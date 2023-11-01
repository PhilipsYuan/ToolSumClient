import {Worker} from 'worker_threads'
import {app} from "electron";
import {sendTips} from "../../util/source/electronOperations";
import {deleteLoadingRecordAndFile, savePauseDownloadInfo} from "../processList/processList";
import {newFinishedRecord} from "../finishList/finishList";
import path from 'path';

const basePath = app.getPath('userData');
const tempSourcePath = path.resolve(basePath, 'm3u8Video', 'tempSource')

const works = {}

/**
 * 开启一个work
 */
export function createWork(loadingRecord) {
    const work = new Worker(path.resolve(__dirname, 'downloadTs.js'))
    works[loadingRecord.id] = work
    runWork(work, loadingRecord)
}

function runWork(work, loadingRecord) {
    work.postMessage({
        type: 'start',
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
            work.terminate()
        }
        if (data.type === 'pauseSuccess') {
            await savePauseDownloadInfo(loadingRecord)
            work.terminate()
        }
        if(data.type === 'updateRecord') {
            // console.log('updateRecord', loadingRecord.name)
            // console.log('updateRecord', Object.keys(works))
            loadingRecord[data.key] = data.value
        }
    })
    work.on('exit', (code) => {
        delete works[loadingRecord.id]
        console.log('exit')
        if (code !== 0) {
            console.log(`Worker stopped with exit code ${code}`)
        }
    });
}

/**
 * 更新work
 */
export function updateWork(loadingRecord) {
    const work = works[loadingRecord.id]
    work.postMessage({
        type: 'pause'
    })
}

/**
 * 关闭一个work
 */
export function deleteWork() {

}
