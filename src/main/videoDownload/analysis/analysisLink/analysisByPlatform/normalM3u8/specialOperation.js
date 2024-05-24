export function runSpecialOperation(htmlUrl, page, window) {
  if(/bipot\.vip/.test(htmlUrl)) {
    bipotFun(window)
  }
}

function bipotFun(window) {
  const ses = window.webContents.session
  ses.cookies.set({
    url: 'https://bipot.vip/',
    name: 'hasVisitedIndex',
    value: 'true'
  })
}
