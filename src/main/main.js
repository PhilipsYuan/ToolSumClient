import { app, BrowserWindow, session } from 'electron'
import path from 'path'
import './importFileModule'
import pie from "./util/source/puppeteer-in-electron";
import {addWindow} from "./service";

async function initialize(){
  global.pie = pie
  await pie.initialize(app);
}
initialize();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1500,
    height: 850,
    title: '小滑轮',
    closable: true,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      allowRunningInsecureContent: false
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    addWindow("mainWindow", mainWindow, '')
  })

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
  global.mainWindow = mainWindow
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

app.on('certificate-error', function(event, webContents, url, error,
                                     certificate, callback) {
  event.preventDefault();
  callback(true);
});


app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 解决跨域请求cookie的问题
app.whenReady().then(() => {
  const filter = {urls: ['https://*.feiaci.com/*']};
  session.defaultSession.webRequest.onHeadersReceived(filter, (details,callback) => {
    if(details.responseHeaders && details.responseHeaders['set-cookie']){
      for(let i = 0;i < details.responseHeaders['set-cookie'].length;i++) {
        details.responseHeaders['set-cookie'][i] += ";SameSite=None;Secure";
      }
    }
    callback({ responseHeaders: details.responseHeaders});
  })
  const RequestFilter = {
    urls: ['https://*.mgtv.com/*', 'https://*.bilivideo.cn/*', 'https://*.bilivideo.com/*', 'https://*.smtcdns.com/*',
    'https://*.bdstatic.com/*', 'https://mpvideo.qpic.cn/*']
  }
  session.defaultSession.webRequest.onBeforeSendHeaders(RequestFilter, (details, callback) => {
    let refer = ''
    let Origin = ''
    if(/mgtv/.test(details.url)) {
      refer = 'https://www.mgtv.com'
    } else if(/bilivideo/.test(details.url)) {
      refer = 'https://www.bilibili.com'
    } else  if(/smtcdns\.com/.test(details.url)) {
      refer = 'https://v.qq.com/'
    } else  if(/bdstatic\.com/.test(details.url)) {
      refer = 'https://haokan.baidu.com/'
    } else if(/https:\/\/mpvideo/.test(details.url)) {
      refer = 'https://mp.weixin.qq.com/'
      Origin = 'https://mp.weixin.qq.com/'
    }
    details.requestHeaders['Referer'] = refer
    if(Origin) {
      details.requestHeaders['Origin'] = Origin
    }
    callback({ requestHeaders: details.requestHeaders })
  })
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
