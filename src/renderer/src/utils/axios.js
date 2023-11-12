// 引入axios
import axios from 'axios'
import host from './const/host'
import routeSetting from '../route/route';
import { exceptionList } from '../config/exceptApiList.js'

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
    return response;
}, (err)=> {
    console.log('here')
    const item = exceptionList.find((item) => {
        const regex = new RegExp(item)
        return regex.test(err.config.url)
    })
    if(!item) {
        routeSetting.push({path: '/error'})
    }
});

export default instance