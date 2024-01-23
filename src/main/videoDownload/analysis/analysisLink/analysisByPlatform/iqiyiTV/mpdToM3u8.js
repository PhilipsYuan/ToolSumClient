import xml2js from 'xml2js'

export async function mpdToM3u8(mpdString) {
    return new Promise((resolve, reject) => {
        xml2js.parseString(mpdString, function (err, result) {
            const tsList = result.MPD.Period[0].AdaptationSet[0].Representation[0].SegmentList[0].SegmentURL
            let m3u8String = `#EXTM3U\n#EXT-X-TARGETDURATION:5\n`
            tsList.forEach((item) => {
                const range = item.$.mediaRange.replace('-', 'and')
                const url =  `${item.$.media}&mediaRange=${range}`
                const time = (Number(item.$.d) / 1000).toFixed(6)
                const extinf = `#EXTINF:${time},\n${url}\n`
                m3u8String = m3u8String + extinf
            })
            m3u8String = m3u8String + `#EXT-X-ENDLIST`
            resolve(m3u8String)
        });
    })


}