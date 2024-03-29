<template>
  <el-container>
    <el-header>
      <head-part/>
    </el-header>
    <el-container>
      <el-aside>
        <el-menu :default-active="active">
          <el-menu-item index="1" @click="goPath('/')">
            <span>m3u8视频下载</span>
          </el-menu-item>
          <el-menu-item index="2" @click="goPath('/personal')">
            <span>个人信息</span>
          </el-menu-item>
          <el-menu-item index="3" @click="goPath('/vipBuy')">
            <span>会员购买</span>
          </el-menu-item>
          <el-menu-item index="4" @click="goPath('/setting')">
            <span>设置</span>
          </el-menu-item>
          <el-menu-item index="5" @click="goPath('/help')">
            <span>使用指南</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main>
        <router-view/>
      </el-main>
    </el-container>
    <login />
    <register/>
    <reset-password />
    <login-tip  />
    <disclaimer ref="disclaimer"/>
    <about-xhl />
  </el-container>
</template>

<script>
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import login from './login.vue';
import register from "./register.vue";
import resetPassword from "./resetPassword.vue";
import loginTip from "./loginTip.vue";
import disclaimer from "./disclaimer.vue";
import aboutXhl from "./aboutXhl.vue";
import headPart from "./head.vue";

window.app.config.globalProperties.$message = ElMessage
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  window.app.component(key, component)
}

export default {
  name: "layout",
  components: {headPart, login, register, resetPassword, loginTip, disclaimer, aboutXhl},
  data() {
    return {
      notice: null,
      active: '1',
    }
  },
  watch: {
    $route: {
      handler: function (val) {
        switch (val.name) {
          case 'home':
            this.active = '1';
            break;
          case 'm3u8':
            this.active = '1';
            break;
          case 'personal':
            this.active = '2';
            break;
          case 'vipBuy':
            this.active = '3';
            break;
          case 'setting':
            this.active = '4';
            break;
          case 'help':
            this.active = '5';
        }
      },
      // 深度观察监听
      deep: true
    }
  },
  async mounted() {
    window.electronAPI.checkShowDisclaimer()
        .then((result) => {
          if (result) {
            this.$refs.disclaimer.open()
          }
        })
    switch (this.$route.name) {
      case 'home':
        this.active = '1';
        break;
      case 'm3u8':
        this.active = '1';
        break;
      case 'personal':
        this.active = '2';
        break;
      case 'vipBuy':
        this.active = '3';
        break;
      case 'setting':
        this.active = '4';
        break;
      case 'help':
        this.active = '5';
    }
  },
  methods: {
    goPath(path) {
      this.$router.push({path: path})
    }
  }
}
</script>

<style scoped>

</style>