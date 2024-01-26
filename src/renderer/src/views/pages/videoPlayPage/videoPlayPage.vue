<template>
  <div class="absolute left-0 right-0 bottom-0 top-0">
    <div class="bg-gray-100 pl-4 pr-4 h-10 py-2 w-full" :class="{'!pl-20': isMac}" style="-webkit-app-region: drag;">
      <div class="w-full text-center">
        {{videoName}}
      </div>
    </div>
    <div class="w-full h-[calc(100%-40px)]">
      <video v-if="videoSrc" ref="myVideo" controls
             class="video-js vjs-default-skin w-full h-full object-fill">
        <source :src="videoSrc" />
      </video>
    </div>

  </div>
</template>

<script>
import 'video.js/dist/video-js.css'
import videoJs from 'video.js'
import zhCNJson from  'video.js/dist/lang/zh-CN.json'
import {getUrlParams} from "../../../utils/url";
videoJs.addLanguage('zh-CN', zhCNJson)
export default {
  name: "videoPlayPage",
  data() {
    return {
      videoSrc: '',
      player: null,
      videoName: '',
      isMac: false,
    }
  },
  mounted() {
    this.isMac = /macintosh|mac os x/i.test(navigator.userAgent);
    const params = getUrlParams(window.location.href)
    this.videoSrc = `file://${params.view}`
    this.videoName = params.name
    this.$nextTick(() => {
      this.setVideoConfig()
    })
  },
  methods: {
    setVideoConfig() {
      this.player = videoJs(this.$refs.myVideo);
    },

  }
}
</script>

<style scoped>

</style>