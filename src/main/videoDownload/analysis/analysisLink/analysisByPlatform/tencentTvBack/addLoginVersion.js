import axios from "../../../../../util/source/axios";
// import dayjs from "dayjs";
import host from "../../../../../../renderer/src/utils/const/host";

// const loginInfo = {
//     "access_token": "435733241808D1757FF11D831AB1029F",
//     "appid": "101483052",
//     "vusession": "9xUI2tNt5s0p62-IEiZ39g.M",
//     "openid": "1C61AC7A4A631C2F87B51E578DA89234",
//     "vuserid": "156267680",
//     "video_guid": "37c8fb814907dcf7",
//     "main_login": "qq"
// }

// let cookieInfo = null

export async function getVideoInfo(url, postData) {
    const loginInfoString = await getCookieInfo()
    const loginInfo = JSON.parse(loginInfoString)
    const vusession = await getVuSession(loginInfo)
    loginInfo.vusession = vusession
    postData.vinfoparam = changeVinfoparam(postData.vinfoparam, loginInfo)
    postData.sspAdParam = changeSspAdParam(postData.sspAdParam, loginInfo)
    return axios.post(url, postData, {
        headers: {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1",
            referer: 'https://v.qq.com',
        }
    })
        .then((res) => {
            return res.data
        })
}

function changeVinfoparam(vinfo, loginInfo) {
    const loginToken = encodeURIComponent(JSON.stringify(loginInfo))
    // 控制视频质量 shd： 720p， fhd： 1080p
    const aa = vinfo.replace(/defn=[^&]*&/, 'defn=fhd&')
    const cc = aa.replace(/guid=[^&]*&/, `guid=${loginInfo.video_guid}&`)
    const bb = cc.replace('logintoken=', `logintoken=${loginToken}`)
    // hevclv: 28 表示h265格式， hevclv:31 表示h264格式
    const dd = bb.replace(/hevclv=[^&]*&/, 'hevclv=31&')
    return dd
}

function changeSspAdParam(sspAdParam, loginInfo) {
    const bb = JSON.parse(sspAdParam)
    const token = {
        type: 1,
        vuid: loginInfo.vuserid,
        vuser_session: loginInfo.vusession,
        app_id: loginInfo.appid,
        open_id: loginInfo.openid,
        access_token: loginInfo.access_token
    }
    bb.pre_ad_params.token = token
    bb.pre_ad_params.platform.guid = loginInfo.video_guid
    bb.pre_ad_params.user_type = 2
    bb.pre_ad_params.video.fmt = 'fhd'
    return JSON.stringify(bb)
}

/**
 * 获取viewSession
 */
async function getVuSession(loginInfo) {
    const url = `https://pbaccess.video.qq.com/trpc.video_account_login.web_login_trpc.WebLoginTrpc/NewRefresh`
    return axios.get(url, {
        headers: {
            Host: 'pbaccess.video.qq.com',
            referer: 'https://v.qq.com/',
            Origin: 'https://v.qq.com',
            Cookie: `video_guid=${loginInfo.video_guid}; vqq_access_token=${loginInfo.access_token}; vqq_openid=${loginInfo.openid}; vqq_vuserid=${loginInfo.vuserid}; vqq_vusession=${loginInfo.vusession};`
        }
    })
        .then((res) => {
            return res.data.data.vusession
        })
        .catch((e)=> {
            console.log(e)
        })
}


/**
 * 获取qq的cookie
 * @returns {Promise<*>}
 */
async function getCookieInfo() {
    const response = await axios.get(`${host.server}mini/systemConfig/qc`)
    const cookie = response.data.result.cookie
    return cookie;

    // const currentTime = dayjs().format('YYYY-MM-DD')
    // if(cookieInfo && dayjs(currentTime).isBefore(dayjs(cookieInfo.expiredTime))
    //     && dayjs(currentTime).isBefore(dayjs(cookieInfo.saveTime))) {
    //     return cookieInfo.cookie;
    // } else {
    //     const response = await axios.get(`${host.server}mini/systemConfig/qc`)
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
