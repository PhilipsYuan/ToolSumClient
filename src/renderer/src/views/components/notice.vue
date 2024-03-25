<template>
  <div v-if="notice"
       class="py-2 border text-xs rounded-md mb-4 bg-gray-50 flex items-start justify-between relative">
    <div class="flex items-start max-h-[120px] w-full overflow-auto px-4">
      <el-icon class="!text-blue-500 mr-2 mt-1">
        <InfoFilled/>
      </el-icon>
      <div class="whitespace-pre">{{ notice }}</div>
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

export default {
  name: "notice",
  data() {
    return {
      notice: ''
    }
  },
  mounted() {
    getSystemUpdateNotice()
        .then((res) => {
          this.notice = res.data.result || `网飞三体来啦。
第一集m3u8链接：https://v.cdnlz14.com/20240321/36154_ef1392a1/2100k/hls/mixed.m3u8。
第二集m3u8链接：https://v.cdnlz14.com/20240321/36155_87696a27/2100k/hls/mixed.m3u8。
第三集m3u8链接： https://v.cdnlz14.com/20240321/36156_ce4bc075/2100k/hls/mixed.m3u8。
第四集m3u8链接：https://v.cdnlz14.com/20240321/36157_105bb251/2100k/hls/mixed.m3u8。
第五集m3u8链接： https://v.cdnlz14.com/20240321/36158_7da7e04b/2100k/hls/mixed.m3u8。
第六集m3u8链接：https://v.cdnlz14.com/20240321/36159_c10ff6bb/2100k/hls/mixed.m3u8。
第七集m3u8链接： https://v.cdnlz14.com/20240321/36160_23346131/2100k/hls/mixed.m3u8。
第八集m3u8链接：https://v.cdnlz14.com/20240321/36161_01426e28/2100k/hls/mixed.m3u8。`
        })
  },
  methods: {
    clearNotice() {
      this.notice = ''
    }
  }
}
</script>

<style scoped>

</style>