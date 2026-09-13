/**
 * Builds a `module -> package` index for the Elm ecosystem.
 *
 * The Elm compiler knows which modules *installed* packages expose, but nothing
 * maps an arbitrary module (e.g. `Maybe.Extra` or `Element`) to the package that
 * provides it. package.elm-lang.org does not expose that as a bulk file and
 * sends no CORS headers, so we build the index here (Node, no CORS) and ship it
 * as a static asset that the browser can fetch.
 *
 *   node scripts/build-module-index.mjs [--limit N] [--concurrency N]
 *
 * Output: public/assets/elm-modules-index.json
 *   { generatedAt, source, count, modules: { "Module.Name": ["author/pkg", "1.2.3"] } }
 *
 * A module can be exposed by several packages. We only keep Elm 0.19 packages
 * and break ties by how many packages depend on each candidate (a decent
 * popularity proxy), then by official-ness and name similarity.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const assetsDir = path.join(root, 'public', 'assets');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};
const limit = arg('limit', Infinity);
const concurrency = arg('concurrency', 24);

const PACKAGES_URL = 'https://package.elm-lang.org/all-packages';

const parseVersion = (v) => v.split('.').map(Number);
const gte = (a, b) => {
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
};

/** Is this package usable with Elm 0.19? (filters out the 0.18-era ecosystem) */
function supportsElm019(elmVersion) {
  const m = /(\d+\.\d+\.\d+)\s*<=\s*v\s*<\s*(\d+\.\d+\.\d+)/.exec(elmVersion || '');
  if (!m) return false;
  const target = [0, 19, 1];
  return gte(target, parseVersion(m[1])) && !gte(target, parseVersion(m[2]));
}

console.log('Fetching package list...');
const allPackages = await (await fetch(PACKAGES_URL)).json();
let entries = Object.entries(allPackages);
if (Number.isFinite(limit)) entries = entries.slice(0, limit);
console.log(`Fetching manifests for ${entries.length} packages (concurrency ${concurrency})...`);

const records = [];
const failures = [];
const startedAt = performance.now();
const queue = [...entries];
let done = 0;

async function worker() {
  while (queue.length) {
    const [name, versions] = queue.shift();
    const version = versions[versions.length - 1];
    const url = `https://package.elm-lang.org/packages/${name}/${version}/elm.json`;
    try {
      let res = await fetch(url);
      if (!res.ok) res = await fetch(url); // one retry
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const elmJson = await res.json();
      if (elmJson.type === 'package' && supportsElm019(elmJson['elm-version'])) {
        const exposed = elmJson['exposed-modules'];
        records.push({
          name,
          version,
          // Usually an array of module names, but kernel packages use an object
          // of kernel groups -> module lists (e.g. { "HTML": ["Html", ...] }).
          modules: Array.isArray(exposed) ? exposed : Object.values(exposed ?? {}).flat(),
          deps: Object.keys(elmJson.dependencies ?? {}),
        });
      }
    } catch (err) {
      failures.push(`${name}@${version}: ${err.message}`);
    }
    done += 1;
    if (done % 500 === 0) {
      const rate = done / ((performance.now() - startedAt) / 1000);
      process.stdout.write(`  ${done}/${entries.length} (${rate.toFixed(0)}/s)\n`);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));

// Popularity proxy: how many indexed packages depend on each package.
const dependents = new Map();
for (const record of records) {
  for (const dep of record.deps) dependents.set(dep, (dependents.get(dep) ?? 0) + 1);
}

const rank = (record) => {
  const official = record.name.startsWith('elm/') ? 2 : record.name.startsWith('elm-explorations/') ? 1 : 0;
  return [dependents.get(record.name) ?? 0, official];
};
const better = (a, b) => {
  const [da, oa] = rank(a);
  const [db, ob] = rank(b);
  if (da !== db) return da > db;
  if (oa !== ob) return oa > ob;
  return a.name < b.name; // deterministic
};

const modules = {};
for (const record of records) {
  for (const moduleName of record.modules) {
    const current = modules[moduleName];
    if (!current || better(record, current)) modules[moduleName] = record;
  }
}

const index = {
  generatedAt: new Date().toISOString(),
  source: PACKAGES_URL,
  count: Object.keys(modules).length,
  modules: Object.fromEntries(
    Object.entries(modules)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([moduleName, record]) => [moduleName, [record.name, record.version]]),
  ),
};

await mkdir(assetsDir, { recursive: true });
const out = path.join(assetsDir, 'elm-modules-index.json');
const serialized = JSON.stringify(index);
await writeFile(out, serialized);

console.log(`\nWrote ${out}`);
console.log(`  ${records.length} Elm 0.19 packages, ${index.count} modules`);
console.log(`  ${(serialized.length / 1e6).toFixed(2)} MB in ${((performance.now() - startedAt) / 1000).toFixed(1)}s`);
if (failures.length) console.log(`  ${failures.length} packages skipped (fetch errors)`);

console.log('\nSanity check:');
for (const m of ['Html', 'Parser', 'Random', 'Maybe.Extra', 'Element', 'Json.Decode.Pipeline', 'List.Extra']) {
  console.log(`  ${m} -> ${JSON.stringify(index.modules[m])}`);
}
