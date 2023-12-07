<template>
  <div>
    <div class="bg-gray-100 pl-20 pr-4 h-10 py-2 w-full" style="-webkit-app-region: drag;">
      <div class="flex h-6 justify-between items-center" >
        <div class="flex gap-1" style="-webkit-app-region: no-drag;">
          <div class="w-8 hover:bg-gray-200 rounded-md cursor-pointer flex items-center justify-center text-gray-500 hover:text-blue-400 text-lg" @click="goBack">
            <el-icon><ArrowLeft /></el-icon>
          </div>
          <div class="w-8 hover:bg-gray-200 rounded-md cursor-pointer flex items-center justify-center text-gray-500 hover:text-blue-400 text-lg" @click="goForward">
            <el-icon><ArrowRight /></el-icon>
          </div>
          <div class="w-8 hover:bg-gray-200 rounded-md cursor-pointer flex items-center justify-center text-gray-500 hover:text-blue-400 text-lg" @click="goForward">
            <el-icon><RefreshLeft /></el-icon>
          </div>
        </div>
        <div style="-webkit-app-region: no-drag;">
          <el-input v-model="url" size="small" class="h-6 !w-[400px]" @keydown.enter="changeView"/>
        </div>
        <div style="-webkit-app-region: no-drag;">
          <el-button size="small" class="!h-6" @click="confirmCurrentPage">确定</el-button>
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
import {ArrowRightBold} from "@element-plus/icons-vue";
import { getUrlParams } from "../../../utils/url";
import { addService } from "../../../service/service";

export default {
  name: "searchPage",
  components: {ArrowRightBold},
  data() {
    return {
      webview: null,
      url: "",
      viewUrl: ""
    }
  },
  beforeCreate() {

  },
  mounted() {
    addService('changeSearchPageUrl', this.changeSearchPageUrl.bind(this))
    this.webview = document.getElementById('webviewTag')
    const params = getUrlParams(window.location.href)
    this.url = params.view
    this.viewUrl = this.url
  },
  methods: {
    goBack() {
      this.webview.goBack()
    },
    goForward() {
      this.webview.goForward()
    },
    changeView() {
      if(!/^http/.test(this.url)) {
        this.url = `https://${this.url}`
      }
      this.webview.loadURL(this.url)
    },
    confirmCurrentPage() {
      const url = this.webview.getURL()
      window.electronAPI.confirmSearchWindow(url)
    },
    changeSearchPageUrl(url) {
      this.url = url
      this.webview.loadURL(this.url)
    }
  }
}
</script>

<style scoped>

</style>