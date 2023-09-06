<template>
  <div>
    <el-form :model="form" label-width="120px">
      <el-form-item label="m3u8链接">
        <el-input v-model="form.m3u8Url" class="!w-80"/>
      </el-form-item>
      <el-form-item label="文件名称">
        <el-input v-model="form.name"  class="!w-80"/>
      </el-form-item>
    </el-form>
    <el-button type="primary" @click="getInfo">解析</el-button>
    <div class="mt-6">{{ message }}</div>
  </div>
</template>

<script>
import {addService} from "../../../service/service";

export default {
  name: "m3u8VideoPage",
  data() {
    return {
      form: {
        m3u8Url: "",
        name: ""
      },
      message: "未进行下载",
    }
  },
  mounted() {
    addService('showM3u8DownloadMessage', this.showMessage.bind(this))
  },
  methods: {
    async getInfo() {
      if (this.form.name && this.form.m3u8Url) {
        window.electronAPI.generateVideo(this.form.m3u8Url, this.form.name, `/Users/smart-philip/Documents/m3u8Test`)
      }
    },
    showMessage(message) {
      this.message = message
    }
  }
}
</script>

<style scoped>

</style>