import { createElmCompiler, wrapJsInHtml } from './compiler.js';
import { installPackages } from './packages.js';

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
  run: document.getElementById('run'),
  reset: document.getElementById('reset'),
  status: document.getElementById('status'),
  output: document.getElementById('output'),
  logs: document.getElementById('logs'),
};

let compilerPromise = null;
let outputUrl = null;
let installedPackagesKey = null;

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

const fetchBytes = async (relative) => {
  const url = new URL(relative, import.meta.url).href;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${relative}: HTTP ${res.status}`);
  return res.arrayBuffer();
};

function getCompiler() {
  compilerPromise ??= initCompiler();
  return compilerPromise;
}

async function initCompiler() {
  setStatus('Loading compiler…', 'busy');
  const started = performance.now();
  const [wasmBytes, jsffiModule, artifactsTarGz, elmInitTarGz] = await Promise.all([
    fetchBytes('./assets/ulm.wasm'),
    import(new URL('./assets/ulm.js', import.meta.url).href),
    fetchBytes('./assets/elm-all-examples-package-artifacts.tar.gz'),
    fetchBytes('./assets/elm-init.tar.gz'),
  ]);
  const compiler = await createElmCompiler({
    wasmBytes,
    jsffi: jsffiModule.default,
    artifactsTarGz,
    elmInitTarGz,
    log,
  });
  log(`Compiler ready in ${(performance.now() - started).toFixed(0)} ms`);
  return compiler;
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

/** Turn the compiler's structured errors into readable text. */
function formatElmErrors(result) {
  if (Array.isArray(result.errors)) {
    return result.errors
      .map((err) => {
        const header = `${err.name ?? 'Elm'}${err.path ? ` (${err.path})` : ''}`;
        const problems = (err.problems ?? []).map((problem) => {
          const at = problem.region?.start
            ? ` at line ${problem.region.start.line}, column ${problem.region.start.column}`
            : '';
          const message = Array.isArray(problem.message)
            ? problem.message.map((part) => (typeof part === 'string' ? part : (part.string ?? ''))).join('')
            : String(problem.message ?? '');
          return `${problem.title ?? 'ERROR'}${at}\n${message}`;
        });
        return [header, ...problems].join('\n\n');
      })
      .join('\n\n────────────\n\n');
  }
  if (result.message) return `${result.title ?? 'Error'}\n\n${result.message}`;
  return JSON.stringify(result, null, 2);
}

const errorHtml = (result) => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
body { font-family: ui-monospace, monospace; padding: 12px; color: #b00020; font-size: 13px; }
pre { white-space: pre-wrap; line-height: 1.45; }
</style></head>
<body><h2>Compilation failed</h2><pre>${escapeHtml(formatElmErrors(result))}</pre></body></html>`;

/** Install any packages named in the Packages field (once per change). */
async function ensurePackages(compiler) {
  const raw = els.packages?.value.trim() ?? '';
  if (!raw || raw === installedPackagesKey) return;
  const specs = raw.split(/[\s,]+/).filter(Boolean);
  setStatus('Installing packages…', 'busy');
  await installPackages(compiler, specs, { log });
  installedPackagesKey = raw;
  log(`Installed: ${specs.join(', ')}`);
}

async function run() {
  els.run.disabled = true;
  try {
    const compiler = await getCompiler();
    await ensurePackages(compiler);
    setStatus('Compiling…', 'busy');
    const started = performance.now();
    const result = await compiler.compile(els.editor.value);
    const ms = (performance.now() - started).toFixed(0);

    if (result.type === 'success') {
      log(`Compiled ${result.name} (${result.js.length} bytes of JS) in ${ms} ms`);
      setStatus(`Compiled in ${ms} ms`, 'ok');
      showHtml(wrapJsInHtml(result.js, result.name));
    } else if (result.type === 'compile-errors') {
      setStatus('Compile errors', 'error');
      log(`Compile errors: ${formatElmErrors(result)}`);
      showHtml(errorHtml(result));
    } else {
      setStatus('Compiler error', 'error');
      log(`Compiler error: ${formatElmErrors(result)}`);
      showHtml(errorHtml(result));
    }
  } catch (err) {
    console.error(err);
    setStatus(`Failed: ${err.message}`, 'error');
    log(`Failed: ${err.stack || err.message}`);
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
