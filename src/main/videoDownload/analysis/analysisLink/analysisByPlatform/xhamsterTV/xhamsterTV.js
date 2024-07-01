import {app, BrowserWindow} from "electron";
import puppeteer from "../../../../../util/source/puppeteer-core";
import path from "path";
import {getUserAgent} from "../../../../../util/const/userAgentSetting";
import {perfectTitleName} from "../../../../../util/url";
import axios from "../../../../../util/source/axios";

/**
 * 参考链接
 * https://hu.xhamster.com/videos/latin-girl-facesits-her-sub-1-812241
 */

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
  let videoInfo = null
  const browser = await pie.connect(app, puppeteer);
  const window = new BrowserWindow({
    show: true, width: 900, height: 600, webPreferences: {
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
    if(url === htmlUrl) {
      const text = await response.text()
      const match = text.match(/standard":\{"h264":([^\]]*\}\])/)[1]
      videoInfo = JSON.parse(match)
    }
  }

  page.on('response', responseFun);

  try {
    return await window.loadURL(htmlUrl)
      .then(async (res) => {
        const title = await page.title();
        console.log(videoInfo)
        console.log('here', title)
        getMoreInfo(videoInfo[0].url)
        return 'error';
        // const promise = new Promise((resolve) => {
        //   let index = 0
        //   const interval = setInterval(async () => {
        //     console.log(`检测次数：${index + 1}`)
        //     if (m3u8Url || index > 18) {
        //       page.removeListener('response', responseFun);
        //       clearInterval(interval);
        //       window && window.destroy();
        //       resolve({m3u8Url: m3u8Url, title: perfectTitleName(title), videoType: 'm3u8'})
        //     } else {
        //       index++
        //     }
        //   }, 1000)
        //   window.on('close', () => {
        //     interval && clearInterval(interval);
        //     resolve('error')
        //   })
        // })
        // return promise
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

function getMoreInfo(url) {
  return axios.get(url)
    .then((res) => {
      console.log(res.data)

    })
}

