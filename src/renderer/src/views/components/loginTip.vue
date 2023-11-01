<template>
  <p-dialog v-model="showModal" title="请登录" :show-footer="false" :show-close="true"
            :destroy-on-close="true" :close-on-click-modal="false"
            :close-on-press-escape="false" width="500px">
    <div class="text-center my-5">
      <div class="text-lg font-medium">您还没有登录，请先进行登录再使用！</div>
      <div class="mt-4 text-sm">如您还没有账号，请先注册账号，再登录。</div>
      <div class="mt-1">注册成功后，赠送<span class="text-red-500 text-lg mx-1">20</span>次免费使用功能。</div>
    </div>

  </p-dialog>
</template>

<script>
import PDialog from "../UIComponents/PDialog.vue";
import {addService} from "../../service/service";
export default {
  name: "loginTip",
  components: { PDialog },
  data() {
    return {
      showModal: false
    }
  },
  mounted() {
    addService('openLoginTip', this.open.bind(this));
  },
  methods: {
    open () {
      this.showModal = true;
    },
    close () {
      this.showModal = false;
    },
  }
}
</script>

<style scoped>

</style>