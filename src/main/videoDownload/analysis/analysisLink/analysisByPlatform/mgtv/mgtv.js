import axios from '../../../../../util/source/axios'
// import dayjs from "dayjs";
import host from "../../../../../../renderer/src/utils/const/host";

// let cookieInfo = null

export async function getMgTvDownloadLink(htmlUrl) {
    const cookie = await getCookieInfo()
    const videoId = getTVId(htmlUrl)
    return axios.get("https://pcweb.api.mgtv.com/video/streamList", {
        params: {
            "auth_mode": 1,
            "definitionType": 2,
            // 系数决定清晰度： 3：720px 4:1080p
            "definition": 3,
            "fileSourceType": 1,
            video_id: videoId,
            vf: "h265",
            type: 'pch5',
            _support: '10000000',
            src: 'mgtv',
            abroad: 0,
            allowedRC: 1
        },
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
            referer: 'https://www.mgtv.com',
            Cookie: cookie
        },
    })
        .then((res) => {
            const json = res.data
            const title = [json?.data?.info?.title, json?.data?.info?.series].join('-').trim()
            if(json.data && json.data.stream_h265 && json.data.stream_h265.length > 0) {
                const matchItem = json.data.stream_h265.find((item) => {
                    return item.disp
                })
                if(matchItem && matchItem.disp && matchItem.disp.info) {
                    return {videoUrl: matchItem.disp.info, title}
                } else {
                    return "error"
                }
            } else if(json.data && json.data.stream && json.data.stream.length > 0) {
                const matchItem = json.data.stream.find((item) => {
                    return item.disp
                })
                if(matchItem && matchItem.disp && matchItem.disp.info) {
                    return {videoUrl: matchItem.disp.info, title}
                } else {
                    return "error"
                }
            } else {
                return "error"
            }
        })
        .catch(() => {
            return 'error'
        })
}

/**
 * 获取芒果TV的Id
 * 从链接里找出Id
 */
function getTVId(htmlUrl) {
    return htmlUrl.match(/\/(\d+).html/)[1]
}

/**
 * 获取mgTV的cookie
 * @returns {Promise<*>}
 */
async function getCookieInfo() {
    const response = await axios.get(`${host.server}mini/systemConfig/mc`)
    const cookie = response.data.result.cookie
    return cookie;

    // const currentTime = dayjs().format('YYYY-MM-DD')
    // if(cookieInfo && dayjs(currentTime).isBefore(dayjs(cookieInfo.expiredTime))
    //     && dayjs(currentTime).isBefore(dayjs(cookieInfo.saveTime))) {
    //     return cookieInfo.cookie;
    // } else {
    //     const response = await axios.get(`${host.server}mini/systemConfig/mc`)
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
