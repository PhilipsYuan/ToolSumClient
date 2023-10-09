<template>
  <p-dialog v-model="showModal" title="更换密码" :show-footer="false" :show-close="true"
            :destroy-on-close="true" :close-on-click-modal="false"
            :close-on-press-escape="false" width="600px">
      <el-form ref="form" :model="form" :rules="rules" label-width="80px" label-position="left">
        <el-form-item label="用户名" prop="userName">
          <el-input size="small" v-model="form.userName" placeholder="用户名" />
        </el-form-item>
        <el-form-item label="新密码" prop="password">
          <el-input size="small" v-model="form.password" type="password" placeholder="密码"/>
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input size="small" v-model="form.confirmPassword" type="password" placeholder="确认密码"/>
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input size="small" v-model="form.email" placeholder="邮箱" />
        </el-form-item>
        <el-form-item label="验证码" prop="validateCode">
          <el-input size="small" v-model="form.validateCode" style="width: 150px; margin-right: 10px;" placeholder="验证码"/>
          <el-button size="small" style="width: 116px;" :disabled="codeButtonEnable" @click="sendCode">{{codeMessage}}</el-button>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="small" @click="handleSubmit($event)">更换密码</el-button>
        </el-form-item>
      </el-form>
  </p-dialog>
</template>

<script>
import {addService} from '../../service/service';
import {checkUserName, changePassword, sendValidateCode} from '../../api/user';
import PDialog from "../UIComponents/PDialog.vue";
export default {
  name: 'resetPassword',
  components: {PDialog},
  data () {
    return {
      showModal: false,
      codeButtonEnable: false,
      form: {
        userName: '',
        password: '',
        confirmPassword: '',
        email: '',
        validateCode: ''
      },
      rules: {
        userName: [{
          required: true,
          validator: (rule, value, callback) => {
            let timer = null
            timer = setTimeout(() => {
              clearTimeout(timer)
              checkUserName({userName: value})
                .then((res) => {
                  if (res.data.code === 200) {
                    callback(new Error('用户名不存在!'))
                  } else {
                    callback()
                  }
                })
            }, 500)
          },
          trigger: 'blur'
        }],
        password: [
          {required: true, message: '请输入密码!', trigger: 'blur'},
          {pattern: /^(?=.*\d)(?=.*[a-zA-Z])(?=.*[\W_]).{10,20}$/, message: '请输入长度为10-20位包含数字、字母、特殊字符的密码', trigger: 'blur'}
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
          {pattern: /^\w+((.\w+)|(-\w+))@[A-Za-z0-9]+((.|-)[A-Za-z0-9]+).[A-Za-z0-9]+$/, message: '邮箱格式不正确！', trigger: 'blur'}
        ],
        validateCode: [
          {required: true, message: '请输入验证码!', trigger: 'blur'},
          {pattern: /^\d{6}$/, message: '验证码格式不正确！', trigger: 'blur'}
        ]
      },
      codeMessage: '获取验证码'
    }
  },
  mounted () {
    addService('openResetPassword', this.open.bind(this));
  },
  methods: {
    open () {
      this.showModal = true
    },
    close () {
      this.showModal = false
    },
    handleSubmit (e) {
      e.preventDefault();
      this.$refs.form.validate((valid) => {
        if (valid) {
          let json = {
            userName: this.form.userName,
            password: this.form.password,
            email: this.form.email,
            validateCode: this.form.validateCode
          }
          changePassword(json)
            .then((res) => {
              if (res.data.code === 200) {
                this.close()
                this.$message.success('密码修改成功，可以进行登录啦！')
              } else {
                this.$message.error(res.data.message)
              }
            })
        }
      });
    },
    /**
     * 发送验证码
     */
    sendCode () {
      if (this.form.email) {
        let json = {
          email: this.form.email
        }
        sendValidateCode(json)
          .then((res) => {
            if (res.data.code === 200) {
              this.changeCodeButton()
              this.$message.success('验证码已发送，请注意查收！');
            } else {
              this.$message.error('邮件发送失败, 请在问题留言（评论留言）下，留言告知。我们会尽快修复，并通知您！')
            }
          })
      }
    },
    changeCodeButton () {
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
    }
  }
}
</script>
