import {settingsDB} from "../db/db";
import {ipcMain} from "electron";

ipcMain.handle('get-recommend-mail-setting', getRecommendMailSetting)
ipcMain.handle('set-recommend-mail-setting', setRecommendMailSetting)
ipcMain.handle('get-replace-hold-stock-setting', getReplaceHoldStockSetting)
ipcMain.handle('set-replace-hold-stock-setting', setReplaceHoldStockSetting)

/**
 * 推荐股票的邮件设置
 * @returns {*|{}}
 */
export function getCommonSetting () {
    const recommendMailSetting = settingsDB.data.settings.recommendMail
    return recommendMailSetting || {}
}

async function setRecommendMailSetting (event, data) {
    const recommendMailSetting = settingsDB.data.settings.recommendMail
    if(recommendMailSetting) {
        recommendMailSetting.openRecommendSendMail = data.openRecommendSendMail
        recommendMailSetting.recommendMailRuleValue = data.recommendMailRuleValue
    } else {
        settingsDB.data.settings.recommendMail = {
            openRecommendSendMail: data.openRecommendSendMail,
            recommendMailRuleValue: data.recommendMailRuleValue
        }
    }
    await settingsDB.write()
}

export function getReplaceHoldStockSetting () {
    const replaceHoldStockSetting = settingsDB.data.settings.replaceHoldStock
    return replaceHoldStockSetting || {}
}

async function setReplaceHoldStockSetting (event, data) {
    const replaceHoldStockSetting = settingsDB.data.settings.replaceHoldStock
    if(replaceHoldStockSetting) {
        replaceHoldStockSetting.openReplaceStockSendMail = data.openReplaceStockSendMail
        replaceHoldStockSetting.replaceHoldStockDay = data.replaceHoldStockDay
        replaceHoldStockSetting.replaceHoldStockPercent = data.replaceHoldStockPercent
    } else {
        settingsDB.data.settings.replaceHoldStock = {
            openReplaceStockSendMail: data.openReplaceStockSendMail,
            replaceHoldStockDay: data.replaceHoldStockDay,
            replaceHoldStockPercent: data.replaceHoldStockPercent
        }
    }
    await settingsDB.write()
}