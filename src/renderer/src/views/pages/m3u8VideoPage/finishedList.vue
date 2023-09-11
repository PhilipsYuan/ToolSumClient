<template>
  <div class="px-5 py-4 grid gap-6">
    <el-card v-for="item in list" class="hover:bg-gray-50 !rounded-md" :body-style="{'padding': '16px 20px'}">
      <div class="flex justify-between items-center">
        <div class="font-medium text-base flex items-center">
          {{ item.name }}
        </div>
        <div class="flex gap-4 items-center">
          <div v-if="!item.isExist"
               class="bg-red-100 text-xs flex items-center rounded-md px-1 font-normal text-gray-500 mr-2">
            <el-icon class="!text-red-500 mr-1">
              <CircleCloseFilled/>
            </el-icon>
            已丢失
          </div>
          <div class="text-xs text-gray-500">{{item.date}}</div>
          <el-icon class="icon-button" :class="{'!text-gray-300 pointer-events-none': !item.isExist}"
                   @click="openFolder(item.filePath)">
            <Folder/>
          </el-icon>
          <el-dropdown>
            <el-icon class="icon-button">
              <MoreFilled/>
            </el-icon>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="item.isExist" @click="openVideoFile(item.filePath)">播放</el-dropdown-item>
                <el-dropdown-item @click="deleteRecord(item.id)">删除记录</el-dropdown-item>
                <el-dropdown-item @click="deleteRecordAndFile(item.id)" v-if="item.isExist">删除记录和文件</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script>
import {addService} from "../../../service/service";

export default {
  name: "finishedList",
  data() {
    return {
      list: []
    }
  },
  async mounted() {
    await this.getFinishList()
    addService("getM3u8FinishedList", this.getFinishList.bind(this))
  },
  methods: {
    openFolder(filePath) {
      window.electronAPI.goToDirectory(filePath)
    },
    openVideoFile(filePath) {
      window.electronAPI.openDirectoryAndFile(filePath)
    },
    async deleteRecord(id) {
      await window.electronAPI.deleteM3u8FinishedRecord(id)
      this.$message.success("删除成功")
      await this.getFinishList()
    },
    async deleteRecordAndFile(id) {
      await window.electronAPI.deleteFinishedRecordAndFile(id)
      this.$message.success("删除成功")
      await this.getFinishList()
    },
    async getFinishList() {
      this.list = await window.electronAPI.getFinishList()
    }
  }
}
</script>

<style scoped>

</style>