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
<!--      <video id="my-video" class="video-js vjs-default-skin w-full h-full object-fill" autoplay></video>-->
      <video id="my-video" ref="myVideo" controls autoplay
             class="video-js vjs-default-skin w-full h-full object-fill">
<!--        <source v-if="/\.mp4/.test(videoSrc)" :src="videoSrc" type="video/mp4" codecs="avc1" />-->
<!--        <source v-if="/\.mp4/.test(videoSrc)" :src="videoSrc" type="video/mp4" codecs="hevc" />-->
<!--        <source v-if="/\.m3u8/.test(videoSrc)" :src="videoSrc" type="application/x-mpegURL" />-->
<!--        <source v-if="/\.m4s/.test(videoSrc)" :src="videoSrc" type="video/mp4" codecs="avc1" />-->
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
    }
    this.videoName = params.name

    this.$nextTick(() => {
      setTimeout(() => {
        this.setVideoConfig()
      }, 2000)

    })
  },
  methods: {
    async setVideoConfig() {
      const videoTag = document.getElementById("my-video");
      this.player = videoJs(videoTag, {
        preload: 'auto',
        source: [{
          src: this.videoSrc,
          type: 'video/mp4',
          codecs: 'avc1'
        }, {
          src: this.videoSrc,
          type: 'application/x-mpegURL',
        }]
      }, () => {
        this.player.play()
      });

      // const ready = await this.checkVideoAndAudioSuccess()
      // if(ready) {
      //   this.audioElement.play()
      //   this.player.play()
      // }
    },
    changeVideoPlayItem(videoPath, videoName) {
      this.videoSrc = `file://${videoPath}`
      this.videoName = videoName
      this.player.src(this.videoSrc)
    },
    closeWindow() {
      window.electronAPI.closeVideoPlayWindow()
    },

    playEr(videoUrl, audioUrl) {
      const videoTag = document.getElementById("my-video");
      const myMediaSource = new MediaSource();
      const url = URL.createObjectURL(myMediaSource);
      videoTag.src = url;
      myMediaSource.addEventListener('sourceopen', () => {
        console.log('here')
        // 1. add source buffers
        const audioSourceBuffer = myMediaSource
            .addSourceBuffer('audio/mp4; codecs="mp4a.40.2"');
        const videoSourceBuffer = myMediaSource
            .addSourceBuffer('video/mp4; codecs="avc1.64001e"');

        // 2. download and add our audio/video to the SourceBuffers
        // for the audio SourceBuffer
        fetch(audioUrl).then(function(response) {
          // The data has to be a JavaScript ArrayBuffer
          return response.arrayBuffer();
        }).then(function(audioData) {
          audioSourceBuffer.appendBuffer(audioData);
        });
        // the same for the video SourceBuffer
        fetch(videoUrl).then(function(response) {
          // The data has to be a JavaScript ArrayBuffer
          return response.arrayBuffer();
        }).then(function(videoData) {
          videoSourceBuffer.appendBuffer(videoData);
        });
      })

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
