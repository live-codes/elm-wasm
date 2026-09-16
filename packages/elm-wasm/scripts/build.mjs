/**
 * Bundles the package into `dist/`:
 *
 *   index.js        bundled + minified ESM (WASI shim + tarball reader + JSFFI glue)
 *   index.umd.js    the same as an IIFE build, exposing `globalThis.ElmWasm`
 *   *.map
 *   index.d.ts
 *   ulm.wasm        the compiler
 *   *.tar.gz        package data
 *   elm-modules-index.json
 *
 *   node scripts/build.mjs
 */
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { patchGlueFile } from "./patch-glue.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = path.join(root, "dist");
const assetsDir = path.join(root, "assets");

const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));

const required = ["ulm.wasm", "ulm.js"];
for (const name of required) {
  const info = await stat(path.join(assetsDir, name)).catch(() => null);
  if (!info?.size) {
    throw new Error(
      `Missing assets/${name}. Run \`npm run fetch-assets\` first (see README).`,
    );
  }
}

// A top-level await in the glue would make the IIFE build impossible.
if (await patchGlueFile(path.join(assetsDir, "ulm.js"))) {
  console.log("patched assets/ulm.js (setImmediate resolved lazily)");
}

await mkdir(dist, { recursive: true });

/**
 * Replace the `'__VERSION__'` placeholder in `src/index.js` with the real
 * version. esbuild's `define` cannot do this: it substitutes identifiers, not
 * the contents of string literals, so the placeholder would ship as-is.
 */
const versionPlugin = (version) => ({
  name: "version-placeholder",
  setup(pluginBuild) {
    pluginBuild.onLoad({ filter: /src[\\/]index\.js$/ }, async (args) => ({
      contents: (await readFile(args.path, "utf8")).replace(
        "'__VERSION__'",
        JSON.stringify(version),
      ),
      loader: "js",
    }));
  },
});

const shared = {
  absWorkingDir: root,
  entryPoints: ["src/index.js"],
  bundle: true,
  platform: "browser",
  target: ["es2022"],
  minify: true,
  sourcemap: true,
  legalComments: "none",
  plugins: [versionPlugin(pkg.version)],
  logLevel: "warning",
};

console.log(`Bundling @live-codes/elm-wasm@${pkg.version}…`);
const esm = await build({
  ...shared,
  outfile: "dist/index.js",
  format: "esm",
  metafile: true,
});

// IIFE build for <script> tags and importScripts() in classic workers.
await build({
  ...shared,
  outfile: "dist/index.umd.js",
  format: "iife",
  globalName: "ElmWasm",
});

// Types and runtime assets.
await copyFile(
  path.join(root, "types", "index.d.ts"),
  path.join(dist, "index.d.ts"),
);

const assets = [
  "ulm.wasm",
  "elm-init.tar.gz",
  "elm-all-examples-package-artifacts.tar.gz",
  "elm-modules-index.json",
];
for (const name of assets) {
  const src = path.join(assetsDir, name);
  if ((await stat(src).catch(() => null))?.size) {
    await copyFile(src, path.join(dist, name));
  }
}

// Sanity check: the bundle should only pull from src/, node_modules/ and the
// JSFFI glue (which lives in assets/).
const bundled = Object.keys(esm.metafile.outputs["dist/index.js"].inputs);
const allowed = (f) =>
  !f ||
  f.startsWith("src/") ||
  f === "assets/ulm.js" ||
  f.includes("node_modules/");
const suspects = bundled.filter((f) => !allowed(f));
if (suspects.length)
  throw new Error(`Unexpected bundle inputs: ${suspects.join(", ")}`);

const files = [
  "index.js",
  "index.js.map",
  "index.umd.js",
  "index.umd.js.map",
  "index.d.ts",
  "ulm.wasm",
  "elm-init.tar.gz",
  "elm-all-examples-package-artifacts.tar.gz",
  "elm-modules-index.json",
];

console.log("\ndist/:");
let total = 0;
for (const name of files) {
  const info = await stat(path.join(dist, name)).catch(() => null);
  if (!info) continue;
  total += info.size;
  console.log(
    `  ${name.padEnd(46)} ${(info.size / 1024).toFixed(1).padStart(9)} kB`,
  );
}
console.log(
  `  ${"total".padEnd(46)} ${(total / 1024 / 1024).toFixed(2).padStart(9)} MB`,
);
console.log(
  `\n(${Object.keys(esm.metafile.inputs).length} inputs bundled.)`,
);
