import {sendTips} from "../../../../../util/electronOperations";
import {ipcMain} from "electron";
import * as htmlparser2 from "htmlparser2";
import {perfectTitleName} from "../../../../../util/url";

ipcMain.on('response-http-get-request', getHttpInfo)

let response = null
export async function getTnaflixTVDownloadLink(htmlUrl) {
  response = null
  const {videoName, videoId} = getVideoNameAndId(htmlUrl)
  if(videoId) {
    sendTips("send-http-get-request", `https://m.tnaflix.com/ajax/video-player/${videoId}` , 'tnaflix')
    const promise = new Promise((resolve) => {
      let index = 0
      const interval = setInterval(() => {
        if(response || index > 8) {
          clearInterval(interval)
          if(response) {
            const dom = htmlparser2.parseDocument(response.html);
            const items = dom.children[0].children.filter((item) => item.name === 'source')
            const item720 = items.find((item) => item.attribs.size === '720')
            const item480 = items.find((item) => item.attribs.size === '480')
            const item360 = items.find((item) => item.attribs.size === '360')
            const item240 = items.find((item) => item.attribs.size === '240')
            const item = item720 ? item720 : item480 ? item480 : item360 ? item360 : item240 ? item240 : '';
            if(item) {
              resolve({videoUrl: item.attribs.src, title: perfectTitleName(videoName), videoType: 'mp4'})
              return {}
            } else {
              resolve("error")
            }
          } else {
            resolve("error")
          }
        } else {
          index ++
        }
      }, 1000)
    })
    return promise
  } else {
    return Promise.resolve('error')
  }
}

export function getVideoNameAndId (htmlUrl) {
  const url = new URL(htmlUrl)
  const paths = url.pathname.split('/')
  const videoIdIndex = paths.findIndex((item) => /video\d+$/.test(item))
  const videoName = paths[videoIdIndex -1]
  const videoId = paths[videoIdIndex]
  const id = videoId ? videoId.match(/\d+/)[0] : '';
  return {videoName, videoId: id}
}

export function getHttpInfo(event, type, res) {
  if(type === 'tnaflix') {
    response = res
  }
}