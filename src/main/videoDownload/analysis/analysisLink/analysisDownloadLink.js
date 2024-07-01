import {ipcMain, app, BrowserWindow} from "electron";
import { getTencentTVDownloadLink } from './analysisByPlatform/tencentTvBack/tencentTVBack';
import { getMgTvDownloadLink } from "./analysisByPlatform/mgtv/mgtv";
import { getBiliTVDownloadLink } from "./analysisByPlatform/bilibiliTV/bilibiliTV";
import { getNormalM3u8Link} from "./analysisByPlatform/normalM3u8/normalM3u8";
import { getIQiYiTVDownloadLink } from "./analysisByPlatform/iqiyiTV/iqiyiTV";
import { getHaoKanTVDownloadLink } from './analysisByPlatform/haokan/haokanTV';
import { getPZhanTVDownloadLink } from "./analysisByPlatform/PZhanTV/PZhanTV";
import { getBimiacgLink} from './analysisByPlatform/bimiacg/bimiacg'
import {getInsTVDownloadLink} from "./analysisByPlatform/insTV/insTV";
import {getOpenWindowDownloadLink} from "./analysisByPlatform/openWindowM3u8/openWindowM3u8";
import {getNeedOpen} from "../../../util/const/needOpenWeb";
import {getCCTVDownloadLink} from "./analysisByPlatform/cctv/cctv";
import { getTencentTVDownloadLink as test} from "./analysisByPlatform/tencentTV/tencentTV"
import getCnPornHubDownloadLink from "./analysisByPlatform/cnPornHub/cnPornHub";
import {getTnaflixTVDownloadLink} from "./analysisByPlatform/tnaflixTV/tnaflixTV";
import {getWhoresHubTVDownloadLink} from "./analysisByPlatform/whoreshubTV/whoreshubTV"
import axios from '../../../util/source/axios'
import {getHaiJiaoTvDownloadLink} from "./analysisByPlatform/haijiao/haijiaoTV";
import {getMovie1905TVLink} from "./analysisByPlatform/movie1905/movie1905TV";
import {getXiGuaTVLink} from "./analysisByPlatform/xiguaTV/xiguaTV";
import {getXhamsterTVLink} from "./analysisByPlatform/xhamsterTV/xhamsterTV";
ipcMain.handle('get-download-link-from-url', getDownloadLinkFromUrl)

/**
 * 从一个网页里分析出可以下载link(m3u8url)
 * @returns {Promise<void>}
 */
export async function getDownloadLinkFromUrl(event, htmlUrl) {
    try{
        if(/mgtv\.com/.test(htmlUrl)) {
            return await getMgTvDownloadLink(htmlUrl)
        } else if(/bilibili\.com/.test(htmlUrl)) {
            return await getBiliTVDownloadLink(htmlUrl)
        } else if(/iqiyi\.com/.test(htmlUrl)) {
            return await getIQiYiTVDownloadLink(htmlUrl)
        } else if(/v\.qq\.com/.test(htmlUrl)) {
            return await getTencentTVDownloadLink(htmlUrl)
        } else if (/cctv\.com|cctv\.cn|v\.ccdi\.gov\.cn|12371\.cn|docuchina\.cn/.test(htmlUrl)) {
            return await getCCTVDownloadLink(htmlUrl)
        } else if (/haokan\.baidu\.com/.test(htmlUrl)) {
            return await getHaoKanTVDownloadLink(htmlUrl)
        } else if(/bimiacg/.test(htmlUrl)) {
            return await getBimiacgLink(htmlUrl)
        } else if(/cn\.pornhub\.com/.test(htmlUrl)) {
            return await getCnPornHubDownloadLink(htmlUrl)
        } else if (/tnaflix\.com/.test(htmlUrl)) {
            return await getTnaflixTVDownloadLink(htmlUrl)
        } else if(/whoreshub\.com/.test(htmlUrl) || /theyarehuge\.com/.test(htmlUrl)) {
            return await getWhoresHubTVDownloadLink(htmlUrl)
        } else if(/haijiao\.com/.test(htmlUrl)) {
            return await getHaiJiaoTvDownloadLink(htmlUrl)
        } else if(/1905\.com/.test(htmlUrl)) {
            return await getMovie1905TVLink(htmlUrl);
        } else if(/ixigua\.com/.test(htmlUrl)) {
            return await getXiGuaTVLink(htmlUrl);
        } else if(/xhamster\.com/.test(htmlUrl)) {
            return await getXhamsterTVLink(htmlUrl)
        } else if(getNeedOpen(htmlUrl)) {
            return await getOpenWindowDownloadLink(htmlUrl)
        } else {
            return await checkOtherInfo(htmlUrl)
        }
    } catch (e) {
        console.log(e)
        return "error"
    }
}

async function checkOtherInfo(htmlUrl) {
    return axios.get(htmlUrl, {
        timeout: 4000
    })
      .then(async (res) => {
          if(res.data) {
              if(/INS AV/.test(res.data)) {
                  return await getInsTVDownloadLink(htmlUrl)
              } else if(/We're sorry but user doesn't work properly without JavaScript enabled. Please enable it to continue./.test(res.data)) {
                  return await getHaiJiaoTvDownloadLink(htmlUrl)
              } else {
                  return await getNormalM3u8Link(htmlUrl)
              }
          } else {
              return await getNormalM3u8Link(htmlUrl)
          }
      })
      .catch(async () => {
          return await getNormalM3u8Link(htmlUrl)
      })

}

