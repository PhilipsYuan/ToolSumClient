import require$$0 from 'crypto';

function getDefaultExportFromCjs (x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

var src = {exports: {}};

const crypto = require$$0;

function sha1 (buf, cb) {
  const hash = sha1sync(buf);
  process.nextTick(function () {
    cb(hash);
  });
}

function sha1sync (buf) {
  return crypto.createHash('sha1')
      .update(buf)
      .digest('hex')
}

src.exports = sha1;
var sync = src.exports.sync = sha1sync;

var srcExports = src.exports;
var index = /*@__PURE__*/getDefaultExportFromCjs(srcExports);

export { index as default, sync };
