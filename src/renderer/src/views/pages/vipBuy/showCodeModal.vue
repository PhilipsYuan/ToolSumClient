<template>
  <p-dialog v-model="showModal" title="请支付" :show-footer="false" :show-close="false"
            :destroy-on-close="true" :close-on-click-modal="false"
            :close-on-press-escape="false" width="500px">
    <div>
      <div class="text-center text-lg font-medium">小滑轮{{name}}会员</div>
      <div class="text-center text-red-500 text-xl font-medium">{{price}}<span class="text-sm">元</span></div>
      <div class="mt-2 mb-4">
        <div class="w-[202px] h-[202px] border border-amber-400 rounded-md overflow-auto m-auto">
          <canvas ref="qrCodeCanvas"/>
        </div>
        <div class="text-center mt-1">微信扫码支付</div>
        <div class="text-center text-xs text-gray-500">请在<span class="text-red-500">15</span>分钟内支付，一旦付款成功，概不对款，请谨慎支付</div>
        <div class="text-center mt-1 text-lg text-red-500 font-medium">{{downTime}}</div>
      </div>
      <div class="text-xs">P.S. 出现付款成功后，没有收到权益，请给我们发邮件(xiaohualun1@gmail.com)，备注：用户名或者邮箱地址，购买会员类型，
        以及微信支付截图, 我们会尽快确认问题，并给您下发权益。</div>
      <div class="mt-6 px-5 py-2 flex items-center justify-end">
        <div class="text-xs text-gray-500 mr-2">个人信息也可以支付此订单</div>
        <el-button type="primary" @click="notPayNow">等会支付</el-button>
      </div>
    </div>
  </p-dialog>
</template>

<script>
import {getBuyVipOrderStatus, overtimeBuyVipRecordsApi} from '../../../api/vip'
import { setUserBenefit } from "../../../service/userService";
import PDialog from "../../UIComponents/PDialog.vue";
import qrCode from 'qrcode'
import dayjs from "dayjs";
export default {
  name: "showCodeModal",
  components: { PDialog },
  data() {
    return {
      showModal: false,
      codeUrl: '',
      name: '',
      price: '',
      orderId: '',
      interval: '',
      timeInterval: '',
      // 倒计时时间
      downTime: '15:00',
      restSeconds: 900,
      orderCreatedTime: ''
    }
  },
  methods: {
    open (codeUrl, name, price, orderId, restSeconds) {
      this.showModal = true;
      this.codeUrl = codeUrl;
      this.name = name
      this.price = price
      this.orderId = orderId
      this.restSeconds = restSeconds || 900
      const times = this.convertSeconds(this.restSeconds)
      this.downTime = `${times.minutes < 10 ? '0' + times.minutes : times.minutes}:${times.second < 10 ? '0' + times.second : times.second}`
      this.generateQRCode()
      this.loopOrderStatus()
      this.setDownTime()
    },
    generateQRCode() {
      setTimeout(() => {
        qrCode.toCanvas(this.$refs.qrCodeCanvas, this.codeUrl, {
          width: 200
        }, function (error) {
          if (error) console.error(error)
          console.log('success!');
        })
      })
    },
    loopOrderStatus() {
      this.interval = setInterval(() => {
        getBuyVipOrderStatus({orderId: this.orderId})
            .then((res) => {
              const result = res.data.result

              // 查询订单结果，如果15分钟没有支付，关闭订单，支付成功后，设置内容
              if(result.orderStatus == '2') {
                setUserBenefit()
                    .then(() => {
                      this.close()
                      this.$emit('openOrderModal', '支付成功，权益已下发，请开始使用吧！', 'success')
                    })
              } else {
                const overSeconds = dayjs(new Date()).diff(dayjs(result.createdTime), 'second')
                if(overSeconds >= 900) {
                  overtimeBuyVipRecordsApi(this.orderId)
                      .then((res) => {
                        if(res) {
                          this.close()
                          this.$emit('openOrderModal', '订单支付已经过期，请重新购买', 'failure')
                        }
                      })
                } else {
                  this.restSeconds = 900 - overSeconds
                  this.timeInterval && clearInterval(this.timeInterval)
                  this.setDownTime()
                }
              }
            })
      }, 1000 * 5)
    },
    /**
     * 设置15分钟倒计时
     */
    setDownTime() {
      const times = this.convertSeconds(this.restSeconds)
      let minutes = times.minutes
      let seconds = times.second;
      this.timeInterval = setInterval(() => {
        if (seconds == 0) {
          if (minutes == 0) {
            clearInterval(this.timeInterval);
            this.downTime = '00:00'
            return;
          }
          minutes--;
          seconds = 59;
        } else {
          seconds--;
        }
        let sec = seconds < 10 ? '0' + seconds : seconds;
        let min = minutes < 10 ? '0' + minutes : minutes;
        this.downTime = min + ':' + sec
      }, 1000);
    },
    notPayNow() {
      this.close()
      this.$router.push({path: '/personal'})
    },
    close() {
      this.interval && clearInterval(this.interval)
      this.timeInterval && clearInterval(this.timeInterval)
      this.showModal = false
    },
    convertSeconds(seconds) {
      const minutes = Math.floor(seconds / 60)
      const second = seconds % 60
      return { minutes, second }
    }
  }
}
</script>

<style scoped>

</style>