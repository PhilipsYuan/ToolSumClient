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
