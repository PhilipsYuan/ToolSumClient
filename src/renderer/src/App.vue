<template>
  <el-config-provider :locale="zhCn">
    <head-part />
    <div class="h-calc(100vh-48px) px-9 py-6" style="height: calc(100vh - 48px)">
      <div class="flex">
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
    </div>
    <login/>
    <register/>
  </el-config-provider>
</template>

<script>
import './style/global.css'
import zhCn from 'element-plus/lib/locale/lang/zh-cn'
import { ElLoading } from 'element-plus'
import {addService} from "./service/service";
import headPart from './views/components/head.vue'
import login from './views/components/login.vue';
import register from "./views/components/register.vue";
export default {
  components: { headPart, login, register },
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