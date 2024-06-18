const func = () => {
  if ("object" != typeof CNTVH5PlayerModule)
    return e;
  var i = 0
    , n = 0
    , r = new Uint8Array
    , a = 0;
  try {
    i = CNTVH5PlayerModule._jsmalloc(e.byteLength + 1024);
    for (var s = 0; s < e.byteLength; s++)
      CNTVH5PlayerModule.HEAP8[i + s] = e[s];
    if (!rt) {
      a = nt.length;
      for (var o = 0; o < a; o++)
        CNTVH5PlayerModule.HEAP8[i + e.byteLength + o] = nt.charCodeAt(o);
      rt = !0
    }
    1 == t && (n = CNTVH5PlayerModule._vodplay(i, e.byteLength, a)),
      r = new Uint8Array(n);
    for (var u = 0; u < r.byteLength; u++)
      r[u] = CNTVH5PlayerModule.HEAP8[i + u];
    CNTVH5PlayerModule._jsfree(i)
  } catch (t) {
    return e
  }
  return CNTVH5PlayerModule._jsfree(i),
    i = null,
    r
}
