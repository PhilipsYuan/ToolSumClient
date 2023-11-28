<template>
  <div class="flex items-center gap-4 w-full">
    <el-input v-model="searchText" class="w-full" placeholder="请输入完整的电影名称"
              @change="()=> this.searchText = this.searchText.trim()"/>
    <el-button @click="searchContent" :loading="loading" :disabled="loading">自动搜索</el-button>
    <el-button @click="selfSearchContent" :loading="loading" :disabled="loading">手动搜索</el-button>
    <search-dialog ref="searchDialog" />
  </div>
</template>

<script>
import searchDialog from "../../components/searchDialog.vue";
export default {
  name: "search",
  components: { searchDialog },
  data() {
    return {
      searchText: '',
      loading: false
    }
  },
  methods: {
    async searchContent() {
      this.loading = true;
      const link = await window.electronAPI.getSearchResult(this.searchText)
      this.loading = false;
      if(link) {
        this.$emit('setHtmlUrl', link, this.searchText)
      }
    },
    async selfSearchContent() {
      if(this.searchText) {
        this.$refs.searchDialog.openModal(this.searchText)
      } else {
        this.$message.error('请输入电影名称！')
      }
    }
  }
}
</script>

<style scoped>

</style>