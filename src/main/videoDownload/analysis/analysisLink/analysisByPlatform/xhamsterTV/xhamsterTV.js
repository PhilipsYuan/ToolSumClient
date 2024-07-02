/**
 * 参考链接
 * https://hu.xhamster.com/videos/latin-girl-facesits-her-sub-1-812241
 */
import {buildAbsoluteURl, perfectTitleName} from "../../../../../util/url";
import {requestGet} from "../../../../../util/request";
import {Parser} from "m3u8-parser";

export function getXhamsterTVLink(htmlUrl) {
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
  return requestGet(htmlUrl, null, true)
    .then(async (res) => {
      const title = res.match(/"pageTitle":\s*"(.*?)",/)?.[1]
      const match = res.match(/standard":\{"h264":([^\]]*\}\])/)?.[1]
      const videoInfo = JSON.parse(match)
      const newUrl = await getMoreInfo(videoInfo?.[0].url)
      return {m3u8Url: newUrl, title: perfectTitleName(title), videoType: 'm3u8'}
    })
    .catch(() => {
      return "error"
    })
}

function getMoreInfo(url) {
  return requestGet(url, null, true)
    .then((res) => {
      const parser = new Parser();
      parser.push(res);
      parser.end();
      const parsedManifest = parser.manifest;
      if(parsedManifest.playlists && parsedManifest.playlists.length > 0) {
        const absoluteUrl = buildAbsoluteURl(url, parsedManifest.playlists[parsedManifest.playlists.length -1].uri)
        return absoluteUrl
      } else {
        return url
      }
    })
}

