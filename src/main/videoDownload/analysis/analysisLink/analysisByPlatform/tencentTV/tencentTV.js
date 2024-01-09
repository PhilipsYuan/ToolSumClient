import { getCKey } from './getck'
import axios from "../../../../../util/source/axios"

export async function getTencentTVDownloadLink(htmlUrl) {
    const adparam = getAdparam(htmlUrl);
    const buid = 'vinfoad';
    const vinfoparam = getVinfoParam(htmlUrl);
    // console.log('vinfoParam', vinfoParam)

    const sspAdParam = getSspAdParam(htmlUrl)
    console.log('sspAdParam', JSON.stringify(sspAdParam))
    const apiUrl = 'https://vd6.l.qq.com/proxyhttp'
    return axios.post(apiUrl, {
        adparam,
        buid,
        // adparam: 'adType=preAd&vid=v00468qjf9x&sspKey=quqs',
        // sspAdParam,
        // lcAdCookie: 'o_minduid=fVwFGT6WO7fSM_Kxkmy2k-a_8A_-yPY1; appuser=2C97CF079D0779DA; ad_session_id=dyalygcwbkh2c; Lturn=446; LKBturn=931; LPVLturn=780; LZCturn=220; LPSJturn=634; LBSturn=382; LVINturn=857; LPHLSturn=320; LDERturn=68; LPPBturn=799; LZTturn=713',
        sspAdParam: '{"ad_scene":1,"pre_ad_params":{"ad_scene":1,"user_type":0,"video":{"base":{"vid":"v00468qjf9x","cid":"mzc00200u8ec6k4"},"is_live":false,"type_id":2,"referer":"","url":"https://v.qq.com/x/cover/mzc00200u8ec6k4/v00468qjf9x.html","flow_id":"929b4a8a5cd88f20ccfb0ad4a9e89d67","refresh_id":"c24c445eb2fbf5c58ce62c3c5875443d_1704679468","fmt":"fhd"},"platform":{"guid":"37c8fb814907dcf7","channel_id":0,"site":"web","platform":"in","from":0,"device":"pc","play_platform":10201,"pv_tag":"","support_click_scan_integration":true},"player":{"version":"1.30.2","plugin":"3.4.34","switch":1,"play_type":"0"},"token":{"type":0,"vuid":0,"vuser_session":"","app_id":"","open_id":"","access_token":""}}}',
        vinfoparam: 'charge=0&otype=ojson&defnpayver=7&spau=1&spaudio=64&spwm=1&sphls=2&host=v.qq.com&refer=https%3A%2F%2Fv.qq.com%2Fx%2Fcover%2Fmzc00200u8ec6k4%2Fv00468qjf9x.html&ehost=https%3A%2F%2Fv.qq.com%2Fx%2Fcover%2Fmzc00200u8ec6k4%2Fv00468qjf9x.html&sphttps=1&encryptVer=9.2&cKey=8alBjVWLaRK1O81Orq2-LnCjnpb8Ocr0cPTcX60pzEul_f4uOWcoUmJMR8Gu77I5O1tC3BIG3moPCp7VHCeQghpmp7rG5tiHjLv_PnnatnPaZfOXktuBpd_IjbY_9NKe3V33_IMO58knFjOj-NmZhE-NjjawCzIHH6ORd8JBnDgsk_VKYDnwTGrhuLoxaemxuyx9-KN7KuuWUYWksGXkUJYnQqXKgvocvCDoQBrA1BuIgjfLp43cmgP-uznjzwSQ1MjCSuzbutdm6naXkOY9v_stgHmjfV3wx4D-7khhCIYycsXZ0JD4ub7u1vS9o5kLKNhigqA385zkM5y9kdohlahO1pXsdPlILeC8K6IW1om4tUcSYW4ji6IIFi0UxEMnE-N3aKdHfbo70YMs9OYogpb4DqPP6ci84QGf04Bx0t0IjZbMAkaYh6Wms331tvFELLm4-yKZdpgERQ9j8TjPzRRN9-6J5gwWT4y8HuzFJtWHAbXq0IOqA8k3VFmoXgDlCJ-KET6OxsBQzIUFBQUFBT3Mt9I&clip=4&guid=37c8fb814907dcf7&flowid=929b4a8a5cd88f20ccfb0ad4a9e89d67&platform=10201&sdtfrom=v1010&appVer=1.30.2&unid=&auth_from=&auth_ext=&vid=v00468qjf9x&defn=fhd&fhdswitch=0&dtype=3&spsrt=2&tm=1704681723&lang_code=0&logintoken=&spvvpay=1&spadseg=3&spav1=15&hevclv=28&spsfrhdr=100&spvideo=1028&spm3u8tag=67&spmasterm3u8=3&drm=40'
    }, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36¬",
            referer: 'https://v.qq.com',
        }
    })
        .then((res) => {
            console.log(res.data)
            return '2222222'
        })
}

function getAdparam (htmlUrl) {
    const adType = "preAd";
    const vid = getVid(htmlUrl)
    const sspKey = 'quqs';
    return `adType=${adType}&vid=${vid}&sspKey=${sspKey}`
}


function getVinfoParam(htmlUrl) {
    const charge = '0';
    const otype = 'ojson';
    const defnpayver = '7';
    const spau = '1'
    const spaudio = '64'
    const spwm = '1'
    const sphls = '2'
    const host = encodeURIComponent('v.qq.com')
    const refer = encodeURIComponent(htmlUrl)
    const ehost = encodeURIComponent(htmlUrl)
    const sphttps = "1"
    const encryptVer ="9.2"
    const platform = "10201"
    const appVer = "1.30.1"
    const clip = "4"
    const guid = "37c8fb814907dcf7"
    const flowid = "a66d65f216213de3712c7c9b82d6d633"
    const sdtfrom = "v1010"
    const vid = getVid(htmlUrl)
    const defn = "fhd"
    const fhdswitch = "0"
    const dtype = "3"
    const spsrt = "2"
    const tm = new Date().getTime()
    const lang_code = "0"
    const spvvpay = "1"
    const spadseg = "3"
    const spav1 = "15"
    const hevclv = "28"
    const spsfrhdr = "100"
    const spvideo = "1028"
    const spm3u8tag = "67"
    const spmasterm3u8 = "3"
    const drm = "40"
    const cKey = getCKey(platform, appVer, vid, "", guid, tm)
    return `charge=${charge}&otype=${otype}&defnpayver=${defnpayver}&spau=${spau}&spaudio=${spaudio}&spwm=${spwm}&sphls=${sphls}&host=${host}&refer=${refer}&ehost=${ehost}&sphttps=${sphttps}&encryptVer=${encryptVer}&cKey=${cKey}&clip=${clip}&guid=${guid}&flowid=${flowid}&platform=${platform}&sdtfrom=${sdtfrom}&appVer=${appVer}&unid=&auth_from=&auth_ext=&vid=${vid}&defn=${defn}&fhdswitch=${fhdswitch}&dtype=${dtype}&spsrt=${spsrt}&tm=${tm}&lang_code=${lang_code}&logintoken=&spvvpay=${spvvpay}&spadseg=${spadseg}&spav1=${spav1}&hevclv=${hevclv}&spsfrhdr=${spsfrhdr}&spvideo=${spvideo}&spm3u8tag=${spm3u8tag}&spmasterm3u8=${spmasterm3u8}&drm=${drm}`
}

 /**
  * 获取视频的vid
  * @param htmlUrl
  * @returns {*}
  */
 function getVid (htmlUrl) {
    // const vid = url.match(/cover\/([^\/]*)\//)[1]
    const vid = htmlUrl.match(/cover\/[^\/]*\/([^.]*).html/)[1]
    return vid
}

/**
 * 获取视频的Cid
 * @returns {*}
 */
function getCid(htmlUrl) {
    const cid = htmlUrl.match(/cover\/([^\/]*)\//)[1]
    return cid
}

function createGUID(e) {
    void 0 === e && (e = 32);
    for (var t = e || 32, o = "", i = 1; i <= t; i++) {
        o += Math.floor(16 * Math.random()).toString(16)
    }
    return o
}

function getSspAdParam(htmlUrl) {
     return {
         "ad_scene": 1,
         "pre_ad_params": {
             "ad_scene": 1,
             "user_type": 0,
             "video": {
                 "base": {"vid": getVid(htmlUrl), "cid": getCid(htmlUrl)},
                 "is_live": false,
                 "type_id": 2,
                 "referer": "",
                 "url": htmlUrl,
                 "flow_id": "4a01ad498576c2043befa00144de54c9",
                 "refresh_id": "37c745a2deabb0bc3278a29469569b85_1703141928",
                 "fmt": "fhd"
             },
             "platform": {
                 "guid": "37c8fb814907dcf7",
                 "channel_id": 0,
                 "site": "web",
                 "platform": "in",
                 "from": 0,
                 "device": "pc",
                 "play_platform": 10201,
                 "pv_tag": "|v_qq_com",
                 "support_click_scan_integration": true
             },
             "player": {"version": "1.29.13", "plugin": "3.4.33", "switch": 1, "play_type": "0"},
             "token": {"type": 0, "vuid": 0, "vuser_session": "", "app_id": "", "open_id": "", "access_token": ""}
         }
     }
}