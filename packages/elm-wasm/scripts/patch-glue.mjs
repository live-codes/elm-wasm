/**
 * GHC's post-link glue (`assets/ulm.js`) resolves `setImmediate` with a
 * top-level `await`, which means the module cannot be bundled as IIFE/UMD
 * (esbuild rejects top-level await in non-ESM formats).
 *
 * This rewrites that one expression to resolve lazily on first use. Behaviour is
 * unchanged — the value is only needed when the RTS schedules work — and the
 * ES module also becomes await-free, which is a bonus.
 *
 * The rewrite is anchored on the upstream comment, so a change in the glue
 * format fails the build loudly instead of silently producing a broken bundle.
 */
import { readFile, writeFile } from 'node:fs/promises';

export const PATCH_MARKER = '__elmWasmSetImmediate';

const PATTERN = /\/\/ The actual setImmediate\(\)[\s\S]*?\n\}\)\(\);/;

const REPLACEMENT = `// The actual setImmediate() to be used. This is a ESM module top
// level binding and doesn't pollute the globalThis namespace.
//
// Patched by @live-codes/elm-wasm: resolved on first use rather than with a
// top-level await, so this module can also be bundled as IIFE/UMD.
let ${PATCH_MARKER} = null;
const resolveSetImmediate = () => {
  // https://developer.mozilla.org/en-US/docs/Web/API/Scheduler
  if (globalThis.scheduler) {
    return (cb, ...args) => scheduler.postTask(() => cb(...args));
  }
  // node, bun, or other scripts might have set this up
  if (globalThis.setImmediate) {
    return globalThis.setImmediate;
  }
  // browsers, workers, deno
  const sm = new SetImmediate();
  return (cb, ...args) => sm.setImmediate(cb, ...args);
};
const setImmediate = (cb, ...args) => {
  ${PATCH_MARKER} ??= resolveSetImmediate();
  return ${PATCH_MARKER}(cb, ...args);
};`;

/** @returns {string} the patched source (idempotent) */
export function patchGlue(source) {
  if (source.includes(PATCH_MARKER)) return source;
  if (!PATTERN.test(source)) {
    throw new Error(
      'Could not patch assets/ulm.js: the setImmediate top-level await was not found. ' +
        'The upstream glue format probably changed — update scripts/patch-glue.mjs.',
    );
  }
  return source.replace(PATTERN, REPLACEMENT);
}

/** Patch the glue in place. Returns true if it changed. */
export async function patchGlueFile(file) {
  const source = await readFile(file, 'utf8');
  const patched = patchGlue(source);
  if (patched === source) return false;
  await writeFile(file, patched);
  return true;
}
