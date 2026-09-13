// Classic worker (no module support needed): loads the IIFE build with
// importScripts and compiles Elm.
importScripts('/elm-wasm/index.umd.js');

self.onmessage = async (event) => {
  try {
    const { js, name } = await ElmWasm.compile(event.data, { baseUrl: '/elm-wasm/' });
    self.postMessage({ ok: true, name, bytes: js.length });
  } catch (err) {
    self.postMessage({ ok: false, name: err.name, message: err.message });
  }
};

self.postMessage({ ready: true });
