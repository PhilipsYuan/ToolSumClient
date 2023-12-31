import axios from "../../../../util/source/axios"

export async function getBiliTVDownloadLink(htmlUrl) {
    return axios
        .get(htmlUrl, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
                referer: 'https://www.bilibili.com',
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
                const epId = htmlUrl.match(/ep(\d+)?/)[1]
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
        const videoUrl =
            info?.data?.dash?.video?.[0]?.baseUrl
            ?? (info?.data?.dash?.video?.[0]?.backupUrl?.[0] ?? info?.data?.dash?.video?.[0]?.backup_url?.[0]);
        const audioUrl =
            info?.data?.dash?.audio?.[0]?.baseUrl
            ?? (info?.data?.dash?.audio?.[0]?.backupUrl?.[0] ?? info?.data?.dash?.audio?.[0]?.backup_url?.[0]);
        const title = data.match(/title="(.*?)"/)?.[1]?.replaceAll?.(/\\|\/|:|\*|\?|"|<|>|\|/g, '');

        if (videoUrl && audioUrl) {
            return { videoUrl, audioUrl, title };
        }
        return 'error'
    }
}

function getInfoFromNextData(data, epId) {
    const matchData = data.replace(/[\n|\t]/g, '').replace(/ /g, '')
    const infoString = matchData.match(/<scriptid="__NEXT_DATA__"type="application\/json">(.*)<\/script>/)?.[1]
    const info = infoString ? JSON.parse(infoString) : null;
    if(info) {
        const episodes = info?.props?.pageProps?.dehydratedState?.queries?.[0]?.state?.data?.seasonInfo?.mediaInfo?.episodes
        const epiItem = episodes.find((item) => item.ep_id == epId)
        const avid = epiItem.aid;
        const cid = epiItem.cid;
        const qn = 0
        const fnver = 0
        const fourk = 1
        const from_client = 'BROWSER'
        const ep_id = epId
        const drm_tech_type = 2
        const fnval = 4048
        return axios.get('https://api.bilibili.com/pgc/player/web/v2/playurl?support_multi_audi=true', {
            params: { avid, cid, qn, fnver, fourk, fnval, from_client, ep_id, drm_tech_type },
        })
            .then((res) => {
                const videoInfo = res?.data?.result?.video_info
                if(videoInfo) {
                    const videoUrl =
                        videoInfo?.dash?.video?.[0]?.baseUrl
                        ?? (videoInfo?.dash?.video?.[0]?.backupUrl?.[0] ?? videoInfo?.dash?.video?.[0]?.backup_url?.[0]);
                    const audioUrl =
                        videoInfo?.dash?.audio?.[0]?.baseUrl
                        ?? (videoInfo?.dash?.audio?.[0]?.backupUrl?.[0] ?? videoInfo?.dash?.audio?.[0]?.backup_url?.[0]);
                    const title = data.match(/<title>(.*)<\/title>/)?.[1].split('-')[0];
                    if (videoUrl && audioUrl) {
                        return {videoUrl, audioUrl, title};
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