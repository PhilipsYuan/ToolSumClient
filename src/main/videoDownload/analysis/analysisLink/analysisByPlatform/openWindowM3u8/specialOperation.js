import {setCookie} from "../../../../../util/cookie";

export function runSpecialOperation(htmlUrl, page) {
  if(/bipot.vip/.test(htmlUrl)) {

  }
}

function bipotFun(page, htmlUrl) {
  page.on('requestfinished', async(request) => {
    const url = request.url()
    if(url === htmlUrl) {
      await page.evaluate(() => {
        Object.defineProperty(navigator, 'platform', {
          get: function() {
            return 'iPhone';
          }
        });
      })
    }
  })
}