import {app, BrowserWindow} from "electron";
import puppeteer from "../../../../../util/source/puppeteer-core";
import path from "path";
import {makeDir} from "../../../../../util/fs";
import fs from "fs";
import {getPlayList} from "../../../../../util/m3u8Parse";

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
                m3u8Url = await createM3u8Url(json2?.vl?.vi[0].ul?.m3u8, vid, json2?.vl?.vi[0].ul.ui[0].url)
                title = json2?.vl?.vi[0].ti
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
                            resolve({m3u8Url, title})
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
async function createM3u8Url(m3u8Text, id, hostPath) {
    const allUrls = getPlayList(m3u8Text)
    allUrls.forEach((item) => {
        const url = buildAbsoluteURL(hostPath, item)
        m3u8Text = m3u8Text.replace(item, url)
    })
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
