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
      <div v-if="message.content"
           class="px-4 py-2 border text-sm rounded-md mb-8 bg-gray-50 flex items-center justify-between">
        <div class="text-green-500 flex items-center" :class="{'!text-red-500': message.status === 'error'}">
          <el-icon class="!text-green-500 mr-2" :class="{'!text-red-500': message.status === 'error'}">
            <InfoFilled/>
          </el-icon>
          {{ message.content }}
        </div>
        <div>
          <el-icon class="icon-button" @click="message.content = ''">
            <CloseBold/>
          </el-icon>
        </div>
      </div>
      <el-form :model="form" label-width="85px" label-position="left">
        <el-form-item label="网址">
          <div class="flex items-center gap-4 w-full">
            <el-input v-model="form.htmlUrl" class="w-full"/>
            <el-button @click="startAnalysis" :loading="analysisLoading">解析下载链接</el-button>
          </div>
        </el-form-item>
        <el-form-item label="m3u8链接:">
          <el-input v-model="form.m3u8Url"/>
        </el-form-item>
        <el-form-item label="文件名称:">
          <el-input v-model="form.name"/>
        </el-form-item>
        <el-form-item label="">
          <el-button :loading="createLoading" type="primary" @click="getInfo">创建</el-button>
          <el-button :loading="createLoading" @click="clearInput">清空</el-button>
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
      message: {
        status: 'success',
        content: '未进行下载'
      },
      analysisLoading: false,
      createLoading: false
    }
  },
  async beforeCreate() {
    const downloadSetting = await window.electronAPI.getDownloadSetting()
    this.downloadPath = downloadSetting.downloadPath || ""
  },
  async mounted() {
    addService('getM3u8FileFailureTips', this.getM3u8FileFailureMessage.bind(this))
  },
  methods: {
    async getInfo() {
      if(await this.checkDownloadCondition()) {
        this.createLoading = true
        const result = await window.electronAPI.createM3u8DownloadTask(this.form.m3u8Url, this.form.name, this.downloadPath)
        if(result === 'success') {
          useService('getM3u8LoadingList')
          this.changeTab('loading')
          this.createLoading = false
        }
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
        const m3u8UrlIsNotDownloaded = await window.electronAPI.checkDownloadUrlNotExist(this.form.m3u8Url, this.form.name)
        if(m3u8UrlIsNotDownloaded.id) {
          this.$refs.alreadyExistedModal.openModal(m3u8UrlIsNotDownloaded, this.form.m3u8Url, this.form.name)
          return false
        }
        return true
      }
    },
    clearInput() {
      this.form.name = ''
      this.form.m3u8Url = ''
      this.form.htmlUrl = ''
    },
    getM3u8FileFailureMessage(status, content) {
      this.message = {
        status,
        content
      }
    },
    changeTab(tab) {
      this.$emit('changeTab', tab)
    },
    isUrl(str) {
      return /(http|ftp|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?/.test(str)
    },
    async startAnalysis() {
      if(this.form.htmlUrl) {
        this.analysisLoading = true
        this.message = {
          content: "网页解析中...",
          status: 'success'
        }
        const m3u8Url = await window.electronAPI.getDownloadLinkFromUrl(this.form.htmlUrl)
        if(m3u8Url === 'error') {
          this.message = {
            content: "网页加载不成功，请先确定网页在浏览器上是否正常打开！",
            status: 'error'
          }
        } else if(m3u8Url) {
          this.form.m3u8Url = m3u8Url
          this.message = {
            content: "网页解析完成，发现可下载的链接。",
            status: 'success'
          }
        } else {
          this.message = {
            content: "未发现可以下载的链接！",
            status: 'error'
          }
        }
        this.analysisLoading = false
      } else {
        this.message = {
          content: "请先输入个网址再进行解析！",
          status: 'error'
        }
        this.$message.error("请先输入个网址再进行解析")
      }
    }
  }
}
</script>

<style scoped>

</style>