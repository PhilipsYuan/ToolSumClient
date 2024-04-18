const blackRequest = [
  'https://www.hzjmled.com/note.js'
]

export function isBlackRequest(url) {
  return blackRequest.indexOf(url) > -1
}