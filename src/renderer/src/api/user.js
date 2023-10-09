import host from '../utils/const/host';
import axios from '../utils/axios';

/**
 * 登录
 * @param name
 * @returns {Promise<AxiosResponse<any>>}
 */
function login(data) {
  let url = `${host.server}mini/user/login`;
  return axios.post(url, data)
}

/**
 * 注册
 * @param name
 * @returns {Promise<AxiosResponse<any>>}
 */
function register(data) {
  let url = `${host.server}mini/user/register`;
  return axios.post(url, data)
}

/**
 * 验证用户是否已经注册
 * @param data
 * @returns {Promise<AxiosResponse<any>>}
 */
function checkUserName(data) {
  let url = `${host.server}mini/user/checkUserName`;
  return axios.get(url, {
    params: data
  })
}

/**
 * 发送验证码
 * @param data
 * @returns {Promise<AxiosResponse<any>>}
 */
function sendValidateCode (data) {
  let url = `${host.server}mini/user/sendValidateCode`;
  return axios.get(url, {
    params: data
  })
}

/**
 * 更换账号密码
 */
function changePassword(data) {
  let url = `${host.server}mini/user/changePassword`;
  return axios.post(url, data)
}

/**
 * 获取用户信息
 */
function getUserInfo() {
  let url = `${host.server}mini/user/account/info`;
  return axios.get(url)
}

/**
 * 退出登录
 */
function userLogOut() {
  let url = `${host.server}mini/user/loginOut`;
  return axios.get(url)
}

export {
  login,
  register,
  checkUserName,
  sendValidateCode,
  changePassword,
  getUserInfo,
  userLogOut
}
