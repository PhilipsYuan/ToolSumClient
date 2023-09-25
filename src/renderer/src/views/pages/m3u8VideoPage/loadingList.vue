<template>
  <div class="grid gap-4">
    <div v-for="item in list" class="border rounded-md px-4 py-2" :id="item.id">
      <div class="flex items-center justify-between">
        <div>
          <div>{{item.name}}</div>
          <div class="flex">
           <div class="text-green-500 text-xs">已完成50%</div>
            <div class="text-green-500 flex items-center text-xs ml-8" :class="{'!text-red-500': item.message.status === 'error'}">
              {{ item.message.content }}
            </div>
          </div>
        </div>
        <div class="flex gap-3">
          <el-icon class="icon-button !text-lg !p-1 cursor-pointer"
                   style="width: 28px !important;height:28px !important;"
                   @click="startDownload()">
            <VideoPlay/>
          </el-icon>
          <el-dropdown>
            <el-icon class="icon-button !text-lg" style="width: 28px !important;height:28px !important;">
              <MoreFilled/>
            </el-icon>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="copyLink(item.m3u8Url)">复制资源链接</el-dropdown-item>
                <el-dropdown-item @click="deleteRecord(item.id)">删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {VideoPlay} from "@element-plus/icons-vue";
export default {
  name: "loadingList",
  components: {VideoPlay},
  data() {
    return {
      list: [],
      message: {
        status: 'success',
        content: '网页解析完成，发现可下载的链接。'
      }
    }
  },
  async mounted() {
    await this.getLoadingList()
  },
  methods: {
    startDownload() {

    },
    copyLink(url) {
      navigator.clipboard.writeText(url)
    },
    async deleteRecord(id) {
      await window.electronAPI.deleteM3u8LoadingList(id)
      this.$message.success("删除成功")
      await this.getLoadingList()
    },
    async getLoadingList() {
      this.list = await window.electronAPI.getM3u8LoadingList() || []
    }
  }
}
</script>

<style scoped>

</style>