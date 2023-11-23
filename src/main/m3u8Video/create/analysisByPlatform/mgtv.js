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
        let cookie = null
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
                cookie = await page.cookies()
            }
        });
        try {
            return await window.loadURL(htmlUrl, {
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
            })
                .then(async (res) => {
                    const promise = new Promise((resolve) => {
                        let index = 0
                        const interval = setInterval(() => {
                            console.log(`检测次数：${index + 1}`)
                            if ((m3u8Text && cookie && cookie.length > 0 && infoPath) || index > 10) {
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
    const keys = ['_source_', 'Province', '__STKUUID', 'mba_deviceid', 'mba_sessionid', 'mba_cxid_expiration', 'mba_cxid',
    'finger', 'beta_timer', 'MQGUID', 'PLANB_FREQUENCY', '__MQGUID', 'PM_CHKID', 'isShowUserPop', 'IPDX', 'sessionid',
        'mba_last_action_time', 'lastActionTime']
    const maps = []
    keys.forEach((key) => {
        const item = cookie.find((item) => {
            return item.name === key
        })
        if(item) {
            maps.push(`${item.name}=${item.value}`)
        }
    })
    const paths = urlObject.pathname.split('/')
    paths.splice(-1, 1)
    const json = {
        host: `${urlObject.protocol}//${urlObject.host}${paths.join('/')}`,
        text: deleteM3uu8Map(m3u8Text),
        cookie: maps.join('; ')
    }
    const filePath = path.resolve(m3u8UrlMgPath, `${id}.m3u8`)
    await fs.writeFileSync(path.resolve(m3u8UrlMgPath, `${id}.m3u8`), JSON.stringify(json), "utf-8")
    return filePath
}

/**
 * 删除m3u8文件里#EXT-X-MAP
 */
function deleteM3uu8Map(aa) {
    const map = aa.match(/#EXT-X-MAP:URI="[^"]*"\n/)[0]
    const missMap= aa.replace(map, '')
    const xmap = missMap.match(/#EXT-MGTV-X-MAP:URI="[^"]*"\n/)[0]
    return missMap.replace(xmap, '')
}