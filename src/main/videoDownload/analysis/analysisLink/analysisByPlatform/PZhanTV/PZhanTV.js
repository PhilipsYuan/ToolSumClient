import {getUrlParams} from "../../../../../util/url";
import {sendRequest, decryptRequestData, randomCode} from "./decode";

export async function getPZhanTVDownloadLink (htmlUrl) {
  const url = new URL(htmlUrl);
  const origin = url.origin;
  const host = url.host;
  const params = getUrlParams(htmlUrl)
  const videoId = params.id
  let jwtToken = null
  let accessToken = null
  if(videoId) {
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
    const videoDetail = {
      "method": 1,
      "params": null,
      "uri": `cms/vod/detail/${videoId}`
    }
    const videoInfo = await sendRequest(videoDetail, origin, jwtToken, accessToken)
    const perfectVideoInfo = decryptRequestData(videoInfo)
    if(perfectVideoInfo?.result?.vod?.preview) {
      const url = `https://qaa.51learn.xyz/${perfectVideoInfo.result.vod.preview}`
      return {videoUrl: url, title: perfectVideoInfo?.result?.vod?.title?.replace(/\//g, '').replace(/\\/g, '') || ''};
    } else {
      return "error"
    }
  } else {
    return "error"
  }
}
