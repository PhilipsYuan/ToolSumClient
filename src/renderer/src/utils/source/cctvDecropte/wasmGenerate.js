import {arrayBuffer} from "./wasmBuffer.js";

export async function generateWasm () {
  const importObject = {
    'env': {
      abort: () => console.log("abort"),
      jsCall_ii: () => console.log("jsCall_ii"),
      jsCall_iidiiii: () => console.log("jsCall_iidiiii"),
      jsCall_iiii: () => console.log("jsCall_iiii"),
      jsCall_v: () => console.log("jsCall_v"),
      jsCall_vi: () => console.log("jsCall_vi"),
      jsCall_vii: () => console.log("jsCall_vii"),
      ___setErrNo: () => console.log("___setErrNo"),
      ___syscall140: () => console.log("___syscall140"),
      ___syscall146: () => console.log("___syscall146"),
      ___syscall54: () => console.log("___syscall54"),
      ___syscall6: () => console.log("___syscall6"),
      __emscripten_fetch_free: () => console.log("__emscripten_fetch_free"),
      _emscripten_asm_const_ii: () => console.log("_emscripten_asm_const_ii"),
      _emscripten_get_heap_size: () => console.log("_emscripten_get_heap_size"),
      _emscripten_is_main_browser_thread: () => console.log("_emscripten_is_main_browser_thread"),
      _emscripten_memcpy_big: () => console.log("_emscripten_memcpy_big"),
      _emscripten_resize_heap: () => console.log("_emscripten_resize_heap"),
      _emscripten_start_fetch: () => console.log("_emscripten_start_fetch"),
      abortOnCannotGrowMemory: () => console.log("abortOnCannotGrowMemory"),
      setTempRet0: () => console.log("setTempRet0"),
      getTempRet0: () => console.log("getTempRet0"),
      jsCall_jiji: () => console.log("jsCall_jiji"),
      memory: new WebAssembly.Memory({initial: 256, maximum: 256}),
      table: new WebAssembly.Table({initial: 160, element: 'anyfunc'}),
      "tempDoublePtr": 28160,
      "DYNAMICTOP_PTR": 28144,
      "__memory_base": 1024,
      "__table_base": 0
    },
    'global': {
      'NaN': NaN,
      'Infinity': Infinity
    },
    'global.Math': Math,
    'asm2wasm': {
      debugger: () => console.log('debugger info'),
      'f64-rem': function(a, b) {
        return a % b;
      }
    }
  }
  const wasmModule = await WebAssembly.instantiate(arrayBuffer, importObject);
  const wasmInstance = wasmModule.instance.exports
  return wasmInstance
}
