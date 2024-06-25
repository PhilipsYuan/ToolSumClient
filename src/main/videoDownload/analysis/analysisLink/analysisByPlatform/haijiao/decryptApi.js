export function decryptApi (n){
    var i, o = (n = n || {}).Base64, s = "2.6.4", a = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", l = function(t) {
      for (var e = {}, n = 0, r = t.length; n < r; n++)
        e[t.charAt(n)] = n;
      return e
    }(a), u = String.fromCharCode, c = function(t) {
      if (t.length < 2) {
        var e = t.charCodeAt(0);
        return e < 128 ? t : e < 2048 ? u(192 | e >>> 6) + u(128 | 63 & e) : u(224 | e >>> 12 & 15) + u(128 | e >>> 6 & 63) + u(128 | 63 & e)
      }
      e = 65536 + 1024 * (t.charCodeAt(0) - 55296) + (t.charCodeAt(1) - 56320);
      return u(240 | e >>> 18 & 7) + u(128 | e >>> 12 & 63) + u(128 | e >>> 6 & 63) + u(128 | 63 & e)
    }, f = /[\uD800-\uDBFF][\uDC00-\uDFFFF]|[^\x00-\x7F]/g, d = function(t) {
      return t.replace(f, c)
    }, h = function(t) {
      var e = [0, 2, 1][t.length % 3]
        , n = t.charCodeAt(0) << 16 | (t.length > 1 ? t.charCodeAt(1) : 0) << 8 | (t.length > 2 ? t.charCodeAt(2) : 0)
        , r = [a.charAt(n >>> 18), a.charAt(n >>> 12 & 63), e >= 2 ? "=" : a.charAt(n >>> 6 & 63), e >= 1 ? "=" : a.charAt(63 & n)];
      return r.join("")
    }, p = n.btoa && "function" == typeof n.btoa ? function(t) {
        return n.btoa(t)
      }
      : function(t) {
        if (t.match(/[^\x00-\xFF]/))
          throw new RangeError("The string contains invalid characters.");
        return t.replace(/[\s\S]{1,3}/g, h)
      }
      , m = function(t) {
      return p(d(String(t)))
    }, y = function(t) {
      return t.replace(/[+\/]/g, (function(t) {
          return "+" == t ? "-" : "_"
        }
      )).replace(/=/g, "")
    }, v = function(t, e) {
      return e ? y(m(t)) : m(t)
    };
    n.Uint8Array && (i = function(t, e) {
        for (var n = "", r = 0, i = t.length; r < i; r += 3) {
          var o = t[r]
            , s = t[r + 1]
            , l = t[r + 2]
            , u = o << 16 | s << 8 | l;
          n += a.charAt(u >>> 18) + a.charAt(u >>> 12 & 63) + ("undefined" != typeof s ? a.charAt(u >>> 6 & 63) : "=") + ("undefined" != typeof l ? a.charAt(63 & u) : "=")
        }
        return e ? y(n) : n
      }
    );
    var g, b = /[\xC0-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}|[\xF0-\xF7][\x80-\xBF]{3}/g, _ = function(t) {
      switch (t.length) {
        case 4:
          var e = (7 & t.charCodeAt(0)) << 18 | (63 & t.charCodeAt(1)) << 12 | (63 & t.charCodeAt(2)) << 6 | 63 & t.charCodeAt(3)
            , n = e - 65536;
          return u(55296 + (n >>> 10)) + u(56320 + (1023 & n));
        case 3:
          return u((15 & t.charCodeAt(0)) << 12 | (63 & t.charCodeAt(1)) << 6 | 63 & t.charCodeAt(2));
        default:
          return u((31 & t.charCodeAt(0)) << 6 | 63 & t.charCodeAt(1))
      }
    }, w = function(t) {
      return t.replace(b, _)
    }, x = function(t) {
      var e = t.length
        , n = e % 4
        , r = (e > 0 ? l[t.charAt(0)] << 18 : 0) | (e > 1 ? l[t.charAt(1)] << 12 : 0) | (e > 2 ? l[t.charAt(2)] << 6 : 0) | (e > 3 ? l[t.charAt(3)] : 0)
        , i = [u(r >>> 16), u(r >>> 8 & 255), u(255 & r)];
      return i.length -= [0, 0, 2, 1][n],
        i.join("")
    }, O = n.atob && "function" == typeof n.atob ? function(t) {
        return n.atob(t)
      }
      : function(t) {
        return t.replace(/\S{1,4}/g, x)
      }
      , C = function(t) {
      return O(String(t).replace(/[^A-Za-z0-9\+\/]/g, ""))
    }, S = function(t) {
      return w(O(t))
    }, k = function(t) {
      return String(t).replace(/[-_]/g, (function(t) {
          return "-" == t ? "+" : "/"
        }
      )).replace(/[^A-Za-z0-9\+\/]/g, "")
    }, E = function(t) {
      return S(k(t))
    };
    if (n.Uint8Array && (g = function(t) {
        return Uint8Array.from(C(k(t)), (function(t) {
            return t.charCodeAt(0)
          }
        ))
      }
    ),
      n.Base64 = {
        VERSION: s,
        atob: C,
        btoa: p,
        fromBase64: E,
        toBase64: v,
        utob: d,
        encode: v,
        encodeURI: function(t) {
          return v(t, !0)
        },
        btou: w,
        decode: E,
        noConflict: function() {
          var t = n.Base64;
          return n.Base64 = o,
            t
        },
        fromUint8Array: i,
        toUint8Array: g
      },
    "function" === typeof Object.defineProperty) {
      var j = function(t) {
        return {
          value: t,
          enumerable: !1,
          writable: !0,
          configurable: !0
        }
      };
      n.Base64.extendString = function() {
        Object.defineProperty(String.prototype, "fromBase64", j((function() {
            return E(this)
          }
        ))),
          Object.defineProperty(String.prototype, "toBase64", j((function(t) {
              return v(this, t)
            }
          ))),
          Object.defineProperty(String.prototype, "toBase64URI", j((function() {
              return v(this, !0)
            }
          )))
      }
    }
  return n
  }
// const d = decryptApi()
// const data = `WlhsS2FtUllUakJpTWpGc1kyeE9iR051V25CWk1sVnBUMmxLYjJGdE1YWmpiVFZ3WW0xa1FXRkhjSFJpTTBwMVlWYzFia3h0VG5aaVUwbHpTVzFTZG1KWFJuQmlhVWsyU1cxb01HUklRbnBQYVRoMllVZHZlVTVFUVRCWk1sRXdXbWsxTUdJelFXbE1RMHByWWpJeGFHRlhOVUpaYmtwMldWZFJhVTlwU205a1NGSjNZM3B2ZGt3elpETmtlVFZ2V1Zkc2NXRlhSblpNYlU1MllsTkpjMGx1U214YWFVazJTV2xKYzBsdVVuWmhNbFoxU1dwdmFWbHRWVFJPUkVVd1QxUm5lazVFVVRKT1IwMTZUMVJuTVUxdFVYcE5la2swVDBST2ExbFVUVEZhYW1OcFRFTktNR1ZZUW14SmFtOTZURU5LTVdNeVZubEphbkEzU1cxc2EwbHFiM2hOVkZGNFRrUlJNazlEZDJsaWJXeHFZVEkxYUdKWFZXbFBhVXh0ZEdKbWIzQTFURzVzUzJwdGFVeGtaazFVUlRCTlZGRXdUbXBuYVV4RFNtaGtiVVl3V1ZoSmFVOXBTVEJPYVVselNXMVNiR015VG5saFdFSXdZVmM1ZFVscWIyazFjbGN6Tmt0bFV6VTJVeXMxV1hrMk5WbGhSalZoTmpVMVlqWkpOWEZQVXpjM2VVMDFObGRrTlhKWE16WkxaVk0xTmxNck5WbDVOalpNWVVzMVdYRmxOa3hoU3pWaFZ6azBORU5EU1dsM2FXUkhPWGRoVjA1RVlqTldkV1JEU1RaTlEzZHBaRzFzYTFwWE9VUmlNMVoxWkVOSk5rMURkMmxaTWpsMFlsZFdkV1JGVG5aa1Z6VXdTV3B2ZUV4RFNtMVpWelY2VVRJNU1XSnVVV2xQYWtGelNXMWFhR1J0T1hsaFdGSnNVVEk1TVdKdVVXbFBhbXR6U1c1T01GbFlVakZqZVVrMlRVTjNhV015VmpSSmFtOTNURU5LTW1GWVFXbFBha0Z6U1c1YWNHTkZWalJqUjJ4NVdsaE9WV0ZYTVd4SmFtOXBUVVJCZDAxVE1IZE5VekIzVFZOQmQwMUViM2ROUkc5M1RVTkpjMGx0VG14amJsSndXbTFzYkZwRFNUWmFiVVp6WXpKVmMwbHRUbXhqYmxKWFlWZFNiR0o1U1RaYWJVWnpZekpWYzBsdFRteGpibEpSWTIwNWJWcFlUbnBpTTBscFQyMWFhR0pJVG14TVEwcHRXVmN4ZG1SWVRXbFBiVnBvWWtoT2JFeERTbTFpTTBwcFlWZFNhMXBYTkdsUGJWcG9Za2hPYkV4RFNqQlpWMlI2U1dwd2RXUlhlSE5NUTBwNVlqSjRiRWxxYjNkTVEwcHJZVmRHZEdJeU5XdFJNamwxWXpOV2RGcFRTVFpOUTNkcFpFZHNNR0pIVldsUGJuTnBZVmRSYVU5cVFYTkpiVFZvWWxkVmFVOXBTV2xNUTBwcVlqSTFlbVJYTVd4SmFtOTNURU5LYW1JeU5YcGtWekZzVWxjMWEwbHFiM2RNUTBwd1dUSTVkVWxxYjJsSmJqQnpTVzFhZVdGWFZuVmFSazR3V1ZoU01XTjVTVFphYlVaell6SlZjMGx1V25aaFYwNXNWVE5TYUdSSVZucEphbkJ0V1ZkNGVscFRkMmxrYld4cldsYzVWR1JIUmpCa1dFMXBUMjFhYUdKSVRteE1RMG95WWpKc2FscFZNWFppYlZZMVZraHNkMXBUU1RaTlEzZHBaRzA1Y0ZreVZrSmlWemt4WW01UmFVOXFRWE5KYmxwd1drZFdkbFJYT1hWYVdHeFZaVmhDYkVscWIzZE1RMG95WVZkU2JHSXdSblJpTTFaMVpFTkpOazFEZDJsYVIxWjNZak5PY0dSRk1YWmliVlkxU1dwdmQweERTbmRoUnpsMVdsTkpOa2xwU1hOSmJsWjZXbGhLUTFsWE5YSkphbkIxWkZkNGMweERTbmRaV0Vwc1ltNVNTbHBEU1RaTlEzZHBXakk1YzFwRFNUWk9VM2RwV2tkc2FHSlhPWFZhUTBrMlRVTjNhV05IUm5wak0yUjJZMjFTVkZwWVVXbFBibEo1WkZkVmMwbHVRbWhsVmtKb1l6Tk9NMkl6U210Vk1sWXdTV3B3YlZsWGVIcGFVM2RwWTBjNWQyUlhlR2hqYld3d1pWTkpOazFVUVhOSmJsSjJZMGRzYWxSSGJISmFWVFV4WWxOSk5rMURkMmxaYld4MVdrWldlbHBZU1dsUGFVbHBURU5LTVdNeVZubGliVVowV2xOSk5rbHViREZaVnpWdFdsZHJhVXhEU214aVYwWndZa05KTmtsdWJERlpWelZ0V2xkck5FOVVSWGxOVkd4QldWZDRjR1ZZVm5WTWJVNTJZbE5KYzBsdFZuUlpWMnh6Vm0xV2VXRlhXbkJhVjFGcFQyMWFhR0pJVG14TVEwcHFZMjFXYUdSSFZsVmhWekZzU1dwdmFVMXFRWGxOVXpCM1QxTXdlVTlUUVhkTlJHOTRUWHB2ZDA1VFNYTkpiWGhvWXpOU1RXSXlaSEJpYkZKd1lsZFZhVTlwU1hsTlJFa3dURlJCTWt4VVNUQkpSRVV4VDJwRk0wOXFRVFJKYVhkcFlrZEdlbVJGZUhaYU1teDFVMWhCYVU5cFNYcE5VelI0VDFSSmRVMXFUVEJNYWtVelRtbEpjMGx0VG14amJsSndXbTFzYkZwRlZqUmpSMng1V2xkUmFVOXRXbWhpU0U1c1RFTkthbHBZU2pCVlNFcDJXbTFXZW1NeU9YbFNXR2gzWVZoS2JGcERTVFphYlVaell6SlZjMGx0VG14amJsSlhZVmRTYkdJd1ZqUmpSMng1V2xkUmFVOXRXbWhpU0U1c1RFTktiMWxZVGtoWlZWWjFXVmRLYzFwWFVXbFBiVnBvWWtoT2JHWlRkMmxrYld4M1dESlNkbUpYUm5CaWFVazJTV2xLT1E9PQ`
// console.log(JSON.parse(d.Base64.decode(d.Base64.decode(d.Base64.decode(data)))))
