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

/**
 * 取消订单
 * @param orderId
 * @returns {Promise<axios.AxiosResponse<any>>}
 */
export function cancelBuyVipRecords(orderId) {
    const url = `${host.server}mini/vip/buy/cancel`
    return axios.put(url, {
        orderId
    })
}

/**
 * 删除订单
 * @param orderId
 * @returns {Promise<axios.AxiosResponse<any>>}
 */
export function deleteBuyVipRecords(orderId) {
    const url = `${host.server}mini/vip/buy/delete`;
    return axios.put(url, {
        orderId
    })
}

/**
 * 获取订单的状态
 */
export function getBuyVipOrderStatus(data) {
    const url = `${host.server}mini/vip/buy/order/status`
    return axios.get(url, {
        params: data
    })
}

/**
 * 过期时间
 */
export function overtimeBuyVipRecordsApi(orderId) {
    const url = `${host.server}mini/vip/buy/overtime`;
    return axios.put(url, {
        orderId
    })
}