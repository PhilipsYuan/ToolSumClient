import require$$0 from 'crypto';

function getDefaultExportFromCjs (x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var randombytes = require$$0.randomBytes;

var index = /*@__PURE__*/getDefaultExportFromCjs(randombytes);

export { index as default };
