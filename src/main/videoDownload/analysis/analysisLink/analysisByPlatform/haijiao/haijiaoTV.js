/**
 * 参考链接
 * https://hj2404cb0b.top/post/details?pid=1379328
 */
import dayjs from "dayjs";
import {sendTips} from "../../../../../util/electronOperations";
import axios from "../../../../../util/source/axios";
import {decryptApi} from "./decryptApi";
import {ipcMain} from "electron";
import {perfectTitleName} from "../../../../../util/url";

ipcMain.on('response-http-get-request', getHttpInfo)

let response = null
const haiJInfo = {
  expireTime: '',
  token: null,
  uid: null
}


export async function getHaiJiaoTvDownloadLink(htmlUrl) {
  return getM3u8DownloadLink(htmlUrl)
    .then((result) => {
      if (result !== 'error' && result?.m3u8Url) {
        return {title: result?.title || '', videoUrl: result.m3u8Url, videoType: result?.videoType || 'm3u8'}
      } else {
        return 'error'
      }
    })
}

async function getM3u8DownloadLink(htmlUrl) {
  const d = decryptApi();
  const urlInstance = new URL(htmlUrl)
  let origin = urlInstance.origin;
  const loginInfo = await getLoginInfo(htmlUrl, origin)
  const sourceId = urlInstance.searchParams.get('pid')
  const sourceResponse = await axios.get(`${origin}/api/topic/${sourceId}`)
  const sourceInfo = JSON.parse(d.Base64.decode(d.Base64.decode(d.Base64.decode(sourceResponse.data.data))))
  const title = sourceInfo.title;
  const attachment = sourceInfo.attachments.find((item) => item.category === 'video');
  if(attachment) {
    const attachId = attachment.id
    const headers = {
      "accept": "application/json, text/plain, */*",
      "accept-language": "zh-CN,zh;q=0.9,ja;q=0.8",
      "cache-control": "no-cache",
      "content-type": "application/json",
      "pcver": "2",
      "pragma": "no-cache",
      "priority": "u=1, i",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-user-id": loginInfo.uid,
      "x-user-token": loginInfo.token,
      "cookie": `token=${loginInfo.token}; uid=${loginInfo.uid};`,
      "Referer": htmlUrl,
      "Referrer-Policy": "strict-origin-when-cross-origin"
    }
    return fetch(`${origin}/api/attachment`, {
      "headers": headers,
      "body": `{\"id\":${attachId},\"resource_id\":${sourceId},\"resource_type\":\"topic\",\"line\":\"\"}`,
      "method": "POST"
    })
      .then(async (res) => {
        const info = await res.text();
        const attachment = JSON.parse(info)
        const videoInfo = JSON.parse(d.Base64.decode(d.Base64.decode(d.Base64.decode(attachment.data))))
        const url = `${origin}${videoInfo.remoteUrl}`;
        return {m3u8Url: url, title: perfectTitleName(title), videoType: 'm3u8'}
      })
      .catch((e) => {
        console.log(e)
      })
  } else {
    return 'error'
  }
}


async function getLoginInfo(htmlUrl, origin) {
  const currentTime = new Date()
  if(haiJInfo.token && dayjs(currentTime).isBefore(dayjs(haiJInfo.expireTime))) {
    return Promise.resolve(haiJInfo)
  } else {
    response = null;
    sendTips("send-haijiao-sign-request", htmlUrl , 'haijiao')
    const promise = new Promise((resolve) => {
      let index = 0
      const interval = setInterval(async () => {
        if(response || index > 8) {
          clearInterval(interval)
          if(response) {
            const d = decryptApi();
            const uerInfo = JSON.parse(d.Base64.decode(d.Base64.decode(d.Base64.decode(response.data))))
            haiJInfo.token = uerInfo.token;
            haiJInfo.domain = origin
            haiJInfo.expireTime = dayjs(currentTime).add(1, 'hour');
            haiJInfo.uid = uerInfo.user.id
            resolve(haiJInfo)
          } else {
            resolve("error")
          }
        } else {
          index ++
        }
      }, 1000)
    });
    return promise;
  }
}

function getHttpInfo(event, type, res) {
  if(type === 'haijiao') {
    response = res
  }
}
