import {app, BrowserWindow, ipcMain} from "electron";
import puppeteer from "../../util/source/puppeteer-core";

ipcMain.handle('get-search-result', searchResourceByKey)

export async function searchResourceByKey(event, key) {
    console.log("here")
    const browser = await pie.connect(app, puppeteer);
    const window = new BrowserWindow({
        show: false, width: 900, height: 600, webPreferences: {
            devTools: true,
            webSecurity: false,
            allowRunningInsecureContent: true,
            experimentalFeatures: true,
            webviewTag: true,
            autoplayPolicy: "document-user-activation-required"
        }
    });
    const page = await global.pie.getPage(browser, window)
    await page.setViewport({"width": 475, "height": 867, "isMobile": false})

}