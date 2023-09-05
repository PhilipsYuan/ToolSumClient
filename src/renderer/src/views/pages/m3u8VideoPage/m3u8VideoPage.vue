<template>
  <div>
    <el-row :gutter="20">
          <span class="ml-3 w-35 text-gray-600 inline-flex items-center">
            请输入m3u8链接
          </span>
      <el-input
          v-model="m3u8Url"
          class="w-50 m-2"
          placeholder="请输入"
      />
      <el-button @click="getInfo">解析</el-button>

    </el-row>
    <div>{{message}}</div>
  </div>
</template>

<script>
import { addService } from "../../../service/service";
export default {
  name: "m3u8VideoPage",
  data() {
    return {
      m3u8Url: "",
      message: "未进行下载"
    }
  },
  mounted() {
    addService('showM3u8DownloadMessage', this.showMessage.bind(this))
  },
  methods: {
    async getInfo() {
      window.electronAPI.generateVideo(this.m3u8Url, 'test', `/Users/smart-philip/Documents/m3u8Test`)
    },
    showMessage(message) {
      this.message = message
    }
  }
}
</script>

<style scoped>

</style>