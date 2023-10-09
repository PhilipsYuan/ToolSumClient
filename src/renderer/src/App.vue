<template>
  <el-config-provider :locale="zhCn">
    <el-container>
      <el-header>    <head-part /></el-header>
      <el-container>
        <el-aside>
          <el-menu default-active="1">
            <el-menu-item index="1" @click="goPath('/')">
              <span>m3u8视频下载</span>
            </el-menu-item>
            <el-menu-item index="2" @click="goPath('/setting')">
              <span>设置</span>
            </el-menu-item>
          </el-menu>
        </el-aside>
        <el-main>
          <router-view/>
        </el-main>
      </el-container>
    </el-container>
    <login/>
    <register/>
    <reset-password />
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
import resetPassword from "./views/components/resetPassword.vue";
export default {
  components: { headPart, login, register, resetPassword },
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