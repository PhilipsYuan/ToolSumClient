import {generateWasm} from './wasmGenerate.js'
const CNTVH5PlayerModule = CNTVModule()
export const translateForm = (e, t) => {
  // const CNTVH5PlayerModule = await generateWasm()
  let i = 0;
  let n = 0;
  let r = new Uint8Array;
  const a = 0;
  try {
    i = CNTVH5PlayerModule._jsmalloc(e.byteLength + 1024);
    for (let s = 0; s < e.byteLength; s++) {
      CNTVH5PlayerModule.HEAP8[i + s] = e[s];
    }
    if(1 == t) {
      n = CNTVH5PlayerModule._vodplay(i, e.byteLength, a)
    };
    r = new Uint8Array(n);
    for (let u = 0; u < r.byteLength; u++) {
      r[u] = CNTVH5PlayerModule.HEAP8[i + u];
    }
    CNTVH5PlayerModule._jsfree(i)
  } catch (t) {
    console.log(t)
    return e
  }
  CNTVH5PlayerModule._jsfree(i);
  i = null;
  return r;
}
