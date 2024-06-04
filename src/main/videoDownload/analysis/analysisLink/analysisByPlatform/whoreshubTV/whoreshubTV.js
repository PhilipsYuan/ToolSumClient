import {sendTips} from "../../../../../util/electronOperations";
import {ipcMain} from "electron";
import vm from 'vm'
import axios from '../../../../../util/source/axios'
import {perfectTitleName} from "../../../../../util/url";

ipcMain.on('response-http-get-request', getHttpInfo)
let response = null

export async function getWhoresHubTVDownloadLink (htmlUrl) {
  response = null
  sendTips("send-http-get-request", htmlUrl , 'whoreshub')
  const promise = new Promise((resolve) => {
    let index = 0
    const interval = setInterval(async () => {
      if(response || index > 8) {
        clearInterval(interval)
        if(response) {
          const jsonString = response?.match(/var flashvars = (\{[^;]*);/)[1]
          if(jsonString) {
            vm.runInThisContext(`json=${jsonString}`)
            if(json) {
              const title = json.video_title
              let videoUrl = '';
              if(/whoreshub\.com/.test(htmlUrl)) {
                videoUrl = json.video_alt_url3 ? json.video_alt_url3 : json.video_alt_url2 ? json.video_alt_url2 : json.video_alt_url
                  ? json.video_alt_url : json.video_url ? json.video_url : '';
              } else {
                videoUrl = json.video_url || ''
              }
              if(videoUrl && /\.mp4/.test(videoUrl)) {
               const newUrl = await getRedirectUrl(videoUrl)
                resolve({videoUrl: newUrl, title: perfectTitleName(title), videoType: 'mp4'})
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

function getRedirectUrl (url) {
  return axios.get(url, {maxRedirects: 0})
    .then(response => {
      // 检查响应状态码
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        const redirectUrl = response.headers.location;
        console.log(`重定向到: ${redirectUrl}`);
        return redirectUrl;
      } else {
        return ''
      }
    })
    .catch(error => {
      if (error.response && error.response.status >= 300 && error.response.status < 400) {
        const redirectUrl = error.response.headers.location;
        console.log(`重定向到: ${redirectUrl}`);
        return redirectUrl;
      } else {
        console.error(error);
        return ''
      }
    });
}
