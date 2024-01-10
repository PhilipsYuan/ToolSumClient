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
    const { tvId, vid, title, payMark } = await getVid(htmlUrl)
    // if(payMark == 1) {
    //
    // } else  if(payMark == 0) {
    //     return getFreeVideo(tvId, title)
    // } else {
    //     return 'error'
    // }
    return getFreeVideo(tvId, title)
}

/**
 * 获取vip视频
 */
function getVipVideo() {

}

/**
 * 获取免费视频
 * @param tvId
 * @param title
 * @returns {*}
 */
function getFreeVideo(tvId, title) {
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
    const apiURL = 'https://cache.video.iqiyi.com/dash?tvid=7147799058657300&bid=300&vid=cf161d7cee51d976a5694cb2e1ca3458&src=01080031010000000000&vt=0&rs=1&uid=1178183755904228&ori=pcw&ps=1&k_uid=80f0bd95358b2c98c3107bd7091ebd5b&pt=0&d=0&s=&lid=0&cf=0&ct=0&authKey=f80ef69dce63324be1f3d7c06a011691&k_tag=1&dfp=a0ecf8e4c6312b4cb6b07659066e7caca9279d3d666b49de92ddf17cab892223b9&locale=zh_cn&pck=74tVlx8g7TMZQ8CI64O6R6zyUnch7W6BQWqEWdBxnhJ8m28ay3fjsZujuBE31Ausj2w61&k_err_retries=0&up=&sr=1&qd_v=5&tm=1704874552266&qdy=u&qds=0&k_ft1=706436220846852&k_ft4=1162321298202628&k_ft2=262335&k_ft5=134217729&k_ft6=128&k_ft7=755499012&fr_300=120_120_120_120_120_120&fr_500=120_120_120_120_120_120&fr_600=120_120_120_120_120_120&fr_800=120_120_120_120_120_120&fr_1020=120_120_120_120_120_120&bop=%7B%22version%22%3A%2210.0%22%2C%22dfp%22%3A%22a0ecf8e4c6312b4cb6b07659066e7caca9279d3d666b49de92ddf17cab892223b9%22%2C%22b_ft1%22%3A8%7D&ut=1&vf=d209d6ce8d187e57a06ac5e04c735e0c'
    // const apiURL = `https://cache.video.iqiyi.com${search}`
    return axios.get(apiURL)
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
                Cookie: '__uuid=17895c5d-3ca8-bd54-be4b-02f217b41b73; QP0033=1; QP008=60; QP0039=10_1; T00700=EgcI9L-tIRABEgcI67-tIRACEgcI58DtIRAB; QC180=true; P00001=74tVlx8g7TMZQ8CI64O6R6zyUnch7W6BQWqEWdBxnhJ8m28ay3fjsZujuBE31Ausj2w61; P00003=1178183755904228; P00010=1178183755904228; P01010=1704902400; P00007=74tVlx8g7TMZQ8CI64O6R6zyUnch7W6BQWqEWdBxnhJ8m28ay3fjsZujuBE31Ausj2w61; P00PRU=1178183755904228; __dfp=a0ecf8e4c6312b4cb6b07659066e7caca9279d3d666b49de92ddf17cab892223b9@1705478465993@1704182466993; QC175=%7B%22upd%22%3Atrue%2C%22ct%22%3A1704874539634%7D; QC179=%7B%22vipTypes%22%3A%221%22%2C%22vipType%22%3A%221%22%2C%22userIcon%22%3A%22%2F%2Fwww.iqiyipic.com%2Fcommon%2Ffix%2Fheadicons%2Fmale-130.png%22%2C%22uid%22%3A1178183755904228%2C%22iconPendant%22%3A%22%22%2C%22bannedVip%22%3Afalse%2C%22allVip%22%3Atrue%2C%22validVip%22%3Atrue%7D; QC160=%7B%22type%22%3A1%2C%22conformLoginType%22%3A0%7D; QP0013=1; P00002=%7B%22uid%22%3A1178183755904228%2C%22pru%22%3A1178183755904228%2C%22user_name%22%3A%22156****3168%22%2C%22nickname%22%3A%22%5Cu7528%5Cu623742f8d484034e4%22%2C%22pnickname%22%3A%22%5Cu7528%5Cu623742f8d484034e4%22%2C%22type%22%3A11%2C%22email%22%3A%22%22%7D; QC163=1; QP0035=5; __oaa_session_id__=160cbe051b5d4d419c6f0cddd6a35028; __oaa_session_referer_app__=pcw-player; QY00001=1178183755904228; QC010=13125856; QP0027=58; QP0036=2024110%7C90.322; IMS=IggQABj__fqsBioyCiBkNDU3NTU5OWU2OGMyMGZlMTM5MmNmNzNiOWU2MTE4NBAAIggI0AUQAhiwCShFMAUwADAAMAByKAogZDQ1NzU1OTllNjhjMjBmZTEzOTJjZjczYjllNjExODQQ06j5rAaCAQCKASQKIgogZDQ1NzU1OTllNjhjMjBmZTEzOTJjZjczYjllNjExODQ; QC193=7147799058657300%2C2757%2C230%3B7272134765024300%2C2769%2C108%3B6381730674101000%2C2769%2C105%3B2180788129725200%2C2768%2C129; websocket=false'
            },
        })
        .then((res) => {
            const data = res.data;
            const tvId = data.match(/"tvId":(\d+),"albumId"/)[1]
            const vid = data.match(/"vid":"(.*?)",/)[1]
            const title = data.match(/\.name="([^"]*)"/)[1];
            const payMark = data.match(/"payMark":(\d+),/)[1];
            const urls = data.match(/"urls":\[([^\]]*)\]/)[1];
            console.log(urls.split(',').length)
            return {tvId, vid, title, payMark}
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

