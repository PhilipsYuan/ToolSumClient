// 引入axios
import axios from 'axios'
import host from './const/host'
import routeSetting from '../route/route';
import { exceptionList } from '../config/exceptApiList.js'
import {setUser, getUser} from "../service/userService";

axios.defaults.withCredentials = true;
// 创建实例
let instance = axios.create({
    baseURL: host.server,
    timeout: 60000,  // 毫秒
    headers: {
        'Content-Type': 'application/json'
    }
})

// 响应拦截器
instance.interceptors.response.use((response)=>{
    if(response.data.code === 1001 && response.data.message === '用户还未登录！') {
        const user = getUser()
        if(user) {
            setUser(null)
            if (routeSetting.name === 'home') {
                window.location.reload();
            } else {
                routeSetting.push({name: 'home'})
                window.location.reload();
            }
        }
    }
    return response;
}, (err)=> {
    const item = exceptionList.find((item) => {
        const regex = new RegExp(item)
        return regex.test(err.config.url)
    })
    if(!item) {
        routeSetting.push({path: '/error'})
    }
});

export default instance