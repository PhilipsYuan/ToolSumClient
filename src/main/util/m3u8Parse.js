import {sendTips} from './electronOperations'
const axios = require('axios')

export function getCorrectM3u8File(url) {
    return axios.get(url)
        .then(async (res) => {
            const result = checkM3u8FileHasAnotherM3u8(res.data, url)
             if(result) {
                 return axios.get(result)
                     .then(async (res) => {
                         return res.data
                     })
                     .catch((res) => {
                         sendTips('m3u8-download-url-failure', '下载资源失败，请重新尝试或者更换个下载资源')
                         return null
                     })
             } else {
                 return res.data
             }
        })
        .catch((res) => {
            sendTips('m3u8-download-url-failure', '下载资源失败，请重新尝试或者更换个下载资源')
            return null
        })
}

/**
 * 判断文件里是否还是个m3u8文件的路径
 */
function checkM3u8FileHasAnotherM3u8(data, url) {
    if(/\.m3u8/.test(data)) {
        const path = data.match(/\/[^.]*.m3u8/)[0]
        const urlObject = new URL(url);
        const host = `${urlObject.protocol}//${urlObject.host}`
        return host + path
    } else {
        return false
    }
}

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