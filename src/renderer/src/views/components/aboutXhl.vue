<template>
  <p-dialog v-model="showModal" title="关于小滑轮" :show-footer="false" :show-close="true"
            :destroy-on-close="true" :close-on-click-modal="false"
            :close-on-press-escape="false" width="300px">
    <div class="text-center text-xl font-medium text-black">小滑轮</div>
    <div class="mt-4 text-base text-center mb-4">版本：{{version}}</div>
  </p-dialog>
</template>

<script>
import PDialog from "../UIComponents/PDialog.vue";
import {addService} from "../../service/service";
export default {
  name: "aboutXhl",
  components: {PDialog},
  mounted() {
    addService('openAboutXhl', this.open.bind(this));
  },
  data() {
    return {
      showModal: false,
      version: ''
    }
  },
  methods: {
    open(version) {
      this.showModal = true
      this.version = version
    },
    close() {
      this.showModal = false
    }
  }
}
</script>

<style scoped>

</style>