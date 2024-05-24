import axios from "../../../../../util/source/axios";
import {perfectTitleName} from "../../../../../util/url";

export default async function getCnPornHubDownloadLink(htmlUrl) {
  const response = await axios.get(htmlUrl)
  if(response.data) {
    const string = response.data.match(/flashvars_(\d+) = (.*?);/)
    if(string?.[2]) {
      try {
        const json = JSON.parse(string[2])
        const title = perfectTitleName(json.video_title || '')
        if(json?.mediaDefinitions) {
          const item1080 = json.mediaDefinitions.find((item) => item.quality == '1080')
          if(item1080 && item1080.videoUrl) {
              return {title, videoUrl: item1080.videoUrl.replace(/\\\//g, '/'), videoType: 'm3u8'}
          } else {
            const item720 = json.mediaDefinitions.find((item) => item.quality == '720')
            if(item720 && item720.videoUrl) {
              return {title, videoUrl: item720.videoUrl.replace(/\\\//g, '/'), videoType: 'm3u8'}
            } else {
              const item480 = json.mediaDefinitions.find((item) => item.quality == '480')
              if(item480 && item480.videoUrl) {
                return {title, videoUrl: item480.videoUrl.replace(/\\\//g, '/'), videoType: 'm3u8'}
              } else {
                return 'error'
              }
            }
          }
        } else {
          return 'error'
        }
      } catch (e) {
        return 'error'
      }
    } else {
      return 'error'
    }
  } else {
    return 'error'
  }
}
