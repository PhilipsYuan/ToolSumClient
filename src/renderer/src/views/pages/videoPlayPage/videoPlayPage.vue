<template>
  <div>
    here
    <video ref="myVideo" width="640" height="264"></video>
    <el-button >清空</el-button>
  </div>
</template>

<script>
import 'video.js/dist/video-js.css'
import videoJs from 'video.js'
// import 'video.js/dist/lang/zh-CN'
import {getUrlParams} from "../../../utils/url";

export default {
  name: "videoPlayPage",
  data() {
    return {
      videoSrc: '',
      player: null
    }
  },
  mounted() {
    const params = getUrlParams(window.location.href)
    this.videoSrc = `file://${params.view}`
    this.setVideoConfig()
  },
  methods: {
    setVideoConfig() {
      const videoOptions = {
        bigPlayButton: true,
        autoplay: false,
        controls: true,
        preload: 'auto',
        // playbackRates: [0.2, 0.5, 1, 1.5, 2, 2.5, 3],
        // language: 'zh-CN',
        // controlBar: {
        //   remainingTimeDisplay: {
        //     displayNegative: false
        //   }
        // },
        // autoSetup: false,
        // controlBar: {
        //   skipButtons: {
        //     backward: 10
        //   },
        //   children: [
        //     {name: 'playToggle'}, // 播放按钮
        //     {name: 'currentTimeDisplay'}, // 当前已播放时间
        //     {name: 'progressControl'}, // 播放进度条
        //     {name: 'durationDisplay'}, // 总时间
        //     {name: 'audioTrackButton'},
        //     { // 倍数播放
        //       name: 'playbackRateMenuButton',
        //     },
        //     {
        //       name: 'volumePanel', // 音量控制
        //       inline: false, // 不使用水平方式
        //     },
        //   ],
        //   fullscreenToggle: true,
        //   playToggle: {
        //     replay: true
        //   }
        // },
        sources: this.videoSrc,
      }
      this.player = videoJs(this.$refs.myVideo, videoOptions, () => {
        // this表示videojs实例
        // 可在这里对videosjs操作
        console.log(this);

        // //   例：创建按钮
        // const button = p.getChild('ControlBar').addChild('button', {
        //   controlText: '按钮',
        //   className: 'vjs-visible-text',
        //   clickHandler: function (event) {
        //     videojs.log('1');
        //   }
        // });
      });
    }
  }
}
</script>

<style scoped>

</style>