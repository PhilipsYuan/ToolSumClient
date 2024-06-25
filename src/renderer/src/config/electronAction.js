import axios from "../utils/axios";
import { md5 } from 'js-md5';
/**
 * Api 监听来自main进程的发起的请求
 */
import { useService } from "../service/service";


window.electronAPI.getM3u8FileFailureTips(async (event, status, content) => {
    useService("getM3u8FileFailureTips", status, content)
})

window.electronAPI.m3u8VideoDownloadSuccess(async(event, loadingId) => {
    useService("m3u8VideoDownloadSuccess", loadingId)
})

window.electronAPI.showPauseTipBeforeClose(async(event, content) => {
    useService("showScreenLoadingMessage", content)
})

window.electronAPI.deleteM3u8LoadingSuccess(async (event, callType) => {
    useService("deleteM3u8LoadingSuccess", callType)
})

window.electronAPI.getUserChooseSearchPageUrl(async (event, url) => {
    useService('getUserChooseSearchPageUrl', url)
})

window.electronAPI.sendSearchPageUrlLoadFail(async (event) => {
    useService('showSearchPageUrlLoadFail')
})

window.electronAPI.changeSearchPageUrl(async (event, url) => {
    useService('changeSearchPageUrl', url)
})

window.electronAPI.changeVideoPlayItem(async(event, videoPath, videoName) => {
    useService('changeVideoPlayItem', videoPath, videoName)
})

window.electronAPI.openAboutXhl(async(event, version) => {
    useService('openAboutXhl', version)
})

window.electronAPI.m3u8AnalysisOpenWindow(async(event, version) => {
    useService('m3u8AnalysisOpenWindow')
})

window.electronAPI.sendHttpGetRequest(async(event, url, type) => {
    const response = await axios.get(url)
    window.electronAPI.responseHttpGetRequest(type,response.data)
})
//
window.electronAPI.sendHaijiaoSignRequest(async(event, url, type) => {
    const userAgent = window.navigator.userAgent;
    const mm = `yuanfei88611961${userAgent}`;
    const hash = md5.create();
    hash.update(mm);
    const sign = hash.hex();
    const urlInstance = new URL(url)
    let origin = urlInstance.origin;
    let data = JSON.stringify({
        "Username": "yuanfei",
        "Password": "88611961",
        "Sign": sign
    });
    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: `${origin}/api/login/signin`,
        headers: {
            'Content-Type': 'application/json'
        },
        data : data
    };
    axios.request(config)
      .then((response) => {
          window.electronAPI.responseHttpGetRequest(type,response.data)
      })
      .catch((error) => {
          console.log(error);
      });
})
