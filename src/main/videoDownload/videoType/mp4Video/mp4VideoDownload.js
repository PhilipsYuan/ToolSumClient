import path from "path";
import shortId from "shortid";
import dayjs from "dayjs";
import {deleteLoadingRecordAndFile, newLoadingRecord} from "../../processList/processList";
import {m3u8VideoDownloadingListDB} from "../../../db/db";
import {deleteDirectory, makeDir} from "../../../util/fs";
import {app} from "electron";
import axios from "../../../util/source/axios";
import fs from "fs";
import childProcess from "child_process";
import {newFinishedRecord} from "../../finishList/finishList";
import {sendTips} from "../../../util/electronOperations";
import os from "os";
const binary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const ffmpegPath = path.resolve(__dirname, binary);
const basePath = app.getPath('userData');
const tempSourcePath = path.resolve(basePath, 'm3u8Video', 'tempSource')
makeDir(tempSourcePath)
const cancelTokenList = {}

export async function createMp4VideoDownloadTask(event, url, name, outPath, htmlUrl, audioUrl, isUpdate, loadingId) {
  const outputPath = path.resolve(outPath, `${name}.mp4`);
  if(isUpdate) {
    const data = {
      name: name,
      htmlUrl: htmlUrl,
      m3u8Url: url,
      outputPath: outputPath
    }
    return UpdateLoadingRecord(data, loadingId)
  } else {
    const id = shortId.generate()
    const json = {
      id: id,
      type: 'mp4',
      name: name,
      htmlUrl: htmlUrl || '',
      m3u8Url: url,
      message: {
        status: 'success',
        content: '未开始进行下载'
      },
      // 判断是否在进行中
      pausing: false,
      pause: false,
      isStart: false,
      totalVideoLength: 0,
      totalAudioLength: 0,
      lastVideoDownloadPosition: 0,
      lastAudioDownloadPosition: 0,
      outputPath: outputPath,
      updateDate: dayjs().format("YYYY/MM/DD HH:mm")
    }
    await newLoadingRecord(json)
    return 'success'
  }
}

async function UpdateLoadingRecord (data, id) {
  const list = m3u8VideoDownloadingListDB.data.loadingList
  const item = list.find((item) => item.id === id)
  item.m3u8Url = data.m3u8Url
  item.htmlUrl = data.htmlUrl
  item.name = data.name
  item.outputPath = data.outputPath
  item.updateDate = dayjs().format("YYYY/MM/DD HH:mm")
  item.message = {
    status: 'success',
    content: '未开始进行下载'
  }
  await m3u8VideoDownloadingListDB.write()
  return 'success'
}


/**
 * 开始进行下载
 * @param item
 */
export function startDownloadMp4Video(item) {
  const tempPath = path.resolve(tempSourcePath, item.name);
  makeDir(tempPath)
  const videoPath = path.resolve(tempPath, item.name + '-video.mp4')
  const cancelTokens = createCancelTokens(item)
  const promises = []
  if(item.lastVideoDownloadPosition === 0 || item.lastVideoDownloadPosition < item.totalVideoLength) {
    promises.push(downloadBFile('video', cancelTokens.videoCancelToken, item, item.m3u8Url, videoPath))
  }
  Promise.all(promises)
    .then(() => {
      combineVideo(tempPath, videoPath, item)
    })
}

/**
 * 暂停下载视频
 * @returns {Promise<void>}
 */
export async function pauseMp4DownloadVideo(item) {
  item.pause = true
  const cancelTokens = cancelTokenList[item.id]
  cancelTokens.videoCancelToken.cancel('pause')
  delete cancelTokenList[item.id]
  setTimeout(async () => {
    await m3u8VideoDownloadingListDB.write()
  }, 100)
}

/**
 * 继续进行下载
 * @returns {Promise<void>}
 */
export async function continueMp4DownloadVideo(item) {
  startDownloadBiliVideo(item)
}


/**
 * 下载文件（video 和 audio）
 * type: video, audio
 * @param type
 * @param url
 * @param fullFileName
 * @param progressCallback
 * @returns {*}
 */
function downloadBFile(type, cancelToken, item, url, fullFileName, progressCallback) {
  const baseVideoPosition = item.lastVideoDownloadPosition > 0 ? item.lastVideoDownloadPosition : 0;
  return axios
    .get(url, {
      cancelToken: cancelToken.token,
      responseType: 'stream',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
        referer: '',
        'Range': `bytes=${item.lastVideoDownloadPosition}-`
      },
      onDownloadProgress: (progressEvent) => {
        if(type === 'video') {
          if(item.lastVideoDownloadPosition === 0) {
            item.totalVideoLength = progressEvent.total;
          }
          item.lastVideoDownloadPosition = baseVideoPosition + progressEvent.loaded
          item.message = {
            status: 'success',
            content: `下载完成${Number((item.lastVideoDownloadPosition / item.totalVideoLength) * 100).toFixed(2)}%`
          }
        }
      }
    })
    .then(({ data, headers }) => {
      const isExist = fs.existsSync(fullFileName)
      const option = {
        flags: isExist ? 'a' : 'w',
        start: baseVideoPosition
      }
      return new Promise((resolve, reject) => {
        data.pipe(
          fs.createWriteStream(fullFileName, option).on('finish', () => {
            resolve({
              fullFileName
            });
          }),
        );
      });
    });
}

function combineVideo(tempPath, videoPath, item) {
  let command = `${ffmpegPath} -y -i "${videoPath}" -c copy "${item.outputPath}"`
  const exec = childProcess.spawn(command, {
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
      type: 'mp4'
    })
    await deleteLoadingRecordAndFile(null, item.id, 'success')
    sendTips('m3u8-download-video-success', item.id)
  });
}

function createCancelTokens (item) {
  const CancelToken = axios.CancelToken;
  const videoCancelToken = CancelToken.source();
  cancelTokenList[item.id] = {
    videoCancelToken,
  }
  return {
    videoCancelToken,
  }
}

