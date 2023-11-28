<template>
  <p-dialog v-model="showModal" title="搜索" :show-close="true" :showFooter="false" :top="'5vh'"
            @cancel="closeModal" :destroy-on-close="true" :close-on-click-modal="false"
            :close-on-press-escape="false" width="414px">
    <iframe ref="searchIframe" class="w-full h-[70vh] border-t" v-if="searchText" :src="`https://quark.sm.cn/s?q=${searchText}&safe=1&snum=6`" />
    <div class="flex justify-end pt-4 border-t">
      <el-button @click="confirmLink">确定视频所在页面</el-button>
    </div>
  </p-dialog>
</template>

<script>
import PDialog from "../UIComponents/PDialog.vue";
export default {
  name: "searchDialog",
  components: {PDialog},
  data() {
    return {
      showModal: false,
      searchText: ""
    }
  },
  methods: {
    openModal(searchText) {
      this.showModal = true
      this.searchText = searchText
    },
    closeModal() {
      this.searchText = ""
      this.showModal = false
    },
    confirmLink() {
      alert(this.$refs.searchIframe.contentWindow.location.href)
      // this.closeModal()
    }
  }
}
</script>

<style scoped>

</style>