import {createRouter, createWebHashHistory} from 'vue-router'

const m3u8VideoPage = () => import('../views/pages/m3u8VideoPage/m3u8VideoPage.vue')
const SettingsPage = () => import('../views/pages/settings/settingsPage.vue')
const errorPage = () => import('../views/pages/errorPage/errorPage.vue')
const layout = () => import('../views/components/layout.vue')
const personalPage = () => import('../views/pages/personalPage/personalPage.vue')
const vipBuy = () => import('../views/pages/vipBuy/vipBuy.vue')
const helpPage = () => import('../views/pages/helpPage/helpPage.vue')
const searchPage = () => import('../views/pages/searchPage/searchPage.vue')
const videoPlayPage = () => import('../views/pages/videoPlayPage/videoPlayPage.vue')

const routerMap = [
    {
        path: '/', component: layout, title: '首页', name: 'layout', children: [
            {path: '', component: m3u8VideoPage, title: '视频下载', name: 'home'},
            {path: '/m3u8', component: m3u8VideoPage, title: '视频下载', name: 'm3u8'},
            {path: '/personal', component: personalPage, title: '个人信息', name: 'personal'},
            {path: '/setting', component: SettingsPage, title: '设置', name: 'setting'},
            {path: '/vipBuy', component: vipBuy, title: '会员购买', name: 'vipBuy'},
            {path: '/help', component: helpPage, title: '使用指南', name: 'help'},
        ]
    },
    {path: '/search', component: searchPage, title: '搜索', name: 'search'},
    {path: '/videoPlay', component: videoPlayPage, title: '播放', name: 'videoPlay'},
    {path: '/error', component: errorPage, title: '错误', name: 'error'}
]

export default createRouter({
    history: createWebHashHistory(),
    routes: routerMap
})