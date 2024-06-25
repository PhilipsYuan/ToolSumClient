export function getHeaders(url) {
    let headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15'
    }
    if(/mgtv\.com/.test(url)) {
        headers.Origin = 'https://www.mgtv.com'
        headers.Referer = 'https://www.mgtv.com/'
    }
    return headers
}
