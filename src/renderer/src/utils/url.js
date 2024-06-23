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

export function checkEmailCanRegister(email) {
    return !/yopmail\.net|chacuo\.net|027168\.com/.test(email)
}
