// Runs the compiler inside a web worker. No DOM APIs are used here.
import { createCompiler } from '/elm-wasm/index.js';

let compilerPromise = null;
const getCompiler = () => (compilerPromise ??= createCompiler({ baseUrl: '/elm-wasm/' }));

self.onmessage = async (event) => {
  try {
    const compiler = await getCompiler();
    const { js, name, map } = await compiler.compile(event.data);
    self.postMessage({ ok: true, name, bytes: js.length, hasMap: typeof map !== 'undefined', js });
  } catch (err) {
    self.postMessage({
      ok: false,
      name: err.name,
      message: err.message,
      errors: err.errors,
    });
  }
};

self.postMessage({ ready: true });
