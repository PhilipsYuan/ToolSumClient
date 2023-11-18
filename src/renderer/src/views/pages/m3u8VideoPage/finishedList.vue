<template>
  <div class="min-h-[300px]">
    <div class="px-20 mt-2 mb-4">
      <el-input class="" v-model="query" placeholder="请输入名称和链接检索" @keyup.enter.native="getFinishList(query)">
        <template #append>
          <el-button @click="getFinishList(query)">
            <el-icon>
              <Search/>
            </el-icon>
          </el-button>
        </template>
      </el-input>
    </div>
    <div class="overflow-auto h-[calc(100vh-243px)] px-4 py-4 rounded-md bg-[#f6f8fc]" id="m3u8-finish-list-frame">
      <el-card v-for="item in list" class="hover:bg-gray-50 !rounded-md mb-4 last:mb-0" :id="item.id" :body-style="{'padding': '8px 20px'}">
        <div class="flex justify-between items-center gap-3">
          <div class="font-medium text-base truncate">
            {{ item.name }}
            <div class="text-xs text-gray-400 truncate">{{item.m3u8Url}}</div>
          </div>
          <div>
            <div class="flex gap-3 items-center w-[190px]" :class="{'w-[265px]': !item.isExist}">
              <div v-if="!item.isExist"
                   class="bg-red-100 text-xs flex items-center rounded-md px-1 font-normal text-gray-500 mr-2 w-[68px]">
                <el-icon class="!text-red-500 mr-1">
                  <CircleCloseFilled/>
                </el-icon>
                已丢失
              </div>
              <div class="text-xs text-gray-500">{{ item.date }}</div>
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
                    <el-dropdown-item @click="copyLink(item.m3u8Url)">复制资源链接</el-dropdown-item>
                    <el-dropdown-item @click="deleteRecord(item.id)">删除记录</el-dropdown-item>
                    <el-dropdown-item @click="deleteRecordAndFile(item.id)" v-if="item.isExist">删除记录和文件
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script>
import {addService} from "../../../service/service";

export default {
  name: "finishedList",
  data() {
    return {
      query: '',
      list: []
    }
  },
  async mounted() {
    await this.getFinishList()
    addService("getM3u8FinishedList", this.getFinishList.bind(this))
  },
  methods: {
    async openFolder(filePath) {
     const result = await window.electronAPI.goToDirectory(filePath);
     if(result === 'failure') {
       this.$message.error("无法打开，文件已经丢失！")
       await this.getFinishList()
     }
    },
    async openVideoFile(filePath) {
      const result = await window.electronAPI.openDirectoryAndFile(filePath)
      if(result === 'failure') {
        this.$message.error("无法播放，文件已经丢失！")
        await this.getFinishList()
      }
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
    async getFinishList(query) {
      this.query = query
      this.list = await window.electronAPI.getFinishList(query)
    },
    copyLink(url) {
      navigator.clipboard.writeText(url)
    }
  }
}
</script>

<style scoped>

</style>