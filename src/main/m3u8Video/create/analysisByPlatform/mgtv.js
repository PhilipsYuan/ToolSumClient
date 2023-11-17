import {BrowserWindow} from "electron";
import fs from 'fs';
import path from "path";
import { app } from 'electron'
import {makeDir} from "../../../util/fs";
const basePath = app.getPath('userData')
const m3u8UrlMgPath = path.resolve(basePath, 'm3u8Video', 'tempM3u8Url', 'mg');
makeDir(m3u8UrlMgPath)

/**
 * 芒果TV
 */
export async function getMgTvDownloadLink(htmlUrl, browser) {
    const id = getTVId(htmlUrl)
    if(id) {
        let m3u8Text = null
        let infoPath = null
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
        const page = await pie.getPage(browser, window)
        await page.setViewport({"width": 475, "height": 867, "isMobile": true})

        page.on('response', async response => {
            const url = response.url()
            const regexId = new RegExp(id)
            if(url === htmlUrl) {
                console.log(await response.request().headers().Cookie)
            } else if(/\/streamList/.test(url) && regexId.test(url)) {
                const json = await response.json()
                if(json.data && json.data.stream_h265 && json.data.stream_h265.length > 0) {
                    const matchItem = json.data.stream_h265.find((item) => {
                        return item.disp
                    })
                    if(matchItem && matchItem.disp && matchItem.disp.info) {
                        infoPath = matchItem.disp.info
                    }
                }
            } else if(/\.m3u8/.test(url) && url.indexOf(infoPath) > -1) {
                m3u8Text = await response.text()
            }
        });
        try {
            return await window.loadURL(htmlUrl, {
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
            })
                .then(async (res) => {
                    const cookie = await page.cookies()
                    const promise = new Promise((resolve) => {
                        let index = 0
                        const interval = setInterval(() => {
                            console.log(`检测次数：${index + 1}`)
                            if ((m3u8Text && cookie && infoPath) || index > 10) {
                                clearInterval(interval);
                                window && window.destroy();
                                const url = createM3u8Url(m3u8Text, cookie, infoPath, id)
                                resolve(url)
                            } else {
                                index++
                            }
                        }, 1000)
                    })
                    return promise
                })
                .catch((e) => {
                    console.log(e)
                    window && window.destroy();
                    return 'error'
                })
        } catch (e) {
            window && window.destroy();
            return Promise.resolve('error')
        }
    } else {
        return Promise.resolve('error')
    }
}

/**
 * 获取芒果TV的Id
 * 从链接里找出Id
 */
function getTVId(htmlUrl) {
    return htmlUrl.match(/\/(\d+).html/)[1]
}

/**
 * 创建本地m3u8url
 */
async function createM3u8Url(m3u8Text, cookie, infoPath, id) {
    const urlObject = new URL(infoPath)
    const map = cookie.reverse().map((item) => {
        return `${item.name}=${item.value}`
    })
    const json = {
        host: `${urlObject.protocol}//${urlObject.host}`,
        text: m3u8Text,
        cookie: map.join(';')
    }
    const filePath = path.resolve(m3u8UrlMgPath, `${id}.m3u8`)
    await fs.writeFileSync(path.resolve(m3u8UrlMgPath, `${id}.m3u8`), JSON.stringify(json), "utf-8")
    return filePath
}