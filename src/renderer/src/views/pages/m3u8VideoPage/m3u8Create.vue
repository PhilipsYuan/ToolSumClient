<template>
  <div class="px-8 py-6">
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
        <el-form-item label="搜索">
          <search-resource ref="searchResource" @setHtmlUrl="setHtmlUrl" />
        </el-form-item>
        <el-form-item label="网址">
          <div class="flex items-center gap-4 w-full">
            <el-input v-model="form.htmlUrl" class="w-full" placeholder="请输入视频网址"
                      @change="()=> this.form.htmlUrl = this.form.htmlUrl.trim()"/>
            <el-button @click="startAnalysis" :loading="analysisLoading" :disabled="createLoading">解析下载链接</el-button>
          </div>
        </el-form-item>
        <el-form-item label="m3u8链接:">
          <el-input v-model="form.m3u8Url" placeholder="请输入m3u8的下载链接"
                    @change="()=> this.form.m3u8Url = this.form.m3u8Url.trim()"/>
        </el-form-item>
        <el-form-item label="文件名称:">
          <el-input v-model="form.name" placeholder="请输入下载视频名称"
                    @change="()=> this.form.name = this.form.name.trim()"/>
        </el-form-item>
        <el-form-item label="">
          <el-button :loading="createLoading" type="primary" @click="getInfo">
            创建
          </el-button>
          <el-button :disabled="createLoading" @click="clearInput">清空</el-button>
          <el-popover
              placement="bottom"
              :width="'fit-content'"
              trigger="hover"
              content="如果不是会员，视频下载完成后会消耗您的免费次数。"
          >
            <template #reference>
              <el-icon class="ml-4"><QuestionFilled class="text-gray-400" /></el-icon>
            </template>
          </el-popover>
        </el-form-item>
      </el-form>
    </div>
    <already-existed-modal ref="alreadyExistedModal" @changeTab="changeTab" />
  </div>
</template>

<script>
import {addService, useService} from "../../../service/service";
import alreadyExistedModal from "./alreadyExistedModal.vue";
import { checkLogin } from "../../../api/login";
import {getUserBenefitApi} from "../../../api/user";
import SearchResource from './searchResource.vue'

export default {
  name: "m3u8Create",
  components: { alreadyExistedModal, SearchResource },
  data() {
    return {
      isLogin: false,
      form: {
        htmlUrl: "",
        m3u8Url: "",
        name: "",
        audioUrl: ''
      },
      downloadButtonStatus: false,
      downloadPath: "11",
      message: {
        status: 'success',
        content: ''
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
    checkLogin()
        .then((res) => {
          if (res) {
            this.isLogin = true
          }
        })
  },
  methods: {
    async getInfo() {
      if(this.isLogin) {
        const hasBenefit = await this.checkUserBenefit()
        if(hasBenefit) {
          if(await this.checkDownloadCondition()) {
            this.createLoading = true
            if(/m3u8Video[/|\\]tempM3u8Url/.test(this.form.m3u8Url)) {
              const isExist = await window.electronAPI.checkFileIsExist(this.form.m3u8Url)
              if(!isExist) {
                await this.startAnalysis()
              }
            }
            const result = await window.electronAPI.createVideoDownloadTask(this.form.m3u8Url, this.form.name, this.downloadPath, this.form.audioUrl)
            if(result === 'success') {
              useService('getM3u8LoadingList')
              this.changeTab('loading')
              this.createLoading = false
            } else {
              this.createLoading = false
              this.getM3u8FileFailureMessage('error', '下载资源失败，请重新尝试或者更换个下载资源!')
            }
          }
        } else {
         this.$message.error('您已经没有免费使用次数了，请购买会员后，再继续使用！')
        }
      } else {
        useService('openLoginTip');
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
      } else if(!(this.isUrl(this.form.m3u8Url) || /m3u8Video[/|\\]tempM3u8Url/.test(this.form.m3u8Url)
      || /magnet:/.test(this.form.m3u8Url))){
        this.$message.error("链接格式不正确, 请确认链接正确后，再进行下载！")
        return false
      } else {
        const m3u8UrlIsNotDownloaded = await window.electronAPI.checkDownloadUrlNotExist(this.form.m3u8Url, this.form.name)
        if(m3u8UrlIsNotDownloaded.item) {
          this.$refs.alreadyExistedModal.openModal(m3u8UrlIsNotDownloaded.item, this.form.m3u8Url, this.form.name, m3u8UrlIsNotDownloaded.type)
          return false
        } else if(! await window.electronAPI.checkDownloadFileNotExist(this.form.name, this.downloadPath)) {
          this.$message.error("存储地址里已存在此名称的文件，请更换一个名称！")
          return false
        }
        return true
      }
    },
    clearInput() {
      this.form.name = ''
      this.form.m3u8Url = ''
      this.form.htmlUrl = ''
      this.message = {
        status: 'success',
        content: ''
      }
      this.$refs.searchResource.clearSearchText()
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
    /**
     * 查看用户的权益，看是否满足下载
     */
    checkUserBenefit() {
      return getUserBenefitApi()
          .then((res) => {
            if(res.data.result) {
              const result = res.data.result
              if(result.isVip) {
                return true
              } else if(result.freeCount > 0) {
                return true
              } else {
                return false
              }
            } else {
              return false
            }
          })
    },
    async startAnalysis() {
      if(this.form.htmlUrl && this.isUrl(this.form.htmlUrl)) {
        this.analysisLoading = true
        this.message = {
          content: "网页解析中...（可能需要1-2分钟，请耐心等待） ",
          status: 'success'
        }
        const info = await window.electronAPI.getDownloadLinkFromUrl(this.form.htmlUrl)
        if(info === 'error') {
          this.message = {
            content: "网页加载不成功，请先确定网页在浏览器上是否正常打开！",
            status: 'error'
          }
        } else if(info === 'noFound') {
          this.message = {
            content: "网页解析不成功，可以将地址上报给我们，我们会努力解析，并在最新的版本中支持！",
            status: 'error'
          }
        } else if(info.videoUrl) {
          this.form.m3u8Url = info.videoUrl
          if(info.audioUrl) {
            this.form.audioUrl = info.audioUrl
          }
          if(info.title) {
            this.form.name = info.title
          }
          this.message = {
            content: "网页解析完成，发现可下载的链接。",
            status: 'success'
          }
        } else {
          this.message = {
            content: "未找到下载的链接，请重新尝试或者查看使用指南自己查找下载链接。",
            status: 'error'
          }
        }
        this.analysisLoading = false
      } else if(this.form.htmlUrl) {
        this.message = {
          content: "网址不符合要求（必须带http或者https协议），请确认下！",
          status: 'error'
        }
      } else {
        this.message = {
          content: "请先输入个网址再进行解析！",
          status: 'error'
        }
      }
    },
    setHtmlUrl (url, name) {
      this.form.m3u8Url = ''
      this.message = {
        status: 'success',
        content: ''
      }
      this.form.htmlUrl = url;
      this.form.name = name || '';
    }
  }
}
</script>

<style scoped>

</style>
