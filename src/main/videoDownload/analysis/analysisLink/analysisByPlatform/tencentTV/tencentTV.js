import { getCKey } from './getck'
import axios from "../../../../../util/source/axios"

export async function getTencentTVDownloadLink(htmlUrl) {
    const adparam = getAdparam(htmlUrl);
    const buid = 'vinfoad';
    const sspAdParam = getSspAdParam(htmlUrl)
    const vinfoparam = await getVinfoParam(htmlUrl);
    console.log('adparam', adparam)
    console.log('sspAdParam', JSON.stringify(sspAdParam))
    console.log('vinfoparam', vinfoparam)
    const apiUrl = 'https://vd6.l.qq.com/proxyhttp'
    return axios.post(apiUrl, {
        adparam,
        buid,
        sspAdParam: JSON.stringify(sspAdParam),
        vinfoparam
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
    const sspKey = 'omod';
    return `adType=${adType}&vid=${vid}&sspKey=${sspKey}`
}


async function getVinfoParam(htmlUrl) {
    const preStr = htmlUrl.substring(0, 48)
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
    const clip = "4"
    const guid = "37c8fb814907dcf7"
    const flowid = "a69c61e4ff33040519446e41820d784a"
    const platform = "10201"
    const sdtfrom = "v1010"
    const appVer = "1.30.8"
    const unid=""
    const auth_from=""
    const auth_ext=""
    const vid = getVid(htmlUrl)
    // 控制视频质量 shd： 720p， fhd： 1080p
    const defn = "shd"
    const fhdswitch = "0"
    const dtype = "3"
    const spsrt = "2"
    const tm = new Date().getTime().toString().substring(0, 10)
    const lang_code = "0"
    const logintoken=""
    const spvvpay = "1"
    const spadseg = "3"
    const spav1 = "15"
    const hevclv = "28"
    const spsfrhdr = "100"
    const spvideo = "1028"
    const spm3u8tag = "67"
    const spmasterm3u8 = "3"
    const drm = "40"
    const cKey = await getCKey(appVer, vid, guid, `${preStr}|mozilla/5.0 (macintosh; intel mac os x 10_15_7) ||Mozilla|Netscape|MacIntel`, tm)
    // const cKey = `HnvCgbpZ6h61O81Orq2-LnCjnpb8Ocr0cPTcf-HtzEul_f4uOWcoUmJGR8Gu77I5O1tC3BIG3moPCp7VHCeQghpmp7rG5tiHjLv_PnnatnPaZfOXktuBpd_IjbY_9NKe3V33_IMO58knFjOj-NmZhE-NjjawCzIHH6ORd8JBnDgsk_VKYDnwTGrhuLoxaemxuyx9-KN7KuuWUYWksGXkUJYnQqXKgvocvCDoQBrA1BuIgjfLp43cmgP-uznjzwSQ1MjCSuzbutdm6naXkOY9v_stgHmjfV3wx4D-7khhCIYycsXZ0JD4ub7u1vS9o5kLKNhigqA385zkM5y9kdohlahO1p3ybrBOLvDna74W1om4tUcSYW4ji6IIFi0UxEMnE-N3aKdHfbo70YMs9OYogpb4DqObvp244wLO04F1g4xcicPKAkaYh6Wms331tvFELLm4-yKZdpgERQ9j8TjPzRRN9-6J5gwWT4y8HuzFJtWHAbXq0IOqA8k3VA6v87EUCbwTtE6framlXX8FBQUFBUvET0E`
    return `charge=${charge}&otype=${otype}&defnpayver=${defnpayver}&spau=${spau}&spaudio=${spaudio}&spwm=${spwm}&sphls=${sphls}&host=${host}&refer=${refer}&ehost=${ehost}&sphttps=${sphttps}&encryptVer=${encryptVer}&cKey=${cKey}&clip=${clip}&guid=${guid}&flowid=${flowid}&platform=${platform}&sdtfrom=${sdtfrom}&appVer=${appVer}&unid=${unid}&auth_from=${auth_from}&auth_ext=${auth_ext}&vid=${vid}&defn=${defn}&fhdswitch=${fhdswitch}&dtype=${dtype}&spsrt=${spsrt}&tm=${tm}&lang_code=${lang_code}&logintoken=${logintoken}&spvvpay=${spvvpay}&spadseg=${spadseg}&spav1=${spav1}&hevclv=${hevclv}&spsfrhdr=${spsfrhdr}&spvideo=${spvideo}&spm3u8tag=${spm3u8tag}&spmasterm3u8=${spmasterm3u8}&drm=${drm}`
}

 /**
  * 获取视频的vid
  * @param htmlUrl
  * @returns {*}
  */
 function getVid (htmlUrl) {
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
                 "flow_id": "a69c61e4ff33040519446e41820d784a",
                 "refresh_id": "e36503d09d74dc7dc29da83c3717de5a_1706662391",
                 "fmt": "shd"
             },
             "platform": {
                 "guid": "37c8fb814907dcf7",
                 "channel_id": 0,
                 "site": "web",
                 "platform": "in",
                 "from": 0,
                 "device": "pc",
                 "play_platform": 10201,
                 "pv_tag": "",
                 "support_click_scan_integration": true
             },
             "player": {"version": "1.30.8", "plugin": "3.4.44", "switch": 1, "play_type": "0"},
             "token": {"type": 0, "vuid": 0, "vuser_session": "", "app_id": "", "open_id": "", "access_token": ""}
         }
     }
}