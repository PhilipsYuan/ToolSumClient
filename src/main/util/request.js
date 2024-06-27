import axios from "./source/axios";
import {getHeaders} from "./httpHeaders";
import {sendTips} from "./electronOperations";
import {ipcMain} from "electron";

let typeSetting = null
let response = null

ipcMain.on('response-http-get-request', getHttpInfo)

export const requestGet = (url) => {
  if(/haijiao\.com/.test(url)) {
    return requestFromClient(url)
  } else {
    const headers = getHeaders(url)
    return axios.get(url, {
      timeout: 15000,
      headers
    })
  }

}

export const requestFromClient = (url) => {
  typeSetting = 'tempRequest'
  sendTips("send-http-get-request", url, typeSetting)
  const promise = new Promise((resolve) => {
    let index = 0
    const interval = setInterval(async () => {
      if(response || index > 8) {
        clearInterval(interval)
        if(response) {
          resolve(response)
        } else {
          resolve("error")
        }
      } else {
        index ++
      }
    }, 1000)
  });
  return promise
}

function getHttpInfo(event, type, res) {
  if(type === typeSetting) {
    response = res
  }
}
