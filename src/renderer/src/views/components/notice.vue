<template>
  <div v-if="noticeInfo?.value"
       class="py-2 border text-xs rounded-md mb-4 bg-gray-50 flex items-start justify-between relative">
    <div class="flex items-start max-h-[120px] w-full overflow-auto px-4">
      <el-icon class="!text-blue-500 mr-2 mt-1">
        <InfoFilled/>
      </el-icon>
      <div class="whitespace-pre">{{ noticeInfo.value }}</div>
    </div>
    <div class="absolute top-1 right-1">
      <el-icon class="icon-button" @click="clearNotice">
        <CloseBold/>
      </el-icon>
    </div>
  </div>
</template>

<script>
import {getSystemUpdateNotice} from "../../api/user";
import dayjs from "dayjs";

export default {
  name: "notice",
  data() {
    return {
      noticeInfo: null
    }
  },
  mounted() {
     getSystemUpdateNotice()
        .then(async (res) => {
          const newNotice = res
          // 有效的通知，有通知内容，且时间在有效期内
          const currentTime = dayjs().format('YYYY-MM-DD')
          if(newNotice.value && newNotice.expiredTime && dayjs(currentTime).isBefore(dayjs(newNotice.expiredTime))) {
            const saveNotice = await window.electronAPI.getNoticeSetting()
            if(saveNotice && saveNotice.isClose && saveNotice.value === newNotice.value) {
              // 这个情况下不用处理。
            } else {
              this.noticeInfo = newNotice
              window.electronAPI.setNoticeSetting({
                isClose: false,
                value: newNotice.value,
                expiredTime: newNotice.expiredTime
              })
            }
          }
        })
  },
  methods: {
    clearNotice() {
      window.electronAPI.setNoticeSetting({
        isClose: true,
        value: this.noticeInfo.value,
        expiredTime: this.noticeInfo.expiredTime
      })
      this.noticeInfo = null
    }
  }
}
</script>

<style scoped>

</style>