#!/usr/bin/env node
/**
 * Check (and optionally bump) the upstream commits pinned in compiler/versions.env.
 *
 * The wasm build tracks a fast-moving fork, so "updating the binaries" is:
 * bump the pins here, rebuild, republish.
 *
 *   node scripts/update-compiler-pins.mjs          # report only
 *   node scripts/update-compiler-pins.mjs --write  # update versions.env
 *   node scripts/update-compiler-pins.mjs --check  # exit 1 if out of date (CI)
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const versionsPath = path.join(root, 'compiler', 'versions.env');

const parseEnv = (text) =>
  Object.fromEntries(
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const i = line.indexOf('=');
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );

const get = async (url) => {
  const res = await fetch(url, { headers: { accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status} ${res.statusText}`);
  return res.json();
};

const text = await readFile(versionsPath, 'utf8');
const current = parseEnv(text);
const repo = (current.ELM_WASM_REPO || '').replace(/\.git$/, '').replace(/^https?:\/\/github\.com\//, '');
const ref = current.ELM_WASM_REF || 'main-wasm';

if (!repo.includes('/')) throw new Error(`Could not parse a GitHub repo from ELM_WASM_REPO="${current.ELM_WASM_REPO}"`);

const api = `https://api.github.com/repos/${repo}`;
const branch = await get(`${api}/branches/${ref}`);
const latestFork = branch.commit.sha;
const tree = await get(`${api}/git/trees/${latestFork}`);
const latestSrc = (tree.tree || []).find((entry) => entry.path === 'elm-src')?.sha;

const updates = [
  {
    key: 'ELM_WASM_COMMIT',
    pinned: current.ELM_WASM_COMMIT,
    latest: latestFork,
    note: `${branch.commit.commit.message.split('\n')[0]} — ${branch.commit.commit.author.date}`,
  },
  {
    key: 'ELM_SRC_COMMIT',
    pinned: current.ELM_SRC_COMMIT,
    latest: latestSrc,
    note: 'elm-src submodule',
  },
];

console.log(`Upstream: ${repo}@${ref}\n`);
let outdated = false;
for (const { key, pinned, latest, note } of updates) {
  const same = pinned && latest && pinned === latest;
  if (!same) outdated = true;
  console.log(`${same ? '  ok  ' : 'stale '} ${key}`);
  console.log(`         pinned: ${pinned}`);
  console.log(`         latest: ${latest}  (${note})`);
}

if (!outdated) {
  console.log('\nAll pins are up to date.');
  process.exit(0);
}

if (process.argv.includes('--write')) {
  let next = text;
  for (const { key, latest } of updates) {
    if (!latest) continue;
    next = next.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${latest}`);
  }
  await writeFile(versionsPath, next);
  console.log(`\nUpdated ${path.relative(root, versionsPath)}. Rebuild with: ./compiler/build.sh`);
} else {
  console.log('\nRun with --write to update compiler/versions.env.');
}

if (process.argv.includes('--check')) process.exit(1);
