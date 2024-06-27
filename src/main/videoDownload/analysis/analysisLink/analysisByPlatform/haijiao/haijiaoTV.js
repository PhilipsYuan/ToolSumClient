/**
 * 参考链接
 * https://hj2404cb0b.top/post/details?pid=1379328
 */
import dayjs from "dayjs";
import {sendTips} from "../../../../../util/electronOperations";
import {decryptApi} from "./decryptApi";
import {ipcMain} from "electron";
import {perfectTitleName} from "../../../../../util/url";

ipcMain.on('response-http-get-request', getHttpInfo)

let loginResponse = null
let TopicResponse = null
let attachResponse = null
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
  const sourceResponse = await getTopicInfo(`${origin}/api/topic/${sourceId}`)
  const sourceInfo = JSON.parse(d.Base64.decode(d.Base64.decode(d.Base64.decode(sourceResponse.data))))
  const title = sourceInfo.title;
  const attachment = sourceInfo.attachments.find((item) => item.category === 'video');
  if(attachment) {
    const attachId = attachment.id
    const attachInfo = await getAttachInfo(`${origin}/api/attachment`, loginInfo.uid, loginInfo.token, htmlUrl, attachId, sourceId)
    console.log(attachInfo)
    const videoInfo = JSON.parse(d.Base64.decode(d.Base64.decode(d.Base64.decode(attachInfo.data))))
    const url = `${origin}${videoInfo?.remoteUrl}`;
    return {m3u8Url: url, title: perfectTitleName(title), videoType: 'm3u8'}

    // const headers = {
    //   "accept": "application/json, text/plain, */*",
    //   "accept-language": "zh-CN,zh;q=0.9,ja;q=0.8",
    //   "cache-control": "no-cache",
    //   "content-type": "application/json",
    //   "pcver": "2",
    //   "pragma": "no-cache",
    //   "priority": "u=1, i",
    //   "sec-fetch-dest": "empty",
    //   "sec-fetch-mode": "cors",
    //   "sec-fetch-site": "same-origin",
    //   "x-user-id": loginInfo.uid,
    //   "x-user-token": loginInfo.token,
    //   "cookie": `token=${loginInfo.token}; uid=${loginInfo.uid};`,
    //   "Referer": htmlUrl,
    //   "Referrer-Policy": "strict-origin-when-cross-origin"
    // }
    // return fetch(`${origin}/api/attachment`, {
    //   "headers": headers,
    //   "body": `{\"id\":${attachId},\"resource_id\":${sourceId},\"resource_type\":\"topic\",\"line\":\"\"}`,
    //   "method": "POST"
    // })
    //   .then(async (res) => {
    //     const info = await res.text();
    //     const attachment = JSON.parse(info)
    //     const videoInfo = JSON.parse(d.Base64.decode(d.Base64.decode(d.Base64.decode(attachment.data))))
    //     const url = `${origin}${videoInfo.remoteUrl}`;
    //     return {m3u8Url: url, title: perfectTitleName(title), videoType: 'm3u8'}
    //   })
    //   .catch((e) => {
    //     console.log(e)
    //   })
  } else {
    return 'error'
  }
}


async function getLoginInfo(htmlUrl, origin) {
  const currentTime = new Date()
  if(haiJInfo.token && dayjs(currentTime).isBefore(dayjs(haiJInfo.expireTime))) {
    return Promise.resolve(haiJInfo)
  } else {
    loginResponse = null;
    sendTips("send-haijiao-sign-request", htmlUrl , 'haijiao1')
    const promise = new Promise((resolve) => {
      let index = 0
      const interval = setInterval(async () => {
        if(loginResponse || index > 8) {
          clearInterval(interval)
          if(loginResponse) {
            const d = decryptApi();
            const uerInfo = JSON.parse(d.Base64.decode(d.Base64.decode(d.Base64.decode(loginResponse.data))))
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

function getTopicInfo(url) {
  TopicResponse = null
  sendTips("send-haijiao-topic-request", url , 'haijiao2')
  const promise = new Promise((resolve) => {
    let index = 0
    const interval = setInterval(async () => {
      if(TopicResponse || index > 8) {
        clearInterval(interval)
        if(TopicResponse) {
          resolve(TopicResponse)
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

function getAttachInfo (url, uid, token, htmlUrl, attachId, sourceId) {
  console.log(url, uid, token, htmlUrl, attachId, sourceId)
  attachResponse = null
  sendTips("send-haijiao-attach-request", url , 'haijiao3', uid, token, htmlUrl, attachId, sourceId)
  const promise = new Promise((resolve) => {
    let index = 0
    const interval = setInterval(async () => {
      if(attachResponse || index > 8) {
        clearInterval(interval)
        if(attachResponse) {
          resolve(attachResponse)
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

function getHttpInfo(event, type, res) {
  if(type === 'haijiao1') {
    loginResponse = res
  } else if(type === 'haijiao2'){
    TopicResponse = res
  } else if(type === 'haijiao3') {
    attachResponse = res
  }
}
