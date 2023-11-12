<template>
  <div>
    overtimePayList
  </div>
</template>

<script>
export default {
  name: "overtimePayList",
  data() {
    return {
      list: []
    }
  },
  methods: {
    updateList(list) {
      this.list = list
    }
  }
}
</script>

<style scoped>

</style>