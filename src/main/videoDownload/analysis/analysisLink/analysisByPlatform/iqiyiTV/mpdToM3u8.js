import xml2js from 'xml2js'

export async function mpdToM3u8(mpdString) {
    return new Promise((resolve, reject) => {
        xml2js.parseString(mpdString, function (err, result) {
            const tsList = result.MPD.Period[0].AdaptationSet[0].Representation[0].SegmentList[0].SegmentURL
            const urlList = perfectList(tsList);
            let m3u8String = `#EXTM3U\n#EXT-X-TARGETDURATION:400\n#EXT-X-MEDIA-SEQUENCE:0\n`
            urlList.forEach((item) => {
                const time = (Number(item.time) / 1000).toFixed(6)
                const extinf = `#EXTINF:${time},\n${item.url}\n`
                m3u8String = m3u8String + extinf
            })
            // urlList.forEach((item) => {
            //     const range = item.$.mediaRange.replace('-', 'and')
            //     const url =  `${item.$.media}&mediaRange=${range}`
            //     const time = (Number(item.$.d) / 1000).toFixed(6)
            //     const extinf = `#EXTINF:${time},\n${url}\n`
            //     m3u8String = m3u8String + extinf
            // })
            m3u8String = m3u8String + `#EXT-X-ENDLIST`
            resolve(m3u8String)
        });
    })
}

/**
 * 将数据进行合并，url筛选出来，时间进行相加
 */
function perfectList(tsList) {
    const urlList = []
    tsList.forEach((item) => {
        const url = item.$.media
        const hasItem = urlList.find((item) => item.url === url)
        if(hasItem) {
            hasItem.time = hasItem.time + Number(item.$.d)
        } else {
            urlList.push({
                url: url,
                time: Number(item.$.d)
            })
        }
    })
    return urlList
}