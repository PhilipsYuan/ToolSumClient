const os = require("os");
const path =  require ("path");
const fs = require('fs')
const fsExtra = require('fs-extra');

// 获取node scripts 的参数
const arguments = process.argv.splice(2);

const platformAndArch = arguments[0] || os.platform() + '-' + os.arch();
console.log(platformAndArch)
const platform = arguments[1] || os.platform()
const binary = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const sourcePath = path.resolve(__dirname, '../','ffmpegPlatforms', platformAndArch, binary);
const targetPath = path.resolve(__dirname, '../', 'public', binary)
// 清空文件夹
fsExtra.emptyDirSync(`${__dirname}/../public`);

// 将ffmpeg执行文件复制过去
fs.copyFileSync(sourcePath, targetPath)


/**
 * 将腾讯的ckey.wasm 复制过去
 */
const sourceWasmPath = path.resolve(__dirname, '../', 'src', 'main', 'videoDownload', 'analysis',
    'analysisLink', 'analysisByPlatform', 'tencentTV', 'tx-ckey.wasm')
const targetWasmPath = path.resolve(__dirname, '../', 'public', 'tx-ckey.wasm')
fs.copyFileSync(sourceWasmPath, targetWasmPath)