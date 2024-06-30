import {app, BrowserWindow} from "electron";
import puppeteer from "../../../../../util/source/puppeteer-core";
import path from "path";
import {perfectTitleName} from "../../../../../util/url";

/**
 * 参考链接
 *
 */

export function getXiGuaTVLink(htmlUrl) {
  return getM3u8Link(htmlUrl)
    .then((result) => {
      console.log(result)
      if (result !== 'error' && result?.videoUrl) {
        return {title: result?.title || '', videoUrl: result.videoUrl, audioUrl: result.audioUrl || '', videoType: result?.videoType || 'videoAndAudio'}
      } else {
        return 'error'
      }
    })
}

async function getM3u8Link(htmlUrl) {
  let videoUrl = null
  let audioUrl = null
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
  const page = await global.pie.getPage(browser, window)

  async function responseFun(response) {
    const url = response.url()
    const contentType = response.headers()['content-type']
    if(contentType === 'video/mp4' && (/media-video/.test(url) || (/video\/tos/.test(url) && !/media-audio/.test(url)))) {
      videoUrl = url
    } else if(contentType === 'video/mp4' && /media-audio/.test(url)) {
      audioUrl = url
    }
  }

  page.on('response', responseFun);

  try {
    return await window.loadURL(htmlUrl, {
    })
      .then(async (res) => {
        const title = await page.title()
        const promise = new Promise((resolve) => {
          let index = 0
          const interval = setInterval(async () => {
            console.log(`检测次数：${index + 1}`)
            if ((videoUrl && audioUrl) || index > 18) {
              page.removeListener('response', responseFun);
              clearInterval(interval);
              window && window.destroy();
              resolve({videoUrl, audioUrl, title: perfectTitleName(title), videoType: 'videoAndAudio'})
            } else if(videoUrl && index > 4) {
              page.removeListener('response', responseFun);
              clearInterval(interval);
              window && window.destroy();
              resolve({videoUrl, audioUrl, title: perfectTitleName(title), videoType: 'mp4'})
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