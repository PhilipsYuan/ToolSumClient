<template>
  <p-dialog v-model="showModal" title="登录" :show-footer="false" :show-close="true"
            :destroy-on-close="true" :close-on-click-modal="false"
            :close-on-press-escape="false" width="600px">
      <el-form ref="form" :model="form" :rules="rules" label-position="left" label-width="70px">
        <el-form-item prop="userName" label="用户名">
          <el-input style="width: 250px" size="small" v-model="form.userName" placeholder="用户名"  prefix-icon="el-icon-user" />
        </el-form-item>
        <el-form-item prop="password" label="密码">
          <el-input style="width: 250px" size="small" v-model="form.password" type="password" placeholder="密码"  prefix-icon="el-icon-lock" />
        </el-form-item>
        <el-form-item >
          <el-button style="float: right;" type="text" size="small" @click="forgetPassword">
            忘记密码
          </el-button>
          <el-button type="primary" @click="handleSubmit" size="small">登 录</el-button>
        </el-form-item>
      </el-form>
  </p-dialog>
</template>

<script>
import {addService, useService} from '../../service/service';
import {login, getUserInfo} from '../../api/user';
import { setUser } from "../../service/userService";
import PDialog from "../UIComponents/PDialog.vue";
export default {
  name: 'login',
  components: {PDialog},
  data () {
    return {
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
