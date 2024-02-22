import { webcrypto } from 'crypto'
import {generateWasm, setBufferValue, stringToUint8Array} from './initWasm.js'
import axios from "../../../../../util/source/axios";
import host from "../../../../../../renderer/src/utils/const/host";

const subtle = webcrypto.subtle

function toUint8Array (e, t) {
    var o = e.replace(/=/g, "").replace(/-/g, "+").replace(/_/g, "/");
    if (t && masks[t]) {
        var i = masks[t].split("")
            , A = o.split("");
        o = A.map((function(e, t) {
                return String.fromCharCode(e.charCodeAt(0) ^ i[t].charCodeAt(0))
            }
        )).join("")
    }
    var r = atob(o);
    return new Uint8Array(r.length).map((function(e, t) {
            return r.charCodeAt(t)
        }
    ))
}

function toUint8Array2 (e) {
    for (var t = [], o = 0; o < e.length; o += 1) {
        var A = e.charCodeAt(o);
        A < 128 ? t.push(A) : A < 2048 ? t.push(192 | A >> 6, 128 | 63 & A) : A < 55296 || A >= 57344 ? t.push(224 | A >> 12, 128 | A >> 6 & 63, 128 | 63 & A) : (o += 1,
            A = 65536 + ((1023 & A) << 10 | 1023 & e.charCodeAt(o)),
            t.push(240 | A >> 18, 128 | A >> 12 & 63, 128 | A >> 6 & 63, 128 | 63 & A))
    }
    return new Uint8Array(t)
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

async function func1(data) {
    const response = await axios.get(`${host.server}mini/systemConfig/getqdk`)
    const rawArray = JSON.parse(response.data.result.key)
    const rawUnit = new Uint8Array(rawArray);
    const aa = await subtle.importKey('pkcs8', rawUnit,{"name": "RSA-OAEP", "hash": "SHA-1"}, false, ["decrypt"] )

    const bb = await subtle.decrypt(
        { name: "RSA-OAEP" },
        aa,
        data
    )
    return bb
}

async function func2(param1, param2, data) {
    const key1 = toUint8Array2(param1)
    const key2 = toUint8Array2(param2)
    const aa = await subtle.importKey('raw', key1, {"name": "AES-CBC"}, false, ["decrypt"]);
    const bb = await subtle.decrypt(
        { name: "AES-CBC", iv: key2 },
        aa,
        data
    )
    return bb
}

async function func3(param1, param2, data) {
    const key1 = toUint8Array2(param1)
    const key2 = toUint8Array2(param2)
    const aa = await subtle.importKey('raw', key1, {"name": "AES-CBC"}, false, ["decrypt"]);
    const bb = await subtle.decrypt(
        { name: "AES-CBC", iv: key2 },
        aa,
        data
    )
    return bb
}

export async function decryptProcess (vinfo) {
    const playData = JSON.parse(vinfo)
    const playJson = JSON.parse(fromUint8Array(toUint8Array(playData.anc)))
    const rcUnit8Array = toUint8Array(playJson.rc)
    const rcArrayBuffer = await func1(rcUnit8Array)
    const rcInfo = fromUint8Array(rcArrayBuffer)
    const param1 = JSON.parse(rcInfo).algo_params[0]
    const param2 = JSON.parse(rcInfo).algo_params[1]
    const algList = await func2(param1, param2, toUint8Array(playJson.aanc))
    const algListJson = JSON.parse(fromUint8Array(algList)).algo_list;
    const m5hAlgo = algListJson.find((item) => item.algo_id === 'm5h0zchrh5')
    const m5hKey1 = m5hAlgo.algo_params[0];
    const m5hKey2 = m5hAlgo.algo_params[1];
    const otherAlgo = algListJson.find((item) => item.algo_id !== 'm5h0zchrh5')
    // 转换数据
    let result = null
    if(otherAlgo) {
        const { wasmInstance, dataView, un167} = await generateWasm()
        if(otherAlgo.algo_params.length < 2) {
            const m5hIndex = algListJson.findIndex((item) => item.algo_id === 'm5h0zchrh5')
            if(m5hIndex == 0) {
                const key24 = otherAlgo.algo_params[0]
                const key24Array = stringToUint8Array(key24, 24)
                setBufferValue(dataView, key24Array, 69176)
                const resultUint8Array = toUint8Array(playJson.anc)
                setBufferValue(dataView, resultUint8Array, 69208)
                wasmInstance.j73(24)
                wasmInstance.j73(resultUint8Array.length)
                const value2 = wasmInstance.T15(69208, resultUint8Array.length, 69176)
                const jsonList = new Uint8Array(un167).slice(value2, value2 + resultUint8Array.length)
                result = await func3(m5hKey1, m5hKey2, jsonList)
            } else {
                const jsonList = await func3(m5hKey1, m5hKey2, toUint8Array(playJson.anc))
                const key24 = otherAlgo.algo_params[0]
                const key24Array = stringToUint8Array(key24, 24)
                setBufferValue(dataView, key24Array, 69176)
                const resultUint8Array = new Uint8Array(jsonList)
                setBufferValue(dataView, resultUint8Array, 69208)
                wasmInstance.j73(24)
                wasmInstance.j73(resultUint8Array.length)
                const value2 = wasmInstance.T15(69208, resultUint8Array.length, 69176)
                result = new Uint8Array(un167).slice(value2, value2 + resultUint8Array.length)
            }

        } else {
            const m5hIndex = algListJson.findIndex((item) => item.algo_id === 'm5h0zchrh5')
            if(m5hIndex == 0) {
                const key40 = otherAlgo.algo_params[0]
                const key20 = otherAlgo.algo_params[1]
                const key40Array = stringToUint8Array(key40, 40)
                const key20Array = stringToUint8Array(key20, 20)
                setBufferValue(dataView, key40Array, 69176)
                setBufferValue(dataView, key20Array, 69224)
                const resultUint8Array = toUint8Array(playJson.anc)
                setBufferValue(dataView, resultUint8Array, 69248)
                const value2 = wasmInstance.FhV(69248, resultUint8Array.length, 69176, 69224)
                const jsonList = new Uint8Array(un167).slice(value2, value2 + resultUint8Array.length)
                result = await func3(m5hKey1, m5hKey2, jsonList)
            } else {
                const jsonList = await func3(m5hKey1, m5hKey2, toUint8Array(playJson.anc))
                const key40 = otherAlgo.algo_params[0]
                const key20 = otherAlgo.algo_params[1]
                const key40Array = stringToUint8Array(key40, 40)
                const key20Array = stringToUint8Array(key20, 20)
                setBufferValue(dataView, key40Array, 69176)
                setBufferValue(dataView, key20Array, 69224)
                const resultUint8Array = new Uint8Array(jsonList)
                setBufferValue(dataView, resultUint8Array, 69248)
                const value2 = wasmInstance.FhV(69248, resultUint8Array.length, 69176, 69224)
                result = new Uint8Array(un167).slice(value2, value2 + resultUint8Array.length)
            }
        }
    } else {
        const jsonList = await func3(m5hKey1, m5hKey2, toUint8Array(playJson.anc))
        result = fromUint8Array(jsonList)
    }
    return fromUint8Array(result)
}
