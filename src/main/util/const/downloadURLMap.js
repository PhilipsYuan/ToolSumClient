const downloadURLMap = [
  {
    host: 'pornhub.com',
    check: 'index-(.*?).m3u8',
    type: 'm3u8'
  },
  {
    host: 'eporner.com',
    check: 'index-(.*?).m3u8',
    type: 'm3u8'
  }
]

export function getCheckRule(htmlUrl) {
  const item = downloadURLMap.find((item) => {
    const regex = new RegExp(item.host)
    return regex.test(htmlUrl)
  })
  if(item) {
    return item
  } else {
    return null
  }
}

