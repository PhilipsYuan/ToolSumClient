import { getCKey } from './getck'
import axios from "../../../../../util/source/axios"

export async function getTencentTVDownloadLink(htmlUrl) {
    const adparam = getAdparam(htmlUrl);
    const buid = 'vinfoad';
    console.log('buid', buid)
    const vinfoParam = getVinfoParam(htmlUrl);
    console.log('vinfoParam', vinfoParam)

    const sspAdParam = getSspAdParam(htmlUrl)
    console.log('adparam', adparam)
    const apiUrl = 'https://vd6.l.qq.com/proxyhttp'
    return axios.get(apiUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36¬",
            referer: 'https://v.qq.com',
        },
        params: {
            // buid: buid,
            // adparam: adparam,
            // vinfoparam: vinfoParam,
            // // sspAdParam: JSON.stringify(sspAdParam),
            // lcAdCookie: "o_minduid=fVwFGT6WO7fSM_Kxkmy2k-a_8A_-yPY1; appuser=2C97CF079D0779DA; ad_session_id=dyalygcwbkh2c; LZCturn=791; LPSJturn=643; LBSturn=157; LVINturn=429; LPHLSturn=408; LDERturn=784; full_screen_cid_pause_times=1; full_screen_pause_times=1; LZTturn=167; Lturn=937; LKBturn=192; LPVLturn=189; LPLFturn=598; LPPBturn=705",
        "vinfoparam": "charge=0&otype=ojson&defnpayver=7&spau=1&spaudio=64&spwm=1&sphls=2&host=v.qq.com&refer=https%3A%2F%2Fv.qq.com%2Fx%2Fcover%2Fmzc00200ekm0uc8%2Fj00468dc2og.html&ehost=https%3A%2F%2Fv.qq.com%2Fx%2Fcover%2Fmzc00200ekm0uc8%2Fj00468dc2og.html&sphttps=1&encryptVer=9.2&cKey=TCPOougB5j21yM1Orq2-LnCjnpb8Ocr0cPTcQCJJzEul_f4uOWcoUmJPR8Gy77I5O1tX1UZQwWr_Cp7VHCeQghpmp7rG5tiHjLv_PnnatnPaZfOXktuBpd_IneU2p5GW0V3r_IMO58kyFjOj-NmZhE-NjjawCzIHH6ORd8JBnDgsk_VKYDnwTGrhuLoxaemxuyx9-KN7KuuWUYWwiX7uSsBkDK_qlv9BvC71ChrA2gKogC-Pt8O57nCcynqx0HGX1bmdCrCHjbMFjEGHpOlwtqN-ln2XYBblxoK743tKEttzPdfN1Lz_quvvxbulqoUFecB0wfll-YS9Ofj5h9p41aZWnIzrfuBZY6SvHftP2Mir5BxcJDUCm-YaFnBR1wI8SecmJekIcokpkphz7bhow-z9eZHVqpK-6FPRhNoy34lI5tz8EgLDgPf35Xn4tvNMJu-t9nauZpMEFFphoTTPzxRE86_Bt14RSoG7Go_pZoDaUuC0lJ7rD5xlAmOBeUlTCB_gZ2CQ559ml3Rc9pnbg4ARNV24KWIJeetNSAQEBAR76Kqz&clip=4&guid=37c8fb814907dcf7&flowid=1c5ff69e99a1d0c304affffe98a46e93&platform=10201&sdtfrom=v1010&appVer=1.30.1&unid=&auth_from=&auth_ext=&vid=j00468dc2og&defn=fhd&fhdswitch=0&dtype=3&spsrt=2&tm=1703210907&lang_code=0&logintoken=&spvvpay=1&spadseg=3&spav1=15&hevclv=28&spsfrhdr=100&spvideo=1028&spm3u8tag=67&spmasterm3u8=3&drm=40",
        "buid": "vinfoad",
        // "sspAdParam": "{\"ad_scene\":1,\"pre_ad_params\":{\"ad_scene\":1,\"user_type\":0,\"video\":{\"base\":{\"vid\":\"j00468dc2og\",\"cid\":\"mzc00200ekm0uc8\"},\"is_live\":false,\"type_id\":3,\"referer\":\"https://v.qq.com/\",\"url\":\"https://v.qq.com/x/cover/mzc00200ekm0uc8/j00468dc2og.html\",\"flow_id\":\"1c5ff69e99a1d0c304affffe98a46e93\",\"refresh_id\":\"851f4c68497cd4e013512a9bdb562e72_1703144964\",\"fmt\":\"fhd\"},\"platform\":{\"guid\":\"37c8fb814907dcf7\",\"channel_id\":0,\"site\":\"web\",\"platform\":\"in\",\"from\":0,\"device\":\"pc\",\"play_platform\":10201,\"pv_tag\":\"\",\"support_click_scan_integration\":true},\"player\":{\"version\":\"1.29.13\",\"plugin\":\"3.4.33\",\"switch\":1,\"play_type\":\"0\"},\"token\":{\"type\":0,\"vuid\":0,\"vuser_session\":\"\",\"app_id\":\"\",\"open_id\":\"\",\"access_token\":\"\"}}}",
        "adparam": "adType=preAd&vid=j00468dc2og&sspKey=ocdl",
        // "lcAdCookie": "o_minduid=fVwFGT6WO7fSM_Kxkmy2k-a_8A_-yPY1; appuser=2C97CF079D0779DA; ad_session_id=dyalygcwbkh2c; LPLFturn=599; Lturn=941; LKBturn=196; LPVLturn=193; LZCturn=795; LPSJturn=647; LBSturn=161; LVINturn=433; LPHLSturn=412; LDERturn=788; LPPBturn=709; LZTturn=171"
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
    const sspKey = 'ghuc';
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

function createGUID(a) {
    a = a || 32;
    for (var b = "", c = 1; c <= a; c++) {
        var d = Math.floor(16 * Math.random()).toString(16);
        b += d
    }
    return b

    return A[i(154)][i(138)]([0, 2, , 3]),
        [4, null === (t = (e = this[i(163)][i(157)])[i(165)]) || void 0 === t ? void 0 : t[i(161)](e, this[i(163)])];
}