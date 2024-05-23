import path from "path";
import shortId from "shortid";
import dayjs from "dayjs";
import {deleteLoadingRecordAndFile, newLoadingRecord} from "../../processList/processList";
import {m3u8VideoDownloadingListDB} from "../../../db/db";
import childProcess from "child_process";
import {newFinishedRecord} from "../../finishList/finishList";
import {sendTips} from "../../../util/electronOperations";
import {Parser} from 'm3u8-parser'
import axios from "../../../util/source/axios"
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
export async function startDownloadCCTVVideo(item) {
  let processedTime = 0;
  item.message = {
    status: 'success',
    content: `下载中...`
  }
  const videoTime = await getVideoLength(item.m3u8Url)
  let command = `${ffmpegPath} -i "${item.m3u8Url}" -c copy -bsf:a aac_adtstoasc "${item.outputPath}"`
  const exec = childProcess.spawn(command, {
    maxBuffer: 5 * 1024 * 1024,
    shell: true
  });
  exec.stderr.on('data', (info) => {
    const stderrStr = info.toString();
    const timeMatch = stderrStr.match(/time=(\d{2}):(\d{2}):(\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = parseInt(timeMatch[3], 10);
      const currentTime = hours * 3600 + minutes * 60 + seconds;
      if (!isNaN(currentTime) && currentTime > processedTime) {
        processedTime = currentTime;
        item.message = {
          status: 'success',
          content: `已完成${((processedTime / videoTime)*100).toFixed(2)}%`
        }
      }
    }
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


async function getVideoLength(m3u8Url) {
  const URLInstance = new URL(m3u8Url)
  const response = await axios.get(m3u8Url)
  if(response?.data) {
    const parser = new Parser();
    parser.push(response.data);
    parser.end();
    const parsedManifest = parser.manifest;
    const uri = parsedManifest?.playlists?.[0]?.uri
    if(uri) {
      const res = await axios.get(`${URLInstance.origin}${uri}`)
      const secondParser = new Parser()
      secondParser.push(res.data);
      secondParser.end();
      const secondParsedManifest = secondParser.manifest;
      let time = 0
      secondParsedManifest.segments.forEach((item) => {
        time = item.duration + time
      })
      return time
    } else {
      return 600
    }
  } else {
    return 600
  }
}