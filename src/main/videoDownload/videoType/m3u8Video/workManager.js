import {Worker} from 'worker_threads'
import {app} from "electron";
import {sendTips} from "../../../util/electronOperations";
import {deleteLoadingRecordAndFile} from "../../processList/processList";
import {newFinishedRecord} from "../../finishList/finishList";
import { savePauseDownloadInfo } from "./m3u8Video"

import path from 'path';
import {makeDir} from "../../../util/fs";

const basePath = app.getPath('userData');
const tempSourcePath = path.resolve(basePath, 'm3u8Video', 'tempSource')
makeDir(tempSourcePath)
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
    work && work.postMessage({
        type: 'start',
        loadingRecord,
        tempSourcePath
    })
    work && work.on('message', async (data) => {
        if (data.type === 'combineSuccess') {
            await newFinishedRecord({
                name: loadingRecord.name,
                filePath: loadingRecord.outputPath,
                m3u8Url: loadingRecord.m3u8Url
            })
            await deleteLoadingRecordAndFile(null, loadingRecord.id, 'success')
            sendTips('m3u8-download-video-success', loadingRecord.id)
            work.terminate()
        }
        if (data.type === 'pauseSuccess') {
            await savePauseDownloadInfo(loadingRecord)
            work.terminate()
        }
        if(data.type === 'updateRecord') {
            loadingRecord[data.key] = data.value
        }
    })
    work && work.on('exit', (code) => {
        delete works[loadingRecord.id]
        if (code !== 0) {
            console.log(`Worker stopped with exit code ${code}`)
        }
    });
}

/**
 * 更新work
 */
export async function updateWork(loadingRecord) {
    const work = works[loadingRecord.id]
    if(work) {
        work.postMessage({
            type: 'pause'
        })
    } else {
        await savePauseDownloadInfo(loadingRecord)
    }
}

/**
 * 关闭一个work
 */
export function deleteWork() {

}
