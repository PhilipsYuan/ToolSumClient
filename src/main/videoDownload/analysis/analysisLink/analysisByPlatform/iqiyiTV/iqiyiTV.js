import axios from '../../../../../util/source/axios'
import { auth } from "./authKey.js";
import { getVf } from "./mmc";
import { app } from 'electron'
import fs from 'fs';
import path from "path";
import {makeDir} from "../../../../../util/fs";
const basePath = app.getPath('userData')
const tempM3u8UrlPath = path.resolve(basePath, 'm3u8Video', 'tempM3u8Url');
makeDir(tempM3u8UrlPath)
const m3u8UrlMgPath = path.resolve(tempM3u8UrlPath, 'iqiyi')
makeDir(m3u8UrlMgPath)

export async function getIQiYiTVDownloadLink (htmlUrl) {
    const { tvId, vid, title } = await getVid(htmlUrl)
    const authKey =  auth('')
    const bob = '{"version":"10.0","dfp":"a0ecf8e4c6312b4cb6b07659066e7caca9279d3d666b49de92ddf17cab892223b9","b_ft1":8}'
    const bobCode = bob.replace(/:/g, '%3A').replace(/,/g, '%2C').replace(/{/g, '%7B').replace(/"/g, '%22').replace(/}/g, '%7D')
    const params = {
        tvid: tvId, // 需要处理
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
        k_ft2: '262335',
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
    return axios.get(`https://cache.video.iqiyi.com${search}`)
        .then(async (res) => {
            const videos = res.data.data?.program?.video
            if(videos) {
                const text = videos.find((item) => item.m3u8).m3u8
                const m3u8Url = await createM3u8Url(text, tvId)
                return {videoUrl: m3u8Url, title: title}
            } else {
                return 'error'
            }
        })
        .catch((e) => {
            console.log(e)
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
        .then((res) => {
            const data = res.data;
            const tvId = data.match(/"tvId":(\d+),"albumId"/)[1]
            const vid = data.match(/"vid":"(.*?)",/)[1]
            const title = data.match(/<title>(.*)<\/title>/)?.[1].split('-')[0].trim();
            return {tvId, vid, title}
        })
        .catch((e) => {
            return null
        })
}

/**
 * 创建本地m3u8url
 */
async function createM3u8Url(m3u8Text, id) {
    const json = {
        text: m3u8Text
    }
    const filePath = path.resolve(m3u8UrlMgPath, `${id}.m3u8`)
    await fs.writeFileSync(path.resolve(m3u8UrlMgPath, `${id}.m3u8`), JSON.stringify(json), "utf-8")
    return filePath
}

