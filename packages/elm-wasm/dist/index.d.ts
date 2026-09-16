/**
 * The Elm compiler, compiled to WebAssembly.
 *
 * Runs in the browser, in a web worker, and in Node. No DOM APIs are used.
 */

/** Structured Elm compiler problem. */
export interface ElmProblem {
  title: string;
  region?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  /** Message parts: plain strings, or `{ string, bold, underline, color }` runs. */
  message: Array<string | { string: string; bold?: boolean; underline?: boolean; color?: string | null }>;
}

export interface ElmErrorReport {
  path?: string;
  name?: string;
  problems: ElmProblem[];
}

/** Thrown by `compile()` when the Elm compiler reports errors. */
export declare class ElmCompileError extends Error {
  readonly type: 'compile-errors' | 'error';
  readonly errors?: ElmErrorReport[];
  readonly result: unknown;
}

/**
 * Render the structured Elm problems as readable text.
 *
 * Elm reports a problem's `message` as a list of parts mixing plain strings with
 * styled runs (`{ string, bold, underline, color }`), so joining it directly
 * stringifies the styled parts as `[object Object]`. This flattens them, keeping
 * the code excerpts, hints and `elm install …` suggestions.
 *
 * Accepts an `ElmCompileError`, anything with an `errors` array, or that array.
 */
export declare function formatError(error: unknown): string;

export type PackageSpec = string;

export interface CompilerOptions {
  /** Where `ulm.wasm` and the data files live. Default: this module's directory. */
  baseUrl?: string;
  /** Provide the compiler module directly instead of fetching it. */
  wasmBytes?: ArrayBuffer | Uint8Array;
  wasmUrl?: string;
  /** Package-data tarballs; loaded from `baseUrl` when omitted. */
  elmInitBytes?: ArrayBuffer | Uint8Array;
  artifactsBytes?: ArrayBuffer | Uint8Array;
  /** Import map applied to every compile: `{ "Module.Name": "url" }` or `{ imports: {...} }`. */
  importMap?: Record<string, string | { url: string; package?: string; version?: string }>;
  /** Packages to install up front, e.g. `['mdgriffith/elm-ui@1.1.8']`. */
  packages?: PackageSpec[];
  /** Package source(s): a name (`'jsdelivr'`, `'github'`, `'statically'`) or a URL template. */
  cdn?: string | string[];
  /** Detect imports in the source and install missing packages. Default `true`. */
  autoInstall?: boolean;
  /** Override the module -> package index used by import detection. */
  moduleIndex?: Record<string, [string, string]>;
  /** Receives the compiler's stdout/stderr. */
  onLog?: (message: string) => void;
}

export interface CompileResult {
  /** The compiled JavaScript (a self-contained Elm program). */
  js: string;
  /** The Elm module name, e.g. `Main`. */
  name: string;
  /**
   * Elm 0.19 removed source-map support, so this is currently always
   * `undefined`. The field exists so it can be populated if that changes.
   */
  map: undefined;
}

export interface Compiler {
  compile(source: string, options?: CompilerOptions): Promise<CompileResult>;
  listPackages(): Array<{ name: string; version: string; modules: string[] }>;
  /**
   * The modules the application can import, i.e. those exposed by the packages
   * listed in its `elm.json`. Packages that are only present in the file system
   * (shipped with the compiler's artifacts) are not importable until they are
   * added to the dependencies.
   */
  listImportableModules(): Set<string>;
  dispose(): void;
}

export declare function createCompiler(options?: CompilerOptions): Promise<Compiler>;

/** Compile with a lazily-created shared instance. */
export declare function compile(source: string, options?: CompilerOptions): Promise<CompileResult>;

export declare const version: string;

/** Wrap compiled Elm JavaScript in a standalone HTML document. */
export declare function wrapJsInHtml(js: string, name: string): string;

/** Module names imported by Elm source (comments stripped). */
export declare function detectImports(source: string): string[];

export declare function resolveImports(options: {
  imports: string[];
  available: Set<string>;
  index?: Record<string, [string, string]>;
}): { needed: Array<{ module: string; package: string; version: string }>; unresolved: string[] };

export declare function autoInstallImports(
  compiler: unknown,
  source: string,
  options?: CompilerOptions & { index?: unknown },
): Promise<{ imports: string[]; installed: string[]; unresolved: string[] }>;

export declare function installPackages(
  compiler: unknown,
  specs: PackageSpec[],
  options?: CompilerOptions,
): Promise<unknown>;

export declare function installFromImportMap(
  compiler: unknown,
  importMap: unknown,
  options?: CompilerOptions,
): Promise<{ installed: string[]; overridden: string[]; unresolved: string[] }>;

export declare function parseImportMap(input: unknown): Array<{
  module: string;
  url: string;
  package?: string;
  version?: string;
}>;

export declare const sourceNames: string[];
export declare function getSources(cdn?: string | string[]): Array<{ id: string }>;
export declare function parseSpec(spec: string): { name: string; version?: string };
export declare function satisfies(version: string, constraint: string): boolean;
export declare function latestVersion(name: string): Promise<string>;
export declare function packageFromUrl(url: string): { name: string; version: string; path: string } | null;
export declare function fetchPackage(
  name: string,
  version: string,
  options?: { sources?: unknown[]; log?: (message: string) => void },
): Promise<{ elmJson: unknown; files: Record<string, string>; source: string }>;

/** Asset file names, relative to `baseUrl`. */
export declare const ASSET_FILES: {
  wasm: string;
  elmInit: string;
  artifacts: string;
  moduleIndex: string;
};

export declare function resolveBaseUrl(baseUrl?: string): string;
export declare function assetUrl(
  name: string,
  options?: { baseUrl?: string; explicit?: string },
): string;

export declare function createElmCompiler(options: {
  wasmBytes: ArrayBuffer | Uint8Array;
  jsffi: (exports: Record<string, unknown>) => Record<string, unknown>;
  artifactsTarGz?: ArrayBuffer | Uint8Array;
  elmInitTarGz?: ArrayBuffer | Uint8Array;
  log?: (message: string) => void;
}): Promise<unknown>;
