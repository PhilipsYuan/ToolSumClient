import axios from '../../../../../util/source/axios'
import { auth } from "./authKey.js";
import { getVf } from "./mmc";
import { app } from 'electron'
import fs from 'fs';
import path from "path";
import { createM3u8UrlBuyFs } from './f4vToM3u8'
// import dayjs from 'dayjs'
import host from "../../../../../../renderer/src/utils/const/host";
import {makeDir} from "../../../../../util/fs";
import { removeUrlParams } from "../../../../../util/url";
const basePath = app.getPath('userData')
const tempM3u8UrlPath = path.resolve(basePath, 'm3u8Video', 'tempM3u8Url');
makeDir(tempM3u8UrlPath)
const m3u8UrlMgPath = path.resolve(tempM3u8UrlPath, 'iqiyi')
makeDir(m3u8UrlMgPath)

// let cookieInfo = null

export async function getIQiYiTVDownloadLink (url) {
    const htmlUrl = removeUrlParams(url)
    const { tvId, vid, title, payMark } = await getVid(htmlUrl)
    if(payMark == 0) {
        return getFreeVideo(tvId, title)
    } else if(Number(payMark) > 0) {
        // 获取vip视频
        const cookie  = await getCookieInfo()
        return getFreeVideo(tvId, title, cookie)
    } else {
        return 'error'
    }
}

/**
 * 获取免费视频
 * @param tvId
 * @param title
 * @returns {*}
 */
function getFreeVideo(tvId, title, cookie) {
    const authKey =  auth('')
    const bob = '{"version":"10.0","dfp":"a0ecf8e4c6312b4cb6b07659066e7caca9279d3d666b49de92ddf17cab892223b9","b_ft1":8}'
    const bobCode = bob.replace(/:/g, '%3A').replace(/,/g, '%2C').replace(/{/g, '%7B').replace(/"/g, '%22').replace(/}/g, '%7D')
    const params = {
        tvid: tvId, // 需要处理
        // 600:720p 800: 1080p, 800 后格式是mpd，现在还没有破解。
        bid: '600', // 资源的格式
        vid: '', // 需要处理
        src: '01080031010000000000',
        vt: 0,
        rs: 1,
        uid: '',
        ori: 'pcw',
        ps: 0,
        k_uid: '80f0bd95358b2c98c3107bd7091ebd5b',
        pt: 0,
        d: 0,
        s: '',
        lid: 0,
        cf: 0,
        ct: 0,
        authKey: authKey,  // 需要处理
        k_tag: 1,
        dfp: 'a0ecf8e4c6312b4cb6b07659066e7caca9279d3d666b49de92ddf17cab892223b9',
        locale: 'zh_cn',
        pck: '',
        k_err_retries: 0,
        up: '',
        sr: 1,
        qd_v: 5,
        tm: new Date().getTime(),
        qdy: 'u',
        qds: 0,
        ppt: 0,
        k_ft1: '706436220846852',
        k_ft4: '1162321298202628',
        // 这个控制导出视频的编码格式： 添加这个属性就是h265, 不添加就是h264
        // k_ft2: '262335',
        k_ft5: '134217729',
        k_ft6: '128',
        k_ft7: '755499012',
        fr_300: '120_120_120_120_120_120',
        fr_500: '120_120_120_120_120_120',
        fr_600: '120_120_120_120_120_120',
        fr_800: '120_120_120_120_120_120',
        fr_1020: '120_120_120_120_120_120',
        bop: bobCode,
        ut: 0
    }
    let temp = '/dash?'
    for(let key in params) {
        let value = params[key]
        temp = temp + key + '=' + value +'&'
    }
    temp = temp.substring(0, temp.length-1)
    const vfString = getVf(temp)
    const search = temp + '&vf=' + vfString
    const apiURL = `https://cache.video.iqiyi.com${search}`
    const headers = {}
    if(cookie) {
        headers.Cookie = cookie
    }
    return axios.get(apiURL, { headers })
        .then(async (res) => {
            const videos = res.data.data?.program?.video
            if(videos) {
                const text = videos.find((item) => item.m3u8)?.m3u8;
                const fs = videos.find(item => item.fs)?.fs
                if(text) {
                    if(/<SegmentList/.test(text)) {
                        // 这个有问题，还没有实现，在超高清的时候，会是这个格式。
                        const m3u8Url = await createMpdUrl(text, tvId)
                        // const m3u8String = await mpdToM3u8(text)
                        // const m3u8Url = await createM3u8Url(m3u8String, tvId)
                        return {videoUrl: m3u8Url, title: title}
                    } else {
                        const m3u8Url = await createM3u8Url(text, tvId)
                        return {videoUrl: m3u8Url, title: title?.replace(/;|；|\\|\//g, ''), videoType: 'm3u8'}
                    }
                } else if(fs) {
                    const perfectTitle = title?.replace(/;|；|\\|\//g, '') || ''
                    const m3u8Url = await createM3u8UrlBuyFs(fs, tvId, perfectTitle)
                    if(m3u8Url !== 'error') {
                        return {videoUrl: m3u8Url, title: perfectTitle, videoType: 'm3u8'}
                    } else {
                        return 'error'
                    }
                } else {
                    return 'error'
                }
            } else {
                return 'error'
            }
        })
        .catch((e) => {
            const filePath = path.resolve(m3u8UrlMgPath, `${id}.m3u8`)
            if(fs.existsSync(filePath)) {
                fs.unlinkSync(filePath)
            }
            return 'error'
        })
}

function getVid(htmlUrl) {
    return axios
        .get(htmlUrl, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
                referer: 'https://www.iqiyi.com',
            },
        })
        .then(async (res) => {
            const data = res.data;
            let tvId = data.match(/"tvId":(\d+),"albumId"/)?.[1]
            if(!tvId && /pages\.iqiyi\.com/.test(htmlUrl)) {
                tvId = data.match(/"tvId":(\d+),"vData"/)?.[1]
            }
            if(!tvId && /sports\.iqiyi\.com/.test(htmlUrl)) {
                const mm = new URL(htmlUrl)
                const pathParts = mm.pathname.split('/')
                const key = pathParts[pathParts.length - 1]
                const id = decode(key, 36);
                let SEED = "lgqipu";
                let l_seed = toLong(SEED);
                tvId = xor(id, l_seed)
            }
            const vid = data.match(/"vid":"(.*?)",/)?.[1] || ''
            let title = data.match(/\.name="([^"]*)"/)?.[1];
            if(!title) {
                title = data.match(/name":"([^"]+)","playUrl"/)?.[1] || data.match(/<title>([^<]*)<\/title>/)?.[1]
            }
            const payMark = data.match(/"payMark":(\d+),/)?.[1] || '';
            return {tvId, vid, title: title?.replace(/;|；|\\|\//g, ''), payMark}
        })
        .catch((e) => {
            return null
        })
}

async function createMpdUrl(m3u8Text, id) {
    const filePath = path.resolve(m3u8UrlMgPath, `${id}.mpd`)
    await fs.writeFileSync(path.resolve(m3u8UrlMgPath, `${id}.mpd`), m3u8Text, "utf-8")
    return filePath
}

/**
 * 创建本地m3u8url
 */
async function createM3u8Url(m3u8Text, id) {
    const json = {
        text: m3u8Text
    }
    const filePath = path.resolve(m3u8UrlMgPath, `${id}.m3u8`)
    // await fs.writeFileSync(filePath, JSON.stringify(json), "utf-8")
    await fs.writeFileSync(filePath, m3u8Text, "utf-8")
    return filePath
}



/**
 * 创建本地的mpd
 */
async function createMpd(mpdText, id) {
    const filePath = path.resolve(m3u8UrlMgPath, `${id}.mpd`)
    await fs.writeFileSync(filePath, mpdText, "utf-8")
    return filePath
}

/**
 * 获取iqiyi的cookie
 * @returns {Promise<*>}
 */
async function getCookieInfo() {
    const response = await axios.get(`${host.server}mini/systemConfig/ic`)
    const cookie = response.data.result.cookie
    return cookie;
    // const currentTime = dayjs().format('YYYY-MM-DD')
    // if(cookieInfo && dayjs(currentTime).isBefore(dayjs(cookieInfo.expiredTime))
    // && dayjs(currentTime).isBefore(dayjs(cookieInfo.saveTime))) {
    //     return cookieInfo.cookie;
    // } else {
    //     const response = await axios.get(`${host.server}mini/systemConfig/ic`)
    //     const cookie = response.data.result.cookie
    //     const expiredTime = response.data.result.expiredTime
    //     const saveTime = dayjs().add(3, 'day').format('YYYY-MM-DD')
    //     cookieInfo = {
    //         cookie,
    //         expiredTime,
    //         saveTime
    //     }
    //     return cookie;
    // }
}

function decode(str, radix) {
    const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    let result = 0;
    for (let i = 0; i < str.length; i++) {
        let digit = BASE62.indexOf(str.charAt(i));
        result += digit * Math.pow(radix, str.length - (i + 1));
    }
    return result;
}

function str2hex(seed) {
    var result = "";
    for (var i = seed.length - 1; i >= 0; i--) {
        var c = seed.charCodeAt(i);
        result += c.toString(16);
    }
    return result.toString();
}

function toLong(seed) {
    return parseInt(str2hex(seed), 16);
}

function xor(num1, num2) {
    var b1 = num1.toString(2) + '';
    var b2 = num2.toString(2) + '';
    var res = '';
    if (b1.length > b2.length) {
        res = b1.slice(0, b1.length - b2.length);
        b1 = b1.substr(b1.length - b2.length);
    } else {
        res = b2.slice(0, b2.length - b1.length);
        b2 = b2.substr(b2.length - b1.length);
    }
    for (var i = 0; i < b1.length; i++) {
        if (b1[i] === b2[i]) {
            res += 0;
        } else {
            res += 1;
        }
    }
    return parseInt(res, 2);
}

