import {app, BrowserWindow} from "electron";
import puppeteer from "../../../../../util/source/puppeteer-core";

export async function getHaoKanTVDownloadLink(htmlUrl) {
  return getM3u8Link(htmlUrl)
    .then((result) => {
      if(result === 'error') {
        return 'error'
      } else {
        return result
      }
    })
}

async function getM3u8Link(htmlUrl) {
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

  try {
    return await windowBrowswer.loadURL(htmlUrl, {
      // userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    })
      .then(async (res) => {
        console.log('here')
        const title = await page.title()
        const videoInfo = await page.evaluate(() => window.__PRELOADED_STATE__.curVideoMeta.dash.bd264);
        const videoItem = videoInfo.video.find((item) => item.id === '1080p' || item.id === '3') || videoInfo.video[0];
        const audioItem = videoInfo.audio[0];
        const audioUrl = videoInfo.baseUri + audioItem.baseUrl
        const videoUrl = videoInfo.baseUri + videoItem.baseUrl
        return {videoUrl, audioUrl, title};
      })
      .catch((e) => {
        console.log('2222', e)
        windowBrowswer && windowBrowswer.destroy();
        return 'error'
      })
  } catch (e) {
    console.log('3333', e)
    windowBrowswer && windowBrowswer.destroy();
    return Promise.resolve('error')
  }
}