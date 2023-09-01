import fs from 'fs'
import path from 'path'
const dirCache = {}

/**
 * 覆盖式写入
 * @param filePath
 * @param data
 */
export function writeDataIntoFile (filePath, data) {
    fs.writeFile(filePath, data, 'utf8', function (err) {
        if (err) {
            console.log(err)
        }
    })
}

/**
 * 创建一个文件夹
 * path: 一个绝对的文件夹路径：/Users/smart-philip/Library/Application Support/my-electron-vite-app/project
 */
export function createDir(path) {
    if(!fs.existsSync(path)) {
        fs.mkdirSync(path)
    }
}

/**
 * 创建文件夹
 * @param filePath
 */
export function mkdir (filePath) {
    const arr = filePath.split('/')
    let dir = arr[0]
    for (let i = 1; i < arr.length; i++) {
        if (!dirCache[dir] && !fs.existsSync(dir)) {
            dirCache[dir] = true
            fs.mkdirSync(dir)
        }
        dir = dir + '/' + arr[i]
    }
    fs.writeFileSync(filePath, '')
}
/**
 * 创建多级目录
 * */
export function makeDir (dirs) {
    if (!fs.existsSync(dirs)) {
        let pathtmp
        dirs.split('/').forEach(function (dirname) {
            if (pathtmp) {
                pathtmp = path.join(pathtmp, dirname)
            } else {
                if (dirname) {
                    pathtmp = dirname
                } else {
                    pathtmp = '/'
                }
            }
            if (!fs.existsSync(pathtmp)) {
                fs.mkdirSync(pathtmp)
            }
        })
    }
}
/**
 * 获取一个文件夹下的文件的数量
 * @param dirPath
 * @return number -1 代表文件夹不存在
 */
export function getFileLengthInDir (dirPath) {
    let length = 0
    if (fs.existsSync(dirPath)) {
        let files = fs.readdirSync(dirPath)
        files.forEach((path) => {
            if (path !== '.DS_Store') {
                length = length + 1
            }
        })
    } else {
        length = -1
    }
    return length
}

/**
 * 获取一个文件夹下的所有文件的名
 * @param dirPath
 */
export function getFilesNameInDir (dirPath) {
    let names = []
    if (fs.existsSync(dirPath)) {
        let files = fs.readdirSync(dirPath)
            .map(function (v) {
                return { name: v,
                    time: fs.statSync(dirPath + '/' + v).birthtime.getTime()
                }
            })
            .sort(function (a, b) { return a.time - b.time })
            .map(function (v) { return v.name })
        files.forEach((path) => {
            if (path !== '.DS_Store') {
                names.push(path)
            }
        })
    }
    return names
}

/**
 * 删除目录下所有文件
 * */
export function deleteDirectory (dir) {
    if(fs.existsSync(dir)) {
        removeDir(dir)
        function removeDir (dir) {
            let statObj = fs.statSync(dir)
            if (statObj.isDirectory()) {
                let dirs = fs.readdirSync(dir)
                dirs = dirs.map(d => path.join(dir, d))
                for (let i = 0; i < dirs.length; i++) {
                    // 深度 先将儿子移除掉 再删除掉自己
                    removeDir(dirs[i])
                }
                fs.rmdirSync(dir)
            } else {
                fs.unlinkSync(dir)
            }
        }
    }
}

/**
 * 拷贝文件到指定目录
 * */
export function copyFileToPath (file, path, name) {
    if (!fs.existsSync(path)) {
        makeDir(path)
    }
    if (fs.existsSync(path + '/' + name)) {
        return {
            code: 100
        }
    }
    if (file) {
        let fileInfo = fs.readFileSync(file)
        fs.writeFileSync(path + '/' + name, fileInfo)
        return {
            code: 200
        }
    } else {
        fs.writeFileSync(path + '/' + name, '')
        return {
            code: 200
        }
    }
}

/**
 * 文件重命名
 * */
export function renameFile (oldName, newName) {
    fs.renameSync(oldName, newName)
}

/**
 * 读取文件里的内容
 */
export function getFileInfo (path) {
    if (path) {
        let check = fs.existsSync(path)
        if (check) {
            return fs.readFileSync(path, 'utf-8')
        }
    }
}
