import {sendTips} from './electronOperations'
import axios from './source/axios'
import { getHeaders } from './httpHeaders'
import {Parser} from 'm3u8-parser'

export function getCorrectM3u8File(url) {
    const headers = getHeaders(url)
    return axios.get(url, {
        timeout: 60000,
        headers
    })
      .then((res) => {
          const parser = new Parser();
          parser.push(res.data);
          parser.end();
          const parsedManifest = parser.manifest;
          if(parsedManifest?.segments?.length > 0) {
              return res.data
          } else {
              if(parsedManifest?.playlists?.[0]?.uri) {
                  const newM3u8Url = getCorrectAnotherM3u8(url, parsedManifest?.playlists?.[0]?.uri)
                  return axios.get(newM3u8Url, {
                      timeout: 30000,
                      headers
                  })
                    .then(async (res) => {
                        return res.data
                    })
                    .catch((res) => {
                        sendTips('m3u8-file-get-failure', 'error', '下载资源失败，请重新尝试或者更换个下载资源!')
                        return null
                    })
              } else {
                  sendTips('m3u8-file-get-failure', 'error', '下载资源失败，请重新尝试或者更换个下载资源!')
                  return null
              }
          }
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
    const parser = new Parser();
    parser.push(data);
    parser.end();
    const parsedManifest = parser.manifest;
    if(parsedManifest?.segments?.length > 0) {
        const segments = parsedManifest.segments
        const allKeys = segments.filter((item) => item.key).map((item) => item.key.uri);
        const keys = Array.from(new Set(allKeys))
        return keys
    } else {
        return []
    }
}

/**
 * #EXT-X-MAP 的获取
 * @param data
 * @returns {*[]|*}
 */
export function getXMap(data) {
    const parser = new Parser();
    parser.push(data);
    parser.end();
    const parsedManifest = parser.manifest;
    if(parsedManifest?.segments?.length > 0) {
        const segments = parsedManifest.segments
        const allKeys = segments.filter((item) => item.map).map((item) => item.map.uri);
        const keys = Array.from(new Set(allKeys))
        return keys
    } else {
        return []
    }
}

/**
 * 将m3u8文本转换成url数组, 屏蔽非同源的。
 */
export function getPlayList(data) {
    const parser = new Parser();
    parser.push(data);
    parser.end();
    const parsedManifest = parser.manifest;
    if(parsedManifest?.segments?.length > 0) {
        const segments = parsedManifest.segments
        return segments.map((item) => item.uri)
    } else {
        return []
    }
}