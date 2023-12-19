import path from "path";
import shortId from "shortid";
import {deleteLoadingRecordAndFile, newLoadingRecord} from "../../processList/processList";
import axios from '../../../util/source/axios'
import { throttle } from 'lodash'
import {app} from "electron";
import os from "os";
import childProcess from "child_process";
import {deleteDirectory, makeDir} from "../../../util/fs";
import {newFinishedRecord} from "../../finishList/finishList";
import {sendTips} from "../../../util/source/electronOperations";
import fs from 'fs'

const binary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const ffmpegPath = path.resolve(__dirname, binary);
const basePath = app.getPath('userData');
const tempSourcePath = path.resolve(basePath, 'm3u8Video', 'tempSource')

export async function createBiliVideoDownloadTask(event, url, name, outPath, audioUrl) {
    const outputPath = path.resolve(outPath, `${name}.mp4`);
    const id = shortId.generate()
    const json = {
        id: id,
        type: 'biliTV',
        name: name,
        m3u8Url: url,
        audioUrl: audioUrl,
        message: {
            status: 'success',
            content: '未开始进行下载'
        },
        // 判断是否在进行中
        pausing: false,
        pause: false,
        isStart: false,
        outputPath: outputPath
    }
    await newLoadingRecord(json)
    return 'success'
}

/**
 * 开始进行下载
 * @param item
 */
export function startDownloadBiliVideo(item) {
    const tempPath = path.resolve(tempSourcePath, item.name);
    makeDir(tempPath)
    const videoPath = path.resolve(tempPath, item.name + '-video.m4s')
    const audioPath = path.resolve(tempPath, item.name + '-audio.m4s')
    const videoPromise = downloadBFile(item.m3u8Url, videoPath, throttle(
        value => {
            item.message = {
                status: 'success',
                content: `下载完成${Number(value * 100).toFixed(2)}%`
            }
        },
        1000,
    ))
    const audioPromise = downloadBFile(item.audioUrl, audioPath);
    Promise.all([videoPromise, audioPromise])
        .then(() => {
            combineVideo(tempPath, videoPath, audioPath, item)
        })
}

function combineVideo(tempPath, videoPath, audioPath, item) {
    const exec = childProcess.spawn(`${ffmpegPath} -y -i "${videoPath}" -i "${audioPath}" -c copy "${item.outputPath}"`, {
        maxBuffer: 5 * 1024 * 1024,
        shell: true
    });
    exec.stderr.on('data', (info) => {
        console.log('2222222：' + info)
    });
    exec.stderr.on('close', async () => {
        deleteDirectory(tempPath)
        await newFinishedRecord({
            name: item.name,
            filePath: item.outputPath,
            m3u8Url: item.m3u8Url,
            audioUrl: item.audioUrl
        })
        await deleteLoadingRecordAndFile(null, item.id, 'success')
        sendTips('m3u8-download-video-success', item.id)
    });
}

function downloadBFile(url, fullFileName, progressCallback) {
    return axios
        .get(url, {
            responseType: 'stream',
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
                referer: 'https://www.bilibili.com',
            },
        })
        .then(({ data, headers }) => {
            let currentLen = 0;
            const totalLen = headers['content-length'];

            return new Promise((resolve, reject) => {
                data.on('data', ({ length }) => {
                    currentLen += length;
                    progressCallback && progressCallback(currentLen / totalLen);
                });

                data.pipe(
                    fs.createWriteStream(fullFileName).on('finish', () => {
                        resolve({
                            fullFileName,
                            totalLen,
                        });
                    }),
                );
            });
        });
}