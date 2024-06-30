/**
 * 参考链接
 * https://www.1905.com/vod/play/1045064.shtml?__hz=ccb1d45fb76f7c5a
 */

import {app, BrowserWindow} from "electron";
import path from "path";
import {getUserAgent} from "../../../../../util/const/userAgentSetting";
import {perfectTitleName} from "../../../../../util/url";
import puppeteer from "../../../../../util/source/puppeteer-core";

export function getMovie1905TVLink(htmlUrl) {
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
  let m3u8Url = null
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

  window.webContents.userAgent = getUserAgent(htmlUrl)
  window.webContents.setUserAgent(getUserAgent(htmlUrl));
  const page = await global.pie.getPage(browser, window)

  async function responseFun(response) {
    const url = response.url()
    if(/getVideoinfo.php/.test(url)) {
      const text = await response.text()
      const mm = text.replace('fnCallback0', '')
      const dd = mm.substring(1, mm.length-1)
      const json = JSON.parse(dd)
      const data = json.data;
      const path = data?.path;
      const quality = data?.quality;
      const sign = data?.sign;
      title = data.title
      if(path?.uhd && quality?.uhd && sign?.uhd) {
        m3u8Url = quality.uhd.host + sign.uhd.sign + path.uhd.path
      }else if(path?.hd && quality?.hd && sign?.hd){
        m3u8Url = quality.hd.host + sign.hd.sign + path.hd.path
      } else if(path?.sd && quality?.sd && sign?.sd) {
        m3u8Url = quality.sd.host + sign.sd.sign + path.sd.path
      }
    }
  }

  page.on('response', responseFun);

  try {
    return await window.loadURL(htmlUrl, {
      userAgent: getUserAgent(htmlUrl)
    })
      .then(async (res) => {
        const promise = new Promise((resolve) => {
          let index = 0
          const interval = setInterval(async () => {
            console.log(`检测次数：${index + 1}`)
            if (m3u8Url || index > 18) {
              page.removeListener('response', responseFun);
              clearInterval(interval);
              window && window.destroy();
              resolve({m3u8Url: m3u8Url, title: perfectTitleName(title), videoType: 'm3u8'})
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
      .catch((e) => {
        setTimeout(() => {
          window && window.destroy();
          return 'error'
        }, 14 * 1000)
      })
  } catch (e) {
    window && window.destroy();
    return Promise.resolve('error')
  }
}
