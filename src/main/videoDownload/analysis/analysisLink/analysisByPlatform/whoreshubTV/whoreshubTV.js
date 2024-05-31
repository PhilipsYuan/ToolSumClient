import axios from "../../../../../util/source/axios";



export default function getWhoresHubTVDownloadLink (htmlUrl) {
  console.log("here")
  return axios.get(htmlUrl, {
    timeout: 20000,
  })
    .then((res) => {
      console.log(res.data)
    })
    .catch((res) => {
      console.log(res)
    })
  // fetch("https://www.whoreshub.com/videos/275159/mompov-lena-35-year-old-busty-petite-asian-first-timer/", {
  //   "headers": {
  //     "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  //     "accept-language": "zh-CN,zh;q=0.9,ja;q=0.8",
  //     "cache-control": "no-cache",
  //     "pragma": "no-cache",
  //     "priority": "u=0, i",
  //     "sec-ch-ua": "\"Google Chrome\";v=\"125\", \"Chromium\";v=\"125\", \"Not.A/Brand\";v=\"24\"",
  //     "sec-ch-ua-mobile": "?0",
  //     "sec-ch-ua-platform": "\"macOS\"",
  //     "sec-fetch-dest": "document",
  //     "sec-fetch-mode": "navigate",
  //     "sec-fetch-site": "none",
  //     "sec-fetch-user": "?1",
  //     "upgrade-insecure-requests": "1"
  //   },
  //   "referrerPolicy": "strict-origin-when-cross-origin",
  //   "body": null,
  //   "method": "GET",
  //   "mode": "cors",
  //   "credentials": "include"
  // })
  //   .then((res) => {
  //     console.log(res)
  //   })
}
