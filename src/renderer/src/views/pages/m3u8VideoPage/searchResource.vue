<template>
  <div class="flex items-center gap-4 w-full">
    <el-input v-model="searchText" class="w-full" @change="()=> this.searchText = this.searchText.trim()"/>
    <el-button @click="searchContent" :loading="loading" :disabled="loading">搜索</el-button>
  </div>
</template>

<script>
export default {
  name: "search",
  data() {
    return {
      searchText: '',
      loading: false
    }
  },
  methods: {
    searchContent() {
      window.electronAPI.getSearchResult(this.searchText)
    }
  }
}
</script>

<style scoped>

</style>