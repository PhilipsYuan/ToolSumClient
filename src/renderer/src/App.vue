<template>
  <el-config-provider :locale="zhCn">
    <div v-if="loadingSuccess">
      <router-view />
    </div>
    <login/>
    <register/>
    <reset-password/>
    <login-tip />
    <disclaimer ref="disclaimer"/>
    <about-xhl />
  </el-config-provider>
</template>

<script>
import './style/global.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import {ElLoading} from 'element-plus'
import {addService} from "./service/service";
import headPart from './views/components/head.vue'
import login from './views/components/login.vue';
import register from "./views/components/register.vue";
import resetPassword from "./views/components/resetPassword.vue";
import loginTip from "./views/components/loginTip.vue";
import disclaimer from "./views/components/disclaimer.vue";
import aboutXhl from "./views/components/aboutXhl.vue";
import {getUserInfo} from "./api/user";
import {setUser} from "./service/userService";

export default {
  components: {headPart, login, register, resetPassword, loginTip, disclaimer, aboutXhl},
  data() {
    return {
      zhCn,
      loadingSuccess: false,
    }
  },
  async beforeCreate() {
    await getUserInfo()
        .then((res) => {
          res && setUser(res.data.result);
          this.loadingSuccess = true
        })
  },
  created() {
  },
  mounted() {
    addService('showScreenLoadingMessage', this.showScreenLoadingMessage.bind(this))
    window.electronAPI.checkShowDisclaimer()
        .then((result) => {
          if(!result) {
            this.$refs.disclaimer.open()
          }
        })
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
    },
  }
}
</script>

<style scoped>
</style>