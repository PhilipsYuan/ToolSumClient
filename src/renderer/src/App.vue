<template>
  <el-config-provider :locale="zhCn">
    <div class="flex h-calc(100vh-48px)" style="height: calc(100vh - 48px)">
      <el-menu default-active="1">
        <el-menu-item index="1" @click="goPath('/')">
          <span>m3u8视频下载</span>
        </el-menu-item>
        <el-menu-item index="2" @click="goPath('/setting')">
          <span>设置</span>
        </el-menu-item>
      </el-menu>
      <div class="w-full pl-9">
        <router-view/>
      </div>
    </div>
  </el-config-provider>
</template>

<script>
import './style/global.css'
import zhCn from 'element-plus/lib/locale/lang/zh-cn'
import { ElLoading } from 'element-plus'
import {addService} from "./service/service";
export default {
  data() {
    return {
      zhCn
    }
  },
  async beforeCreate() {
  },
  created() {
  },
  mounted() {
    addService('showScreenLoadingMessage', this.showScreenLoadingMessage.bind(this))
  },
  methods: {
    goPath(path) {
      this.$router.push({path: path})
    },
    showScreenLoadingMessage(message) {
      const loading = ElLoading.service({
        lock: true,
        text: message,
        background: 'rgba(0, 0, 0, 0.5)',
      })
      return loading
    }
  }
}
</script>

<style scoped>
</style>