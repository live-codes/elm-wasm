/**
 * Where Elm package files come from.
 *
 * Packages live in public Git repos, so a "source" is anything that can map
 * `author/package@version/path` to a URL and (optionally) list a package's
 * files. jsDelivr mirrors GitHub, has a file-listing API, and is not rate
 * limited like the GitHub API — so it is the default, with GitHub as a
 * fallback. Inspired by LiveCodes' `services/modules.ts` CDN list + fallback.
 *
 * A source:
 *   { id, fileUrl(name, version, path), listFiles?(name, version) }
 */

// --- jsDelivr -----------------------------------------------------------------

const flattenTree = (nodes, prefix = '') => {
  const paths = [];
  for (const node of nodes || []) {
    const full = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === 'directory') paths.push(...flattenTree(node.files, full));
    else paths.push(full);
  }
  return paths;
};

const jsdelivrHost = (host) => ({
  id: host === 'cdn.jsdelivr.net' ? 'jsdelivr' : `${host.replace(/\..*/, '')}.jsdelivr`,
  fileUrl: (name, version, path) => `https://${host}/gh/${name}@${version}/${path}`,
  async listFiles(name, version) {
    const res = await fetch(`https://data.jsdelivr.com/v1/packages/gh/${name}@${version}`);
    if (!res.ok) throw new Error(`jsDelivr listing failed (HTTP ${res.status})`);
    const data = await res.json();
    return flattenTree(data.files);
  },
});

export const jsdelivr = jsdelivrHost('cdn.jsdelivr.net');
export const fastlyJsdelivr = jsdelivrHost('fastly.jsdelivr.net');
export const gcoreJsdelivr = jsdelivrHost('gcore.jsdelivr.net');
export const bCdnJsdelivr = jsdelivrHost('jsdelivr.b-cdn.net');

// --- GitHub -------------------------------------------------------------------

export const github = {
  id: 'github',
  fileUrl: (name, version, path) => `https://raw.githubusercontent.com/${name}/${version}/${path}`,
  async listFiles(name, version) {
    const res = await fetch(`https://api.github.com/repos/${name}/git/trees/${version}?recursive=1`);
    if (!res.ok) throw new Error(`GitHub tree API failed (HTTP ${res.status})`);
    const tree = await res.json();
    return (tree.tree ?? []).filter((entry) => entry.type === 'blob').map((entry) => entry.path);
  },
};

// --- statically ---------------------------------------------------------------

export const statically = {
  id: 'statically',
  fileUrl: (name, version, path) => `https://cdn.statically.io/gh/${name}/${version}/${path}`,
  // No listing API — paths are derived from the package's exposed modules.
};

// --- custom template ----------------------------------------------------------

/** A source from a URL template with {name}, {version} and {path} placeholders. */
export const templateSource = (template) => ({
  id: `template(${template})`,
  fileUrl: (name, version, path) =>
    template.replaceAll('{name}', name).replaceAll('{version}', version).replaceAll('{path}', path),
});

const NAMED = {
  jsdelivr,
  github,
  statically,
  'fastly.jsdelivr': fastlyJsdelivr,
  'gcore.jsdelivr': gcoreJsdelivr,
  'jsdelivr.b-cdn': bCdnJsdelivr,
};

export const sourceNames = Object.keys(NAMED);

const DEFAULT_CHAIN = ['jsdelivr', 'github'];

/**
 * Resolve a `cdn` setting (name, template, or array of either) into an ordered
 * list of sources. Anything specified comes first; the defaults follow as
 * fallbacks.
 */
export function getSources(cdn) {
  const requested = cdn === undefined || cdn === null || cdn === '' ? [] : Array.isArray(cdn) ? cdn : [cdn];
  const sources = [];
  const seen = new Set();
  const add = (source) => {
    if (source && !seen.has(source.id)) {
      seen.add(source.id);
      sources.push(source);
    }
  };
  for (const item of requested) {
    add(NAMED[item] ?? (typeof item === 'string' && item.includes('{') ? templateSource(item) : null));
  }
  for (const id of DEFAULT_CHAIN) add(NAMED[id]);
  return sources;
}

// --- package fetching ---------------------------------------------------------

/** Module names -> `src/<Module/Path>.elm` (best effort when a source can't list). */
const derivePaths = (elmJson) => {
  const exposed = elmJson['exposed-modules'];
  const modules = Array.isArray(exposed) ? exposed : Object.values(exposed ?? {}).flat();
  return modules.map((name) => `src/${name.split('.').join('/')}.elm`);
};

/**
 * Download a package's manifest and sources.
 *
 * @returns {Promise<{ elmJson: object, files: Record<string, string>, source: string }>}
 */
export async function fetchPackage(name, version, { sources = getSources(), log } = {}) {
  const errors = [];
  for (const source of sources) {
    try {
      const elmRes = await fetch(source.fileUrl(name, version, 'elm.json'));
      if (!elmRes.ok) throw new Error(`elm.json: HTTP ${elmRes.status}`);
      const elmJson = await elmRes.json();

      // Prefer a real file listing; fall back to deriving paths from exposed modules.
      let paths;
      try {
        paths = source.listFiles ? await source.listFiles(name, version) : derivePaths(elmJson);
      } catch (err) {
        errors.push(`${source.id} list: ${err.message}`);
        paths = derivePaths(elmJson);
      }

      const files = {};
      await Promise.all(
        paths
          .filter((path) => path.startsWith('src/'))
          .map(async (path) => {
            const res = await fetch(source.fileUrl(name, version, path));
            if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
            files[path] = await res.text();
          }),
      );
      return { elmJson, files, source: source.id };
    } catch (err) {
      errors.push(`${source.id}: ${err.message}`);
      log?.(`  ${source.id} could not provide ${name}@${version} (${err.message})`);
    }
  }
  throw new Error(`Could not fetch ${name}@${version} (${errors.join('; ')})`);
}

// --- URL parsing --------------------------------------------------------------

const URL_PATTERNS = [
  /^https?:\/\/cdn\.jsdelivr\.net\/gh\/([^/@]+\/[^/@]+)@([^/]+)\/(.+)$/i,
  /^https?:\/\/(?:fastly|gcore|testingcf)\.jsdelivr\.net\/gh\/([^/@]+\/[^/@]+)@([^/]+)\/(.+)$/i,
  /^https?:\/\/jsdelivr\.b-cdn\.net\/gh\/([^/@]+\/[^/@]+)@([^/]+)\/(.+)$/i,
  /^https?:\/\/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\/([^/]+)\/(.+)$/i,
  /^https?:\/\/cdn\.statically\.io\/gh\/([^/]+\/[^/]+)\/([^/]+)\/(.+)$/i,
];

/**
 * Extract `{ name, version, path }` from a URL on a known GitHub mirror.
 * Used by import maps so a plain module -> URL entry still identifies a package.
 */
export function packageFromUrl(url) {
  for (const pattern of URL_PATTERNS) {
    const match = pattern.exec(url || '');
    if (match) return { name: match[1], version: match[2], path: match[3] };
  }
  return null;
}
