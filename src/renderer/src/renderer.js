/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */


import { createApp } from 'vue';
import App from './App.vue'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import routeSetting from './route/route';
import "element-plus/theme-chalk/el-message-box.css";
import "element-plus/theme-chalk/el-message.css";
import "element-plus/theme-chalk/el-loading.css";
import './config/electronAction'
import { ElMessage } from 'element-plus'
import './style/element-ui-self.css'
import './style/global.css'


const app = createApp(App)
window.app = app
app.config.globalProperties.$message = ElMessage
app.use(routeSetting)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}
app.mount('#app');

