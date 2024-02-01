import {arrayBuffer} from "../tencentTvBack/wasmBuffer.js";

export async function generateWasm(appVer, vid, guid, htmlStr, tm) {
    let un167 = null
    let result = null
    const importObject = {
        "0kc": {
            '3xA': (a, b, c) => {},
            '4PW': (a, b, c) => {
                result.copyWithin(a, b, b+c)
            },
            'P35': (a, b, c) => {
            },
            '6Ye': (a, b, c) => {
                return new Date().getTime()
            },
            __EM_CXA_THROW__: () => { }
        }
    }
    const wasmModule = await WebAssembly.instantiate(arrayBuffer, importObject);
    const wasmInstance = wasmModule.instance.exports
    un167 = wasmInstance.LRm.buffer
    const dataView = new DataView(un167)
    wasmInstance.j73(14)
    const versionUint8Array = stringToUint8Array(appVer, 14)
    setBufferValue(dataView, versionUint8Array, 69176)
    wasmInstance.j73(19)
    const vidUint8Array = stringToUint8Array(vid, 19)
    setBufferValue(dataView, vidUint8Array, 69200)
    wasmInstance.j73(8)
    const voidUint8Array = stringToUint8Array('', 8)
    setBufferValue(dataView, voidUint8Array, 69224)
    wasmInstance.j73(24)
    const sessionUint8Array = stringToUint8Array(guid, 24)
    setBufferValue(dataView, sessionUint8Array, 69240)
    wasmInstance.j73(132)
    const url = stringToUint8Array(htmlStr, 132)
    setBufferValue(dataView, url, 69272)
    wasmInstance.j73(44)
    const bb = stringToUint8Array(`{"csal":["9x7k6uc7xw","m5h0zchrh5"]}`, 44)
    setBufferValue(dataView, bb, 69408)
    wasmInstance.j73(44)
    const cc = stringToUint8Array('{"ea":3,"spa":1,"hwdrm":0,"hwacc":1}', 44)
    setBufferValue(dataView, cc, 69456)
    wasmInstance.j73(46)
    const dd = stringToUint8Array('94fda1801094a8f762471ca403000007e17905', 46)
    setBufferValue(dataView, dd, 69504)
    result = new Uint8Array(un167)
    wasmInstance['9gI'].apply(null, [10201, 69176, 69200, 69224, 69240, 69272, 69408, 69456, 69504, tm])
    return fromUint8Array(result.slice(72088, 77487))
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

function fromUint8Array (e) {
    for (var t = new Uint8Array(e), o = t.byteLength, A = "", i = 0; i < o; ) {
        var r = t[i++];
        if (0 == (128 & r))
            A += String.fromCharCode(r);
        else if (192 == (224 & r))
            A += String.fromCharCode((31 & r) << 6 | 63 & t[i++]);
        else if (224 == (240 & r))
            A += String.fromCharCode((15 & r) << 12 | (63 & t[i++]) << 6 | 63 & t[i++]);
        else {
            var n = (7 & r) << 18 | (63 & t[i++]) << 12 | (63 & t[i++]) << 6 | 63 & t[i++];
            A += String.fromCharCode(55296 | n - 65536 >> 10, 56320 | n - 65536 & 1023)
        }
    }
    return A
}


export async function getCKey(appVer, vid, guid, htmlStr, tm) {
    console.log(appVer, vid, guid, htmlStr)
    const result = await generateWasm(appVer, vid, guid, htmlStr, 1706777019)
    console.log(result.split('|'))
    return result.split('|')[1]
}