<template>
  <div class="min-h-[300px]">
    <div class="grid gap-4" v-if="list.length > 0">
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
          <div class="flex gap-3 items-center">
            <div v-if="item.pausing === true" class="text-xs text-gray-500">暂停中...</div>
            <el-icon v-if="item.isStart === item.pause && item.pausing === false" class="icon-button !text-lg !p-1 cursor-pointer"
                     style="width: 28px !important;height:28px !important;"
                     :class="{'pointer-events-none !text-gray-300': item.message.content === '合成中...'}"
                     @click="startDownload(item)">
              <VideoPlay/>
            </el-icon>
            <el-icon v-if="item.isStart !== item.pause || item.pausing === true" class="icon-button !text-lg !p-1 cursor-pointer"
                     :class="{'pointer-events-none !text-gray-300': item.message.content === '合成中...'}"
                     style="width: 28px !important;height:28px !important;"
                     @click="pauseDownload(item)">
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
    <el-empty v-if="list.length === 0" description="暂无数据" />
  </div>
</template>

<script>
import {VideoPlay} from "@element-plus/icons-vue";
import {addService, useService} from "../../../service/service";
import {getUserBenefitApi, reduceBenefit} from "../../../api/user";
import {setUserBenefit} from "../../../service/userService";
export default {
  name: "loadingList",
  components: {VideoPlay},
  data() {
    return {
      list: [],
    }
  },
  async mounted() {
    await this.getLoadingList()
    addService("getM3u8LoadingList", this.getLoadingList.bind(this))
    addService("m3u8VideoDownloadSuccess", this.m3u8VideoDownloadSuccess.bind(this))
    addService('deleteM3u8LoadingSuccess', this.deleteSuccess.bind(this))
    setInterval(async () => {
      await this.getLoadingList()
    }, 1000)
  },
  methods: {
    async startDownload(item) {
      if(this.checkoutDownloadingLimit()) {
        if(item.pause === false && item.isStart === false) {
          await window.electronAPI.startDownloadM3u8Video(item.id)
        }  else {
          await window.window.electronAPI.continueM3u8DownloadVideo(item.id)
          await this.getLoadingList()
        }
      }
    },
    async pauseDownload(item) {
      if(!item.pausing) {
        await window.window.electronAPI.pauseM3u8DownloadVideo(item.id)
        await this.getLoadingList()
      }
    },
    copyLink(url) {
      navigator.clipboard.writeText(url)
    },
    async deleteRecord(id) {
      await window.electronAPI.deleteM3u8LoadingList(id)
    },
    async deleteSuccess(callType) {
      if(callType !== 'success') {
        this.$message.success("删除成功")
      }
      await this.getLoadingList()
    },
    async getLoadingList() {
      this.list = await window.electronAPI.getM3u8LoadingList() || []
    },
    async m3u8VideoDownloadSuccess() {
      useService("getM3u8FinishedList")
      await this.getLoadingList()
      this.$emit('changeTab', 'finish')
      setTimeout(() => {
        document.getElementById('m3u8-finish-list-frame').scroll(0, 0)
      }, 200)
      await this.costUserBenefit()
    },
    /**
     * 下载成功后，消耗用户的权益
     */
    costUserBenefit() {
      return getUserBenefitApi()
          .then((res) => {
            if(res.data.result) {
              const result = res.data.result
              if(result.isVip) {
                // nothing to do
              } else if(result.freeCount > 0) {
                reduceBenefit()
                    .then(() => {
                      setUserBenefit()
                    })
              }
            }
          })
    },
    /**
     * 校验现在下载的次数，如果达到3个，就不可以再进行下载。
     */
    checkoutDownloadingLimit() {
      const loadingItems = this.list.filter((item) => item.isStart !== item.pause || item.pausing === true)
      if(loadingItems.length >= 3) {
        this.$message.error("只能同时下载3个文件，如果想下其他文件，请先暂停一个下载。")
        return false
      } else {
        return true
      }
    }
  }
}
</script>

<style scoped>

</style>