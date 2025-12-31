import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));

const isWatch = process.argv.includes("--watch");
const outdir = "dist";

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (!entry.name.endsWith(".ts")) fs.copyFileSync(s, d);
  }
}

function rimraf(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyStatic() {
  fs.mkdirSync(outdir, { recursive: true });
  fs.copyFileSync("src/manifest.json", path.join(outdir, "manifest.json"));
  copyDir("src/sidepanel", path.join(outdir, "sidepanel"));
}

const common = {
  bundle: true,
  sourcemap: true,
  target: "es2020",
  format: "iife",
  platform: "browser",
  define: {
    __BRIDGE_VERSION__: JSON.stringify(pkg.version)
  }
};

const entryPoints = {
  background: "src/background.ts",
  contentScript: "src/contentScript.ts",
  injected: "src/injected.ts",
  "sidepanel/sidepanel": "src/sidepanel/sidepanel.ts"
};

const copyPlugin = {
  name: "copy-static",
  setup(build) {
    build.onStart(() => {
      copyStatic();
    });
  }
};

async function buildOnce() {
  rimraf(outdir);
  copyStatic();
  await esbuild.build({
    ...common,
    entryPoints,
    outdir
  });
}

if (isWatch) {
  rimraf(outdir);
  copyStatic();

  const ctx = await esbuild.context({
    ...common,
    entryPoints,
    outdir,
    plugins: [copyPlugin]
  });

  await ctx.watch();
  console.log("Watching... (dist/ updates on changes)");
} else {
  await buildOnce();
  console.log("Build complete: dist/");
}
