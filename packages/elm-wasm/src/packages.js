/**
 * Client-side Elm package installer.
 *
 * Given `author/package[ @version]`, downloads the package's `elm.json` and
 * sources from a CDN (see `sources.js`) and writes them into the compiler's
 * virtual file system, recursing into the package's Elm dependencies.
 *
 * This is deliberately small — enough to make `import SomePackage` work for the
 * common case. It does not implement Elm's full version solver; see README.md.
 */
import { fetchPackage, getSources } from './sources.js';

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

/** Latest published version of a package (jsDelivr first, GitHub tags fallback). */
export async function latestVersion(name) {
  try {
    const res = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${name}`);
    if (res.ok) {
      const data = await res.json();
      const versions = (data.versions ?? [])
        .map((v) => (typeof v === 'string' ? v : v.version))
        .filter((v) => /^\d+\.\d+\.\d+$/.test(v));
      if (versions.length) return versions.sort(compareVersions).at(-1);
    }
  } catch {
    // fall through to GitHub
  }
  const res = await fetch(`https://api.github.com/repos/${name}/tags?per_page=100`);
  if (!res.ok) throw new Error(`Could not list tags for ${name} (HTTP ${res.status})`);
  const versions = (await res.json())
    .map((tag) => tag.name.replace(/^v/, ''))
    .filter((v) => /^\d+\.\d+\.\d+$/.test(v));
  if (!versions.length) throw new Error(`No version tags found for ${name}`);
  return versions.sort(compareVersions).at(-1);
}

/**
 * Install packages (and their transitive Elm dependencies) so the compiler can
 * import them, then rewrite the application `elm.json`.
 *
 * @param {object} compiler  a compiler from `createElmCompiler`
 * @param {string[]} specs   e.g. `["elm-community/maybe-extra@5.3.0", "mdgriffith/elm-ui"]`
 * @param {object} [options]
 * @param {string|string[]} [options.cdn]  source name(s)/template(s); default jsDelivr → GitHub
 * @returns {Promise<object>} the updated application elm.json
 */
export async function installPackages(compiler, specs, { log = () => {}, cdn, sources = getSources(cdn) } = {}) {
  const base = JSON.parse(compiler.readText('/elm.json'));
  const direct = { ...base.dependencies.direct };
  const indirect = { ...base.dependencies.indirect };
  // Packages the application already depends on — nothing to do.
  const required = new Set([...Object.keys(direct), ...Object.keys(indirect)]);
  // Versions already in the file system (bundled with the compiler, or installed
  // by an earlier compile). Reused for transitive dependencies when they satisfy
  // the constraint, so nothing is downloaded.
  const onDisk = new Map(compiler.listPackages().map((pkg) => [pkg.name, pkg.version]));
  const installed = new Set();

  const queue = [];
  for (const { name, version } of specs.map(parseSpec)) {
    queue.push({ name, version: version ?? (await latestVersion(name)), direct: true });
  }

  while (queue.length) {
    const { name, version, direct: isDirect } = queue.shift();
    if (installed.has(name) || required.has(name)) {
      installed.add(name);
      continue;
    }

    // A package that is already in the file system — bundled with the compiler's
    // precompiled artifacts, or installed by an earlier compile — is usable as
    // it is: making it importable only means declaring the dependency, so
    // nothing is downloaded.
    let elmJson = compiler.readPackageElmJson(name, version);
    if (elmJson) {
      log(`Using bundled ${name}@${version}`);
    } else {
      log(`Installing ${name}@${version}…`);
      const fetched = await fetchPackage(name, version, { sources, log });
      log(`  via ${fetched.source}`);
      elmJson = fetched.elmJson;
      compiler.installPackage({ name, version, elmJson, files: fetched.files });
    }
    installed.add(name);
    if (isDirect) direct[name] = version;
    else indirect[name] = version;

    for (const [dep, constraint] of Object.entries(elmJson.dependencies || {})) {
      if (installed.has(dep) || required.has(dep)) continue;
      let depVersion = direct[dep] ?? indirect[dep];
      if (!depVersion || !satisfies(depVersion, constraint)) {
        const present = onDisk.get(dep);
        depVersion = present && satisfies(present, constraint) ? present : lowerBound(constraint);
      }
      if (!depVersion) throw new Error(`Could not resolve a version for ${dep} (${constraint})`);
      queue.push({ name: dep, version: depVersion, direct: false });
    }
  }

  const next = { ...base, dependencies: { ...base.dependencies, direct, indirect } };
  compiler.setApplicationElmJson(next);
  return next;
}
