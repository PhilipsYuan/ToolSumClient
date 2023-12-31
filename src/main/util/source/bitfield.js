var src = {};

Object.defineProperty(src, "__esModule", { value: true });
function getByteSize(num) {
    var out = num >> 3;
    if (num % 8 !== 0)
        out++;
    return out;
}
var BitField = /** @class */ (function () {
    /**
     *
     *
     * @param data Either a number representing the maximum number of supported bytes, or a Uint8Array.
     * @param opts Options for the bitfield.
     */
    function BitField(data, opts) {
        if (data === void 0) { data = 0; }
        var grow = opts === null || opts === void 0 ? void 0 : opts.grow;
        this.grow = (grow && isFinite(grow) && getByteSize(grow)) || grow || 0;
        this.buffer =
            typeof data === "number" ? new Uint8Array(getByteSize(data)) : data;
    }
    /**
     * Get a particular bit.
     *
     * @param i Bit index to retrieve.
     * @returns A boolean indicating whether the `i`th bit is set.
     */
    BitField.prototype.get = function (i) {
        var j = i >> 3;
        return j < this.buffer.length && !!(this.buffer[j] & (128 >> i % 8));
    };
    /**
     * Set a particular bit.
     *
     * Will grow the underlying array if the bit is out of bounds and the `grow` option is set.
     *
     * @param i Bit index to set.
     * @param value Value to set the bit to. Defaults to `true`.
     */
    BitField.prototype.set = function (i, value) {
        if (value === void 0) { value = true; }
        var j = i >> 3;
        if (value) {
            if (this.buffer.length < j + 1) {
                var length = Math.max(j + 1, Math.min(2 * this.buffer.length, this.grow));
                if (length <= this.grow) {
                    var newBuffer = new Uint8Array(length);
                    newBuffer.set(this.buffer);
                    this.buffer = newBuffer;
                }
            }
            // Set
            this.buffer[j] |= 128 >> i % 8;
        }
        else if (j < this.buffer.length) {
            // Clear
            this.buffer[j] &= ~(128 >> i % 8);
        }
    };
    /**
     * Loop through the bits in the bitfield.
     *
     * @param fn Function to be called with the bit value and index.
     * @param start Index of the first bit to look at.
     * @param end Index of the first bit that should no longer be considered.
     */
    BitField.prototype.forEach = function (fn, start, end) {
        if (start === void 0) { start = 0; }
        if (end === void 0) { end = this.buffer.length * 8; }
        for (var i = start, j = i >> 3, y = 128 >> i % 8, byte = this.buffer[j]; i < end; i++) {
            fn(!!(byte & y), i);
            y = y === 1 ? ((byte = this.buffer[++j]), 128) : y >> 1;
        }
    };
    return BitField;
}());
var _default = src.default = BitField;

export { _default as default };
