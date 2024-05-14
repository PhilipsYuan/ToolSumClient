import {app, BrowserWindow} from "electron";
import puppeteer from "../../../../../util/source/puppeteer-core";
import path from "path";
import { isBlackRequest } from '../../../../../util/const/abortRequest'
import { getUserAgent} from "../../../../../util/const/userAgentSetting";
import { perfectTitleName } from "../../../../../util/url"
import { getCorrectAnotherM3u8, generateM3U8String } from "../../../../../util/m3u8Parse"
import {makeDir} from "../../../../../util/fs";
import axios from "../../../../../util/source/axios";
import {Parser} from 'm3u8-parser'
import fs from "fs";
const basePath = app.getPath('userData')
const tempM3u8UrlPath = path.resolve(basePath, 'm3u8Video', 'tempM3u8Url');
makeDir(tempM3u8UrlPath)
const m3u8UrlMgPath = path.resolve(tempM3u8UrlPath, 'normalM3u8')
makeDir(m3u8UrlMgPath)

export function getNormalM3u8Link(htmlUrl) {
    return getM3u8Link(htmlUrl)
        .then((result) => {
            if(result === 'error') {
                return 'error'
            } else {
                return {title: result.title, videoUrl: result.m3u8Url, videoType: result.videoType || 'm3u8'}
            }
        })
}

async function getM3u8Link(htmlUrl) {
    let m3u8Url = null
    let mp4Url = null
    let m3u8Data = null
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
    // window.webContents.openDevTools();
    window.webContents.userAgent = getUserAgent(htmlUrl)
    window.webContents.setUserAgent(getUserAgent(htmlUrl));

    const page = await global.pie.getPage(browser, window)
    await page.setViewport({"width": 475, "height": 867, "isMobile": true})

    page.on('requestfinished', async(request) => {
        const url = request.url()
        if(url === htmlUrl) {
            await page.evaluate(() => {
                Object.defineProperty(navigator, 'platform', {
                    get: function() {
                        return 'iPhone';
                    }
                });
            })
        }
    })

    // 启动request拦截器。拦截一些没有用的请求
    await page.setRequestInterception(true)
    page.on('request', (request) => {
        // 检查请求的 URL 是否是你想要屏蔽的 JS 文件
        if (isBlackRequest(request.url())) {
            // 阻止请求
            request.abort();
        } else {
            // 允许其他请求继续
            request.continue();
        }
    });

    async function responseFun (response) {
        const url = response.url()
        const text = await response.text()
        if(/#EXT-X-ENDLIST|#EXTM3U/.test(text) && response.headers()['content-type'] !== 'application/javascript') {
            m3u8Url = url
            m3u8Data = text
        } else if(response.headers()['content-type'] === 'video/mp4') {
            mp4Url = url
        }
    }
    page.on('response', responseFun);

    try {
        return await window.loadURL(htmlUrl, {
            userAgent: getUserAgent(htmlUrl)
        })
            .then(async (res) => {
                const title = await page.title()
                const promise = new Promise((resolve) => {
                    let index = 0
                    const interval = setInterval(async () => {
                        console.log(`检测次数：${index + 1}`)
                        if (m3u8Url || index > 12) {
                            page.removeListener('response', responseFun);
                            clearInterval(interval);
                            window && window.destroy();
                            let localM3u8Url = m3u8Url
                            if(m3u8Url) {
                                localM3u8Url = await getPerfectM3u8Url(m3u8Url, m3u8Data, title)
                            }
                            resolve({m3u8Url: localM3u8Url, title: perfectTitleName(title), videoType: 'm3u8'})
                        } else if(index > 6 && mp4Url) {
                            page.removeListener('response', responseFun);
                            clearInterval(interval);
                            window && window.destroy();
                            resolve({m3u8Url: mp4Url, title: perfectTitleName(title), videoType: 'mp4'})
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

async function getPerfectM3u8Url(m3u8Url, m3u8Data, title) {
    const parser = new Parser();
    parser.push(m3u8Data);
    parser.end();
    const parsedManifest = parser.manifest;
    try {
        if(parsedManifest.segments?.length > 0) {
            const perfectTitle = perfectTitleName(title).substr(0, 8)
            const filePath = path.resolve(m3u8UrlMgPath, `${perfectTitle}.m3u8`)
            const correctUrl = getCorrectAnotherM3u8(m3u8Url, parsedManifest.segments[0].uri)
            const tsData = await axios.get(correctUrl)
            const subData = tsData.data.substr(0, 8)
            if(/PNG/gi.test(subData)) {
                parsedManifest.segments.forEach((item) => {
                    item.byterange = {
                        length: 10000000,
                        offset: 8
                    }
                })
                const newM3u8Data = generateM3U8String(parsedManifest)
                await fs.writeFileSync(filePath, newM3u8Data, "utf-8")
                return filePath
            } else {
                return m3u8Url
            }
        } else {
            return m3u8Url
        }
    } catch (e) {
        return m3u8Url
    }
}



