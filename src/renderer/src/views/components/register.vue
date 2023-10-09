<template>
  <el-dialog v-if="visible" :visible="visible" :footer="null" :before-close="close" width="400px">
      <div class="title">注册</div>
      <el-form ref="form" :model="form" :rules="rules" label-width="80px" label-position="left">
        <el-form-item label="用户名" prop="userName">
          <el-input v-model="form.userName" size="small" placeholder="用户名"/>
        </el-form-item>
        <el-form-item label="昵称" prop="nickName">
          <el-input v-model="form.nickName" size="small" placeholder="昵称"/>
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" size="small" type="password" placeholder="密码"/>
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="form.confirmPassword" size="small" type="password" placeholder="确认密码"/>
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" size="small" placeholder="邮箱"/>
        </el-form-item>
        <el-form-item label="验证码" prop="validateCode">
          <el-input v-model="form.validateCode" size="small" style="width: 150px; margin-right: 10px;" placeholder="验证码"/>
          <el-button style="width: 116px;" size="small" :disabled="codeButtonEnable" @click="sendCode">{{ codeMessage }}</el-button>
        </el-form-item>
        <el-form-item>
          <el-button size="small" type="primary" @click="handleSubmit($event)">注 册</el-button>
        </el-form-item>
      </el-form>
  </el-dialog>
</template>

<script>
import {addService} from '../../service/service';
import {register, checkUserName, sendValidateCode, changePassword} from '../../api/user';

export default {
  name: 'register',
  data () {
    return {
      visible: false,
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
            checkUserName({userName: value})
              .then((res) => {
                if (res.data.code === 200) {
                  callback()
                } else {
                  callback(new Error('用户名已经注册!'))
                }
              })
          },
          trigger: 'blur'
        }],
        nickName: [{required: true, message: '请输入昵称!', trigger: 'blur'}],
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
    addService('openRegister', this.open.bind(this));
  },
  methods: {
    open () {
      this.visible = true
    },
    close () {
      this.visible = false
    },
    handleSubmit (e) {
      e.preventDefault();
      this.$refs.form.validate((valid) => {
        if (valid) {
          // 注册
          let json = {
            userName: this.form.userName,
            nickName: this.form.nickName,
            password: this.form.password,
            email: this.form.email,
            validateCode: this.form.validateCode
          }
          register(json)
            .then((res) => {
              if (res.data.code === 200) {
                this.close()
                this.$message.success('注册成功啦，可以进行登录喽！')
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