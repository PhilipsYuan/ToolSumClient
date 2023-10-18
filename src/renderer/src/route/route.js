import {createRouter, createWebHashHistory} from 'vue-router'

const m3u8VideoPage = () => import('../views/pages/m3u8VideoPage/m3u8VideoPage.vue')
const SettingsPage = () => import('../views/pages/settings/settingsPage.vue')
const errorPage = () => import('../views/pages/errorPage/errorPage.vue')

const routerMap = [
    {path: '/', component: m3u8VideoPage, title: '首页', name: 'home'},
    {path: '/m3u8', component: m3u8VideoPage, title: '视频下载', name: 'm3u8'},
    {path: '/setting', component: SettingsPage, title: '设置', name: 'setting'},
    {path: '/error', component: errorPage, title: '错误', name: 'error'}
]

export default createRouter({
    history: createWebHashHistory(),
    routes: routerMap
})