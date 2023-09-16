<template>
  <div class="px-20 py-6">
    <div>
      <div v-if="!this.downloadPath"
           class="px-4 py-2 border text-sm rounded-md mb-8 bg-gray-50 text-center flex items-center">
        <el-icon class="!text-red-500 mr-2">
          <WarningFilled/>
        </el-icon>
        您还没有设置存储地址，请先去设置栏里设置存储地址，再回来下载！
      </div>
      <div v-if="message"
           class="px-4 py-2 border text-sm rounded-md mb-8 bg-gray-50 flex items-center justify-between">
        <div class="text-green-500 flex items-center" :class="{'!text-red-500': errorStatus}">
          <el-icon class="!text-green-500 mr-2" :class="{'!text-red-500': errorStatus}">
            <InfoFilled/>
          </el-icon>
          {{ message }}
        </div>
        <div>
          <el-icon class="icon-button" @click="message = ''">
            <CloseBold/>
          </el-icon>
        </div>
      </div>
      <el-form :model="form" label-width="85px" label-position="left">
        <el-form-item label="网址">
          <div class="flex items-center gap-4">
            <el-input v-model="form.htmlUrl" class="!w-[600px]"/>
            <el-button @click="startAnalysis">解析</el-button>
          </div>
        </el-form-item>
        <el-form-item label="m3u8链接:">
          <el-input v-model="form.m3u8Url" class="!w-[600px]"/>
        </el-form-item>
        <el-form-item label="文件名称:">
          <el-input v-model="form.name" class="!w-80"/>
        </el-form-item>
        <el-form-item label="">
          <el-button :disabled="downloadButtonStatus" type="primary" @click="getInfo">下载</el-button>
          <el-button :disabled="downloadButtonStatus" @click="clearInput">清空</el-button>
        </el-form-item>
      </el-form>
    </div>
    <already-existed-modal ref="alreadyExistedModal" @changeTab="changeTab" />
  </div>
</template>

<script>
import {addService, useService} from "../../../service/service";
import alreadyExistedModal from "./alreadyExistedModal.vue";

export default {
  name: "m3u8Create",
  components: { alreadyExistedModal },
  data() {
    return {
      form: {
        htmlUrl: "",
        m3u8Url: "",
        name: ""
      },
      downloadButtonStatus: false,
      downloadPath: "11",
      message: "未进行下载",
      errorStatus: false,
      analysing: false
    }
  },
  async beforeCreate() {
    const downloadSetting = await window.electronAPI.getDownloadSetting()
    this.downloadPath = downloadSetting.downloadPath || ""
  },
  async mounted() {
    addService('showM3u8DownloadMessage', this.showMessage.bind(this))
    addService('getM3u8DownloadSuccess', this.getDownloadSuccess.bind(this))
    addService('getM3u8DownloadFailure', this.getDownloadFailure.bind(this))
  },
  methods: {
    async getInfo() {
      if(await this.checkDownloadCondition()) {
        this.downloadButtonStatus = true
        window.electronAPI.generateVideo(this.form.m3u8Url, this.form.name, this.downloadPath)
      }
    },
    // 检验下载的条件
    async checkDownloadCondition() {
      if (!this.downloadPath) {
        this.$message.error('您还没有设置存储地址，请先去设置里设置存储地址，再回来下载！')
         return false
      } else if(!(this.form.name && this.form.m3u8Url)) {
        this.$message.error("请先输入链接和文件名称，再进行下载")
        return false
      } else if(!this.isUrl(this.form.m3u8Url)){
        this.$message.error("链接格式不正确, 请确认链接正确后，再进行下载！")
        return false
      } else {
        const m3u8UrlIsNotDownloaded = await window.electronAPI.checkDownloadUrlNotExist(this.form.m3u8Url)
        if(m3u8UrlIsNotDownloaded.id) {
          this.$refs.alreadyExistedModal.openModal(m3u8UrlIsNotDownloaded)
          return false
        }
        const path = `${this.downloadPath}/${this.form.name}.mp4`
        const isNotExist = await window.electronAPI.checkOutputFileNotExist(path)
        if(!isNotExist) {
          this.$message.error("输出的文件名称已经存在，请更换一个名称")
          return false
        }
        return true
      }
    },
    clearInput() {
      this.form.name = ''
      this.form.m3u8Url = ''
    },
    showMessage(message) {
      this.errorStatus = false
      this.message = message
    },
    getDownloadSuccess() {
      this.errorStatus = false
      this.downloadButtonStatus = false
      useService('getM3u8FinishedList')
    },
    changeTab() {
      this.$emit('changeTab', 'finish')
    },
    getDownloadFailure(message) {
      this.errorStatus = true
      this.downloadButtonStatus = false
      this.message = message
    },
    isUrl(str) {
      return /(http|ftp|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?/.test(str)
    },
    startAnalysis() {
      if(this.form.htmlUrl) {
        // window.electronAPI.createChildBrowserWindow(this.form.htmlUrl)
        this.analysing = true
      } else {
        this.$message.error("请先输入个网址再进行解析")
      }
    }
  }
}
</script>

<style scoped>

</style>