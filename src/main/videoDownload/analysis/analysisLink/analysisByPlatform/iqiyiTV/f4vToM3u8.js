import axios from "../../../../../util/source/axios";
import {getHeaders} from "../../../../../util/httpHeaders";
import path from "path";
import {deleteDirectory, makeDir} from "../../../../../util/fs";
import {app} from "electron";
import os from "os";
import childProcess from "child_process";
import fs from "fs";
const binary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const ffmpegPath = path.resolve(__dirname, binary);
const basePath = app.getPath('userData')
const tempM3u8UrlPath = path.resolve(basePath, 'm3u8Video', 'tempM3u8Url');
makeDir(tempM3u8UrlPath)
const m3u8UrlMgPath = path.resolve(tempM3u8UrlPath, 'iqiyi')
makeDir(m3u8UrlMgPath)
const tempSourcePath = path.resolve(basePath, 'm3u8Video', 'tempSource')



/**
 * F4v文件列表，转换m3u8url
 */
export async function createM3u8UrlBuyFs(f4vFiles, id, name) {
  let m3u8String = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:400\n#EXT-X-MEDIA-SEQUENCE:0\n`
  const f4vPath = path.resolve(m3u8UrlMgPath, `f4v${id}`)
  makeDir(f4vPath)
  const tempPath = path.resolve(tempSourcePath, name);
  makeDir(tempPath)
  const newUrls = f4vFiles.map((item) => {
    return axios.get(`https://pcw-data.video.iqiyi.com/videos${item.l}`)
      .then((res) => res.data.l)
  })
  return Promise.all(newUrls)
    .then(async (results) => {
      const dataPromises = results.map((url, index) => {
        const headers = getHeaders(url)
        return axios.get(url, {
          responseType: "arraybuffer",
          headers: headers
        })
          .then( async (res) => {
            let data = res.data
            const indexF4vPath = path.resolve(f4vPath, `${index + 1}.f4v`)
            const tsPath = path.resolve(tempPath, `${index + 1}.ts`);
            fs.writeFileSync(indexF4vPath, data, 'binary')
            return new Promise((resolve) => {
              const exec_1 = childProcess.spawn(`${ffmpegPath} -i "${indexF4vPath}" -codec copy -f mpegts -y "${tsPath}"`, {
                maxBuffer: 5 * 1024 * 1024,
                shell: true
              });
              exec_1.stderr.on('close', async () => {
                resolve("covert Success")
              });
            })
              .then(() => {
                return tsPath
              })
          })
      })
      return Promise.all(dataPromises)
    })
    .then(async (results) => {
      f4vFiles.forEach((item, index) => {
        const time = (Number(item.d) / 1000).toFixed(6)
        const extinf = `#EXTINF:${time},\n${results[index]}\n`
        m3u8String = m3u8String + extinf
      })
      m3u8String = m3u8String + `#EXT-X-ENDLIST`
      deleteDirectory(f4vPath)
      return await createM3u8Url(m3u8String, id)
    })
    .catch((e) => {
      deleteDirectory(f4vPath)
      deleteDirectory(tempPath)
      const filePath = path.resolve(m3u8UrlMgPath, `${id}.m3u8`)
      if(fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
      return 'error'
    })
}

/**
 * 创建本地m3u8url
 */
async function createM3u8Url(m3u8Text, id) {
  const filePath = path.resolve(m3u8UrlMgPath, `${id}.m3u8`)
  await fs.writeFileSync(filePath, m3u8Text, "utf-8")
  return filePath
}