import {app, BrowserWindow} from "electron";
import puppeteer from "../../../../util/source/puppeteer-core";

export async function getTXDownloadLink(htmlUrl) {
    let m3u8Url = null
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
    const browser = await pie.connect(app, puppeteer);
    const page = await global.pie.getPage(browser, window)
    await page.setViewport({"width": 475, "height": 867, "isMobile": false})
    async function logRequest(request) {
        if(/qq\.com\/proxyhttp/.test(request.url())) {
            console.log(await request.response())
        }
        const url = request.url()
        if (/\.m3u8$/.test(url)) {
            m3u8Url = url
        }
        // const content = await page.content();
        // console.log(content)
    }
    page.on('request', logRequest);
    page.on('response', async response => {
        if(/qq\.com\/proxyhttp/.test(response.url())) {
            const json = await response.json()
            const json2 = JSON.parse(json.vinfo)
            m3u8Url = json2.vl.vi[0].ul.m3u8
        }
        // do something here
    });
    try {
        return await window.loadURL(htmlUrl, {
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
        })
            .then((res) => {
                const promise = new Promise((resolve) => {
                    let index = 0
                    const interval = setInterval(() => {
                        console.log(`检测次数：${index + 1}`)
                        if (m3u8Url || index > 10) {
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
                console.log(e)
                window && window.destroy();
                return 'error'
            })
    } catch (e) {
        window && window.destroy();
        return Promise.resolve('error')
    }
}

