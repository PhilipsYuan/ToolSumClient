import {createRouter, createWebHashHistory} from 'vue-router'

const m3u8VideoPage = () => import('../views/pages/m3u8VideoPage/m3u8VideoPage.vue')

const routerMap = [
    {path: '/', component: m3u8VideoPage, title: '首页'},
    {path: '/m3u8', component: m3u8VideoPage, title: '视频下载'},
]

export default createRouter({
    history: createWebHashHistory(),
    routes: routerMap
})