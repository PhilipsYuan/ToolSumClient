import axios from "./source/axios";
import {sendTips} from "./electronOperations";
import {ipcMain} from "electron";

let typeSetting = null
let response = null

ipcMain.on('response-http-get-request', getHttpInfo)

const fromClientDomain = [
  'haijiao.com',
  'xhcdn.com'
]

export const requestGet = (url, config, forClient= false) => {
  const item = fromClientDomain.find((item) => {
    const regex = new RegExp(item)
    return regex.test(url)
  })
  if(item || forClient) {
    return requestFromClient(url)
  } else {
    let configDefault = {
      timeout: 15000
    }
    let configJson = null
    if(config) {
      configJson = {...configDefault, ...config}
    } else {
      configJson = configDefault
    }
    return axios.get(url, configJson)
      .then((res) => {
        return res.data
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
