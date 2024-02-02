<template>
  <p-dialog v-model="showModal" title="免责申明" :show-footer="false" :show-close="false"
            :destroy-on-close="true" :close-on-click-modal="false"
            :close-on-press-escape="false" width="800px">
    <div class="text-center">{{ info }}</div>
    <div class="flex justify-center mt-8">
      <el-button class="w-[320px]" type="primary" @click="agree()">同意</el-button>
    </div>
  </p-dialog>
</template>

<script>
import PDialog from "../UIComponents/PDialog.vue";

export default {
  name: "disclaimer",
  components: {PDialog},
  data() {
    return {
      showModal: false,
      info: ''
    }
  },
  mounted() {
  },
  methods: {
    open() {
      this.showModal = true
      window.electronAPI.getDisclaimerInfo()
          .then((result) => {
            this.info = result.info || ''
          })
    },
    close() {
      this.showModal = false
    },
    async agree() {
      await window.electronAPI.setAgreeDisclaimerSetting(true)
      this.close()
    }
  }
}
</script>

<style scoped>

</style>