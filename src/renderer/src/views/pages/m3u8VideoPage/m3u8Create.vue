<template>
  <div>
    <div>
      <div v-if="!this.downloadPath"
           class="px-4 py-2 border text-sm rounded-md mb-8 text-red-500 bg-gray-100 text-center">
        您还没有设置存储地址，请先去设置栏里设置存储地址，再回来下载！
      </div>
      <el-form :model="form" label-width="120px">
        <el-form-item label="m3u8链接">
          <el-input v-model="form.m3u8Url" class="!w-160"/>
        </el-form-item>
        <el-form-item label="文件名称">
          <el-input v-model="form.name" class="!w-80"/>
        </el-form-item>
      </el-form>
      <el-button type="primary" @click="getInfo">解析</el-button>
      <div class="mt-6">{{ message }}</div>
    </div>
  </div>
</template>

<script>
import {addService} from "../../../service/service";
export default {
  name: "m3u8Create",
  data() {
    return {
      form: {
        m3u8Url: "",
        name: ""
      },
      downloadPath: "",
      message: "未进行下载",
    }
  },
  async mounted() {
    const downloadSetting = await window.electronAPI.getDownloadSetting()
    this.downloadPath = downloadSetting.downloadPath || ""
    addService('showM3u8DownloadMessage', this.showMessage.bind(this))
  },
  methods: {
    async getInfo() {
      if (this.downloadPath) {
        if (this.form.name && this.form.m3u8Url) {
          const path = `${this.downloadPath}/${this.form.name}.mp4`
          const isNotExist = await window.electronAPI.checkOutputFileNotExist(path)
          if (isNotExist) {
            window.electronAPI.generateVideo(this.form.m3u8Url, this.form.name, this.downloadPath)
          } else {
            this.$message.error("输出的文件名称已经存在，请更换一个名称")
          }
        }
      } else {
        this.$message.error('您还没有设置存储地址，请先去设置里设置存储地址，再回来下载！')
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