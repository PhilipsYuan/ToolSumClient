import {app, ipcMain} from "electron";
import fs from "fs";
import { getSecretKeys } from "../util/m3u8Parse"
import childProcess from "child_process"
import { deleteDirectory, makeDir } from "../util/fs"
import { downloadTsFiles } from './downloadTsFiles'
import {sendTips} from '../util/electronSendTips'
const basePath = app.getPath('userData')
const tempSourcePath = `${basePath}/m3u8Video/tempSource`
const axios = require('axios')

ipcMain.handle('generate-video', generateVideo)
ipcMain.handle('check-output-file-not-exist', checkOutputFileNotExist)
/**
 * 生成视频
 */
async function generateVideo(event, url, name, outPath) {
    const outputPath = `${outPath}/${name}.mp4`
    if(checkOutputFileNotExist(null, outputPath)) {
        sendTips('m3u8-download-tip', `开始下载`)
        const tempPath = `${tempSourcePath}/${name}`
        makeDir(tempPath)
        const urlObject = new URL(url);
        const host = `${urlObject.protocol}//${urlObject.host}`
        const res = await axios.get(url)
        const m3u8Data = await downloadSecretKey(res.data, host, tempPath, urlObject.pathname)
        await downloadTsFiles(m3u8Data, host, tempPath, urlObject.pathname)
        combineVideo(tempPath, outputPath)
    }
}

/**
 * 下载解码key，并进行替换,
 * 文件里可能会出现多个
 */
async function downloadSecretKey(data, host, tempPath, pathname) {
    const keys = getSecretKeys(data)
    let i = 0;
    let m3u8Data = data
    if(keys.length > 0) {
        while(i < keys.length) {
            let url = null
            if(keys[i][0] !== '/') {
                url = host + pathname.match(/\/.*\//)[0] + keys[i]
            } else {
                url = host + keys[i]
            }
            const res = await axios.get(url)
            await fs.writeFileSync(`${tempPath}/key${i + 1}.key`, res.data, "utf-8")
            i ++
        }
        keys.forEach((item, index) => {
            m3u8Data = m3u8Data.replace(item, `./key${index + 1}.key`)
        })
        await fs.writeFileSync(`${tempPath}/index.m3u8`, m3u8Data, "utf-8")
    }
    return m3u8Data
}

/**
 * 合并，并生成视频
 */
function combineVideo( tempPath, outputPath) {
    sendTips('m3u8-download-tip', `合成中`)
    childProcess.exec(`cd "${tempPath}" && ffmpeg -allowed_extensions ALL -protocol_whitelist "file,http,crypto,tcp,https,tls" -i "index.m3u8" -c copy "${outputPath}"`, (error, stdout, stderr) => {
        if(error) {
            console.error(error)
            sendTips('m3u8-download-tip', `合成失败`)
        } else {
            sendTips('m3u8-download-tip', `合成完成`)
            deleteTempSource(tempPath)
        }
    })
}

/**
 * 检测要输出的文件是否已经存在，如果已经存在，提示更换名称
 */
function checkOutputFileNotExist(event, path) {
    const isExist = fs.existsSync(path)
    if(isExist) {
        return false
    } else {
        return true
    }
}

/**
 * 删除临时文件
 */
function deleteTempSource(tempPath) {
    deleteDirectory(tempPath)
}