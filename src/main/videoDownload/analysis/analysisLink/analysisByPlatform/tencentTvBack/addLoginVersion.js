import axios from "../../../../../util/source/axios";
import dayjs from "dayjs";
import host from "../../../../../../renderer/src/utils/const/host";

let cookieInfo = null

export async function getVideoInfo(url, postData) {
    const loginInfoString = await getCookieInfo()
    const loginInfo = JSON.parse(loginInfoString)
    postData.vinfoparam = changeVinfoparam(loginInfo, postData.vinfoparam)
    postData.sspAdParam = changeSspAdParam(loginInfo, postData.sspAdParam)
    return axios.post(url, postData, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36¬",
            referer: 'https://v.qq.com',
        }
    })
        .then((res) => {
            return res.data
        })
}

function changeVinfoparam (loginInfo, vinfo) {
    const loginToken = encodeURIComponent(JSON.stringify(loginInfo))
    // 控制视频质量 shd： 720p， fhd： 1080p
    const aa = vinfo.replace(/defn=[^&]*&/, 'defn=fhd&')
    const bb = aa.replace('logintoken=', `logintoken=${loginToken}`)
    return bb
}

function changeSspAdParam(loginInfo, sspAdParam) {
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
    return JSON.stringify(bb)
}


/**
 * 获取qq的cookie
 * @returns {Promise<*>}
 */
async function getCookieInfo() {
    const currentTime = dayjs().format('YYYY-MM-DD')
    if(cookieInfo && dayjs(currentTime).isBefore(dayjs(cookieInfo.expiredTime))
        && dayjs(currentTime).isBefore(dayjs(cookieInfo.saveTime))) {
        return cookieInfo.cookie;
    } else {
        const response = await axios.get(`${host.server}mini/systemConfig/qc`)
        const cookie = response.data.result.cookie
        const expiredTime = response.data.result.expiredTime
        const saveTime = dayjs().add(3, 'day').format('YYYY-MM-DD')
        cookieInfo = {
            cookie,
            expiredTime,
            saveTime
        }
        return cookie;
    }
}
