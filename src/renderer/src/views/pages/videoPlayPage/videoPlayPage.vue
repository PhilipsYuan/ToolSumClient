<template>
  <div class="absolute left-0 right-0 bottom-0 top-0">
    <div class="bg-gray-100 pl-4 pr-4 h-10 py-2 w-full" :class="{'!pl-20': isMac}" style="-webkit-app-region: drag;">
      <div class="flex h-6 justify-between items-center" >
        <div></div>
        <div class="w-full text-center w-[500px] truncate">
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
      <video id="my-video" ref="myVideo"
             class="video-js vjs-default-skin w-full h-full object-fill" autoplay controls>
      </video>
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
import { playVideoAndAudio } from './videoAndAudioPlay'
import {playPZhan} from "./playPzhan";
import axios from '../../../utils/axios'
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
    if(params.audio && params.audio !== 'undefined') {
      if(params.audio !== 'noNeed') {
        this.audioSrc = params.audio
      }
    }
    this.videoName = params.name
    this.$nextTick(() => {
      this.setVideoConfig()
    })
  },
  methods: {
    async setVideoConfig() {
      if(this.videoSrc && this.audioSrc) {
        playVideoAndAudio(this.videoSrc, this.audioSrc, this.$refs.myVideo, videoJs)
      } else if(/51learn\.xyz/.test(this.videoSrc)) {
        playPZhan(this.$refs.myVideo, this.videoSrc)
      } else {
        const videoType = await this.checkVideoType()
        const json = videoType === 'mp4' ? {
          src: this.videoSrc,
          type: 'video/mp4',
          codecs: 'avc1'
        } : {
          src: this.videoSrc,
          type: 'application/x-mpegURL',
        }
        this.player = videoJs(this.$refs.myVideo, {
          preload: 'auto',
          sources: [json]
        });
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
    async checkVideoType() {
      if(/file:\/\//.test(this.videoSrc)) {
        if(/\.mp4/.test(this.videoSrc)) {
          return 'mp4'
        } else {
          return 'm3u8'
        }
      } else {
        const response = await axios.options(this.videoSrc)
        const contentType = response.headers.getContentType();
        if(/mp4/.test(contentType)) {
          return 'mp4'
        } else {
          return 'm3u8'
        }
      }
    }
  }
}
</script>

<style scoped>

</style>
