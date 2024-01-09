import {app, BrowserWindow} from "electron";
import puppeteer from "../../../../../util/source/puppeteer-core";
import axios from "../../../../../util/source/axios";
import path from "path";
import {makeDir} from "../../../../../util/fs";
import fs from "fs";

const basePath = app.getPath('userData')
const tempM3u8UrlPath = path.resolve(basePath, 'm3u8Video', 'tempM3u8Url');
makeDir(tempM3u8UrlPath)
const m3u8UrlMgPath = path.resolve(tempM3u8UrlPath, 'tencent')
makeDir(m3u8UrlMgPath)

export function getTencentTVDownloadLink(htmlUrl) {
    const promise1 = getM3u8Link(htmlUrl)
    const promise2 = getTitle(htmlUrl)
    return Promise.all([promise1, promise2])
        .then((results) => {
            if(results[0] === 'error' || results[1] === 'error') {
                return 'error'
            } else {
                return {title: results[1], videoUrl: results[0]}
            }
        })
}

export function getTitle(htmlUrl) {
    return axios
        .get(htmlUrl)
        .then((res) => {
            const data = res.data
            const title = data.match(/<title>(.*)<\/title>/)?.[1].split('-')[0].trim();
            return title
        })
        .catch(() => {
            return 'error'
        })
}


async function getM3u8Link(htmlUrl) {
    let m3u8Url = null
    const browser = await pie.connect(app, puppeteer);
    const window = new BrowserWindow({
        show: false, width: 900, height: 600, webPreferences: {
            devTools: true,
            webSecurity: false,
            allowRunningInsecureContent: true,
            experimentalFeatures: true,
            webviewTag: true,
            autoplayPolicy: "document-user-activation-required"
        }
    });
    const page = await global.pie.getPage(browser, window)
    await page.setViewport({"width": 1200, "height": 867, "isMobile": false})

    async function responseFun (response) {
        const url = response.url()
        if(/qq\.com\/proxyhttp/.test(url)) {
            const json = await response.json()
            const json2 = JSON.parse(json.vinfo)
            if(json2?.vl?.vi[0].ul?.m3u8) {
                const vid = getVid(htmlUrl)
                m3u8Url = await createM3u8Url(json2?.vl?.vi[0].ul?.m3u8, vid)
            }
        }
    }
    page.on('response', responseFun);

    try {
        return await window.loadURL(htmlUrl, {
            // userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1'
        })
            .then((res) => {
                const promise = new Promise((resolve) => {
                    let index = 0
                    const interval = setInterval(() => {
                        console.log(`检测次数：${index + 1}`)
                        if (m3u8Url || index > 10) {
                            page.removeListener('response', responseFun);
                            clearInterval(interval);
                            window && window.destroy();
                            resolve(m3u8Url)
                        } else {
                            index++
                        }
                    }, 1000)
                })
                return promise
            })
            .catch((e) => {
                window && window.destroy();
                return 'error'
            })
    } catch (e) {
        window && window.destroy();
        return Promise.resolve('error')
    }
}

/**
 * 创建本地m3u8url
 */
async function createM3u8Url(m3u8Text, id) {
    const json = {
        text: m3u8Text
    }
    const filePath = path.resolve(m3u8UrlMgPath, `${id}.m3u8`)
    await fs.writeFileSync(path.resolve(m3u8UrlMgPath, `${id}.m3u8`), JSON.stringify(json), "utf-8")
    return filePath
}

/**
 * 获取视频的vid
 * @param htmlUrl
 * @returns {*}
 */
function getVid (htmlUrl) {
    const vid = htmlUrl.match(/cover\/[^\/]*\/([^.]*).html/)[1]
    return vid
}
