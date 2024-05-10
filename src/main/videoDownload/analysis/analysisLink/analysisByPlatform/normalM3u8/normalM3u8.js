import {app, BrowserWindow} from "electron";
import puppeteer from "../../../../../util/source/puppeteer-core";
import path from "path";
import { isBlackRequest } from '../../../../../util/const/abortRequest'
import { getUserAgent} from "../../../../../util/const/userAgentSetting";
import { perfectTitleName } from "../../../../../util/url"

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
        if (/m3u8/.test(url)) {
            const text = await response.text()
            if(/#EXT-X-ENDLIST|#EXTM3U/.test(text))
                m3u8Url = url
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
                    const interval = setInterval(() => {
                        console.log(`检测次数：${index + 1}`)
                        if (m3u8Url || index > 12) {
                            page.removeListener('response', responseFun);
                            clearInterval(interval);
                            window && window.destroy();
                            resolve({m3u8Url: m3u8Url, title: perfectTitleName(title), videoType: 'm3u8'})
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
