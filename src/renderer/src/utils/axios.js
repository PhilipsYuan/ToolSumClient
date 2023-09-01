/*
// 引入axios
import axios from 'axios'

axios.defaults.withCredentials = true;

// const path = `http://localhost:8083/`
// 服务器
const path = `http://39.105.223.85:8083/`
// 创建实例
let instance = axios.create({
    baseURL: path,
    timeout: 60000,  // 毫秒
    headers: {
        'Content-Type': 'application/json'
    }
})

// 响应拦截器
instance.interceptors.response.use((response)=>{
    return response.data;
}, err=>{
    console.log(err)
});

export default instance
*/
