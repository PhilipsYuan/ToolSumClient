import axios from "../../../../../util/source/axios"
import {app, BrowserWindow} from "electron";
import puppeteer from "../../../../../util/source/puppeteer-core";

export async function getHaoKanTVDownloadLink(htmlUrl) {
  return getM3u8Link(htmlUrl)
    .then((result) => {
      if(result === 'error') {
        return 'error'
      } else {
        return {title: result.title, videoUrl: result.m3u8Url}
      }
    })

  // return axios
  //   .get(htmlUrl, {
  //     headers: {
  //       'User-Agent':
  //         'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
  //       referer: 'https://haokan.baidu.com/'
  //     },
  //   })
  //   .then((data) => {
  //     const playInfo = getInfoFromPlayInfo(data.data)
  //   })
}

async function getM3u8Link(htmlUrl) {
  console.log("here2")
  let m3u8Url = null
  const browser = await pie.connect(app, puppeteer);
  const windowBrowswer = new BrowserWindow({
    show: false, width: 900, height: 600, webPreferences: {
      devTools: true,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      webviewTag: true,
      autoplayPolicy: "document-user-activation-required"
    }
  });
  const page = await global.pie.getPage(browser, windowBrowswer)
  await page.setViewport({"width": 475, "height": 867, "isMobile": true})

  // async function responseFun (response) {
  //   const url = response.url()
  //   if (/rec/.test(url)) {
  //     console.log()
  //
  //     // const text = await response.text()
  //     // if(/#EXT-X-ENDLIST|#EXTM3U/.test(text))
  //     //   m3u8Url = url
  //   }
  // }
  // page.on('response', responseFun);

  try {
    return await windowBrowswer.loadURL(htmlUrl, {
      // userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1'
    })
      .then(async (res) => {
        const title = await page.title()
        console.log(title)
        const videoInfo = await page.evaluate(() => window.__PRELOADED_STATE__.curVideoMeta.dash.bd264);
        console.log(videoInfo.curVideoMeta)
        // const promise = new Promise((resolve) => {
        //   let index = 0
        //   const interval = setInterval(() => {
        //     console.log(`检测次数：${index + 1}`)
        //     if (m3u8Url || index > 10) {
        //       page.removeListener('response', responseFun);
        //       clearInterval(interval);
        //       window && window.destroy();
        //       resolve({m3u8Url: m3u8Url, title: title})
        //     } else {
        //       index++
        //     }
        //   }, 1000)
        // })
        // return promise
      })
      .catch((e) => {
        console.log(33333)
        console.log(e)
        windowBrowswer && windowBrowswer.destroy();
        return 'error'
      })
  } catch (e) {
    console.log(222222)
    console.log(e)
    windowBrowswer && windowBrowswer.destroy();
    return Promise.resolve('error')
  }
}

function getInfoFromPlayInfo(data) {
  const infoString = data.match(/window.__PRELOADED_STATE__ = (.*);\s+document.querySelector\('body'\)/)?.[1];
  const info = infoString ? JSON.parse(infoString) : null;
  console.log(info)
  const curVideoMeta = info.curVideoMeta;
  console.log(curVideoMeta)
}
