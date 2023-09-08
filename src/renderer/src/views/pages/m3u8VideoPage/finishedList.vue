<template>
  <div>

  </div>
</template>

<script>
export default {
  name: "finishedList",
  data() {
    return {
      list: []
    }
  },
  async mounted() {
    this.list = await window.electronAPI.getFinishList()
  }
}
</script>

<style scoped>

</style>