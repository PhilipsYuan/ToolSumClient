<template>
  <div class="bg-white rounded-md border p-6 grid gap-8">
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
        <span class="text-amber-400 hover:text-amber-500 cursor-pointer ml-2">去购买</span>
      </div>
    </div>
  </div>
</template>

<script>
import VipIcon from '../../../assets/vip.svg'
import {getUser} from "../../../service/userService";
import {getUserBenefit} from "../../../api/user";

export default {
  name: "personalPage",
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
          if(res.data.result) {
            this.userBenefit = res.data.result
          }
        })
  }
}
</script>

<style scoped>

</style>