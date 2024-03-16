<template>
  <div>
    <div class="h-[60px] pl-6 pr-8 py-2.5 shadow-[] flex items-center justify-between border-y border-gray-300">
      <div class="flex items-center gap-4">
        <div class="inline-block align-middle h-10 cursor-pointer" @click="goToPath('home')">
          <img class="h-10" src="../../assets/favicon.ico">
        </div>
        <div class="cursor-pointer inline-block text-xl font-medium align-middle" @click="goToPath('home')">小滑轮</div>
        <el-link v-if="checkNewVersion()"
                 @click="goToNewVersion" type="primary" target="_blank">新版本（{{newVersion}}）</el-link>
      </div>
      <div class="flex items-center gap-3">
        <div class="list">
          <a-col :span="4">
            <div class="text-yellow-400 text-base cursor-pointer hover:text-yellow-300" @click="goToPath('vipBuy')">开通会员</div>
          </a-col>
        </div>
        <div class="flex" v-if="!isLogin">
          <el-button type="primary" @click="openLogin">登录</el-button>
          <el-button @click="openRegister">注册</el-button>
        </div>
        <div class="login" v-if="isLogin">
          <el-dropdown trigger="click">
            <div class="flex gap-2 px-2 py-1.5 hover:bg-[#ecf5ff] hover:text-[#409eff] rounded">{{ user.nickName }} <el-icon><ArrowDownBold /></el-icon></div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="a" @click="loginOut">退出</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useService } from '../../service/service'
import {getSoftVersion, getUser, setUser} from "../../service/userService";
import {userLogOut} from '../../api/user';

export default {
  name: 'headPart',
  props: {
    tabName: String
  },
  data () {
    return {
      isLogin: true,
      user: null,
      current: [],
      newVersion: '',
      currentVersion: ''
    }
  },
  async created () {
    this.checkUser()
    this.newVersion = await getSoftVersion()
    this.currentVersion = await window.electronAPI.getCurrentSoftVersion()
  },
  methods: {
    openLogin () {
      useService('openLogin')
    },
    openRegister () {
      useService('openRegister')
    },
    checkUser () {
      let user = getUser()
      if (user) {
        this.isLogin = true
        this.user = user
      } else {
        this.isLogin = false
      }
    },
    /**
     * 退出登录
     */
    loginOut () {
      userLogOut()
        .then((res) => {
          setUser(null)
          if (this.$route.name === 'home') {
            useService('saveInputInfo')
            window.location.reload();
          } else {
            this.$router.push({name: 'home'})
            useService('saveInputInfo')
            window.location.reload();
          }
        })
    },
    goToPath (name) {
      if (name !== this.$router.currentRoute.name) {
        this.$router.push({name: name})
      }
    },
    goToNewVersion() {
      window.electronAPI.openLinkByDefaultBrowser("https://www.feiaci.com/xhl/m3u8Video")
    },
    checkNewVersion() {
      if(this.newVersion && this.currentVersion) {
        const newVersionList = this.newVersion.split('.')
        const currentVersionList = this.currentVersion.split('.')
        if(newVersionList[0] > currentVersionList[0]) {
          return true
        } else if(newVersionList[1] > currentVersionList[1]) {
          return true
        } else if(newVersionList[2] > currentVersionList[2]) {
          return true
        } else {
          return false
        }
      } else {
        return false
      }
    }
  }
}
</script>
