/**
 * 参考链接
 * https://www.12371.cn/2022/07/21/VIDE1658363703897656.shtml
 */
import axios from "../../../../../util/source/axios";
import {perfectTitleName} from "../../../../../util/url";

export async function getCCTVDownloadLink(htmlUrl) {
  if(/12371\.cn/.test(htmlUrl)) {
    return await getInfoFromHtml(htmlUrl)
  } else {
    if(/VID/.test(htmlUrl)) {
      const vid = extractVid(htmlUrl)
      if(vid) {
        return await getInfoNewContentInfo(vid)
      } else {
        return 'error'
      }
    } else if(/guid/.test(htmlUrl)){
      const guid = extractGuid(htmlUrl)
      if(guid) {
        return await getInfoFromHttpVideoInfo(guid)
      } else {
        return 'error'
      }
    } else {
      return await getInfoFromHtml(htmlUrl)
    }
  }
}

async function getInfoFromHtml(htmlUrl) {
  const response = await axios.get(htmlUrl)
  const vid = response?.data?.match(/videoCenterId: "(.*?)"/)?.[1]
  if(vid) {
    return await getInfoFromHttpVideoInfo(vid)
  } else{
    const guid0 = response?.data?.match(/guid_0="(.*?)"/)?.[1]
    const guid = response?.data.match(/guid\s*=\s*"(.*?)"/)?.[1]
    const guid3 = response?.data.match(/htmlVideoCode--](.*?),/)?.[1]
    console.log(guid, guid0, guid3)
    if(guid0 || guid || guid3) {
      return await getInfoFromHttpVideoInfo(guid0 || guid || guid3)
    } else {
      return 'error'
    }
  }
}

/**
 * 从这个接口获取信息
 * https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do
 */
async function getInfoFromHttpVideoInfo (guid) {
  const newInfoUrl = `https://vdn.apps.cntv.cn/api/getHttpVideoInfo.do?pid=${guid}`
  const response = await axios.get(newInfoUrl)
  const m3u8Url = response.data.hls_url
  const title = response.data.title
  if(m3u8Url) {
    return {title: perfectTitleName(title), videoUrl: m3u8Url, videoType: 'm3u8'}
  } else {
    return 'error'
  }
}


/**
 * 从这个接口获取信息
 * https://api.cntv.cn/Article/newContentInfo
 */

async function getInfoNewContentInfo (vid) {
  const newInfoUrl = `https://api.cntv.cn/Article/newContentInfo?serviceId=tvcctv&id=${vid}&cb=abcde${vid}`
  const response = await axios.get(newInfoUrl)
  const match = response.data.match(/"guid":"(.*?)"/)
  if(match?.[1]) {
    return await getInfoFromHttpVideoInfo(match[1])
  }
  return 'error'
}

function extractVid(htmlUrl) {
  const map = htmlUrl.match(/\/VID([a-zA-Z0-9]+)/)
  if(map && map[1]) {
    return `VID${map[1]}`
  } else {
    return null
  }
}

function extractGuid(htmlUrl) {
  const map = htmlUrl.match(/guid=([a-zA-Z0-9]+)/)
  if(map && map[1]) {
    return map[1]
  } else {
    return null
  }
}
