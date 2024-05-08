const blackRequest = [
  'https://m.knight74.cc/pingbi.js',
  'http://m.knight74.cc/pingbi.js'
]

export function isBlackRequest(url) {
  return blackRequest.indexOf(url) > -1
}
