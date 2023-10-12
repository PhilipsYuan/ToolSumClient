<template>
  <p-dialog v-model="showModal" title="登录" :show-footer="false" :show-close="true"
            :destroy-on-close="true" :close-on-click-modal="false"
            :close-on-press-escape="false" width="500px">
      <el-form ref="form" :model="form" :rules="rules" label-position="left" label-width="70px">
        <el-form-item prop="userName" label="用户">
          <el-input v-model="form.userName" placeholder="请输入用户名或者邮箱"  :prefix-icon="UserIcon" />
        </el-form-item>
        <el-form-item prop="password" label="密码">
          <el-input v-model="form.password" type="password" placeholder="请输入密码"  :prefix-icon="LockIcon" />
        </el-form-item>
        <el-form-item >
          <div class="flex items-center justify-between w-full">
            <el-button type="primary" @click="handleSubmit">登 录</el-button>
            <el-button type="text" @click="forgetPassword">
              忘记密码
            </el-button>
          </div>
        </el-form-item>
      </el-form>
  </p-dialog>
</template>

<script>
import {addService, useService} from '../../service/service';
import {login, getUserInfo} from '../../api/user';
import { setUser } from "../../service/userService";
import { User, Lock } from '@element-plus/icons-vue'
import PDialog from "../UIComponents/PDialog.vue";
export default {
  name: 'login',
  components: {PDialog},
  data () {
    return {
      UserIcon: User,
      LockIcon: Lock,
      showModal: false,
      form: {
        userName: '',
        password: ''
      },
      rules: {
        userName: [{ required: true, message: '请输入用户名!', trigger: 'blur' }],
        password: [
          {required: true, message: '请输入密码!', trigger: 'blur'}
        ]
      }
    }
  },
  mounted () {
    addService('openLogin', this.open.bind(this));
  },
  methods: {
    open () {
      this.showModal = true;
    },
    close () {
      this.showModal = false;
    },
    handleSubmit (e) {
      e.preventDefault();
      this.$refs.form.validate((valid) => {
        if (valid) {
          // 登录
          login(this.form)
            .then((res) => {
              if (res.data.code === 200) {
                getUserInfo()
                  .then((re) => {
                    setUser(re.data.result);
                    this.close()
                    window.location.reload();
                  })
              } else {
                this.$message.error('用户名或密码错误, 请重新输入！')
              }
            })
              .catch((error) => {
                console.log(error)
              })
        }
      });
    },
    forgetPassword () {
      this.close();
      useService('openResetPassword');
    }
  }
}
</script>
