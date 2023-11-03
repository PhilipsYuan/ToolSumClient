import {app, ipcMain} from "electron";
import fs from "fs";
import {getSecretKeys, getCorrectM3u8File, getPlayList} from "../../util/m3u8Parse"
import {makeDir} from "../../util/fs"
import {splitArray} from '../../util/array';
import {newLoadingRecord} from '../processList/processList';
import axios from '../../util/source/axios'
import path from "path";
import { batchNum } from "./m3u8Config";

const basePath = app.getPath('userData');
const tempSourcePath = path.resolve(basePath, 'm3u8Video', 'tempSource')

ipcMain.handle('check-output-file-not-exist', checkOutputFileNotExist);
ipcMain.handle('create-m3u8-download-task', createM3u8DownloadTask);

/**
 * 创建m3u8下载任务
 */
async function createM3u8DownloadTask(event, url, name, outPath) {
    const outputPath = path.resolve(outPath, `${name}.mp4`);
    if (checkOutputFileNotExist(null, outputPath)) {
        const tempPath = path.resolve(tempSourcePath, name);
        makeDir(tempPath)
        return getCorrectM3u8File(url)
            .then(async (data) => {
                if (data) {
                    const urlObject = new URL(url);
                    const host = `${urlObject.protocol}//${urlObject.host}`
                    const m3u8Data = await downloadSecretKey(data, host, tempPath, urlObject.pathname)
                    const urls = getPlayList(data)
                    const formatUrls = urls.map((item, index) => {
                        let url = ''
                        if (item[0] !== '/' && !/^http/.test(item)) {
                            url = host + urlObject.pathname.match(/\/.*\//)[0] + item
                        } else if (/^http/.test(item)) {
                            url = item
                        } else {
                            url = host + item
                        }
                        return {
                            item, url, number: index + 1
                        }
                    })
                    const twoUrls = splitArray(formatUrls, batchNum)
                    await newLoadingRecord({
                        name: name,
                        m3u8Url: url,
                        m3u8Data: m3u8Data,
                        batchIndex: 0,
                        totalIndex: twoUrls.length,
                        totalUrls: formatUrls,
                        outputPath: outputPath
                    })
                    return 'success'
                } else {
                    return 'failure'
                }
            })
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
    if (keys.length > 0) {
        while (i < keys.length) {
            let url = null
            if (keys[i][0] !== '/' && !/^http/.test(keys[i])) {
                url = host + pathname.match(/\/.*\//)[0] + keys[i]
            } else if (/^http/.test(keys[i])) {
                url = keys[i]
            } else {
                url = host + keys[i]
            }
            const res = await axios.get(url, {
                responseType: "arraybuffer",
                headers: {
                    "Content-Type": "application/octet-stream",
                }
            })
            const dyData = new Uint8Array(res.data);
            await fs.writeFileSync(path.resolve(tempPath, `key${i + 1}.key`), dyData, "utf-8")
            i++
        }
        keys.forEach((item, index) => {
            m3u8Data = m3u8Data.replace(item, path.resolve(tempPath, `key${index + 1}.key`).replace(/\\/g, '/'))
        })
        await fs.writeFileSync(path.resolve(tempPath, `index.m3u8`), m3u8Data, "utf-8")
    }
    return m3u8Data
}



/**
 * 检测要输出的文件是否已经存在，如果已经存在，提示更换名称
 */
function checkOutputFileNotExist(event, path) {
    const isExist = fs.existsSync(path)
    if (isExist) {
        return false
    } else {
        return true
    }
}
