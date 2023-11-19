<template>
  <p-dialog v-model="showModal" title="通知" :show-footer="false" :show-close="false"
            :destroy-on-close="true" :close-on-click-modal="false"
            :close-on-press-escape="false" width="500px">
    <div>
      <div class="text-lg font-medium text-center">{{message}}</div>
      <div v-if="status === 'success'" class="text-center mt-1">
        会员到期时间：<span class="text-red-500">{{ userBenefit.vipEnd || '----'}}</span>
      </div>
      <div v-if="status === 'success'" class="flex justify-center mt-6">
        <el-button class="w-80" type="primary" @click="toUse">去使用吧</el-button>
      </div>
      <div v-if="status === 'failure'" class="flex justify-center mt-6">
        <el-button class="w-80" type="primary" @click="toGoBuy">去购买</el-button>
      </div>
    </div>
  </p-dialog>
</template>

<script>
import PDialog from "../../UIComponents/PDialog.vue";
import { getUserBenefit } from "../../../service/userService";

export default {
  name: "orderStatusModal",
  components: { PDialog },
  data() {
    return {
      showModal: false,
      message: '',
      status: '',
      userBenefit: {}
    }
  },
  methods: {
    open(message, status) {
      this.showModal = true
      this.message = message
      this.status = status
      getUserBenefit()
          .then((res) => this.userBenefit = res || {})
    },
    close() {
      this.showModal = false
    },
    toUse() {
      this.close()
      this.$router.push({path: '/m3u8'})
    },
    toGoBuy() {
      this.close()
      this.$router.push({path: '/vipBuy'})
    }
  }
}
</script>

<style scoped>

</style>