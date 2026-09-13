/**
 * A minimal, GitHub-backed Elm package installer.
 *
 * Elm package sources are not served by package.elm-lang.org, but every
 * published package has a public Git repo tagged with its version, and GitHub
 * sends `Access-Control-Allow-Origin: *`. So the browser can fetch a package's
 * `elm.json` and `src/` directly.
 *
 * This is deliberately small — enough to make `import SomePackage` work for the
 * common case. It does not implement Elm's full version solver; see README.md.
 */

const GITHUB_API = 'https://api.github.com';
const GITHUB_RAW = 'https://raw.githubusercontent.com';

const compareVersions = (a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
};

/** Parse `"author/package"` or `"author/package@1.2.3"`. */
export function parseSpec(spec) {
  const [name, version] = spec.trim().split('@');
  if (!/^[\w.-]+\/[\w.-]+$/.test(name || '')) throw new Error(`Invalid package spec: "${spec}"`);
  if (version && !/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Invalid version in "${spec}"`);
  return { name, version };
}

/** Does `version` satisfy an Elm constraint like `"1.0.0 <= v < 2.0.0"`? */
export function satisfies(version, constraint) {
  const m = /^\s*(\d+\.\d+\.\d+)\s*<=\s*v\s*<\s*(\d+\.\d+\.\d+)\s*$/.exec(constraint || '');
  if (!m) return true; // no constraint we understand — don't block
  return compareVersions(version, m[1]) >= 0 && compareVersions(version, m[2]) < 0;
}

const lowerBound = (constraint) => /(\d+\.\d+\.\d+)\s*<=/.exec(constraint || '')?.[1] ?? null;

async function latestVersion(name) {
  const res = await fetch(`${GITHUB_API}/repos/${name}/tags?per_page=100`);
  if (!res.ok) throw new Error(`Could not list tags for ${name} (HTTP ${res.status})`);
  const versions = (await res.json())
    .map((tag) => tag.name.replace(/^v/, ''))
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v));
  if (!versions.length) throw new Error(`No version tags found for ${name}`);
  return versions.sort(compareVersions).at(-1);
}

async function fetchElmJson(name, version) {
  const res = await fetch(`${GITHUB_RAW}/${name}/${version}/elm.json`);
  if (!res.ok) throw new Error(`Could not fetch elm.json for ${name}@${version} (HTTP ${res.status})`);
  return res.json();
}

async function fetchSources(name, version) {
  const res = await fetch(`${GITHUB_API}/repos/${name}/git/trees/${version}?recursive=1`);
  if (!res.ok) throw new Error(`Could not list files for ${name}@${version} (HTTP ${res.status})`);
  const tree = await res.json();
  const paths = (tree.tree || [])
    .filter((entry) => entry.type === 'blob' && entry.path.startsWith('src/'))
    .map((entry) => entry.path);
  const files = {};
  await Promise.all(
    paths.map(async (path) => {
      const raw = await fetch(`${GITHUB_RAW}/${name}/${version}/${path}`);
      if (!raw.ok) throw new Error(`Could not fetch ${name}@${version}/${path} (HTTP ${raw.status})`);
      files[path] = await raw.text();
    }),
  );
  return files;
}

/**
 * Install packages (and their transitive Elm dependencies) so the compiler can
 * import them, then rewrite the application `elm.json`.
 *
 * @param {object} compiler  a compiler from `createElmCompiler`
 * @param {string[]} specs   e.g. `["elm-community/maybe-extra@5.3.0", "mdgriffith/elm-ui"]`
 * @returns {Promise<object>} the updated application elm.json
 */
export async function installPackages(compiler, specs, { log = () => {} } = {}) {
  const base = JSON.parse(compiler.readText('/elm.json'));
  const direct = { ...base.dependencies.direct };
  const indirect = { ...base.dependencies.indirect };
  // Packages shipped with the compiler's package artifacts — no need to fetch.
  const preinstalled = new Set([...Object.keys(direct), ...Object.keys(indirect)]);
  const installed = new Set();

  const queue = [];
  for (const { name, version } of specs.map(parseSpec)) {
    queue.push({ name, version: version ?? (await latestVersion(name)), direct: true });
  }

  while (queue.length) {
    const { name, version, direct: isDirect } = queue.shift();
    if (installed.has(name) || preinstalled.has(name)) {
      installed.add(name);
      continue;
    }

    log(`Installing ${name}@${version}…`);
    const [elmJson, files] = await Promise.all([fetchElmJson(name, version), fetchSources(name, version)]);
    compiler.installPackage({ name, version, elmJson, files });
    installed.add(name);
    if (isDirect) direct[name] = version;
    else indirect[name] = version;

    for (const [dep, constraint] of Object.entries(elmJson.dependencies || {})) {
      if (installed.has(dep) || preinstalled.has(dep)) continue;
      let depVersion = direct[dep] ?? indirect[dep];
      if (!depVersion || !satisfies(depVersion, constraint)) depVersion = lowerBound(constraint);
      if (!depVersion) throw new Error(`Could not resolve a version for ${dep} (${constraint})`);
      queue.push({ name: dep, version: depVersion, direct: false });
    }
  }

  const next = { ...base, dependencies: { ...base.dependencies, direct, indirect } };
  compiler.setApplicationElmJson(next);
  return next;
}
