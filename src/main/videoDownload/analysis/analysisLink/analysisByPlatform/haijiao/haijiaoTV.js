/**
 * 参考链接
 * https://haijiao.com/post/details?pid=1374774
 */
import dayjs from "dayjs";
import{ decryptApi } from "./decryptApi";
import {app, BrowserWindow, ipcMain} from "electron";
import {sendTips} from "../../../../../util/electronOperations";
import puppeteer from "../../../../../util/source/puppeteer-core";
import path from "path";
import {perfectTitleName} from "../../../../../util/url";
import fs from "fs";
import {makeDir} from "../../../../../util/fs";
const basePath = app.getPath('userData')
const tempM3u8UrlPath = path.resolve(basePath, 'm3u8Video', 'tempM3u8Url');
makeDir(tempM3u8UrlPath)
const m3u8UrlMgPath = path.resolve(tempM3u8UrlPath, 'haijiao')
makeDir(m3u8UrlMgPath)

ipcMain.on('response-http-get-request', getHttpInfo)

let response = null
const haiJInfo = {
  expireTime: '',
  token: null,
  uid: null,
  domain: ''
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
  const urlInstance = new URL(htmlUrl)
  let origin = urlInstance.origin;
  const loginInfo = await getLoginInfo(htmlUrl, origin)
  let m3u8Url = null
  let m3u8Data = null
  let title = null
  const browser = await pie.connect(app, puppeteer);
  const window = new BrowserWindow({
    show: false, width: 900, height: 600, webPreferences: {
      devTools: true,
      webSecurity: false,
      nodeIntegration: true,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      webviewTag: true,
      autoplayPolicy: "document-user-activation-required",
      preload: path.join(__dirname, 'preload.js')
    }
  });
  window.webContents.openDevTools();
  const page = await global.pie.getPage(browser, window)
  const ses = window.webContents.session
  ses.cookies.set({
    url: origin,
    name: 'token',
    value: loginInfo.token,
  })
  ses.cookies.set({
    url: origin,
    name: 'uid',
    value: '11414468'
  })
  ses.cookies.set({
    url: origin,
    name: 'NOTLOGIN',
    value: ''
  })
  ses.cookies.set({
    url: origin,
    name: "user",
    value: "%7B%22id%22%3A11414468%2C%22nickname%22%3A%22%u6D77%u89D2%u7528%u6237_11414468%22%2C%22avatar%22%3A%2246%22%2C%22description%22%3A%22%u6D77%u89D2%u793E%u533A%u5185%u5BB9%u5F88%u68D2%uFF0C%u795D%u6D77%u89D2%u793E%u533A%u8D8A%u529E%u8D8A%u597D%u3002%22%2C%22topicCount%22%3A0%2C%22videoCount%22%3A0%2C%22commentCount%22%3A1%2C%22fansCount%22%3A0%2C%22favoriteCount%22%3A9%2C%22status%22%3A0%2C%22sex%22%3A0%2C%22vip%22%3A0%2C%22vipExpiresTime%22%3A%220001-01-01%2000%3A00%3A00%22%2C%22certified%22%3Afalse%2C%22certVideo%22%3Afalse%2C%22certProfessor%22%3Afalse%2C%22famous%22%3Afalse%2C%22forbidden%22%3Afalse%2C%22tags%22%3Anull%2C%22role%22%3A0%2C%22diamondConsume%22%3A0%2C%22title%22%3A%7B%22id%22%3A0%2C%22name%22%3A%22%22%2C%22consume%22%3A0%2C%22consumeEnd%22%3A0%2C%22icon%22%3A%22%22%7D%2C%22friendStatus%22%3Afalse%2C%22voiceStatus%22%3Afalse%2C%22videoStatus%22%3Afalse%2C%22voiceMoneyType%22%3A0%2C%22voiceAmount%22%3A0%2C%22videoMoneyType%22%3A0%2C%22videoAmount%22%3A0%2C%22depositMoney%22%3A0%2C%22phone%22%3A%22%22%2C%22userBank%22%3Anull%2C%22parentId%22%3A0%2C%22gold%22%3A5%2C%22diamond%22%3A0%2C%22passwordSet%22%3Atrue%2C%22payPasswordSet%22%3Afalse%2C%22popularity%22%3A10%2C%22topicLikeNum%22%3A0%2C%22bindUser%22%3A%22%22%2C%22username%22%3A%22yuanfei%22%2C%22email%22%3A%22yuanfei891219@aliyun.com%22%2C%22emailVerified%22%3Afalse%2C%22createTime%22%3A%222021-09-29%2000%3A13%3A05%22%2C%22lastLoginTime%22%3A%222024-06-25%2009%3A49%3A14%22%2C%22lastLoginIp%22%3A%2236.129.150.75%22%2C%22certifiedExpired%22%3Afalse%2C%22certProfessorExpired%22%3Afalse%2C%22certVideoExpired%22%3Afalse%2C%22hasGaEnabled%22%3Afalse%7D"
  })

  async function responseFun(response) {
    const url = response.url()
    const text = await response.text()
    const contentType = response.headers()['content-type']
    if(/api\/topic\/\d+$/.test(url)) {
      const data = JSON.parse(text).data
      const d = decryptApi();
      const videoInfo = JSON.parse(d.Base64.decode(d.Base64.decode(d.Base64.decode(data))))
      title = videoInfo.title
    } else {
      if(contentType !== 'application/javascript') {
        if (/#EXT-X-ENDLIST|#EXTM3U/.test(text)) {
          m3u8Url = url
          m3u8Data = text
        }
      }
    }
  }
  page.on('response', responseFun);

  try {
    return await window.loadURL(htmlUrl)
      .then(async (res) => {
        const promise = new Promise((resolve) => {
          let index = 0
          const interval = setInterval(async () => {
            console.log(`检测次数：${index + 1}`)
            if (m3u8Url || index > 10) {
              page.removeListener('response', responseFun);
              clearInterval(interval);
              window && window.destroy();
              let localM3u8Url = m3u8Url
              if(m3u8Url) {
                localM3u8Url = await createM3u8Url(m3u8Data, perfectTitleName(title))
              }
              resolve({m3u8Url: localM3u8Url, title: perfectTitleName(title), videoType: 'm3u8'})
            } else {
              index++
            }
          }, 1000)
          window.on('close', () => {
            interval && clearInterval(interval);
            resolve('error')
          })
        })
        return promise
      })
  } catch (e) {
    console.log(e)
    window && window.destroy();
    return Promise.resolve('error')
  }
}

export async function getLoginInfo(htmlUrl, origin) {
  const currentTime = new Date()
  if(haiJInfo.token && origin === haiJInfo.domain && dayjs(currentTime).isBefore(dayjs(haiJInfo.expireTime))) {
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
              haiJInfo.expireTime = dayjs(currentTime).add(5, 'hour');
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

async function createM3u8Url(m3u8Text, id) {
  const filePath = path.resolve(m3u8UrlMgPath, `${id}.m3u8`)
  await fs.writeFileSync(filePath, m3u8Text, "utf-8")
  return filePath
}

function getHttpInfo(event, type, res) {
  if(type === 'haijiao') {
    response = res
  }
}
