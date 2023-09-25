<template>
  <p-dialog v-model="showModal" title="文件存在" :show-close="false" ok-text="确定" @ok="goToExist"
            close-text="取消" @cancel="cancelFun" :destroy-on-close="true" :close-on-click-modal="false"
            :close-on-press-escape="false" width="600px">
    <div class="text-base">
      <div class="font-medium text-lg mb-5">已下载过, 查看下载记录吗？</div>
      <el-form ref="formRef">
        <el-form-item label="名称:" prop="masterName">
          <div class="">{{item.name}}</div>
        </el-form-item>
        <el-form-item label="m3u8链接:" prop="masterName">
          <div class="text-gray-400 break-all">{{item.m3u8Url}}</div>
        </el-form-item>
      </el-form>
    </div>
  </p-dialog>
</template>

<script>
import PDialog from "../../UIComponents/PDialog.vue";
export default {
  name: "alreadyExistedModal",
  components: { PDialog },
  data() {
    return {
      showModal: false,
      item: {}
    }
  },
  methods: {
    openModal(item) {
      this.showModal = true
      this.item = item
    },
    goToExist() {
      if(this.item.totalIndex) {
        this.$emit('changeTab', 'loading')
      } else {
        this.$emit('changeTab', 'finish')
      }
      this.cancelFun()
      setTimeout(() => {
        document.getElementById(this.item.id).scrollIntoView()
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