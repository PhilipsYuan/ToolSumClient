import axios from '../../../../../util/source/axios'

export async function getMgTvDownloadLink(htmlUrl) {
    const videoId = getTVId(htmlUrl)
    return axios.get("https://pcweb.api.mgtv.com/video/streamList", {
        params: {
            "auth_mode": 1,
            "definitionType": 2,
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
        },
    })
        .then((res) => {
            const json = res.data
            if(json.data && json.data.stream_h265 && json.data.stream_h265.length > 0) {
                const matchItem = json.data.stream_h265.find((item) => {
                    return item.disp
                })
                if(matchItem && matchItem.disp && matchItem.disp.info) {
                    return {videoUrl: matchItem.disp.info}
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