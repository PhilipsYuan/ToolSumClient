import {updateDockMenu} from "./menu/dockMenu";

const browserWindows = {}

export function addWindow (name, window, webviewContent) {
    browserWindows[name] = {
        window: window,
        webviewContent: webviewContent
    };
    updateDockMenu()
    window.on('focus', () => {
        updateDockMenu()
    })
}

export function getWindow(name) {
    return browserWindows[name]
}

export function deleteWindow(name) {
    browserWindows[name] && delete browserWindows[name]
    updateDockMenu()
}
