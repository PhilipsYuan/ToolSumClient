import {Menu, app, BrowserWindow} from "electron";
function createDockMenu() {
    const windows = BrowserWindow.getAllWindows()
    const menuItem = windows.map((item) => {
        let label = '  □ ' + item.title
        if(item.isFocused()) {
            label = `✓ □ ${item.title}`
        }
        if(item.isMinimized()) {
            label = `◇ □ ${item.title}`
        }
        return {
            label: label,
            click: function () {
                if(item.isMinimized()) {
                    item.restore()
                }
                item.focus()
            }
        }
    })
    return Menu.buildFromTemplate(menuItem)
}

export function updateDockMenu () {
    const menuItem = createDockMenu()
    app.dock.setMenu(menuItem)
}