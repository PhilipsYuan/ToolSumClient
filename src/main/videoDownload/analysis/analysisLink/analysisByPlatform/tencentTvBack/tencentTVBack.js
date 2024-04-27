import {app, BrowserWindow} from "electron";
import puppeteer from "../../../../../util/source/puppeteer-core";
import path from "path";
import {makeDir} from "../../../../../util/fs";
import fs from "fs";
import {getPlayList} from "../../../../../util/m3u8Parse";
import { decryptProcess } from "./getVinFo";
import { getVideoInfo } from './addLoginVersion'
import axios from "../../../../../util/source/axios";

/**
 * 如果是免费的视频，m3u8文件在proxyhttp直接获取。
 * 如果是付费的视频，m3u8文件在ul下面获取接口，重新获取。独立的http请求
 * @type {string}
 */

const basePath = app.getPath('userData')
const tempM3u8UrlPath = path.resolve(basePath, 'm3u8Video', 'tempM3u8Url');
makeDir(tempM3u8UrlPath)
const m3u8UrlMgPath = path.resolve(tempM3u8UrlPath, 'tencent')
makeDir(m3u8UrlMgPath)

export function getTencentTVDownloadLink(htmlUrl) {
    return getM3u8Link(htmlUrl)
        .then((result) => {
            if(result === 'error') {
                return 'error'
            } else {
                return {title: result.title, videoUrl: result.m3u8Url}
            }
        })
}

async function getM3u8Link(htmlUrl) {
    let m3u8Url = null
    let title = null
    const browser = await pie.connect(app, puppeteer);
    const window = new BrowserWindow({
        show: false, width: 900, height: 600, webPreferences: {
            devTools: true,
            webSecurity: false,
            allowRunningInsecureContent: true,
            experimentalFeatures: true,
            webviewTag: true,
            autoplayPolicy: "user-gesture-required"
        }
    });
    const page = await global.pie.getPage(browser, window)
    await page.setViewport({"width": 1200, "height": 867, "isMobile": false})
    async function responseFun (response) {
        const url = response.url()
        if(/qq\.com\/proxyhttp/.test(url)) {
            const post = JSON.parse(response.request().postData())
            if(post.buid === 'vinfoad') {
                const vid = getVid(htmlUrl)
                const info = await getUrlAndTitle(url, post, vid)
                if(info) {
                    m3u8Url = info.m3u8Url
                    title = info.title
                }
            }
        }
    }
    page.on('response', responseFun);
    page.once('load', async () => {
        await page.evaluate(() => {
            localStorage.setItem('__thumbplayer_setting__definition_vod', 'shd');
        });
    });
    try {
        window.webContents.on('did-finish-load', () => {
            // 将页面声音静音
            window.webContents.setAudioMuted(true);
        });
        return await window.loadURL(htmlUrl, {
            // userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Mobile/15E148 Safari/604.1'
        })
            .then(async (res) => {
                const promise = new Promise((resolve) => {
                    let index = 0
                    const interval = setInterval(() => {
                        console.log(`检测次数：${index + 1}`)
                        if (m3u8Url || index > 10) {
                            page.removeListener('response', responseFun);
                            clearInterval(interval);
                            window && window.destroy();
                            resolve({m3u8Url, title: title?.replace(/\//g, '').replace(/\\/g, '')})
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
 * 递归解析，为了获取正确的解码内容（因为解码不够完美，会出现解码出来找不到问题）
 * 这个需要优化，完美破解解码
 * @param url
 * @param post
 * @returns {Promise<void>}
 */
async function getUrlAndTitle (url, post, vid) {
    const info = await getVideoInfo(url, post)
    const json = JSON.parse(info.vinfo)
    if(json.anc) {
        const result = await decryptProcess(info.vinfo) || ''
        const m3u8String = result.match(/(#EXTM3U.*#EXT-X-ENDLIST)/)?.[1].replace(/\\n/g, '\n').replace(/\\u0026/g, '&');
        if(m3u8String) {
            const hosts = result.match(/"(https:\/\/[^"]*)"/g)
            if(hosts.length > 6) {
                const matchHosts = hosts.filter((item) => item.length > 100)
                const clearHosts = matchHosts.map((item) => item.replace('"', ''))
                const allUrls = getPlayList(m3u8String)
                let host = ''
                for(let hostItem of clearHosts) {
                    const url =  buildAbsoluteURL(hostItem, allUrls[0])
                    try {
                        const match = await axios.get(url)
                        if(match.status === 200) {
                            host = hostItem
                            break;
                        }
                    } catch (e) {
                       // nothing to do
                    }
                }
                const m3u8Url = await createM3u8Url(m3u8String, vid, host)
                const title = result?.match(/"ti":"([^"]*)"/)[1]
                return {m3u8Url, title}
            } else {
                return await getUrlAndTitle(url, post, vid)
            }
        } else {
            const allInfo = result.match(/"ul":{"ui":\[{"url":(.*)"}},{"/)?.[0]
            if (allInfo) {
                const host = allInfo.match(/"url":"([^"]*)"/)?.[1]
                const path = allInfo.match(/"pt":"([^"]*)"/)?.[1]
                const url = host + path
                const m3u8Result = await axios.get(url)
                const m3u8Url = await createM3u8Url(m3u8Result.data, vid, host)
                const title = result?.match(/"ti":"([^"]*)"/)[1]
                return {m3u8Url, title}
            }
        }
    } else if(json?.vl?.vi[0].ul?.m3u8){
        const m3u8Url = await createM3u8Url(json?.vl?.vi[0].ul?.m3u8, vid, json?.vl?.vi[0].ul.ui[0].url)
        const title = json?.vl?.vi[0].ti
        return {m3u8Url, title}
    } else if(json.vl.vi[0].ul.ui && json.vl.vi[0].ul.ui[0]){
        const item = json.vl.vi[0].ul.ui[0]
        const url = item.url + item.hls?.pt
        const result = await axios.get(url)
        const m3u8Url = await createM3u8Url(result.data, vid, item.url)
        const title = json?.vl?.vi[0].ti
        return {m3u8Url, title}
    } else {
        return null
    }
}

/**
 * 创建本地m3u8url
 */
async function createM3u8Url(m3u8Text, id, hostPath) {
    const allUrls = getPlayList(m3u8Text)
    allUrls.forEach((item) => {
        const url = buildAbsoluteURL(hostPath, item)
        m3u8Text = m3u8Text.replace(item, url)
    })
    const filePath = path.resolve(m3u8UrlMgPath, `${id}.m3u8`)
    await fs.writeFileSync(path.resolve(m3u8UrlMgPath, `${id}.m3u8`), m3u8Text, "utf-8")
    return filePath
}

/**
 * 获取视频的vid
 * @param htmlUrl
 * @returns {*}
 */
function getVid (htmlUrl) {
    let vid = htmlUrl.match(/[cover|page]\/[^\/]*\/([^.]*).html/)?.[1] || htmlUrl.match(/page\/([^.]*).html/)?.[1]
    if(!vid) {
        vid = new Date().getTime()
    }
    return vid
}

/**
 * 创建绝对路径
 */
function buildAbsoluteURL(e, t, r= {alwaysNormalize: true}) {
    const n = /^([^\/?#]*)([^]*)$/;
    if (r = r || {},
        e = e.trim(),
        !(t = t.trim())) {
        if (!r.alwaysNormalize)
            return e;
        const i = parseURL(e);
        if (!i)
            throw new Error("Error trying to parse base URL.");
        return i.path = normalizePath(i.path),
            buildURLFromParts(i)
    }
    var a = parseURL(t);
    if (!a)
        throw new Error("Error trying to parse relative URL.");
    if (a.scheme)
        return r.alwaysNormalize ? (a.path = normalizePath(a.path),
            buildURLFromParts(a)) : t;
    var o = parseURL(e);
    if (!o)
        throw new Error("Error trying to parse base URL.");
    if (!o.netLoc && o.path && "/" !== o.path[0]) {
        var l = n.exec(o.path);
        o.netLoc = l[1],
            o.path = l[2]
    }
    o.netLoc && !o.path && (o.path = "/");
    var c = {
        scheme: o.scheme,
        netLoc: a.netLoc,
        path: null,
        params: a.params,
        query: a.query,
        fragment: a.fragment
    };
    if (!a.netLoc && (c.netLoc = o.netLoc,
    "/" !== a.path[0]))
        if (a.path) {
            var h = o.path
                , u = h.substring(0, h.lastIndexOf("/") + 1) + a.path;
            c.path = normalizePath(u)
        } else
            c.path = o.path,
            a.params || (c.params = o.params,
            a.query || (c.query = o.query));
    return null === c.path && (c.path = r.alwaysNormalize ? normalizePath(a.path) : a.path),
        buildURLFromParts(c)
}

function parseURL (e) {
    const i = /^((?:[a-zA-Z0-9+\-.]+:)?)(\/\/[^\/?#]*)?((?:[^\/?#]*\/)*[^;?#]*)?(;[^?#]*)?(\?[^#]*)?(#[^]*)?$/
    let t = i.exec(e);
    return t ? {
        scheme: t[1] || "",
        netLoc: t[2] || "",
        path: t[3] || "",
        params: t[4] || "",
        query: t[5] || "",
        fragment: t[6] || ""
    } : null
}

function normalizePath(e) {
    const a = /(?:\/|^)\.(?=\/)/g;
    const o = /(?:\/|^)\.\.\/(?!\.\.\/)[^\/]*(?=\/)/g;
    for (e = e.split("").reverse().join("").replace(a, ""); e.length !== (e = e.replace(o, "")).length; )
        ;
    return e.split("").reverse().join("")
}

function buildURLFromParts(e) {
    return e.scheme + e.netLoc + e.path + e.params + e.query + e.fragment
}
