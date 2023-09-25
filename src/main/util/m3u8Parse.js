import {sendTips} from './electronOperations'
const axios = require('axios')

export function getCorrectM3u8File(url) {
    return axios.get(url, {
        timeout: 60000
    })
        .then(async (res) => {
            const result = checkM3u8FileHasAnotherM3u8(res.data, url)
             if(result) {
                 return axios.get(result, {
                     timeout: 30000
                 })
                     .then(async (res) => {
                         return res.data
                     })
                     .catch((res) => {
                         sendTips('m3u8-file-get-failure', 'error', '下载资源失败，请重新尝试或者更换个下载资源')
                         return null
                     })
             } else {
                 return res.data
             }
        })
        .catch((res) => {
            sendTips('m3u8-file-get-failure', 'error', '下载资源失败，请重新尝试或者更换个下载资源')
            return null
        })
}

/**
 * 判断文件里是否还是个m3u8文件的路径
 */
function checkM3u8FileHasAnotherM3u8(data, url) {
    if(/\.m3u8/.test(data)) {
        const path = data.match(/\n[^\n.]*.m3u8/)[0].replace('\n', '')
        return getCorrectAnotherM3u8(url, path)
    } else {
        return false
    }
}

/**
 * 获取正确的M3u8
 * 可能出现 mode1 和 mode4 两种情况
 * @param sourceUrl
 * @param targetUrl
 * @returns {string|*}
 */
function getCorrectAnotherM3u8(sourceUrl, targetUrl) {
    if(/^http/.test(targetUrl)) {
        return targetUrl
    } else {
        const sourceUrlObject = new URL(sourceUrl);
        const sourcePathName = sourceUrlObject.pathname
        let sourcePathArray = sourcePathName.split('/')
        if(sourcePathArray[0] === '') {
            sourcePathArray = sourcePathArray.splice(1)
        }
        let targetPathArray = targetUrl.split('/')
        if(targetPathArray[0] === '') {
            targetPathArray = targetPathArray.splice(1)
        }
        let differentIndex = 0
        sourcePathArray.forEach((item, index) => {
            if(item === targetPathArray[index]) {
                differentIndex = index + 1
            }
        })
        const frontArray = sourcePathArray.slice(0, differentIndex > 0 ? differentIndex : sourcePathArray.length - 1)
        const endArray = targetPathArray.slice(differentIndex)
        let correctPathName = frontArray.concat(endArray).join('/')
        if(!/^\//.test(correctPathName)) {
            correctPathName = '/' + correctPathName
        }
        const url = `${sourceUrlObject.protocol}//${sourceUrlObject.host}${correctPathName}`
        return url
    }
}

/**
 * 获取m3u8Key
 * @param data
 * @returns {*[]|*}
 */
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
    return allUrls
}