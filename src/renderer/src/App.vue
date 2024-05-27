<template>
  <div v-if="loadingSuccess">
    <router-view />
  </div>
</template>

<script>
import {ElLoading} from 'element-plus'
import {addService} from "./service/service";
import {getUserInfo} from "./api/user";
import {setUser} from "./service/userService";
import {getUrlParams} from "./utils/url";

export default {
  data() {
    const params = getUrlParams(window.location.href)
    return {
      loadingSuccess: params.sample !== '1' ? false : true,
      loading: null,
    }
  },
  async beforeCreate() {
    if(!this.loadingSuccess) {
      await getUserInfo()
          .then((res) => {
            res && setUser(res.data.result);
            this.loadingSuccess = true
          })
    }
  },
  mounted() {
    addService('showScreenLoadingMessage', this.showScreenLoadingMessage.bind(this));
    addService('closeScreenLoadingMessage', this.closeScreenLoadingMessage.bind(this));
    addService('m3u8AnalysisOpenWindow', this.m3u8AnalysisOpenWindow.bind(this))
  },
  methods: {
    goPath(path) {
      this.$router.push({path: path})
    },
    showScreenLoadingMessage(message) {
      this.loading = ElLoading.service({
        lock: true,
        text: message,
        background: 'rgba(0, 0, 0, 0.7)',
      })
    },
    closeScreenLoadingMessage() {
      this.loading && this.loading.close()
    },
    m3u8AnalysisOpenWindow() {
      this.$message.success({
        message: '页面需要您进行操作到达视频页面或者者点击播放，才能解析出视频链接，请操作下',
        duration: 6000
      })
    }
  }
}
</script>

<style scoped>
</style>
