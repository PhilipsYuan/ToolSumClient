export function removeUrlParams(url) {
    return url.replace(/\?.*/, '');
}

export function getUrlParams(url) {
    const paramRegex = /[?&]([^=#]+)=([^&#]*)/g;
    const params = {};
    let match;

    while ((match = paramRegex.exec(url))) {
        const paramName = decodeURIComponent(match[1]);
        const paramValue = decodeURIComponent(match[2]);
        params[paramName] = paramValue;
    }

    return params;
}

export function perfectTitleName(title) {
    return title?.replace(/[^\w\u4e00-\u9fa5\u3040-\u309F\u30A0-\u30FF]/g, '') || '';
}

/**
 * 将一个url作为参数，构建第二个url， 第二个url可能只有部分路径。
 * 用在m3u8里解析ts的路径
 */
export function buildAbsoluteURl(source, target) {
    const urlObject = new URL(source);
    const host = `${urlObject.protocol}//${urlObject.host}`
    let url = ''
    if (target[0] !== '/' && !/^http/.test(target)) {
        url = host + urlObject.pathname.match(/\/.*\//)[0] + target
    } else if (/^http/.test(target)) {
        url = target
    } else {
        url = host + target
    }
    return url
}
