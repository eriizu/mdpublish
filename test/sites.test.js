import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mdpublish-sites-"));
  const vault = path.join(root, "vault");
  await fs.mkdir(path.join(root, "sites"));
  await fs.mkdir(vault);
  await fs.writeFile(path.join(vault, "Home.md"), "# Home article\n");
  await fs.writeFile(path.join(vault, "Other.md"), "# Other article\n");
  await fs.writeFile(path.join(vault, "mdpublish.config.json"), JSON.stringify({
    title: "Vault title",
    welcome: "Home.md",
    navigation: ["Home.md"],
  }));
  const configPath = path.join(root, "sites", "demo.json");
  const profile = {
    vault: "vault",
    build: { out: ".build/demo", base: "/notes/" },
    overrides: {
      title: "Profile title",
      welcome: "Other.md",
      navigation: ["Other.md"],
    },
    publish: { type: "ssh-release", host: "testhost", root: "services/mdpublish/site" },
  };
  await fs.writeFile(configPath, JSON.stringify(profile));
  return { root, vault, configPath, profile, output: path.join(root, ".build", "demo") };
}

function command(root, action, env = process.env) {
  return spawnSync(process.execPath, [cli, "site", action, "demo"], {
    cwd: root,
    env,
    encoding: "utf8",
  });
}

test("site profile overrides vault config field by field", async (context) => {
  const site = await fixture();
  context.after(() => fs.rm(site.root, { recursive: true, force: true }));

  const first = command(site.root, "build");
  assert.equal(first.status, 0, first.stderr);
  const welcome = await fs.readFile(path.join(site.output, "index.html"), "utf8");
  assert.match(welcome, /<title>Other · Profile title<\/title>/);
  assert.match(welcome, /<h1 class="page-title">Other<\/h1>/);
  assert.match(welcome, /href="\/notes\/" aria-current="page">Other<\/a>/);
  assert.doesNotMatch(welcome, /href="\/notes\/home\/">Home<\/a>/);
  await fs.access(path.join(site.output, "home", "index.html"));

  site.profile.overrides = { title: "Only title overridden" };
  await fs.writeFile(site.configPath, JSON.stringify(site.profile));
  const second = command(site.root, "build");
  assert.equal(second.status, 0, second.stderr);
  const inherited = await fs.readFile(path.join(site.output, "index.html"), "utf8");
  assert.match(inherited, /<title>Home · Only title overridden<\/title>/);
  assert.match(inherited, /<h1 class="page-title">Home<\/h1>/);
  assert.match(inherited, /href="\/notes\/" aria-current="page">Home<\/a>/);
});

test("deployment stops on warnings before contacting the host", async (context) => {
  const site = await fixture();
  context.after(() => fs.rm(site.root, { recursive: true, force: true }));
  site.profile.overrides.navigation = ["Missing.md"];
  await fs.writeFile(site.configPath, JSON.stringify(site.profile));
  const result = command(site.root, "deploy");
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /warning: .*sites\/demo\.json: overrides: Navigation entry/);
  const blockedPublish = command(site.root, "publish");
  assert.equal(blockedPublish.status, 1);
  assert.match(blockedPublish.stderr, /build has 1 warnings/);

  site.profile.build.allowWarnings = true;
  await fs.writeFile(site.configPath, JSON.stringify(site.profile));
  const permitted = command(site.root, "build");
  assert.equal(permitted.status, 0, permitted.stderr);
  assert.match(permitted.stderr, /Continuing because build\.allowWarnings is true/);
});

test("publish uploads a built artifact and switches between releases", async (context) => {
  const site = await fixture();
  context.after(() => fs.rm(site.root, { recursive: true, force: true }));
  assert.equal(command(site.root, "build").status, 0);

  const bin = path.join(site.root, "bin");
  await fs.mkdir(bin);
  const remote = path.join(site.root, "remote");
  const remoteSite = path.join(remote, "services", "mdpublish", "site");
  const contents = path.join(remoteSite, "contents");
  await fs.mkdir(contents, { recursive: true });
  await fs.writeFile(path.join(contents, "old.html"), "Previous site");
  await fs.writeFile(path.join(bin, "ssh"), [
    "#!/bin/sh",
    "shift",
    "cd \"$SITE_TEST_REMOTE\"",
    "if [ \"$1\" = 'sh -s' ]; then exec sh -s; fi",
    "exec sh -c \"$1\"",
    "",
  ].join("\n"), { mode: 0o755 });
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    SITE_TEST_REMOTE: remote,
  };
  const result = command(site.root, "publish", env);
  assert.equal(result.status, 0, result.stderr);
  assert.ok((await fs.lstat(contents)).isSymbolicLink());
  const firstRelease = await fs.readlink(contents);
  assert.match(firstRelease, /^releases\//);
  await fs.access(path.join(contents, "index.html"));
  await assert.rejects(fs.access(path.join(contents, ".mdpublish-output")));
  const releases = await fs.readdir(path.join(remoteSite, "releases"));
  const legacy = releases.find((name) => name.startsWith("legacy-"));
  assert.ok(legacy);
  assert.equal(await fs.readFile(path.join(remoteSite, "releases", legacy, "old.html"), "utf8"), "Previous site");

  const second = command(site.root, "publish", env);
  assert.equal(second.status, 0, second.stderr);
  assert.notEqual(await fs.readlink(contents), firstRelease);
  await fs.access(path.join(remoteSite, firstRelease, "index.html"));

  site.profile.build.base = "/different/";
  await fs.writeFile(site.configPath, JSON.stringify(site.profile));
  const stale = command(site.root, "publish");
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /does not match/);
});
