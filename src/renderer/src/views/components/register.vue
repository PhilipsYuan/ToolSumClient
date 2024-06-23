<template>
  <p-dialog v-model="showModal" title="注册" :show-footer="false" :show-close="true"
            :destroy-on-close="true" :close-on-click-modal="false"
            :close-on-press-escape="false" width="500px">
    <el-form ref="form" :model="form" :rules="rules" label-width="80px" label-position="left">
      <el-form-item label="用户名" prop="userName">
        <el-input v-model="form.userName" placeholder="请输入用户名"/>
      </el-form-item>
      <el-form-item label="昵称" prop="nickName">
        <el-input v-model="form.nickName" placeholder="请输入昵称"/>
      </el-form-item>
      <el-form-item label="密码" prop="password">
        <el-input v-model="form.password" :type="passwordShow ? 'text': 'password'" placeholder="请输入密码">
          <template #append><el-button :icon="passwordShow ? View: Hide" @click="changePasswordShow" /></template>
        </el-input>
      </el-form-item>
      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input v-model="form.confirmPassword" :type="confirmPasswordShow ? 'text': 'password'" placeholder="请再确认密码">
          <template #append><el-button :icon="confirmPasswordShow ? View : Hide" @click="changeConfirmPasswordShow" /></template>
        </el-input>
      </el-form-item>
      <el-form-item label="邮箱" prop="email">
        <el-input v-model="form.email" placeholder="请输入邮箱地址"/>
      </el-form-item>
      <el-form-item label="验证码" prop="validateCode">
        <div class="flex items-center gap-4 justify-between w-full">
          <el-input v-model="form.validateCode"
                    placeholder="请输入验证码"/>
          <el-button class="w-32" :disabled="codeButtonEnable" :loading="requestLoading" @click="sendCode">{{
              codeMessage
            }}
          </el-button>
        </div>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSubmit($event)" :loading="requestLoading">注 册</el-button>
      </el-form-item>
    </el-form>
  </p-dialog>
</template>

<script>
import {addService} from '../../service/service';
import {register, checkUserName, sendValidateCode, checkEmailIsRegister } from '../../api/user';
import PDialog from "../UIComponents/PDialog.vue";
import { View, Hide } from '@element-plus/icons-vue'
import {checkEmailCanRegister} from "../../utils/url";
export default {
  name: 'register',
  components: {PDialog},
  data() {
    return {
      View,
      Hide,
      passwordShow: false,
      confirmPasswordShow: false,
      showModal: false,
      codeButtonEnable: false,
      form: {
        userName: '',
        nickName: '',
        password: '',
        confirmPassword: '',
        email: '',
        validateCode: ''
      },
      rules: {
        userName: [{
          required: true,
          validator: (rule, value, callback) => {
            if(value) {
              checkUserName({userName: value})
                  .then((res) => {
                    if (res.data.code === 200) {
                      callback()
                    } else {
                      callback(new Error('用户名已经注册!'))
                    }
                  })
            } else {
              callback(new Error('请输入用户名!'))
            }
          },
          trigger: 'blur'
        }],
        nickName: [{required: true, message: '请输入昵称!', trigger: 'blur'}],
        password: [
          {required: true, message: '请输入密码!', trigger: 'blur'},
          {
            pattern: /^(?=.*\d)(?=.*[a-zA-Z])(?=.*[\W_]).{10,20}$/,
            message: '请输入长度为10-20位包含数字、字母、特殊字符的密码',
            trigger: 'blur'
          }
        ],
        confirmPassword: [{
          required: true,
          validator: (rule, value, callback) => {
            if (value) {
              if (value !== this.form.password) {
                return callback(new Error('密码不同步!'))
              } else {
                callback()
              }
            } else {
              return callback(new Error('请输入确认密码!'))
            }
          },
          trigger: 'blur'
        }],
        email: [
          {required: true, message: '请输入邮箱!', trigger: 'blur'},
          {
            pattern: /^\w+((.\w+)|(-\w+))@[A-Za-z0-9]+((.|-)[A-Za-z0-9]+).[A-Za-z0-9]+$/,
            message: '邮箱格式不正确！',
            trigger: 'blur'
          },
          {
            required: true,
            validator: (rule, value, callback) => {
              checkEmailIsRegister({email: value})
                  .then((res) => {
                    if (res.data.code === 200) {
                      callback()
                    } else {
                      callback(new Error('该邮箱已经注册!'))
                    }
                  })
            },
            trigger: 'blur'
          }
        ],
        validateCode: [
          {required: true, message: '请输入验证码!', trigger: 'blur'},
          {pattern: /^\d{6}$/, message: '验证码格式不正确！', trigger: 'blur'}
        ]
      },
      codeMessage: '获取验证码',
      requestLoading: false,
      isMac: false
    }
  },
  mounted() {
    this.isMac = /macintosh|mac os x/i.test(navigator.userAgent);
    addService('openRegister', this.open.bind(this));
  },
  methods: {
    open() {
      this.showModal = true
      this.form = {
        userName: '',
        nickName: '',
        password: '',
        confirmPassword: '',
        email: '',
        validateCode: ''
      }
    },
    close() {
      this.showModal = false
    },
    handleSubmit(e) {
      e.preventDefault();
      this.$refs.form.validate((valid) => {
        if (valid) {
          // 注册
          let json = {
            userName: this.form.userName,
            nickName: this.form.nickName,
            password: this.form.password,
            email: this.form.email,
            validateCode: this.form.validateCode,
            userFrom: this.isMac ? 1 : 2
          }
          this.requestLoading = true
          if(checkEmailCanRegister(this.form.email)) {
            register(json)
                .then((res) => {
                  this.requestLoading = false
                  if (res.data.code === 200) {
                    this.close()
                    this.$message.success('注册成功啦，可以进行登录喽！')
                  } else {
                    this.$message.error(res.data.message)
                  }
                })
                .catch(() => {
                  this.requestLoading = false
                  this.$message.success('注册失败，稍后再试，或者给我们发送邮件(xiaohualun1@gmail.com)，我们会尽快修复，并通知您！')
                })
          } else {
            this.$message.error('临时邮箱无法注册账号，请更换邮箱！')
          }
        }
      });
    },
    /**
     * 发送验证码
     */
    sendCode() {
      if (this.form.email) {
        let json = {
          email: this.form.email
        }
        this.requestLoading = true
        sendValidateCode(json)
            .then((res) => {
              this.requestLoading = false
              if (res.data.code === 200) {
                this.changeCodeButton()
                this.$message.success('验证码已发送，请注意查收！');
              } else {
                this.$message.error('邮件发送失败, 请给我们发送邮件(xiaohualun1@gmail.com)，我们会尽快修复，并通知您！')
              }
            })
            .catch(() => {
              this.requestLoading = false
              this.$message.error('邮件发送失败, 请给我们发送邮件(xiaohualun1@gmail.com)，我们会尽快修复，并通知您！')
            })
      }
    },
    changeCodeButton() {
      this.codeButtonEnable = true
      let index = 90
      let interval = setInterval(() => {
        if (index > 0) {
          this.codeMessage = `已发送(${index}秒)`
          index--
        } else {
          clearInterval(interval)
          this.codeButtonEnable = false
          this.codeMessage = `获取验证码`
        }
      }, 1000)
    },
    changePasswordShow() {
      this.passwordShow = !this.passwordShow
    },
    changeConfirmPasswordShow() {
      this.confirmPasswordShow = !this.confirmPasswordShow
    }
  }
}
</script>
