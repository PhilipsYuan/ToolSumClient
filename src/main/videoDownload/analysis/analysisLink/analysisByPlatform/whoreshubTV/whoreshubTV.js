import {sendTips} from "../../../../../util/electronOperations";
import {ipcMain} from "electron";
import vm from 'vm'
import {perfectTitleName} from "../../../../../util/url";

ipcMain.on('response-http-get-request', getHttpInfo)
let response = null

export async function getWhoresHubTVDownloadLink (htmlUrl) {
  response = null
  sendTips("send-http-get-request", htmlUrl , 'whoreshub')
  const promise = new Promise((resolve) => {
    let index = 0
    const interval = setInterval(() => {
      if(response || index > 8) {
        clearInterval(interval)
        if(response) {
          const jsonString = response?.match(/var flashvars = (\{[^;]*);/)[1]
          if(jsonString) {
            vm.runInThisContext(`json=${jsonString}`)
            if(json) {
              const title = json.video_title
              const videoUrl = json.video_alt_url3 ? json.video_alt_url3 : json.video_alt_url2 ? json.video_alt_url2 : json.video_alt_url
                ? json.video_alt_url : json.video_url ? json.video_url : '';
              if(videoUrl) {
                resolve({videoUrl, title: perfectTitleName(title), videoType: 'mp4'})
              } else {
                resolve("error")
              }
            } else {
              resolve("error")
            }
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
}

function getHttpInfo(event, type, res) {
  if(type === 'whoreshub') {
    response = res
  }
}