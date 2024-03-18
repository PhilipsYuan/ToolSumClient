<template>
  <div>
    <div class="bg-gray-100 pl-4 pr-4 h-10 py-2 w-full" :class="{'!pl-20': isMac}" style="-webkit-app-region: drag;">
      <div class="flex h-6 justify-between items-center" >
        <div class="flex gap-1" style="-webkit-app-region: no-drag;">
          <div class="w-8 hover:bg-gray-200 rounded-md cursor-pointer flex items-center justify-center text-gray-500 hover:text-blue-400 text-lg"
               :class="{'cursor-not-allow !text-gray-300': !backStatus}"
               @click="goBack">
            <el-icon><Back /></el-icon>
          </div>
          <div class="w-8 hover:bg-gray-200 rounded-md cursor-pointer flex items-center justify-center text-gray-500 hover:text-blue-400 text-lg"
               :class="{'cursor-not-allow !text-gray-300': !forwardStatus}"
               @click="goForward">
            <el-icon><Right /></el-icon>
          </div>
          <div class="w-8 hover:bg-gray-200 rounded-md cursor-pointer flex items-center justify-center text-gray-500 hover:text-blue-400 text-lg" @click="reload">
            <el-icon><RefreshLeft /></el-icon>
          </div>
        </div>
        <div style="-webkit-app-region: no-drag;">
          <el-input v-model="url" size="small" class="h-6 !w-[400px]" @keydown.enter="changeView"/>
        </div>
        <div class="flex gap-1" style="-webkit-app-region: no-drag;">
          <el-button size="small" class="!h-6" @click="confirmCurrentPage">确定</el-button>
          <div v-if="!isMac" class="w-8 hover:bg-gray-200 rounded-md cursor-pointer flex items-center justify-center text-gray-500 hover:text-blue-400 text-lg"
               @click="closeWindow">
            <el-icon><Close /></el-icon>
          </div>
        </div>
      </div>
    </div>
    <div class="w-full h-[calc(100vh-46px)]">
      <webview id="webviewTag" :src="viewUrl" style="display: inline-flex" class="w-full h-[calc(100vh-46px)]"
               nodeintegration allowpopups></webview>
    </div>
  </div>
</template>

<script>
import {Back, Right, Close, RefreshLeft} from "@element-plus/icons-vue";
import { getUrlParams } from "../../../utils/url";
import { addService } from "../../../service/service";

export default {
  name: "searchPage",
  components: {Back, Right, Close, RefreshLeft},
  data() {
    return {
      webview: null,
      url: "",
      viewUrl: "",
      isMac: false,
      backStatus: false,
      forwardStatus: false
    }
  },
  mounted() {
    addService('changeSearchPageUrl', this.changeSearchPageUrl.bind(this))
    this.webview = document.getElementById('webviewTag')
    const params = getUrlParams(window.location.href)
    this.url = params.view
    this.viewUrl = this.url
    this.isMac = /macintosh|mac os x/i.test(navigator.userAgent);
    this.checkStatus()
  },
  methods: {
    goBack() {
      this.webview.goBack()
      this.checkStatus()
      setTimeout(() => {
        this.url = this.webview.getURL()
      },500)
    },
    goForward() {
      this.webview.goForward()
      this.checkStatus()
      setTimeout(() => {
        this.url = this.webview.getURL()
      },500)
    },
    reload() {
      this.webview.reload()
    },
    changeView() {
      if(!/^http/.test(this.url)) {
        this.url = `https://${this.url}`
      }
      this.webview.loadURL(this.url)
      this.checkStatus()
    },
    confirmCurrentPage() {
      const url = this.webview.getURL()
      window.electronAPI.confirmSearchWindow(url)
    },
    changeSearchPageUrl(url) {
      if(url ) {
        this.url = url
        this.webview.loadURL(this.url)
        this.checkStatus()
      }
    },
    closeWindow() {
      window.electronAPI.closeSearchWindow()
    },
    checkStatus() {
      let num = 0
      const interval = setInterval(()=> {
        const bs = this.webview.canGoBack()
        const fs = this.webview.canGoForward()
        if(num > 5 || bs !== this.backStatus || fs !== this.forwardStatus ) {
          clearInterval(interval)
          this.backStatus = bs
          this.forwardStatus = fs
        } else {
          num ++
        }
      }, 300)
    }
  }
}
</script>

<style scoped>

</style>
