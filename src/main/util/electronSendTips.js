
export function sendTips (name, param1, param2, param3) {
    global.mainWindow.webContents.send(name, param1, param2, param3)
}