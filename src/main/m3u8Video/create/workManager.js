import {Worker} from 'worker_threads'
import {app} from "electron";
import {sendTips} from "../../util/electronOperations";
import {deleteLoadingRecordAndFile, savePauseDownloadInfo} from "../processList/processList";
import {newFinishedRecord} from "../finishList/finishList";

const basePath = app.getPath('userData');
const tempSourcePath = `${basePath}/m3u8Video/tempSource`;

const works = {}

/**
 * 开启一个work
 */
export function createWork(loadingRecord) {
    const work = new Worker(__dirname + '/downloadTs.js')
    works[loadingRecord.id] = work
    runWork(work, loadingRecord)
}

function runWork(work, loadingRecord) {
    work.postMessage({
        loadingRecord,
        tempSourcePath
    })
    work.on('message', async (data) => {
        if (data.type === 'combineSuccess') {
            await newFinishedRecord({
                name: loadingRecord.name,
                filePath: loadingRecord.outputPath,
                m3u8Url: loadingRecord.m3u8Url
            })
            await deleteLoadingRecordAndFile(null, loadingRecord.id)
            sendTips('m3u8-download-video-success', loadingRecord.id)
        }
        if (data.type === 'pauseSuccess') {
            await savePauseDownloadInfo(loadingRecord)
        }
        if(data.type === 'updateRecord') {
            loadingRecord[data.key] = data.value
        }
    })
}

/**
 * 关闭一个work
 */
export function deleteWork() {

}