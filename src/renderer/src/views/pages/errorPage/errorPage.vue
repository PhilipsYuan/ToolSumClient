<template>
  <div class="bg-[#f6f8fc] px-12 py-8 w-full h-screen flex items-center justify-center">
    <div class="">
      <img class="m-auto" :src="SeverErrorSvg">
      <div class="mt-12 text-center">
        <div class="text-xl font-medium text-gray-400">服务器出错</div>
        <div class="mt-2 text-sm text-gray-400">可能是服务器出现故障了，给我们发送邮件( xiaohualun1@gmail.com )，我们会尽快处理</div>
        <el-button class="mt-4" @click="goPath('/')">返回首页</el-button>
      </div>
    </div>
  </div>
</template>

<script>
import SeverErrorSvg from '../../../assets/serverError.svg'
export default {
  name: "errorPage",
  data() {
    return {
      SeverErrorSvg
    }
  },
  methods: {
    goPath(path) {
      this.$router.push({path: path})
    },
  }
}
</script>

<style scoped>

</style>