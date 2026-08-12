import fs from "node:fs/promises";
import http, { type ServerResponse } from "node:http";
import path from "node:path";
import { watch } from "chokidar";
import mime from "mime-types";
import { buildSite } from "./builder.js";
import { normalizeBasePath } from "./paths.js";
import { LIVE_RELOAD_JS } from "./theme.js";
import type { BuildOptions } from "./types.js";

export interface DevServerOptions extends BuildOptions {
  port?: number;
}

function showBuildResult(pages: number, assets: number, warnings: string[]): void {
  console.log(`Built ${pages} pages and ${assets} assets.`);
  for (const warning of warnings) console.warn(`warning: ${warning}`);
}

export async function startDevServer(options: DevServerOptions): Promise<void> {
  const port = options.port ?? 4173;
  const outputDir = path.resolve(options.outputDir);
  const inputDir = path.resolve(options.inputDir);
  const basePath = normalizeBasePath(options.basePath);
  const buildOptions = { ...options, liveReload: true };
  const initial = await buildSite(buildOptions);
  showBuildResult(initial.pages, initial.assets, initial.warnings);

  const eventStreams = new Set<ServerResponse>();
  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host}`);
      if (requestUrl.pathname === "/__mdpublish/events") {
        response.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        response.write("event: connected\ndata: ready\n\n");
        eventStreams.add(response);
        request.on("close", () => eventStreams.delete(response));
        return;
      }
      if (requestUrl.pathname === "/__mdpublish/reload.js") {
        response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
        response.end(LIVE_RELOAD_JS);
        return;
      }

      let pathname = decodeURIComponent(requestUrl.pathname);
      if (basePath && pathname.startsWith(`${basePath}/`)) {
        pathname = pathname.slice(basePath.length);
      } else if (basePath && pathname === basePath) {
        response.writeHead(308, { Location: `${basePath}/` });
        response.end();
        return;
      }
      const relative = pathname.replace(/^\/+/, "");
      let filePath = path.resolve(outputDir, relative);
      if (!filePath.startsWith(`${outputDir}${path.sep}`) && filePath !== outputDir) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const stats = await fs.stat(filePath).catch(() => undefined);
      if (stats?.isDirectory()) filePath = path.join(filePath, "index.html");
      const file = await fs.readFile(filePath).catch(() => undefined);
      if (!file) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": mime.contentType(path.extname(filePath)) || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      response.end(file);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "0.0.0.0", resolve);
  });
  console.log(`Watching ${inputDir}`);
  console.log(`Server: http://0.0.0.0:${port}${basePath}/`);

  let timer: NodeJS.Timeout | undefined;
  let rebuilding = false;
  let pending = false;
  const rebuild = async (): Promise<void> => {
    if (rebuilding) {
      pending = true;
      return;
    }
    rebuilding = true;
    do {
      pending = false;
      try {
        const result = await buildSite(buildOptions);
        showBuildResult(result.pages, result.assets, result.warnings);
        for (const stream of eventStreams) stream.write("event: reload\ndata: change\n\n");
      } catch (error) {
        console.error(`Build failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } while (pending);
    rebuilding = false;
  };

  const watcher = watch(inputDir, {
    ignored: (candidate) => candidate === outputDir || candidate.startsWith(`${outputDir}${path.sep}`),
    ignoreInitial: true,
  });
  watcher.on("all", () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void rebuild(), 100);
  });

  await new Promise<void>((resolve) => {
    const stop = (): void => {
      void watcher.close();
      for (const stream of eventStreams) stream.end();
      server.close(() => resolve());
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}
