const chromeSupportUrl = [
  'jijunjie.com',
  'pornhub.com',
  'ijujitv.cc',
  'huixusy.com',
  'theyarehuge.com',
  'zlyka1.com',
  'hemaha.com'
];

export function getUserAgent(htmlUrl) {
  const index = chromeSupportUrl.findIndex((item) => {
    const regex = new RegExp(item)
    return regex.test(htmlUrl)
  })
  if(index > -1) {
    return 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  }
  return 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_1_2 like Mac OS X; zh-cn) AppleWebKit/601.1.46 (KHTML, like Gecko) Mobile/20B110 Quark/1.11.2.2085 Mobile'
}
