const browserWindows = {}

export function addWindow (name, window, webviewContent) {
    browserWindows[name] = {
        window: window,
        webviewContent: webviewContent
    };
}

export function getWindow(name) {
    return browserWindows[name]
}

export function deleteWindow(name) {
    browserWindows[name] && delete browserWindows[name]
}
