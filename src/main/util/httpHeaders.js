export function getHeaders(url) {
    let headers = {}
    if(/mgtv\.com/.test(url)) {
        headers.Origin = 'https://www.mgtv.com'
        headers.Referer = 'https://www.mgtv.com/'
    }
    return headers
}