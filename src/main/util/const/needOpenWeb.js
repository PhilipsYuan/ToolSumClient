/**
 * 需要打开网页，让用户自己点击操作后，才可以进行下载的
 */
const needOpenWebList = [
  'gaodun.com',
  'recu.me',
  'pornhub.com'
]

export function getNeedOpen(htmlUrl) {
  const item = needOpenWebList.find((item) => {
    const regex = new RegExp(item)
    return regex.test(htmlUrl)
  })
  if(item) {
    return true
  } else {
    return false
  }
}