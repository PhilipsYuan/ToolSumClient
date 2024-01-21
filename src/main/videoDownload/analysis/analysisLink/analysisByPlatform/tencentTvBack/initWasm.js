import {arrayBuffer} from "./wasmBuffer.js";

export async function generateWasm() {
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