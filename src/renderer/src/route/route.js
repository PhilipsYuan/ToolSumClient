import {createRouter, createWebHashHistory} from 'vue-router'

const m3u8VideoPage = () => import('../views/pages/m3u8VideoPage/m3u8VideoPage.vue')
const SettingsPage = () => import('../views/pages/settings/settingsPage.vue')

const routerMap = [
    {path: '/', component: m3u8VideoPage, title: '首页', name: 'home'},
    {path: '/m3u8', component: m3u8VideoPage, title: '视频下载', name: 'm3u8'},
    {path: '/setting', component: SettingsPage, title: '设置', name: 'setting'}
]

export default createRouter({
    history: createWebHashHistory(),
    routes: routerMap
})