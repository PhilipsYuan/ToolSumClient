import {app, ipcMain} from "electron";
import fs from "fs";
import { getSecretKeys, getPlayList } from "../util/m3u8Parse"
import childProcess from "child_process"
import { deleteDirectory, makeDir } from "../util/fs"
const basePath = app.getPath('userData')
const tempSourcePath = `${basePath}/m3u8Video/tempSource`
const axios = require('axios')

ipcMain.handle('generate-video', generateVideo)
/**
 * 生成视频
 */
async function generateVideo(event, url, name, outPath) {
    const tempPath = `${tempSourcePath}/${name}`
    makeDir(tempPath)
    const urlObject = new URL(url);
    const host = `${urlObject.protocol}//${urlObject.host}`
    const res = await axios.get(url)
    console.log(res.data)
    const m3u8Data = await downloadSecretKey(res.data, host, tempPath, urlObject.pathname)
    await downloadTsFiles(m3u8Data, host, tempPath, urlObject.pathname)
    combineVideo(tempPath, name, outPath)
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
 * 下载ts文件，并进行替换
 * @returns {Promise<void>}
 */
async function downloadTsFiles(data, host, tempPath, pathname) {
    global.mainWindow.webContents.send('m3u8-download-tip', '下载0%')
    const urls = getPlayList(data)
    const twoUrls = splitArray(urls, 50)
    const length = twoUrls.length
    async function download(index) {
        if(index < length) {
            const pros = twoUrls[index]
            const promises = pros.map(async (item, subIndex) => {
                const number = index * 50 + 1 + subIndex
                let url = null
                if(item[0] !== '/') {
                    url = host + pathname.match(/\/.*\//)[0] + item
                } else {
                    url = host + item
                }
                const result =  await getFileAndStore(url, number, tempPath)
                console.log(`完成第${number}个`)
                return result
            })
            return Promise.all(promises)
                .then( async (results) => {
                    global.mainWindow.webContents.send('m3u8-download-tip', `下载完成${Number(((index + 1) / length) * 100).toFixed(2)}%`)
                    index = index + 1
                    return await download(index)
                })
                .catch((e) => console.log(e))
        } else {
            await replaceTsFileUrls(urls, data, tempPath)
        }
    }
    await download(0)
}

async function replaceTsFileUrls(urls, data, tempPath) {
    let m3u8Data = data
    urls.forEach((item, index) => {
        m3u8Data = m3u8Data.replace(item, `./${index + 1}.ts`)
    })
    await fs.writeFileSync(`${tempPath}/index.m3u8`, m3u8Data, "utf-8")
}

/**
 * 将数组分拆成多个数组
 * @param array 原数组
 * @param subGroupLength 拆分的每组的数量。
 * @returns {*[]}
 */
function splitArray(array, subGroupLength) {
    let index = 0;
    let newArray = [];
    while(index < array.length) {
        newArray.push(array.slice(index, index += subGroupLength));
    }
    return newArray;
}

/**
 * 获取分片文件，然后存储到临时文件夹中
 */
async function getFileAndStore(url, index, tempPath) {
    const res = await axios.get(url, {
        responseType: "arraybuffer",
        headers: {
            "Content-Type": "application/octet-stream",
        }
    })
    await fs.writeFileSync(`${tempPath}/${index}.ts`, res.data, 'binary')
}

/**
 * 合并，并生成视频
 */
function combineVideo( tempPath, name, outPath) {
    global.mainWindow.webContents.send('m3u8-download-tip', `开始合成`)
    childProcess.exec(`cd "${tempPath}" && ffmpeg -allowed_extensions ALL -protocol_whitelist "file,http,crypto,tcp,https,tls" -i "index.m3u8" -c copy "${outPath}/${name}.mp4"`, (error, stdout, stderr) => {
        if(error) {
            console.error(error)
        } else {
            global.mainWindow.webContents.send('m3u8-download-tip', `合成完成`)
            deleteTempSource(tempPath)
        }
    })
}

/**
 * 删除临时文件
 */
function deleteTempSource(tempPath) {
    deleteDirectory(tempPath)
}