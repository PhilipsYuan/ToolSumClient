import path from "path";
import shortId from "shortid";
import dayjs from "dayjs";
import {deleteLoadingRecordAndFile, newLoadingRecord} from "../../processList/processList";
import {m3u8VideoDownloadingListDB} from "../../../db/db";
import childProcess from "child_process";
import {newFinishedRecord} from "../../finishList/finishList";
import {sendTips} from "../../../util/electronOperations";
import os from "os";
const binary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const ffmpegPath = path.resolve(__dirname, binary);

export async function createCCTVVideoDownloadTask(event, url, name, outPath, htmlUrl, audioUrl, isUpdate, loadingId) {
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
      type: 'm3u8',
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
export function startDownloadCCTVVideo(item) {
  item.message = {
    status: 'success',
    content: `下载中...`
  }
  let command = `${ffmpegPath} -i "${item.m3u8Url}" -c copy -bsf:a aac_adtstoasc "${item.outputPath}"`
  const exec = childProcess.spawn(command, {
    maxBuffer: 5 * 1024 * 1024,
    shell: true
  });
  exec.stderr.on('data', (info) => {
    console.log('2222222：' + info)
  });
  exec.stderr.on('close', async () => {
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
