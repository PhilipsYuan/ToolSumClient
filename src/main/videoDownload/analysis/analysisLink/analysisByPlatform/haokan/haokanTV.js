import axios from "../../../../../util/source/axios"

export async function getHaoKanTVDownloadLink(htmlUrl) {
  return axios
    .get(htmlUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
        referer: 'https://haokan.baidu.com/'
      },
    })
    .then((data) => {
      const playInfo = getInfoFromPlayInfo(data.data)
    })
}

function getInfoFromPlayInfo(data) {
  const infoString = data.match(/window.__PRELOADED_STATE__ = (.*);\s+document.querySelector\('body'\)/)?.[1];
  const info = infoString ? JSON.parse(infoString) : null;
  console.log(info)
  const curVideoMeta = info.curVideoMeta;
  console.log(curVideoMeta)
}
