import { createCompiler, wrapJsInHtml, ElmCompileError } from '../packages/elm-wasm/src/index.js';

// Package source chain: `?cdn=github` (or a URL template) overrides the default
// jsDelivr -> GitHub fallback. See the package's sources.js.
const cdn = new URLSearchParams(location.search).get('cdn') ?? undefined;

// Where the compiler assets are served from, for the package's `baseUrl` option.
const ASSETS_BASE_URL = './assets/';

const DEFAULT_SOURCE = `module Main exposing (main)

import Browser
import Html exposing (Html, button, div, h1, text)
import Html.Attributes exposing (style)
import Html.Events exposing (onClick)


main : Program () Int Msg
main =
    Browser.sandbox { init = 0, update = update, view = view }


type Msg
    = Increment
    | Decrement


update : Msg -> Int -> Int
update msg model =
    case msg of
        Increment ->
            model + 1

        Decrement ->
            model - 1


view : Int -> Html Msg
view model =
    div [ style "font-family" "sans-serif", style "text-align" "center" ]
        [ h1 [] [ text "Elm in the browser" ]
        , button [ onClick Decrement, style "font-size" "1.5rem" ] [ text "-" ]
        , div [ style "font-size" "2rem" ] [ text (String.fromInt model) ]
        , button [ onClick Increment, style "font-size" "1.5rem" ] [ text "+" ]
        ]
`;

const els = {
  editor: document.getElementById('editor'),
  packages: document.getElementById('packages'),
  importMap: document.getElementById('import-map'),
  run: document.getElementById('run'),
  reset: document.getElementById('reset'),
  status: document.getElementById('status'),
  output: document.getElementById('output'),
  logs: document.getElementById('logs'),
};

let compilerPromise = null;
let outputUrl = null;

function log(message) {
  const line = document.createElement('div');
  line.textContent = message;
  els.logs.append(line);
  els.logs.scrollTop = els.logs.scrollHeight;
}

function setStatus(text, kind = '') {
  els.status.textContent = text;
  els.status.dataset.kind = kind;
}

function getCompiler() {
  compilerPromise ??= (async () => {
    setStatus('Loading compiler…', 'busy');
    const started = performance.now();
    const compiler = await createCompiler({ baseUrl: ASSETS_BASE_URL, cdn, onLog: log });
    log(`Compiler ready in ${(performance.now() - started).toFixed(0)} ms`);
    return compiler;
  })();
  return compilerPromise;
}

function showHtml(html) {
  if (outputUrl) URL.revokeObjectURL(outputUrl);
  outputUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  els.output.src = outputUrl;
}

const escapeHtml = (str) =>
  String(str).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/** Turn the structured Elm problems on an `ElmCompileError` into readable text. */
function formatElmErrors(error) {
  if (Array.isArray(error.errors)) {
    return error.errors
      .map((report) => {
        const header = `${report.name ?? 'Elm'}${report.path ? ` (${report.path})` : ''}`;
        const problems = (report.problems ?? []).map((problem) => {
          const at = problem.region?.start
            ? ` at line ${problem.region.start.line}, column ${problem.region.start.column}`
            : '';
          const message = Array.isArray(problem.message)
            ? problem.message
                .map((part) => (typeof part === 'string' ? part : (part.string ?? '')))
                .join('')
            : String(problem.message ?? '');
          return `${problem.title ?? 'ERROR'}${at}\n${message}`;
        });
        return [header, ...problems].join('\n\n');
      })
      .join('\n\n────────────\n\n');
  }
  return error.message ?? String(error);
}

const errorHtml = (error) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body { font-family: ui-monospace, monospace; padding: 12px; color: #b00020; font-size: 13px; }
pre { white-space: pre-wrap; line-height: 1.45; }
</style></head>
<body><h2>Compilation failed</h2><pre>${escapeHtml(formatElmErrors(error))}</pre></body></html>`;

/** Collect the options from the UI controls. */
function compilerOptions() {
  const packages = (els.packages?.value.trim() ?? '').split(/[\s,]+/).filter(Boolean);
  let importMap;
  const rawImportMap = els.importMap?.value.trim();
  if (rawImportMap) {
    try {
      importMap = JSON.parse(rawImportMap);
    } catch (err) {
      throw new Error(`Import map is not valid JSON: ${err.message}`);
    }
  }
  return { packages, importMap, onLog: log };
}

async function run() {
  els.run.disabled = true;
  try {
    const compiler = await getCompiler();
    setStatus('Compiling…', 'busy');
    const started = performance.now();
    const { js, name } = await compiler.compile(els.editor.value, compilerOptions());
    const ms = (performance.now() - started).toFixed(0);
    log(`Compiled ${name} (${js.length} bytes of JS) in ${ms} ms`);
    setStatus(`Compiled in ${ms} ms`, 'ok');
    showHtml(wrapJsInHtml(js, name));
  } catch (err) {
    if (err instanceof ElmCompileError) {
      setStatus(err.type === 'compile-errors' ? 'Compile errors' : 'Compiler error', 'error');
      log(formatElmErrors(err));
      showHtml(errorHtml(err));
    } else {
      console.error(err);
      setStatus(`Failed: ${err.message}`, 'error');
      log(`Failed: ${err.stack || err.message}`);
    }
  } finally {
    els.run.disabled = false;
  }
}

els.run.addEventListener('click', run);
els.reset.addEventListener('click', () => {
  els.editor.value = DEFAULT_SOURCE;
});
els.editor.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    run();
  }
});

els.editor.value = DEFAULT_SOURCE;
setStatus('Idle — press Run (or Ctrl+Enter)', '');
