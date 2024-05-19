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
