const os = require("os");
const path =  require ("path");
const fsExtra = require('fs-extra');

// 获取node scripts 的参数
const arguments = process.argv.splice(2);

const platform = arguments[0] || os.platform() + '-' + os.arch();
const sourcePath = path.resolve(__dirname, '../','ffmpegPlatforms', platform);
const targetPath = `${__dirname}/../public/${platform}`
// 清空文件夹
fsExtra.emptyDirSync(`${__dirname}/../public`);

fsExtra.copy(sourcePath, targetPath, (err) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log('Directory copied successfully');
});