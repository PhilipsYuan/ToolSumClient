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
            x
          </div>
        </div>
      </div>
    </div>
    <div class="w-full h-[calc(100%-68px)]">
      <div class="text-xs text-center text-gray-400 my-1">如出现播放失败，建议使用系统播放或者其他视频播放器（例如：迅雷影音）</div>
      <video v-if="videoSrc" ref="myVideo" controls
             class="video-js vjs-default-skin w-full h-full object-fill">
        <source v-if="/\.mp4/.test(videoSrc)" :src="videoSrc" type="video/mp4" codecs="avc1" />
        <source v-if="/\.mp4/.test(videoSrc)" :src="videoSrc" type="video/mp4" codecs="hevc" />
        <source v-if="/\.m3u8/.test(videoSrc)" :src="videoSrc" type="application/x-mpegURL" />
        <source v-if="/\.m4s/.test(videoSrc)" :src="videoSrc" type="video/mp4" codecs="avc1" />
      </video>
<!--      <audio v-if="audioSrc" class="opacity-0" >-->
<!--        <source :src="audioSrc" type="audio/mp3">-->
<!--      </audio>-->
    </div>

  </div>
</template>

<script>
import 'video.js/dist/video-js.css'
import videoJs from 'video.js'
import '@videojs/http-streaming'
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
      audioSrc: '',
      audioElement: '',
      isMac: false,
    }
  },
  mounted() {
    addService('changeVideoPlayItem', this.changeVideoPlayItem.bind(this))
    this.isMac = /macintosh|mac os x/i.test(navigator.userAgent);
    const params = getUrlParams(window.location.href)
    if(/http/.test(params.view)) {
      this.videoSrc = params.view
    } else {
      this.videoSrc = `file://${params.view}`
    }
    if(params.audio) {
      this.audioSrc = params.audio
      this.audioElement = new Audio(this.audioSrc);
    }
    this.videoName = params.name
    this.$nextTick(() => {
      this.setVideoConfig()
    })
  },
  methods: {
    async setVideoConfig() {
      this.player = videoJs(this.$refs.myVideo);
      const ready = await this.checkVideoAndAudioSuccess()
      if(ready) {
        this.audioElement.play()
        this.player.play()
      }
    },
    changeVideoPlayItem(videoPath, videoName) {
      this.videoSrc = `file://${videoPath}`
      this.videoName = videoName
      this.player.src(this.videoSrc)
    },
    closeWindow() {
      window.electronAPI.closeVideoPlayWindow()
    },
    /**
     * 校验视频是否准备好了
     * @returns {Promise<unknown>}
     */
    checkVideoAndAudioSuccess() {
      let videoOK = false
      let audioOK = false
      return new Promise(resolve => {
        const interval = setInterval(() => {
          if(this.player) {
            this.player.on('loadedmetadata', () => {
              videoOK = true
            })
          } else {
            videoOK = true
          }
          if(this.audioElement) {
            this.audioElement.addEventListener("canplaythrough", (event) => {
              /* 音频可以播放；如果权限允许则播放 */
              audioOK = true
            });
          } else {
            audioOK = true
          }

          if(audioOK && videoOK) {
            clearInterval(interval)
            resolve(true)
          }
        }, 100)
      })
    }
  }
}
</script>

<style scoped>

</style>
