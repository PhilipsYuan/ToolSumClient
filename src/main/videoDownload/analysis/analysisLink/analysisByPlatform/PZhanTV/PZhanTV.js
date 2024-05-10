import {getUrlParams} from "../../../../../util/url";
import {sendRequest, decryptRequestData, randomCode} from "./decode";
let jwtToken = null
let accessToken = null
export async function getPZhanTVDownloadLink (htmlUrl) {
  const url = new URL(htmlUrl);
  const origin = url.origin;
  const host = url.host;
  const params = getUrlParams(htmlUrl)
  const videoId = params.id
  if(videoId) {
    if(!(jwtToken && accessToken)) {
      // 获取 jwtToken
      const jwtTokenData = {
        "method": 1,
        "params": null,
        "uri": "app/jwt-token"
      }
      const jwtTokenResult = await sendRequest(jwtTokenData, origin, jwtToken, accessToken)
      const perfectJwtTokenResult = decryptRequestData(jwtTokenResult)
      jwtToken = perfectJwtTokenResult.result
      const userInfo = {
        "method": 2,
        "body": {
          "osType": "pc",
          "sign": randomCode(32),
          "machineCode": "Chrome",
          "version": host
        },
        "uri": "user/register/free"
      }
      const userInfoResult = await sendRequest(userInfo, origin, jwtToken, accessToken)
      const perfectUserInfoResult = decryptRequestData(userInfoResult)
      accessToken = perfectUserInfoResult.result.accessToken
    }
    const videoDetail = {
      "method": 1,
      "params": null,
      "uri": `cms/vod/detail/${videoId}`
    }
    const videoInfo = await sendRequest(videoDetail, origin, jwtToken, accessToken)
    const perfectVideoInfo = decryptRequestData(videoInfo)
    if(perfectVideoInfo?.result?.vod?.vodFullPlayUrl?.[0]?.addr) {
      const url = `https://qaa.51learn.xyz${perfectVideoInfo.result.vod.vodFullPlayUrl[0].addr}`
      return {videoUrl: url, title: perfectVideoInfo?.result?.vod?.title?.replace(/;|；|\\|\//g, '') || '', videoType: 'm3u8'};
    } else {
      return "error"
    }
  } else {
    return "error"
  }
}
