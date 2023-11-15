<template>
  <div>
    <div class="text-lg font-medium mb-4">个人信息</div>
    <div class="bg-white rounded-md border p-6">
      <div class="grid grid-cols-2 gap-2">
        <div class="flex gap-8">
          <div class="w-20 text-base font-medium text-justify" style="text-align-last: justify">昵称</div>
          <div>{{user.nickName || '----'}}</div>
        </div>
        <div class="flex gap-8">
          <div class="w-20 text-base font-medium text-justify" style="text-align-last: justify">用户名</div>
          <div>{{user.userName || '----'}}</div>
        </div>
        <div class="flex gap-8">
          <div class="w-20 text-base font-medium text-justify" style="text-align-last: justify">邮箱地址</div>
          <div class="text-blue-400">{{user.email || '----'}}</div>
        </div>
        <div class="flex gap-8">
          <div class="w-20 text-base font-medium text-justify" style="text-align-last: justify">免费次数</div>
          <div><span class="text-red-500">{{ userBenefit.freeCount || 0}}</span> 次</div>
        </div>
        <div class="flex gap-8">
          <div class="w-20 text-base font-medium text-justify" style="text-align-last: justify">会员</div>
          <div v-if="userBenefit.isVip" class="flex gap-2"><img class="w-6 h-6" :src="VipIcon"/> <span
              class="font-medium text-red-500">{{ userBenefit.vipEnd || '----'}}</span> 到期
          </div>
          <div v-if="!userBenefit.isVip" class="flex gap-2 text-gray-400">未是
            <span class="text-yellow-500 hover:text-yellow-300 cursor-pointer ml-2" @click="goToPath('vipBuy')">去购买</span>
          </div>
        </div>
      </div>
    </div>
    <div class="flex items-center">
      <div class="text-lg font-medium my-4">
        购买记录
      </div>
      <div class="text-sm text-gray-500">（只保留最近3个月的记录）</div>
    </div>

    <buy-record />
  </div>

</template>

<script>
import VipIcon from '../../../assets/vip.svg'
import {getUser, getUserBenefit} from "../../../service/userService";
import buyRecord from "./buyRecord.vue"

export default {
  name: "personalPage",
  components: { buyRecord },
  data() {
    return {
      VipIcon,
      user: {},
      userBenefit: {}
    }
  },
  mounted() {
    this.user = getUser() || {}
    getUserBenefit()
        .then((res) => {
          this.userBenefit = res || {}
        })
  },
  methods: {
    goToPath (name) {
      if (name !== this.$router.currentRoute.name) {
        this.$router.push({name: name})
      }
    }
  }
}
</script>

<style scoped>

</style>