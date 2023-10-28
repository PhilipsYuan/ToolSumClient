const os = require("os");
const path =  require ("path");
const fs = require('fs')
const fsExtra = require('fs-extra');

// 获取node scripts 的参数
const arguments = process.argv.splice(2);

const platformAndArch = arguments[0] || os.platform() + '-' + os.arch();
console.log(arguments[1])
const platform = arguments[1] || os.platform()
const binary = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
const sourcePath = path.resolve(__dirname, '../','ffmpegPlatforms', platformAndArch, binary);
const targetPath = path.resolve(__dirname, '../', 'public', binary)
// 清空文件夹
fsExtra.emptyDirSync(`${__dirname}/../public`);

fs.copyFileSync(sourcePath, targetPath)