<template>
  <el-config-provider :locale="zhCn">
    <router-view />
    <login/>
    <register/>
    <reset-password/>
  </el-config-provider>
</template>

<script>
import './style/global.css'
import zhCn from 'element-plus/lib/locale/lang/zh-cn'
import {ElLoading} from 'element-plus'
import {addService} from "./service/service";
import headPart from './views/components/head.vue'
import login from './views/components/login.vue';
import register from "./views/components/register.vue";
import resetPassword from "./views/components/resetPassword.vue";
import {getUserInfo} from "./api/user";
import {setUser} from "./service/userService";

export default {
  components: {headPart, login, register, resetPassword},
  data() {
    return {
      zhCn
    }
  },
  async beforeCreate() {
  },
  created() {
    getUserInfo()
        .then((res) => {
          res && setUser(res.data.result);
        })
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
    },

  }
}
</script>

<style scoped>
</style>