export function getSecretKeys(data) {
    const maps = data.match(/#EXT-X-KEY[^\n]*\n/g)
     if(maps && maps.length > 0) {
         const keys = maps.filter((item) => {
             return /URI/.test(item)
         })
         if (keys.length > 0) {
             return keys.map((item) => item.match(/"[^"]*"/)[0].replace(/"/g, ""))
         } else {
             return []
         }
     } else {
         return []
     }
}

/**
 * 将m3u8文本转换成url数组, 屏蔽非同源的。
 */
export function getPlayList(text) {
    const array = text.split("#EXTINF")
    const allUrls = array.map((item) => item.match(/\n.*\n/)[0].replace(/\n/g, ''))
    allUrls.splice(0,1)
    const urls = []
    const httpsUrls = []
    allUrls.forEach((item) => {
        if(!/http/.test(item)) {
            urls.push(item)
        } else {
            httpsUrls.push(item)
        }
    })
    return {
        urls,
        httpsUrls
    }
}