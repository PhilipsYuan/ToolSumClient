<template>
  <diV class="min-h-[300px]">
    <div class="grid gap-4">
      <div v-for="item in list" class="border rounded-md px-4 py-2 h-fit" :id="item.id">
        <div class="flex items-center justify-between">
          <div>
            <div>{{item.name}}</div>
            <div class="text-green-500 flex items-center text-xs mt-1"
                 :class="{'!text-red-500': item.message.status === 'error'}">
              <el-icon class="!text-green-500 mr-2" :class="{'!text-red-500': item.message.status === 'error'}">
                <InfoFilled/>
              </el-icon>
              {{ item.message.content }}
            </div>
          </div>
          <div class="flex gap-3">
            <el-icon v-if="item.isStart === item.pause" class="icon-button !text-lg !p-1 cursor-pointer"
                     style="width: 28px !important;height:28px !important;"
                     @click="startDownload(item.id)">
              <VideoPlay/>
            </el-icon>
            <el-icon v-if="item.isStart !== item.pause" class="icon-button !text-lg !p-1 cursor-pointer"
                     style="width: 28px !important;height:28px !important;"
                     @click="startDownload(item.id)">
              <VideoPause/>
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
  </diV>
</template>

<script>
import {VideoPlay} from "@element-plus/icons-vue";
import {addService} from "../../../service/service";
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
    addService("getM3u8LoadingList", this.getLoadingList.bind(this))
    addService("m3u8VideoDownloadSuccess", this.m3u8VideoDownloadSuccess.bind(this))
    setInterval(async () => {
      await this.getLoadingList()
    }, 1000)
  },
  methods: {
    async startDownload(id) {
      await window.electronAPI.startDownloadM3u8Video(id)
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
    },
    async m3u8VideoDownloadSuccess(loadingId) {
      await this.getLoadingList()
      this.$emit('changeTab', 'finish')
      document.getElementById('m3u8-finish-list-frame').scroll(0, 0)
    }
  }
}
</script>

<style scoped>

</style>