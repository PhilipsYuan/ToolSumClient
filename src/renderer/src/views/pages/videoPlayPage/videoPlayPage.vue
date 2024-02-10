<template>
  <div class="absolute left-0 right-0 bottom-0 top-0">
    <div class="bg-gray-100 pl-4 pr-4 h-10 py-2 w-full" :class="{'!pl-20': isMac}" style="-webkit-app-region: drag;">
      <div class="flex h-6 justify-between items-center" >
        <div></div>
        <div class="w-full text-center">
          {{videoName}}
        </div>
        <div class="flex gap-1" style="-webkit-app-region: no-drag;">
          <div v-if="!isMac" class="w-8 hover:bg-gray-200 rounded-md cursor-pointer flex items-center justify-center text-gray-500 hover:text-blue-400 text-lg"
               @click="closeWindow">
            <el-icon><Close /></el-icon>
          </div>
        </div>
      </div>
    </div>
    <div class="w-full h-[calc(100%-40px)]">
      <video v-if="videoSrc" ref="myVideo" controls autoplay
             class="video-js vjs-default-skin w-full h-full object-fill">
        <source :src="videoSrc" type="video/mp4" codecs="hevc" />
        <source :src="videoSrc" type="video/mp4" codecs="avc1" />
      </video>
    </div>

  </div>
</template>

<script>
import 'video.js/dist/video-js.css'
import videoJs from 'video.js'
import zhCNJson from  'video.js/dist/lang/zh-CN.json'
import {getUrlParams} from "../../../utils/url";
import { addService } from "../../../service/service";
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
    addService('changeVideoPlayItem', this.changeVideoPlayItem.bind(this))
    this.isMac = /macintosh|mac os x/i.test(navigator.userAgent);
    const params = getUrlParams(window.location.href)
    this.videoSrc = `file://${params.view}`
    this.videoName = params.name
    this.$nextTick(() => {
      this.setVideoConfig()
    })
    this.checkHEVCSupport()
  },
  methods: {
    setVideoConfig() {
      this.player = videoJs(this.$refs.myVideo);
    },
    changeVideoPlayItem(videoPath, videoName) {
      this.videoSrc = `file://${videoPath}`
      this.videoName = videoName
      this.player.src(this.videoSrc)
    },
    closeWindow() {
      window.electronAPI.closeVideoPlayWindow()
    },
    checkVideoCode() {
      const videoElement = document.createElement('video');
      videoElement.addEventListener('loadedmetadata', function() {
        console.log(videoElement.videoTracks)
        const codec = videoElement.videoTracks[0].codec;
       alert('视频编码格式:', codec);
      });
      videoElement.src = this.videoSrc;
    },
    checkHEVCSupport() {
      const isTypeSupported = (mimeType) => {
        const mediaSource = new MediaSource();
        mediaSource.addEventListener('sourceopen', () => {
          let mediaSource = this.mediaSource;
          try {
            let sourceBuffer = mediaSource.addSourceBuffer(mimeType);
            mediaSource.removeSourceBuffer(sourceBuffer);
          } catch (error) {
            console.log(error);
            return false;
          }
          return true;
        });
      };

      const hevcMimeType = 'video/mp4; codecs="hev1"';
      const isHEVCSupported = isTypeSupported(hevcMimeType);
      console.log('HEVC supported:', isHEVCSupported);
    }
  }
}
</script>

<style scoped>

</style>
