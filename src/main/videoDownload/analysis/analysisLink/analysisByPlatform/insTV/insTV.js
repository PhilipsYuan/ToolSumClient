import axios from '../../../../../util/source/axios'
import {perfectTitleName} from "../../../../../util/url";
import host from "../../../../../../renderer/src/utils/const/host";
import dayjs from 'dayjs'

let PHPSESSID = {
  expireTime: '',
  value: null,
  domain: null
}

export async function getInsTVDownloadLink(htmlUrl) {
  const {videoId, origin} = getVideoId(htmlUrl)
  if(videoId) {
    const title = await getVideoTitle(htmlUrl);
    const cookieInfo = await getSessionId(origin)
    const m3u8Url = await getVideoM3u8(origin, videoId, cookieInfo)
    if(m3u8Url) {
      return {title, videoUrl: m3u8Url, videoType: 'm3u8'}
    } else {
      return 'error'
    }
  } else {
    return 'error'
  }
}

function getVideoM3u8 (origin, videoId, cookieInfo) {
  return axios.post(`${origin}/video/getVideoUrl`, {
    vid: videoId,
  }, {
    headers: {
      Cookie: `PHPSESSID=${cookieInfo};`,
    }
  })
    .then(res => {
      return res?.data?.data
    })
}

function getVideoId(htmlUrl) {
   const urlInstance = new URL(htmlUrl);
  return {
     videoId: urlInstance.searchParams.get('id'),
    origin: urlInstance.origin
  }
}

function getVideoTitle(htmlUrl) {
  return axios.get(htmlUrl)
    .then((res) => {
      const title = res.data.match(/title-row">\s+<p>([^<]*)<\/p>/)?.[1]
      return perfectTitleName(title)
    })
}

async function getSessionId(origin) {
  if(PHPSESSID.value && PHPSESSID.expireTime && PHPSESSID.domain
    && PHPSESSID.domain === origin && dayjs().isBefore(dayjs(PHPSESSID.expireTime))) {
    // 判断时间是否OK，如何OK，就直接用，如果过期了就重新请求。
    return PHPSESSID.value
  } else {
    // 获取新的
    const url = `${host.server}mini/systemConfig/getInsTvc`
    const response = await axios.post(url, {
      origin: origin
    })
    PHPSESSID = response.data.result
    return PHPSESSID.value
  }
}