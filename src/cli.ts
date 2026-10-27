#!/usr/bin/env node
import path from "node:path";
import { buildSite } from "./builder.js";
import { publishSite } from "./publish.js";
import { startDevServer } from "./server.js";
import { loadSiteProfile, profileFingerprint } from "./site-profiles.js";

const HELP = `mdpublish — publish a Markdown folder as a static site

Usage:
  mdpublish build [folder] [options]
  mdpublish dev [folder] [options]
  mdpublish site build <name>
  mdpublish site publish <name>
  mdpublish site deploy <name>

Options:
  -o, --out <folder>   Output folder (default: site)
  -t, --title <title>  Site title (default: input folder name)
  -b, --base <path>    URL base path, for example /notes/ (default: /)
  -p, --port <number>  Development server port (default: 4173)
  -h, --help           Show this help
`;

interface Arguments {
  command: "build" | "dev";
  inputDir: string;
  outputDir: string;
  title?: string;
  basePath?: string;
  port?: number;
}

async function siteCommand(argv: string[]): Promise<void> {
  const [action, name, ...extra] = argv;
  if (!name || extra.length || !["build", "publish", "deploy"].includes(action)) {
    throw new Error("Use site build, site publish, or site deploy followed by a site name");
  }
  const profile = await loadSiteProfile(name);
  if (action === "build" || action === "deploy") {
    const result = await buildSite({
      inputDir: profile.vault,
      outputDir: profile.build.out,
      basePath: profile.build.base,
      configOverrides: profile.overrides,
      configOverridesLabel: `${profile.configPath}: overrides`,
      profileFingerprint: profileFingerprint(profile),
    });
    console.log(`Built ${result.pages} pages and ${result.assets} assets in ${result.outputDir}`);
    for (const warning of result.warnings) console.warn(`warning: ${warning}`);
    if (result.warnings.length && !profile.build.allowWarnings) {
      process.exitCode = 2;
      return;
    }
    if (result.warnings.length) console.warn("Continuing because build.allowWarnings is true");
  }
  if (action === "publish" || action === "deploy") await publishSite(profile);
}

function parseArguments(argv: string[]): Arguments | undefined {
  if (!argv.length || argv.includes("--help") || argv.includes("-h")) return undefined;
  const command = argv.shift();
  if (command !== "build" && command !== "dev") {
    throw new Error(`Unknown command “${command ?? ""}”. Use build or dev.`);
  }

  let inputDir = ".";
  let outputDir = "site";
  let title: string | undefined;
  let basePath: string | undefined;
  let port: number | undefined;
  if (argv[0] && !argv[0].startsWith("-")) inputDir = argv.shift()!;

  while (argv.length) {
    const option = argv.shift()!;
    const value = argv.shift();
    if (!value || value.startsWith("-")) throw new Error(`Missing value for ${option}`);
    if (option === "--out" || option === "-o") outputDir = value;
    else if (option === "--title" || option === "-t") title = value;
    else if (option === "--base" || option === "-b") basePath = value;
    else if (option === "--port" || option === "-p") {
      port = Number(value);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`Invalid port: ${value}`);
      }
    } else throw new Error(`Unknown option: ${option}`);
  }

  return {
    command,
    inputDir: path.resolve(inputDir),
    outputDir: path.resolve(outputDir),
    title,
    basePath,
    port,
  };
}

async function main(): Promise<void> {
  if (process.argv[2] === "site") {
    await siteCommand(process.argv.slice(3));
    return;
  }
  const args = parseArguments(process.argv.slice(2));
  if (!args) {
    console.log(HELP);
    return;
  }
  if (args.command === "dev") {
    await startDevServer(args);
    return;
  }
  const result = await buildSite(args);
  console.log(
    `Built ${result.pages} page${result.pages === 1 ? "" : "s"} and ${result.assets} asset${result.assets === 1 ? "" : "s"} in ${result.outputDir}`,
  );
  for (const warning of result.warnings) console.warn(`warning: ${warning}`);
  if (result.warnings.length) process.exitCode = 2;
}

main().catch((error) => {
  console.error(`mdpublish: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
