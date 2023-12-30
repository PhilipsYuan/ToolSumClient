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
        .then(({ data }) => {
            const playInfo = getInfoFromPlayInfo(data)
            if(playInfo) {
                if(playInfo === 'error') {
                    return Promise.resolve('error')
                } else {
                    return playInfo
                }
            } else {
                const nextInfo = getInfoFromNextData(data)
                if(nextInfo) {
                    return Promise.resolve('aaa')
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

function getInfoFromNextData(data) {
    const infoString = data.match(/<script id="__NEXT_DATA__" type="application\/json">({.*})<\/script><script>/)?.[1]
    console.log('222', data)
}