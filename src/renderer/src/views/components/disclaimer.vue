<template>
  <p-dialog v-model="showModal" title="免责申明" :show-footer="false" :show-close="true"
            :destroy-on-close="true" :close-on-click-modal="false"
            :close-on-press-escape="false" width="500px">
  </p-dialog>
</template>

<script>
import PDialog from "../UIComponents/PDialog.vue";
export default {
  name: "disclaimer",
  components: { PDialog },
  data() {
    return {
      showModal: false
    }
  },
  methods: {
    open () {
      this.showModal = true
    },
    close () {
      this.showModal = false
    },
  }
}
</script>

<style scoped>

</style>