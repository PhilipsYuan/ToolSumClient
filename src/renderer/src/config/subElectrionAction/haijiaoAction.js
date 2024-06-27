import {md5} from "js-md5";
import axios from "../../utils/axios";

window.electronAPI.sendHaijiaoSignRequest(async(event, url, type) => {
  const userAgent = window.navigator.userAgent;
  const mm = `yuanfei88611961${userAgent}`;
  const hash = md5.create();
  hash.update(mm);
  const sign = hash.hex();
  const urlInstance = new URL(url)
  let origin = urlInstance.origin;
  let data = JSON.stringify({
    "Username": "yuanfei",
    "Password": "88611961",
    "Sign": sign
  });
  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${origin}/api/login/signin`,
    headers: {
      'Content-Type': 'application/json'
    },
    data : data
  };
  axios.request(config)
    .then((response) => {
      window.electronAPI.responseHttpGetRequest(type,response.data)
    })
    .catch((error) => {
      console.log(error);
    });
})

window.electronAPI.sendHaijiaoTopicRequest((event, url, type) => {
  axios.get(url, {
    headers: {
      "content-type": "application/json",
    }
  })
    .then((response) => {
      window.electronAPI.responseHttpGetRequest(type,response.data)
    })
    .catch((error) => {
      console.log(error);
    });
})

window.electronAPI.sendHaijiaoAttachRequest((event, url, type, uid, token, htmlUrl, attachId, sourceId) => {
  console.log(url, type, uid, token, htmlUrl, attachId, sourceId)
  const headers = {
    "accept": "application/json, text/plain, */*",
    "accept-language": "zh-CN,zh;q=0.9,ja;q=0.8",
    "cache-control": "no-cache",
    "content-type": "application/json",
    "pcver": "2",
    "pragma": "no-cache",
    "priority": "u=1, i",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-user-id": uid,
    "x-user-token": token,
    "cookie": `token=${token}; uid=${uid};`,
    "Referer": htmlUrl,
    "Referrer-Policy": "strict-origin-when-cross-origin"
  }
  axios.post(url, {
    id: attachId,
    resource_id: Number(sourceId),
    resource_type: 'topic',
    line: ''
  }, {
    headers: headers
  })
    .then((response) => {
      window.electronAPI.responseHttpGetRequest(type,response.data)
    })
    .catch((error) => {
      console.log(error);
    });
})
