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
    return await windowBrowswer.loadURL(htmlUrl, {})
      .then(async (res) => {
        const title = await page.title()
        const curVideoMeta = await page.evaluate(() => window.__PRELOADED_STATE__.curVideoMeta);
        let audioUrl = ''
        let videoUrl = ''
        if(curVideoMeta?.dash?.bd264) {
          const videoInfo = curVideoMeta?.dash?.bd264;
          const videoItem = videoInfo.video.find((item) => item.id === '1080p' || item.id === '3') || videoInfo.video[0];
          const audioItem = videoInfo.audio[0];
          audioUrl = videoInfo.baseUri + audioItem.baseUrl
          videoUrl = videoInfo.baseUri + videoItem.baseUrl
        } else {
          audioUrl = 'noNeed'
          videoUrl = (curVideoMeta?.clarityUrl.find((item) => item.key === 'sc') || curVideoMeta?.clarityUrl[0])?.url || curVideoMeta?.playurl;
        }
        windowBrowswer && windowBrowswer.destroy();
        if(videoUrl) {
          return {videoUrl, audioUrl, title: title?.replace(/\//g, '').replace(/\\/g, '')};
        } else {
          return 'error'
        }
      })
      .catch((e) => {
        windowBrowswer && windowBrowswer.destroy();
        return 'error'
      })
  } catch (e) {
    windowBrowswer && windowBrowswer.destroy();
    return Promise.resolve('error')
  }
}