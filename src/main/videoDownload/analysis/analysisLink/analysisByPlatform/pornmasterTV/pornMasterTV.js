/**
 * 参考链接
 * https://pornmaster.fun/hd/9/tgo/tgos-11-days-worn-white-dr-martens-socks
 */
import {perfectTitleName} from "../../../../../util/url";
import axios from '../../../../../util/source/axios'

export function getPornMasterTVLink(htmlUrl) {
  return getM3u8Link(htmlUrl)
    .then((result) => {
      if (result !== 'error' && result?.m3u8Url) {
        return {title: result?.title || '', videoUrl: result.m3u8Url, videoType: result?.videoType || 'm3u8'}
      } else {
        return 'error'
      }
    })
}

async function getM3u8Link(htmlUrl) {
  return axios.get(htmlUrl)
    .then(async (res) => {
      const title = res.data.match(/<title>(.*?)<\/title>/)?.[1]
      const url = res.data.match(/<meta property="og:video" content="(.*?)"/)?.[1]
      if(url) {
        return {m3u8Url: url, title: perfectTitleName(title), videoType: 'mp4'}
      }
      return "error"
    })
    .catch((e) => {
      console.log(e)
      return "error"
    })
}