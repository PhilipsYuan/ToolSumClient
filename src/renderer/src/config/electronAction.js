/**
 * Api 监听来自main进程的发起的请求
 */
import { useService } from "../service/service";


window.electronAPI.getM3u8DownloadTips(async (event, message) => {
    useService("showM3u8DownloadMessage", message)
})

window.electronAPI.getM3u8DownloadSuccess((event, message) => {
    useService("getM3u8DownloadSuccess")
})

window.electronAPI.getM3u8DownloadFailure((event, message) => {
    useService("getM3u8DownloadFailure", message)
})