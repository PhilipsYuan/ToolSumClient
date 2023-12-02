<template>
  <div class="flex items-center gap-4 w-full">
    <el-input v-model="searchText" class="w-full" placeholder="请输入完整的电影名称"
              @change="()=> this.searchText = this.searchText.trim()" @keydown.enter="searchContent"/>
    <el-button @click="searchContent" :loading="loading" :disabled="loading">自动搜索</el-button>
    <el-popover
        ref="popover"
        placement="top-end"
        :width="'fit-content'"
        trigger="hover"
        content="在弹框里选择确定视频所在的页面后，就关闭窗口，软件会自己检索出链接。"
    >
      <template #reference>
        <el-button class="!ml-0" @click="selfSearchContent" :loading="loading" :disabled="loading">手动搜索</el-button>
      </template>
    </el-popover>
    <search-dialog ref="searchDialog" />
  </div>
</template>

<script>
import searchDialog from "../../components/searchDialog.vue";
import { addService} from "../../../service/service";

export default {
  name: "search",
  components: { searchDialog },
  data() {
    return {
      searchText: '',
      loading: false
    }
  },
  mounted() {
    addService('getUserChooseSearchPageUrl', this.getUserChooseSearchPageUrl.bind(this))
    addService('showSearchPageUrlLoadFail', this.showSearchPageUrlLoadFail.bind(this))
  },
  methods: {
    async searchContent() {
      if(this.searchText) {
        this.loading = true;
        const link = await window.electronAPI.getSearchResult(this.searchText)
        this.loading = false;
        if(link) {
          this.$emit('setHtmlUrl', link, this.searchText)
        } else {
          this.$emit('setHtmlUrl', '', '')
          this.$message.error("没有搜索到内容，请选择手动搜索试试！")
        }
      } else {
        this.$message.error('请输入电影名称！')
      }
    },
    async selfSearchContent() {
      this.$refs.popover.hide()
      if(this.searchText) {
        this.loading = true;
        await window.electronAPI.openSearchWindow(this.searchText)
        // this.$refs.searchDialog.openModal(this.searchText)
      } else {
        this.$message.error('请输入电影名称！')
      }
    },
    getUserChooseSearchPageUrl(link) {
      this.loading = false;
      if(link) {
        this.$emit('setHtmlUrl', link, this.searchText)
      } else {
        this.$emit('setHtmlUrl', '', '')
      }
    },
    showSearchPageUrlLoadFail() {
      this.$message.error("无法访问此网站, 将返回到搜索页面。")
    },
    clearSearchText() {
      this.searchText = ''
    }
  }
}
</script>

<style scoped>

</style>
