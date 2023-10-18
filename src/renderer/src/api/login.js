import { getUserInfo } from "./user";

export function checkLogin() {
  return getUserInfo()
    .then((res) => {
      if (res.data.code === 1001) {
        return false
      } else {
        return true
      }
    })
}
