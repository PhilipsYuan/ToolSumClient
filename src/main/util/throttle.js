/**
 * 截流功能
 * @param fn
 * @param dura
 * @returns {(function(...[*]): void)|*}
 * @constructor
 */
export default function Throttle(fn = v => v, dura = 50) {
    let pass = 0;
    return function(...args) {
        const now = +new Date();
        if (now - pass > dura) {
            pass = now;
            fn.apply(this, args);
        }
    };
}