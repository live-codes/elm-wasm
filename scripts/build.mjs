/** Bundles the browser playground (src/main.js -> public/bundle.js). */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

await build({
  absWorkingDir: root,
  entryPoints: ["src/main.js"],
  bundle: true,
  format: "esm",
  target: ["es2022"],
  platform: "browser",
  outfile: "public/bundle.js",
  sourcemap: true,
  logLevel: "info",
});

console.log("Built public/bundle.js");
