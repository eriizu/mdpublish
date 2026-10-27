import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { profileFingerprint, type SiteProfile } from "./site-profiles.js";

async function finished(child: ChildProcess, command: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    child.once("error", (error) => reject(new Error(`Could not run ${command}: ${error.message}`)));
    child.once("close", (code) => code === 0
      ? resolve()
      : reject(new Error(`${command} exited with status ${code ?? "unknown"}`)));
  });
}

async function run(command: string, args: string[], input?: string): Promise<void> {
  const child = spawn(command, args, {
    stdio: [input === undefined ? "inherit" : "pipe", "inherit", "inherit"],
  });
  if (input !== undefined) child.stdin?.end(input);
  await finished(child, command);
}

async function uploadDirectory(source: string, host: string, releasePath: string): Promise<void> {
  const archive = spawn("tar", ["-C", source, "--exclude=./.mdpublish-output", "-cf", "-", "."], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  const remote = spawn("ssh", [host, `mkdir -p -- ${quote(releasePath)} && tar -C ${quote(releasePath)} -xf -`], {
    stdio: ["pipe", "inherit", "inherit"],
  });
  archive.stdout.pipe(remote.stdin);
  remote.stdin.on("error", () => {});
  await Promise.all([finished(archive, "tar"), finished(remote, "ssh")]);
}

function quote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export async function publishSite(profile: SiteProfile): Promise<void> {
  if (!profile.publish) throw new Error(`${profile.configPath}: no publish target is configured`);
  const markerPath = path.join(profile.build.out, ".mdpublish-output");
  let marker: { profileFingerprint?: string; warningCount?: number };
  try {
    marker = JSON.parse(await fs.readFile(markerPath, "utf8"));
  } catch {
    throw new Error(`Build the ${profile.name} site before publishing: ${markerPath} is missing or invalid`);
  }
  if (!marker || marker.profileFingerprint !== profileFingerprint(profile)) {
    throw new Error(`The build in ${profile.build.out} does not match the ${profile.name} site config; build it again`);
  }
  if (typeof marker.warningCount !== "number" || !Number.isInteger(marker.warningCount) || marker.warningCount < 0) {
    throw new Error(`The build in ${profile.build.out} has no valid warning count; build it again`);
  }
  if (marker.warningCount && !profile.build.allowWarnings) {
    throw new Error(`The ${profile.name} build has ${marker.warningCount} warnings; fix them or set build.allowWarnings before publishing`);
  }
  await fs.access(path.join(profile.build.out, "index.html"));

  const { host, root } = profile.publish;
  const release = `${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${randomBytes(4).toString("hex")}`;
  const releasePath = `${root}/releases/${release}`;
  await uploadDirectory(profile.build.out, host, releasePath);
  await run("ssh", [host, "sh -s"], [
    "set -eu",
    `cd ${quote(root)}`,
    "if [ -e contents ] && [ ! -d contents ] && [ ! -L contents ]; then",
    "  echo 'contents must be a directory or symlink' >&2",
    "  exit 1",
    "fi",
    "if [ -d contents ] && [ ! -L contents ]; then",
    `  mv -- contents ${quote(`releases/legacy-${release}`)}`,
    "fi",
    `ln -s -- ${quote(`releases/${release}`)} ${quote(`.contents-${release}`)}`,
    `mv -Tf -- ${quote(`.contents-${release}`)} contents`,
    "",
  ].join("\n"));
  console.log(`Published ${profile.name} to ${host}:${root}/contents (${release})`);
}
