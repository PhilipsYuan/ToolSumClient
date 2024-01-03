import {app, BrowserWindow} from "electron";
import puppeteer from "../../../../../util/source/puppeteer-core";
import axios from "../../../../../util/source/axios";

export function getNormalM3u8Link(htmlUrl) {
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
            const title = data.match(/<title>(.*)<\/title>/)?.[1].split('-')[0];
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
    await page.setViewport({"width": 475, "height": 867, "isMobile": true})

    async function responseFun (response) {
        const url = response.url()
        if (/\.m3u8/.test(url)) {
            const text = await response.text()
            if(/#EXT-X-ENDLIST/.test(text))
                m3u8Url = url
        }
    }
    page.on('response', responseFun);

    try {
        return await window.loadURL(htmlUrl, {
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1'
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
