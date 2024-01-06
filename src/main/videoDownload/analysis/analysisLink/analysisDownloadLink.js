import {ipcMain, app, BrowserWindow} from "electron";
import { getTencentTVDownloadLink } from './analysisByPlatform/tencentTV/tencentTV';
import { getMgTvDownloadLink } from "./analysisByPlatform/mgtv/mgtv";
import { getBiliTVDownloadLink } from "./analysisByPlatform/bilibiliTV/bilibiliTV";
import { getNormalM3u8Link} from "./analysisByPlatform/normalM3u8/normalM3u8";
import { getIQiYiTVDownloadLink } from "./analysisByPlatform/iqiyiTV/iqiyiTV"

ipcMain.handle('get-download-link-from-url', getDownloadLinkFromUrl)

/**
 * 从一个网页里分析出可以下载link(m3u8url)
 * @returns {Promise<void>}
 */
async function getDownloadLinkFromUrl(event, htmlUrl) {
    try{
        if(/v\.qq\.com/.test(htmlUrl)) {
            return await getTencentTVDownloadLink(htmlUrl)
        } else if(/mgtv\.com/.test(htmlUrl)) {
            return await getMgTvDownloadLink(htmlUrl)
        } else if(/bilibili\.com/.test(htmlUrl)) {
            return await getBiliTVDownloadLink(htmlUrl)
        } else if(/iqiyi\.com/.test(htmlUrl)) {
            const aa = await getIQiYiTVDownloadLink(htmlUrl)
            return aa
        } else {
            return await getNormalM3u8Link(htmlUrl)
        }
    } catch (e) {
        console.log(e)
        return "error"
    }

}

