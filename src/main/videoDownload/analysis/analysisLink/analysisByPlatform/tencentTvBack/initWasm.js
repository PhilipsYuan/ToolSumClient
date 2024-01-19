import {getWasmBuffer} from "./wasmBuffer.js";

export async function generateWasm() {
    const arrayBuffer = getWasmBuffer()
    const importObject = {
        "0kc": {
            '3xA': () => { console.log(1)},
            '4PW': () => { console.log(2)},
            'P35': () => { console.log(3)},
            '6Ye': () => { console.log(4)},
            __EM_CXA_THROW__: () => { console.log(5)}
        }
    }
    const wasmModule = await WebAssembly.instantiate(arrayBuffer, importObject);
    const wasmInstance = wasmModule.instance.exports
    const un167 = wasmInstance.LRm.buffer
    const dataView = new DataView(un167)
    const versionUint8Array = stringToUint8Array('1.30.3', 14)
    setBufferValue(dataView, versionUint8Array, 69176)
    const vidUint8Array = stringToUint8Array('g0047vju30g', 19)
    setBufferValue(dataView, vidUint8Array, 69200)
    const voidUint8Array = stringToUint8Array('', 8)
    setBufferValue(dataView, voidUint8Array, 69224)
    const sessionUint8Array = stringToUint8Array('37c8fb814907dcf7', 24)
    setBufferValue(dataView, sessionUint8Array, 69240)
    const url = stringToUint8Array('https://v.qq.com/x/cover/mzc00200whsp9r6/g0047vj|mozilla/5.0 (macintosh; intel mac os x 10_15_7) ||Mozilla|Netscape|MacIntel', 132)
    setBufferValue(dataView, url, 69272)
    const bb = stringToUint8Array(`{"csal":["pplro0qj0r","m5h0zchrh5"]}`, 44)
    setBufferValue(dataView, bb, 69408)
    const cc = stringToUint8Array('{"ea":3,"spa":1,"hwdrm":0,"hwacc":1}', 44)
    setBufferValue(dataView, cc, 69456)
    const dd = stringToUint8Array('94fda1801094a8f762471ca403000007e17905', 46)
    setBufferValue(dataView, dd, 69504)
    return {
        wasmInstance,
        dataView,
        un167
    }
}

export function stringToUint8Array(str, length) {
    const uint = new Uint8Array(length)
    if(str) {
        const encoder = new TextEncoder();
        const encodedData = encoder.encode(str);
        const stringUint =  Uint8Array.from(encodedData);
        uint.set(stringUint, 0)
    }
    return uint
}

export function setBufferValue(dataView, setUint8Array, startIndex) {
    const length = setUint8Array.length
    for(let i = 0; i < length; i++) {
        dataView.setInt8(startIndex + i, setUint8Array[i])
    }
}