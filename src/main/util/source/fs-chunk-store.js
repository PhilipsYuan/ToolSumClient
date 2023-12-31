import require$$0 from 'fs';
import require$$1 from 'os';
import require$$2 from 'run-parallel';
import require$$3 from 'path';
import require$$4 from 'queue-microtask';
import require$$5 from './random-access-file';
import require$$6 from 'randombytes';
import require$$7 from 'thunky';

function getDefaultExportFromCjs (x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
}

/*! fs-chunk-store. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */

var src = Storage;

const fs = require$$0;
const os = require$$1;
const parallel = require$$2;
const path = require$$3;
const queueMicrotask = require$$4;
const raf = require$$5;
const randombytes = require$$6;
const thunky = require$$7;

let TMP;
try {
    TMP = fs.statSync('/tmp') && '/tmp';
} catch (err) {
    TMP = os.tmpdir();
}

function Storage (chunkLength, opts) {
    const self = this;
    if (!(self instanceof Storage)) return new Storage(chunkLength, opts)
    if (!opts) opts = {};

    self.chunkLength = Number(chunkLength);
    if (!self.chunkLength) throw new Error('First argument must be a chunk length')
    self.name = opts.name || path.join('fs-chunk-store', randombytes(20).toString('hex'));
    self.addUID = opts.addUID;

    if (opts.files) {
        self.path = opts.path;
        if (!Array.isArray(opts.files)) {
            throw new Error('`files` option must be an array')
        }
        self.files = opts.files.map(function (file, i, files) {
            if (file.path == null) throw new Error('File is missing `path` property')
            if (file.length == null) throw new Error('File is missing `length` property')
            if (file.offset == null) {
                if (i === 0) {
                    file.offset = 0;
                } else {
                    const prevFile = files[i - 1];
                    file.offset = prevFile.offset + prevFile.length;
                }
            }
            let newPath = file.path;
            if (self.path) {
                newPath = self.addUID ? path.resolve(path.join(self.path, self.name, file.path)) : path.resolve(path.join(self.path, file.path));
            }
            return { path: newPath, length: file.length, offset: file.offset }
        });
        self.length = self.files.reduce(function (sum, file) { return sum + file.length }, 0);
        if (opts.length != null && opts.length !== self.length) {
            throw new Error('total `files` length is not equal to explicit `length` option')
        }
    } else {
        const len = Number(opts.length) || Infinity;
        self.files = [{
            offset: 0,
            path: path.resolve(opts.path || path.join(TMP, self.name)),
            length: len
        }];
        self.length = len;
    }

    self.chunkMap = [];
    self.closed = false;

    self.files.forEach(function (file) {
        file.open = thunky(function (cb) {
            if (self.closed) return cb(new Error('Storage is closed'))
            fs.mkdir(path.dirname(file.path), { recursive: true }, function (err) {
                if (err) return cb(err)
                if (self.closed) return cb(new Error('Storage is closed'))
                cb(null, raf(file.path));
            });
        });
    });

    // If the length is Infinity (i.e. a length was not specified) then the store will
    // automatically grow.

    if (self.length !== Infinity) {
        self.lastChunkLength = (self.length % self.chunkLength) || self.chunkLength;
        self.lastChunkIndex = Math.ceil(self.length / self.chunkLength) - 1;

        self.files.forEach(function (file) {
            const fileStart = file.offset;
            const fileEnd = file.offset + file.length;

            const firstChunk = Math.floor(fileStart / self.chunkLength);
            const lastChunk = Math.floor((fileEnd - 1) / self.chunkLength);

            for (let p = firstChunk; p <= lastChunk; ++p) {
                const chunkStart = p * self.chunkLength;
                const chunkEnd = chunkStart + self.chunkLength;

                const from = (fileStart < chunkStart) ? 0 : fileStart - chunkStart;
                const to = (fileEnd > chunkEnd) ? self.chunkLength : fileEnd - chunkStart;
                const offset = (fileStart > chunkStart) ? 0 : chunkStart - fileStart;

                if (!self.chunkMap[p]) self.chunkMap[p] = [];

                self.chunkMap[p].push({
                    from,
                    to,
                    offset,
                    file
                });
            }
        });
    }
}

Storage.prototype.put = function (index, buf, cb) {
    const self = this;
    if (typeof cb !== 'function') cb = noop;
    if (self.closed) return nextTick(cb, new Error('Storage is closed'))

    const isLastChunk = (index === self.lastChunkIndex);
    if (isLastChunk && buf.length !== self.lastChunkLength) {
        return nextTick(cb, new Error('Last chunk length must be ' + self.lastChunkLength))
    }
    if (!isLastChunk && buf.length !== self.chunkLength) {
        return nextTick(cb, new Error('Chunk length must be ' + self.chunkLength))
    }

    if (self.length === Infinity) {
        self.files[0].open(function (err, file) {
            if (err) return cb(err)
            file.write(index * self.chunkLength, buf, cb);
        });
    } else {
        const targets = self.chunkMap[index];
        if (!targets) return nextTick(cb, new Error('no files matching the request range'))
        const tasks = targets.map(function (target) {
            return function (cb) {
                target.file.open(function (err, file) {
                    if (err) return cb(err)
                    file.write(target.offset, buf.slice(target.from, target.to), cb);
                });
            }
        });
        parallel(tasks, cb);
    }
};

Storage.prototype.get = function (index, opts, cb) {
    const self = this;
    if (typeof opts === 'function') return self.get(index, null, opts)
    if (self.closed) return nextTick(cb, new Error('Storage is closed'))

    const chunkLength = (index === self.lastChunkIndex)
        ? self.lastChunkLength
        : self.chunkLength;

    const rangeFrom = (opts && opts.offset) || 0;
    const rangeTo = (opts && opts.length) ? rangeFrom + opts.length : chunkLength;

    if (rangeFrom < 0 || rangeFrom < 0 || rangeTo > chunkLength) {
        return nextTick(cb, new Error('Invalid offset and/or length'))
    }

    if (self.length === Infinity) {
        if (rangeFrom === rangeTo) return nextTick(cb, null, Buffer.from(0))
        self.files[0].open(function (err, file) {
            if (err) return cb(err)
            const offset = (index * self.chunkLength) + rangeFrom;
            file.read(offset, rangeTo - rangeFrom, cb);
        });
    } else {
        let targets = self.chunkMap[index];
        if (!targets) return nextTick(cb, new Error('no files matching the request range'))
        if (opts) {
            targets = targets.filter(function (target) {
                return target.to > rangeFrom && target.from < rangeTo
            });
            if (targets.length === 0) {
                return nextTick(cb, new Error('no files matching the requested range'))
            }
        }
        if (rangeFrom === rangeTo) return nextTick(cb, null, Buffer.from(0))

        const tasks = targets.map(function (target) {
            return function (cb) {
                let from = target.from;
                let to = target.to;
                let offset = target.offset;

                if (opts) {
                    if (to > rangeTo) to = rangeTo;
                    if (from < rangeFrom) {
                        offset += (rangeFrom - from);
                        from = rangeFrom;
                    }
                }

                target.file.open(function (err, file) {
                    if (err) return cb(err)
                    file.read(offset, to - from, cb);
                });
            }
        });

        parallel(tasks, function (err, buffers) {
            if (err) return cb(err)
            cb(null, Buffer.concat(buffers));
        });
    }
};

Storage.prototype.close = function (cb) {
    const self = this;
    if (self.closed) return nextTick(cb, new Error('Storage is closed'))
    self.closed = true;

    const tasks = self.files.map(function (file) {
        return function (cb) {
            file.open(function (err, file) {
                // an open error is okay because that means the file is not open
                if (err) return cb(null)
                file.close(cb);
            });
        }
    });
    parallel(tasks, cb);
};

Storage.prototype.destroy = function (cb) {
    const self = this;
    self.close(function () {
        if (self.addUID && self.path) {
            fs.rm(path.resolve(path.join(self.path, self.name)), { recursive: true, maxBusyTries: 10 }, cb);
        } else {
            const tasks = self.files.map(function (file) {
                return function (cb) {
                    fs.rm(file.path, { recursive: true, maxRetries: 10 }, err => {
                        err && err.code === 'ENOENT' ? cb() : cb(err);
                    });
                }
            });
            parallel(tasks, cb);
        }
    });
};

function nextTick (cb, err, val) {
    queueMicrotask(function () {
        if (cb) cb(err, val);
    });
}

function noop () {}

var index = /*@__PURE__*/getDefaultExportFromCjs(src);

export { index as default };
