<template>
  <div>
    <div class="h-[60px] px-8 py-2.5 shadow-[] flex items-center justify-between border-b">
      <div>
        <div class="inline-block align-middle h-10 cursor-pointer" @click="goToPath('home')">
          <img class="h-10" src="../../assets/favicon.ico">
        </div>
        <div class="cursor-pointer inline-block text-xl font-medium align-middle ml-4" @click="goToPath('home')">小滑轮</div>
      </div>
      <div class="flex items-center gap-3">
        <div class="list">
          <a-col :span="4">
            <div class="button" @click="goToPath('vip')">会员购买</div>
          </a-col>
        </div>
        <div class="flex" v-if="!isLogin">
          <el-button type="primary" @click="openLogin">登录</el-button>
          <el-button @click="openRegister">注册</el-button>
        </div>
        <div class="login" v-if="isLogin">
          <el-dropdown @command="handleCommand">
          <span class="el-dropdown-link">
            {{ user.nickName }}<i class="el-icon-arrow-down el-icon--right"></i>
          </span>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item command="a" @click="loginOut">退出</el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useService } from '../../service/service'
import { getUser, setUser } from "../../service/userService";
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
      current: []
    }
  },
  created () {
    this.checkUser()
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
          if (res.data.code === 200) {
            setUser(null)
            if (this.$route.name === 'home') {
              window.location.reload();
            } else {
              this.$router.push({name: 'home'})
            }
          }
        })
    },
    goToPath (name) {
      if (name !== this.$router.currentRoute.name) {
        this.$router.push({name: name})
      }
    },
    goToEqx () {
      window.open('https://forms.ebdan.net/ls/meXYisIo?bt=yxy', '_blank')
    },
    goToSg () {
      window.open('https://segmentfault.com/a/1190000021201317', '_blank')
    },
    handleCommand (command) {
      if (command === 'a') {
        this.loginOut()
      }
    }
  }
}
</script>
