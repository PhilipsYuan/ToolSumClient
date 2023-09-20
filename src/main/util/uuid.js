import require$$0 from 'crypto';

function getDefaultExportFromCjs (x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var dist = {};

var v1$1 = {};

var rng$1 = {};

Object.defineProperty(rng$1, "__esModule", {
    value: true
});
rng$1.default = rng;

var _crypto$2 = _interopRequireDefault$b(require$$0);

function _interopRequireDefault$b(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const rnds8Pool = new Uint8Array(256); // # of random values to pre-allocate

let poolPtr = rnds8Pool.length;

function rng() {
    if (poolPtr > rnds8Pool.length - 16) {
        _crypto$2.default.randomFillSync(rnds8Pool);

        poolPtr = 0;
    }

    return rnds8Pool.slice(poolPtr, poolPtr += 16);
}

var stringify$1 = {};

var validate$1 = {};

var regex = {};

Object.defineProperty(regex, "__esModule", {
    value: true
});
regex.default = void 0;
var _default$c = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;
regex.default = _default$c;

Object.defineProperty(validate$1, "__esModule", {
    value: true
});
validate$1.default = void 0;

var _regex = _interopRequireDefault$a(regex);

function _interopRequireDefault$a(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function validate(uuid) {
    return typeof uuid === 'string' && _regex.default.test(uuid);
}

var _default$b = validate;
validate$1.default = _default$b;

Object.defineProperty(stringify$1, "__esModule", {
    value: true
});
stringify$1.default = void 0;

var _validate$2 = _interopRequireDefault$9(validate$1);

function _interopRequireDefault$9(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
const byteToHex = [];

for (let i = 0; i < 256; ++i) {
    byteToHex.push((i + 0x100).toString(16).substr(1));
}

function stringify(arr, offset = 0) {
    // Note: Be careful editing this code!  It's been tuned for performance
    // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
    const uuid = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase(); // Consistency check for valid UUID.  If this throws, it's likely due to one
    // of the following:
    // - One or more input array values don't map to a hex octet (leading to
    // "undefined" in the uuid)
    // - Invalid input values for the RFC `version` or `variant` fields

    if (!(0, _validate$2.default)(uuid)) {
        throw TypeError('Stringified UUID is invalid');
    }

    return uuid;
}

var _default$a = stringify;
stringify$1.default = _default$a;

Object.defineProperty(v1$1, "__esModule", {
    value: true
});
v1$1.default = void 0;

var _rng$1 = _interopRequireDefault$8(rng$1);

var _stringify$2 = _interopRequireDefault$8(stringify$1);

function _interopRequireDefault$8(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html
let _nodeId;

let _clockseq; // Previous uuid creation time


let _lastMSecs = 0;
let _lastNSecs = 0; // See https://github.com/uuidjs/uuid for API details

function v1(options, buf, offset) {
    let i = buf && offset || 0;
    const b = buf || new Array(16);
    options = options || {};
    let node = options.node || _nodeId;
    let clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq; // node and clockseq need to be initialized to random values if they're not
    // specified.  We do this lazily to minimize issues related to insufficient
    // system entropy.  See #189

    if (node == null || clockseq == null) {
        const seedBytes = options.random || (options.rng || _rng$1.default)();

        if (node == null) {
            // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
            node = _nodeId = [seedBytes[0] | 0x01, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
        }

        if (clockseq == null) {
            // Per 4.2.2, randomize (14 bit) clockseq
            clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
        }
    } // UUID timestamps are 100 nano-second units since the Gregorian epoch,
    // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
    // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
    // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.


    let msecs = options.msecs !== undefined ? options.msecs : Date.now(); // Per 4.2.1.2, use count of uuid's generated during the current clock
    // cycle to simulate higher resolution clock

    let nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1; // Time since last uuid creation (in msecs)

    const dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000; // Per 4.2.1.2, Bump clockseq on clock regression

    if (dt < 0 && options.clockseq === undefined) {
        clockseq = clockseq + 1 & 0x3fff;
    } // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
    // time interval


    if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
        nsecs = 0;
    } // Per 4.2.1.2 Throw error if too many uuids are requested


    if (nsecs >= 10000) {
        throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
    }

    _lastMSecs = msecs;
    _lastNSecs = nsecs;
    _clockseq = clockseq; // Per 4.1.4 - Convert from unix epoch to Gregorian epoch

    msecs += 12219292800000; // `time_low`

    const tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
    b[i++] = tl >>> 24 & 0xff;
    b[i++] = tl >>> 16 & 0xff;
    b[i++] = tl >>> 8 & 0xff;
    b[i++] = tl & 0xff; // `time_mid`

    const tmh = msecs / 0x100000000 * 10000 & 0xfffffff;
    b[i++] = tmh >>> 8 & 0xff;
    b[i++] = tmh & 0xff; // `time_high_and_version`

    b[i++] = tmh >>> 24 & 0xf | 0x10; // include version

    b[i++] = tmh >>> 16 & 0xff; // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)

    b[i++] = clockseq >>> 8 | 0x80; // `clock_seq_low`

    b[i++] = clockseq & 0xff; // `node`

    for (let n = 0; n < 6; ++n) {
        b[i + n] = node[n];
    }

    return buf || (0, _stringify$2.default)(b);
}

var _default$9 = v1;
v1$1.default = _default$9;

var v3$1 = {};

var v35 = {};

var parse$1 = {};

Object.defineProperty(parse$1, "__esModule", {
    value: true
});
parse$1.default = void 0;

var _validate$1 = _interopRequireDefault$7(validate$1);

function _interopRequireDefault$7(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function parse(uuid) {
    if (!(0, _validate$1.default)(uuid)) {
        throw TypeError('Invalid UUID');
    }

    let v;
    const arr = new Uint8Array(16); // Parse ########-....-....-....-............

    arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
    arr[1] = v >>> 16 & 0xff;
    arr[2] = v >>> 8 & 0xff;
    arr[3] = v & 0xff; // Parse ........-####-....-....-............

    arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
    arr[5] = v & 0xff; // Parse ........-....-####-....-............

    arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
    arr[7] = v & 0xff; // Parse ........-....-....-####-............

    arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
    arr[9] = v & 0xff; // Parse ........-....-....-....-############
    // (Use "/" to avoid 32-bit truncation when bit-shifting high-order bytes)

    arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000 & 0xff;
    arr[11] = v / 0x100000000 & 0xff;
    arr[12] = v >>> 24 & 0xff;
    arr[13] = v >>> 16 & 0xff;
    arr[14] = v >>> 8 & 0xff;
    arr[15] = v & 0xff;
    return arr;
}

var _default$8 = parse;
parse$1.default = _default$8;

Object.defineProperty(v35, "__esModule", {
    value: true
});
v35.default = _default$7;
v35.URL = v35.DNS = void 0;

var _stringify$1 = _interopRequireDefault$6(stringify$1);

var _parse = _interopRequireDefault$6(parse$1);

function _interopRequireDefault$6(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function stringToBytes(str) {
    str = unescape(encodeURIComponent(str)); // UTF8 escape

    const bytes = [];

    for (let i = 0; i < str.length; ++i) {
        bytes.push(str.charCodeAt(i));
    }

    return bytes;
}

const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
v35.DNS = DNS;
const URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
v35.URL = URL;

function _default$7(name, version, hashfunc) {
    function generateUUID(value, namespace, buf, offset) {
        if (typeof value === 'string') {
            value = stringToBytes(value);
        }

        if (typeof namespace === 'string') {
            namespace = (0, _parse.default)(namespace);
        }

        if (namespace.length !== 16) {
            throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
        } // Compute hash of namespace and value, Per 4.3
        // Future: Use spread syntax when supported on all platforms, e.g. `bytes =
        // hashfunc([...namespace, ... value])`


        let bytes = new Uint8Array(16 + value.length);
        bytes.set(namespace);
        bytes.set(value, namespace.length);
        bytes = hashfunc(bytes);
        bytes[6] = bytes[6] & 0x0f | version;
        bytes[8] = bytes[8] & 0x3f | 0x80;

        if (buf) {
            offset = offset || 0;

            for (let i = 0; i < 16; ++i) {
                buf[offset + i] = bytes[i];
            }

            return buf;
        }

        return (0, _stringify$1.default)(bytes);
    } // Function#name is not settable on some platforms (#270)


    try {
        generateUUID.name = name; // eslint-disable-next-line no-empty
    } catch (err) {} // For CommonJS default export support


    generateUUID.DNS = DNS;
    generateUUID.URL = URL;
    return generateUUID;
}

var md5$1 = {};

Object.defineProperty(md5$1, "__esModule", {
    value: true
});
md5$1.default = void 0;

var _crypto$1 = _interopRequireDefault$5(require$$0);

function _interopRequireDefault$5(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function md5(bytes) {
    if (Array.isArray(bytes)) {
        bytes = Buffer.from(bytes);
    } else if (typeof bytes === 'string') {
        bytes = Buffer.from(bytes, 'utf8');
    }

    return _crypto$1.default.createHash('md5').update(bytes).digest();
}

var _default$6 = md5;
md5$1.default = _default$6;

Object.defineProperty(v3$1, "__esModule", {
    value: true
});
v3$1.default = void 0;

var _v$1 = _interopRequireDefault$4(v35);

var _md = _interopRequireDefault$4(md5$1);

function _interopRequireDefault$4(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const v3 = (0, _v$1.default)('v3', 0x30, _md.default);
var _default$5 = v3;
v3$1.default = _default$5;

var v4$1 = {};

Object.defineProperty(v4$1, "__esModule", {
    value: true
});
v4$1.default = void 0;

var _rng = _interopRequireDefault$3(rng$1);

var _stringify = _interopRequireDefault$3(stringify$1);

function _interopRequireDefault$3(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function v4(options, buf, offset) {
    options = options || {};

    const rnds = options.random || (options.rng || _rng.default)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`


    rnds[6] = rnds[6] & 0x0f | 0x40;
    rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

    if (buf) {
        offset = offset || 0;

        for (let i = 0; i < 16; ++i) {
            buf[offset + i] = rnds[i];
        }

        return buf;
    }

    return (0, _stringify.default)(rnds);
}

var _default$4 = v4;
v4$1.default = _default$4;

var v5$1 = {};

var sha1$1 = {};

Object.defineProperty(sha1$1, "__esModule", {
    value: true
});
sha1$1.default = void 0;

var _crypto = _interopRequireDefault$2(require$$0);

function _interopRequireDefault$2(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function sha1(bytes) {
    if (Array.isArray(bytes)) {
        bytes = Buffer.from(bytes);
    } else if (typeof bytes === 'string') {
        bytes = Buffer.from(bytes, 'utf8');
    }

    return _crypto.default.createHash('sha1').update(bytes).digest();
}

var _default$3 = sha1;
sha1$1.default = _default$3;

Object.defineProperty(v5$1, "__esModule", {
    value: true
});
v5$1.default = void 0;

var _v = _interopRequireDefault$1(v35);

var _sha = _interopRequireDefault$1(sha1$1);

function _interopRequireDefault$1(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const v5 = (0, _v.default)('v5', 0x50, _sha.default);
var _default$2 = v5;
v5$1.default = _default$2;

var nil = {};

Object.defineProperty(nil, "__esModule", {
    value: true
});
nil.default = void 0;
var _default$1 = '00000000-0000-0000-0000-000000000000';
nil.default = _default$1;

var version$1 = {};

Object.defineProperty(version$1, "__esModule", {
    value: true
});
version$1.default = void 0;

var _validate = _interopRequireDefault(validate$1);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function version(uuid) {
    if (!(0, _validate.default)(uuid)) {
        throw TypeError('Invalid UUID');
    }

    return parseInt(uuid.substr(14, 1), 16);
}

var _default = version;
version$1.default = _default;

(function (exports) {

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    Object.defineProperty(exports, "v1", {
        enumerable: true,
        get: function () {
            return _v.default;
        }
    });
    Object.defineProperty(exports, "v3", {
        enumerable: true,
        get: function () {
            return _v2.default;
        }
    });
    Object.defineProperty(exports, "v4", {
        enumerable: true,
        get: function () {
            return _v3.default;
        }
    });
    Object.defineProperty(exports, "v5", {
        enumerable: true,
        get: function () {
            return _v4.default;
        }
    });
    Object.defineProperty(exports, "NIL", {
        enumerable: true,
        get: function () {
            return _nil.default;
        }
    });
    Object.defineProperty(exports, "version", {
        enumerable: true,
        get: function () {
            return _version.default;
        }
    });
    Object.defineProperty(exports, "validate", {
        enumerable: true,
        get: function () {
            return _validate.default;
        }
    });
    Object.defineProperty(exports, "stringify", {
        enumerable: true,
        get: function () {
            return _stringify.default;
        }
    });
    Object.defineProperty(exports, "parse", {
        enumerable: true,
        get: function () {
            return _parse.default;
        }
    });

    var _v = _interopRequireDefault(v1$1);

    var _v2 = _interopRequireDefault(v3$1);

    var _v3 = _interopRequireDefault(v4$1);

    var _v4 = _interopRequireDefault(v5$1);

    var _nil = _interopRequireDefault(nil);

    var _version = _interopRequireDefault(version$1);

    var _validate = _interopRequireDefault(validate$1);

    var _stringify = _interopRequireDefault(stringify$1);

    var _parse = _interopRequireDefault(parse$1);

    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
} (dist));

var index = /*@__PURE__*/getDefaultExportFromCjs(dist);

export { index as default };
