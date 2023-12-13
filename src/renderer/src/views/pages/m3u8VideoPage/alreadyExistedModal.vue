<template>
  <p-dialog v-model="showModal" title="文件存在" :show-close="false" ok-text="去查看" @ok="goToExist"
            close-text="取消" @cancel="cancelFun" :destroy-on-close="true" :close-on-click-modal="false"
            :close-on-press-escape="false" width="700px">
    <div class="text-base">
      <div v-if="item.name === inputName" class="font-medium text-base mb-5">
        <div>"{{ item.name }}"</div>名称在已经下载中存在了，请更换下名称！
      </div>
      <div v-else-if="item.m3u8Url === inputUrl" class="font-medium text-sm mb-5">
        <div class="break-all mb-1">"{{ item.m3u8Url }}"</div>
        资源在已经下载中存在了，请更换个资源！
      </div>
      <el-form ref="formRef">
        <el-form-item label="已存在名称:" prop="masterName">
          <div class="text-lg text-gray-900" :class="{'text-red-500': item.name === inputName}">{{ item.name }}</div>
        </el-form-item>
        <el-form-item label="链接:" prop="masterName">
          <div class="text-gray-400 break-all"
               :class="{'text-red-500': item.m3u8Url === inputUrl}">{{ item.m3u8Url }}
          </div>
        </el-form-item>
      </el-form>
    </div>
  </p-dialog>
</template>

<script>
import PDialog from "../../UIComponents/PDialog.vue";

export default {
  name: "alreadyExistedModal",
  components: {PDialog},
  data() {
    return {
      showModal: false,
      item: {},
      inputUrl: '',
      inputName: '',
      type: ''
    }
  },
  methods: {
    openModal(item, inputUrl, inputName,type) {
      console.log(item)
      this.showModal = true
      this.item = item
      this.inputUrl = inputUrl
      this.inputName = inputName
      this.type = type
    },
    goToExist() {
      if (this.type === 'loading') {
        this.$emit('changeTab', 'loading')
      } else {
        this.$emit('changeTab', 'finish')
      }
      this.cancelFun()
      setTimeout(() => {
        const dom = document.getElementById(this.item.id)
        dom.scrollIntoView()
        dom.style.borderColor = 'red'
        setTimeout(() => {
          dom.style.borderColor = ''
        }, 3000)
        // document.getElementById(this.item.id).scrollIntoView()
      }, 100)
    },
    cancelFun() {
      this.showModal = false
    },
  }
}
</script>

<style scoped>

</style>