import host from "../utils/const/host";
import axios from "../utils/axios";

/**
 * 购买Vip
 * @param name
 * @returns {Promise<AxiosResponse<any>>}
 */
export function buyVip(data) {
    let url = `${host.server}mini/vip/buy`;
    return axios.post(url, data)
}

/**
 * 获取产品的列表
 * @returns {Promise<axios.AxiosResponse<any>>}
 */
export function getVipProductList() {
    let url = `${host.server}min/vip/productType/list`;
    return axios.get(url)
}

/**
 * 获取购买记录
 * @returns {Promise<axios.AxiosResponse<any>>}
 */
export function getBuyVipRecords() {
    const url = `${host.server}mini/vip/buy/list`
    return axios.get(url)
}