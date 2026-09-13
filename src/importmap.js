/**
 * Import maps for Elm modules.
 *
 * An import map is JSON that points modules at specific URLs, e.g.
 *
 *   {
 *     "imports": {
 *       "Maybe.Extra": "https://cdn.jsdelivr.net/gh/elm-community/maybe-extra@5.3.0/src/Maybe/Extra.elm",
 *       "Element": {
 *         "url": "https://example.com/forks/Element.elm",
 *         "package": "mdgriffith/elm-ui",
 *         "version": "1.1.8"
 *       }
 *     }
 *   }
 *
 * The Elm compiler only accepts imports that come from an installed *package*,
 * and it validates `author/name@version` against its registry — so a URL alone
 * is not enough. Each entry therefore needs a published package identity, which
 * we take from the entry itself, from the URL (jsDelivr / raw.githubusercontent
 * / statically pattern), or from the module index. The package is installed as
 * usual and the mapped module's file is then overwritten with the URL's content.
 */
import { installPackages } from './packages.js';
import { getSources, packageFromUrl } from './sources.js';

const moduleToPath = (moduleName) => `src/${moduleName.split('.').join('/')}.elm`;

/**
 * Normalise import map JSON into `[{ module, url, package?, version? }]`.
 * Accepts `{ imports: {...} }`, `{ modules: {...} }`, or a bare `{ module: url }`.
 */
export function parseImportMap(input) {
  const raw = typeof input === 'string' ? JSON.parse(input) : input;
  const imports = raw?.imports ?? raw?.modules ?? raw;
  const entries = [];
  for (const [moduleName, value] of Object.entries(imports ?? {})) {
    if (typeof value === 'string') {
      entries.push({ module: moduleName, url: value });
    } else if (value && typeof value === 'object' && typeof value.url === 'string') {
      entries.push({
        module: moduleName,
        url: value.url,
        package: value.package ?? value.name,
        version: value.version,
      });
    }
  }
  return entries;
}

/**
 * Install the packages referenced by an import map and apply the URL overrides.
 *
 * @param {object} compiler
 * @param {string|object|Array} input  import map JSON, or parsed entries
 * @param {object} [options]
 * @returns {Promise<{ installed: string[], overridden: string[], unresolved: string[] }>}
 */
export async function installFromImportMap(
  compiler,
  input,
  { index, cdn, sources = getSources(cdn), log = () => {} } = {},
) {
  const entries = Array.isArray(input) ? input : parseImportMap(input);
  const byPackage = new Map();
  const unresolved = [];

  for (const entry of entries) {
    let { package: name, version } = entry;
    if (!name || !version) {
      const fromUrl = packageFromUrl(entry.url);
      name ??= fromUrl?.name;
      version ??= fromUrl?.version;
    }
    if ((!name || !version) && index?.[entry.module]) {
      [name, version] = [name ?? index[entry.module][0], version ?? index[entry.module][1]];
    }
    if (!name || !version) {
      unresolved.push(entry.module);
      continue;
    }
    const key = `${name}@${version}`;
    if (!byPackage.has(key)) byPackage.set(key, { name, version, modules: [] });
    byPackage.get(key).modules.push(entry);
  }

  const available = new Set(compiler.listPackages().map((pkg) => `${pkg.name}@${pkg.version}`));
  const installed = [...byPackage.values()]
    .map((pkg) => `${pkg.name}@${pkg.version}`)
    .filter((spec) => !available.has(spec));

  if (installed.length) {
    log(`Import map: installing ${installed.join(', ')}`);
    await installPackages(compiler, installed, { sources, log });
  }

  // Make sure every referenced package is declared as a dependency.
  const elmJson = JSON.parse(compiler.readText('/elm.json'));
  let changed = false;
  for (const { name, version } of byPackage.values()) {
    if (elmJson.dependencies.direct[name] !== version) {
      elmJson.dependencies.direct[name] = version;
      changed = true;
    }
  }
  if (changed) compiler.setApplicationElmJson(elmJson);

  // Apply the module -> URL overrides.
  const overridden = [];
  for (const { name, version, modules } of byPackage.values()) {
    for (const { module: moduleName, url } of modules) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const source = await res.text();
        compiler.writeFile(`/elm-home/0.19.1/packages/${name}/${version}/${moduleToPath(moduleName)}`, source);
        overridden.push(moduleName);
        log(`Import map: ${moduleName} ← ${url}`);
      } catch (err) {
        unresolved.push(moduleName);
        log(`Import map: could not load ${moduleName} (${err.message})`);
      }
    }
  }

  return { installed, overridden, unresolved };
}
