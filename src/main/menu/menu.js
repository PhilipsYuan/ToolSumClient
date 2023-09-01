import {dialog, ipcMain, Menu} from "electron";

ipcMain.on('update-menus', updateMenu)

const template = [
    {
        label: '账号',
        submenu: [
            {
                label: '解绑许可证密钥',
                click: () => global.mainWindow.webContents.send('unbind-active-code')
            },
            {
                label: '更换许可证密钥',
                click: () => global.mainWindow.webContents.send('change-active-code')
            }
        ]
    },
    {
        label: '项目',
        submenu: [{
            label: '新建项目',
            click: () => global.mainWindow.webContents.send('create-new-project')
        }, {
            label: '打开已有的项目',
        }, {
            label: '删除当前项目',
            click: () => global.mainWindow.webContents.send('open-delete-confirm-modal')
        }, {
            type: 'separator'
        }, {
            label: '导入CSV文件',
            click: function () {
                // if (!isMainWindowFoucsed()) return
                // openCsvImport()
            }
        }, {
            label: '导出excel文件',
            click: function () {
                // if (!isMainWindowFoucsed()) return
                // const {mainWindow} = global
                // mainWindow.webContents.send('save-point-result')
                // openExportImport()
                // // to do
            }
        }, {
            label: '退出',
            role: 'quit'
        }]
    },
    {
        label: '编辑',
        submenu: [
            {
                label: '剪切',
                role: 'cut'
            },
            { label: '复制',
                role: 'copy'
            },
            { type: 'separator' },
            { label: '粘贴',
                role: 'paste'
            }
        ]
    }
]

/**
 *
 */
function createMenu() {
    const {menus, dirs} = generateProjectMenus()
    template[1].submenu[1].submenu = menus.length ? menus : null
    const menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)
}

/**
 * 根据创建的项目，需要再更新Menu
 */
function updateMenu() {
    createMenu()
}

function generateProjectMenus () {
    let dirs = getProjectDirs()
    let menus = []
    dirs.forEach(dir => {
        menus.push({
            label: dir,
            click: function () {
                global.mainWindow.webContents.send('change-project', dir)
            }
        })
    })
    return {
        menus,
        dirs
    }
}

createMenu()