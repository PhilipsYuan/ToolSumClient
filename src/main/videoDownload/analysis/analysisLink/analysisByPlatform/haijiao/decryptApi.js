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
// const cc = 'WlhsS01HSXpRbkJaTUd4clNXcHZlRTE2WXpCT2VtTXdURU5LTVdNeVZubEphbkEzU1cxc2EwbHFiM2xOUkZsNFRucG5ORTU1ZDJsaWJXeHFZVEkxYUdKWFZXbFBhVXh0ZEdKbWIzQTFTbVpOYWtFeVRWUmpORTlFWTJsTVEwcG9aRzFHTUZsWVNXbFBhVWt6VFVOSmMwbHVXbkJqUTBrMlRVTjNhVmt5Vm5sa1IyeHRZVmRXYTBscWNHMVpWM2g2V2xOM2FWa3lWbmxrUmxwd1drZFdka2xxY0cxWlYzaDZXbE4zYVZreVZubGtSa0o1WWpKYWJHTXpUblpqYVVrMldtMUdjMk15VlhOSmJWcG9ZbGM1TVdONVNUWmFiVVp6WXpKVmMwbHRVbkJaVnpGMlltMVNSR0l5Tlhwa1Z6RnNTV3B2ZDB4RFNqQmhXRkp6V2xOSk5tVjVTbkJhUTBrMlRVTjNhV0p0Um5SYVUwazJTV2xKYzBsdFRuWmliazR4WWxkVmFVOXFRWE5KYlU1MlltNU9NV0pYVmtaaWJWRnBUMnBCYzBsdGJHcGlNalJwVDJsSmFXWllNSE5KYlRWMldrZFZhVTl1YzJsaWJUbHJXbFZzYTBscWIzaFBSRkZ6U1c1Q2FHTnRWblZrUld4clNXcHZlVTVEZDJsaWJVWjBXbE5KTmtsMVlYbHZaV2wyYm1WaFNuWjFhWFp1VTBselNXMXNhbUl5TkdsUGFVcHZaRWhTZDJONmIzWk1NbWh4WTBkc2FreHRhSEZqUjFwc1RWTTFhbUl5TUhaaFIzQjZaRWM1ZVZwVE9YcGxXRTR3V2xjd2RtSnRPV3RhVXpsMVlqSlNiR0ZYTVc1WWVrVTBUa1k0ZUU1cVRYbFBWR3QzVG1wbk1reHVRblZhZVVselNXNU9kbU51VWs5aWVVazJUbXBCYzBsdFVteGpNazU1WVZoQ01HRlhPWFZKYW05cFdFaFZkMDFFVG1walJuZ3hUVVJCZWxwbFlYbHZaV2wyYm1WaFNuWjFhWFp1WlZNM2NHVlhTV2gxVXpaeEsyVlZiaXRoTUhVclV6UnlaV0ZZYjA5VE5uVjFhWFpwWldsMmRFOWxZV2hQWVZodlQya3lieXNyT0dwUFYydHhaVzF3Y2s5cGFHcFBaWEIxZFdWaGFFOXBSV3RsWVRCdWRXVmhhRTloWkhZclYyUnNLMDlCWjNWaGMyOTFhUzlxZFZkcmNDdFhkWFIxVjNoc1pXVlBjMDlwU0hGMVZ6TnpaV1ZoYUU5WGQyb3JZVmh2VDJreWJ5dFhTV2gxVXpaeEsyVnZaMDlYYkdnclYxQndUMkZCY1hWbFlXaFBiVmh5ZFcxcGJVOHJPR3BQWVdOcFpXRXpjMlZYTm5CMVpXRm9UMmx1WjJWcGJtOHJUMEZuYkhneFRVUkJlbGw1T1hkWVNGVjNUVVJPYkVscGQybGFSMng2WTBkNGFHVlRTVFpOVTNkcFpHMXNkMVJIYkhSaFdGRnBUMnBCYzBsdFZqUmtSMVo1WW0xR2MxZ3pWbmxpUTBrMlNXbEtPVXhEU2pCWlYyUjZTV3B3ZFdSWGVITk1RMG93WVZoU2MxcFRTVFpKZFZkM2FpdGhSR2hsVXl0dksyRkhhU3RUTkdwbFV6bHFLMU0yYUhWbFluUlBZVTl3WlZkamNVOVhUMnhsWVVwblQyRlVhbVZ0UVhaRFNYTkpibEkxWTBkVmFVOXFRWE5KYlRGMlltMVdOVmd6VWpWalIxVnBUMnBCYzBsdGVIQmtSMVpFWWpJMU1GcFhOVEJKYW05cFNXbDNhV0pIUm5wa1JVNTJZbGN4YkdKdVVsVmhWekZzU1dwdmFVMXFRWGxPUXpCM1Rta3dlVTFwUVhkUFZHOHdUbnB2TUU5RFNYTkpibHB3V2xoa1JHSXpWblZrUTBrMlRYcGplVTU2U1hOSmJVNTJZbGN4YkdKdVVrUmlNMVoxWkVOSk5rMXFSWE5KYlhod1lUSldSR0l6Vm5Wa1EwazJUMFJKYzBsdVRqQlpXRkl4WTNsSk5rMURkMmxaTTBwc1dWaFNiRlpIYkhSYVUwazJTV3BKZDAxcVVYUk5SRmwwVFZSSlowMVVhelpOYWxrMlRVUkZhVXhEU21oa1NGSm9XVEpvZEZwWE5UQmplVWsyVnpOemFXRlhVV2xQYW1kNlRVUmplVTVxVVhOSmJrcHNZbGM1TUZwV1ZubGlRMGsyU1dsSmMwbHRUbWhrUjFadVlqTktOVWxxYjJsa2JXeHJXbGM0YVV4RFNucGtSMFl3WkZoTmFVOXFSWE5KYlU1MlpHMVdlVlpZU25OSmFtOXBZVWhTTUdOSVRUWk1lVGt3V2xoT01FeHRhSEZaYlZFMFRVTTFNR0l6UVhaaFIzQjZaRWM1ZVZwVE9USmhWMUpzWW5rNGVVMUVTVEJOUkZsNFRXazRORmt5VFhsT1YwNW9XbGRWTWs5RVozcE5hbXhyVGtSak0xcHFhelJOYWtFelRsUm9iRTlVWkdwWmVUaDVUMFJOTUUxcVkzVmhia0pzV25rMU1HVklVV2xtVmpCelNXMXNlbGd5VG5sYVYwWjBTV3B3YlZsWGVIcGFVM2RwWVZoT1ptUkhPWGRKYW5CdFdWZDRlbHBUZDJsaFdFNW1Zek5XYVdNeVRubGhWMHBzU1dwd2JWbFhlSHBhVTNkcFlWaE9abUZIT1RCSmFuQnRXVmQ0ZWxwVGQybGhXRTVtWWpOS2NGb3liSFZaVjNkcFQyMWFhR0pJVG14TVEwcDVXbGN4YUdOdGRIcEphbTlwU1dsM2FXUkhPWGRTV0doM1lWaEtiR014VW5CaVYxVnBUMmxKZDAxRVFYaE1WRUY0VEZSQmVFbEVRWGRQYWtGM1QycEJkMGxwZDJsaFIwWjZWbTFzYTFwWE9HbFBiVnBvWWtoT2JFeERTbTlaV0U1UllWZE5hVTl0V21oaVNFNXNURU5LYjFsWVRrSmtWMUp3WW5sSk5scHRSbk5qTWxWelNXMU9NV051U214aWJsSldZekpXZVZWSVZubFpNbWhvWXpKV2EwbHFjRzFaVjNoNldsTjNhVmt5T1hWa1IxWjFaRU5KTmtsc2VERk5SRUY2V1RKb01HSlhlR05rVkVGM1RUSldZMlJVUVhkTk1rNXZXbGRHYTFoSVZYZE5SRTVzV0VoVmQwMUVUbXBNTW1oc1dWZFNZMlJVUVhkTk1sWmpaRlJCZDAweVRtbGlNbEkxV0VoVmQwMUVUbXhZU0ZWM1RVUk9hbU5HZURGTlJFRjZXbFo0TVUxRVFYcFpNMXB3V2tkV2RrbElUbmxaZWpGalNXeDNhVWxIVW1oa1IwVjBZVmRST1ZoRFNUUk5la0V6VFdwWk1GaERTbU5rVkVGM1RUSldZMlJVUVhkTk1rMTJaRzFzYTFwWE9XTmtWRUYzVFRKV1kyUlVRWGROTWsxMlkwWjRNVTFFUVhwYVZuZ3hUVVJCZWxsNU9XbGlNbEkxV0VoVmQwMUVUbXhZU0ZWM1RVUk9ha3d5YURCaVYzaGpaRlJCZDAweVZXbE1RMHA1V2xoa2FHTnRVV2xQYlRVeFlrZDNjMGx1VG1oaVIxVnBUMjAxTVdKSGQzTkpibHB3V2xoa1JHSXpWblZrUms0d1kybEpOa2xxYXpWTGVVbHpTVzFPZG1KWE1XeGlibEpFWWpOV2RXUkdUakJqYVVrMlNXeDRNVTFFUVhoT1UwbHpTVzFTZG1JelNucEphbkIxWkZkNGMweERTbTFpTW5ocldsaEtTbHBEU1RaaWJsWnpZa2d3UFE9PQ=='
// console.log(JSON.parse(d.Base64.decode(d.Base64.decode(d.Base64.decode(cc)))))
