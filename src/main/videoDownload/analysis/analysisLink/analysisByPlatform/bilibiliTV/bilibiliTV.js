/**
 * 质量控制
 * 80： 1080p
 * 64： 720p
 */
import axios from "../../../../../util/source/axios"
// import dayjs from "dayjs";
import host from "../../../../../../renderer/src/utils/const/host";
import {perfectTitleName} from "../../../../../util/url";

// let cookieInfo = null

export async function getBiliTVDownloadLink(htmlUrl) {
    return axios
        .get(htmlUrl, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
                referer: 'https://www.bilibili.com',
                Cookie: 'CURRENT_QUALITY=80'
            },
        })
        .then(async ({ data }) => {
            const playInfo = getInfoFromPlayInfo(data)
            if(playInfo) {
                if(playInfo === 'error') {
                    return Promise.resolve('error')
                } else {
                    return playInfo
                }
            } else {
                const epId = htmlUrl.match(/ep(\d+)?/)?.[1]
                const nextInfo = await getInfoFromNextData(data, epId)
                if(nextInfo) {
                    if(nextInfo === 'error') {
                        return Promise.resolve('error')
                    } else {
                        return nextInfo
                    }
                } else {
                    return Promise.resolve('noFound')
                }
            }
        });
}

function getInfoFromPlayInfo(data) {
    const infoString = data.match(/<script>window\.__playinfo__=({.*})<\/script><script>/)?.[1]
    const info = infoString ? JSON.parse(infoString) : null;
    if(info) {
        const videoInfoList = info?.data?.dash?.video
        const audioInfoList = info?.data?.dash?.audio
        const videoItem = videoInfoList.find((item) => /avc1/.test(item.codecs))
        const audioItem = audioInfoList.find((item) => /mp4a\.40\.2/.test(item.codecs))
        const videoUrl =
            videoItem?.baseUrl
            ?? (videoItem?.backupUrl?.[0] ?? videoItem?.backup_url?.[0]);
        const audioUrl =
            audioItem?.baseUrl
            ?? (audioItem?.backupUrl?.[0] ?? audioItem?.backup_url?.[0]);
        const title = data.match(/title="(.*?)"/)?.[1]?.replaceAll?.(/\\|\/|:|\*|\?|"|<|>|\|/g, '');

        if (videoUrl && audioUrl) {
            return { videoUrl, audioUrl, title: perfectTitleName(title), videoType: 'videoAndAudio'};
        }
        return 'error'
    }
}

async function getInfoFromNextData(data, epId) {
    const cookie = await getCookieInfo()
    const matchData = data.replace(/[\n|\t]/g, '').replace(/ /g, '')
    const infoString = matchData.match(/<scriptid="__NEXT_DATA__"type="application\/json">(.*)<\/script>/)?.[1]
    const info = infoString ? JSON.parse(infoString) : null;
    if(info) {
        const episodes = info?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.seasonInfo?.mediaInfo?.episodes
        const epiItem = episodes.find((item) => item.ep_id == epId) || episodes[0]
        const avid = epiItem.aid;
        const cid = epiItem.cid;
        // 决定 质量，
        const qn = 64
        const fnver = 0
        const fourk = 1
        const from_client = 'BROWSER'
        const ep_id = epId || epiItem.ep_id
        const drm_tech_type = 2
        const fnval = 4048
        const gaia_source = ''
        const session = 'c12064d51d13af1754d925c8b7fd7092'
        return axios.get('https://api.bilibili.com/pgc/player/web/v2/playurl?support_multi_audi=true', {
            params: { avid, cid, qn, fnver, fourk, fnval, from_client, ep_id, drm_tech_type, session, gaia_source },
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
                referer: 'https://www.bilibili.com',
                Cookie: `${cookie}; CURRENT_QUALITY=80`
            },
        })
            .then((res) => {
                const dashInfo = res?.data?.result?.video_info?.dash
                if(dashInfo) {
                    const videoInfoList = dashInfo?.video
                    const audioInfoList = dashInfo?.audio
                    const videoItem = videoInfoList.find((item) => /avc1/.test(item.codecs))
                    const audioItem = audioInfoList.find((item) => /mp4a\.40\.2/.test(item.codecs))
                    if(videoItem && audioItem){
                        const videoUrl = videoItem.baseUrl ?? (videoItem.backupUrl?.[0] ?? videoItem.backup_url?.[0]);
                        const audioUrl = audioItem.baseUrl ?? (audioItem.backupUrl?.[0] ?? audioItem.backup_url?.[0]);
                        const title = data.match(/<title>(.*)<\/title>/)?.[1].split('-')[0].trim();
                        if (videoUrl && audioUrl) {
                            return {videoUrl, audioUrl, title: perfectTitleName(title), videoType: 'videoAndAudio'};
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
                return 'error'
            })
    }
}

/**
 * 获取bili的cookie
 * @returns {Promise<*>}
 */
async function getCookieInfo() {
    const response = await axios.get(`${host.server}mini/systemConfig/bc`)
    const cookie = response.data.result.cookie
    return cookie;

    // const currentTime = dayjs().format('YYYY-MM-DD')
    // if(cookieInfo && dayjs(currentTime).isBefore(dayjs(cookieInfo.expiredTime))
    //     && dayjs(currentTime).isBefore(dayjs(cookieInfo.saveTime))) {
    //     return cookieInfo.cookie;
    // } else {
    //     const response = await axios.get(`${host.server}mini/systemConfig/bc`)
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
