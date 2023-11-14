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
        <div class="text-center text-xs text-gray-500">请在15分钟内支付，一旦付款成功，概不对款，请谨慎支付</div>
      </div>
      <div class="text-xs">P.S. 出现付款成功后，没有收到权益，请给我们发邮件(1016027198@qq.com)，备注：用户名或者邮箱地址，购买会员类型，
        以及购买时间(例如：2023-01-01 15点50分左右), 我们会尽快确认问题，并给您下发权益。</div>
      <div class="mt-6 px-5 py-2 flex items-center justify-end">
        <div class="text-xs text-gray-500 mr-2">个人信息也可以支付此订单</div>
        <el-button type="primary" @click="close">等会支付</el-button>
      </div>
    </div>
  </p-dialog>
</template>

<script>
import PDialog from "../../UIComponents/PDialog.vue";
import qrCode from 'qrcode'
export default {
  name: "showCodeModal",
  components: { PDialog },
  data() {
    return {
      showModal: false,
      codeUrl: '',
      name: '',
      price: ''
    }
  },
  methods: {
    open (codeUrl, name, price) {
      this.showModal = true;
      this.codeUrl = codeUrl;
      this.name = name
      this.price = price
      this.generateQRCode()
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
      const interval = setInterval(() => {
        // 查询订单结果，如果15分钟没有支付，关闭订单，支付成功后，设置内容
        if(status === 'success') {
          clearInterval(interval)
          this.$message.success("支付成功，权益下发成功了。请开始使用吧！")
          setTimeout(() => {
            this.close()
            this.$router.push({path: '/m3u8'})
          }, 1000 * 2.5)
        }
      }, 1000 * 5)
    },
    close() {
      this.showModal = false
    }
  }
}
</script>

<style scoped>

</style>