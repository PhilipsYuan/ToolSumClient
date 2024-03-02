<template>
  <div class="min-h-[300px]">
    <div class="grid gap-4" v-if="list.length > 0">
      <div v-for="item in list" class="border rounded-md px-4 py-2 h-fit hover:bg-gray-100 hover:border-blue-400" :id="item.id">
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
            <el-tooltip v-if="item.isStart === item.pause && item.pausing === false" content="下载" placement="top">
              <el-icon class="icon-button !text-lg !p-1 cursor-pointer"
                       style="width: 28px !important;height:28px !important;"
                       :class="{'pointer-events-none !text-gray-300': item.message.content === '合成中...'}"
                       @click="startDownload(item)">
                <svg t="1709279437839" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
                     p-id="15727" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="200">
                  <path d="M623.83 120.25c0.098 0.098 0.098 0.298 0.098 0.497V456.037h167.69c0.103 0 0.103 0.098 0.2 0.2v0.298l-279.82 279.82-279.824-279.917v-0.103c0.103-0.098 0.103-0.2 0.203-0.2H400.071V120.747c0-0.2 0.099-0.399 0.2-0.497h223.657m0-55.965H400.07c-30.883 0-55.964 25.583-55.964 56.462v279.325H232.174c-22.686 0-43.067 13.892-51.664 34.778-8.696 20.884-3.894 45.068 12.091 61.163L472.422 775.93a55.953 55.953 0 0 0 39.575 16.392c14.293 0 28.683-5.5 39.574-16.392l279.82-279.819c15.992-15.991 20.788-40.273 12.097-61.26-8.694-20.886-29.083-34.778-51.67-34.778H679.891V120.747c0-30.878-25.085-56.462-55.964-56.462z m0 0M931.728 903.75H92.264c-15.488 0-27.98 12.49-27.98 27.976 0 15.497 12.492 27.989 27.98 27.989h839.464c15.495 0 27.986-12.492 27.986-27.989 0-15.485-12.492-27.977-27.986-27.977z m0 0"
                        p-id="15728" fill="currentColor"></path>
                </svg>
              </el-icon>
            </el-tooltip>
            <el-tooltip v-if="item.isStart !== item.pause || item.pausing === true" content="暂停" placement="top">
              <el-icon class="icon-button !text-lg !p-1 cursor-pointer"
                       :class="{'pointer-events-none !text-gray-300': item.message.content === '合成中...'}"
                       style="width: 28px !important;height:28px !important;"
                       @click="pauseDownload(item)">
                <svg t="1709278814047" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="6016"
                     xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="200">
                  <path d="M566.30303 868.848485H93.090909a31.030303 31.030303 0 0 0 0 62.060606h498.65697a246.690909 246.690909 0 0 1-25.444849-62.060606zM806.787879 992.969697a186.181818 186.181818 0 1 1 186.181818-186.181818 186.181818 186.181818 0 0 1-186.181818 186.181818z m-85.333334-248.242424v124.121212a23.272727 23.272727 0 0 0 46.545455 0v-124.121212a23.272727 23.272727 0 0 0-46.545455 0z m124.121213 0v124.121212a23.272727 23.272727 0 0 0 46.545454 0v-124.121212a23.272727 23.272727 0 0 0-46.545454 0z m-15.515152-403.39394a36.460606 36.460606 0 0 1 26.530909 63.922425l-357.934545 356.848484a46.545455 46.545455 0 0 1-65.784243 0l-357.934545-356.848484A36.460606 36.460606 0 0 1 101.158788 341.333333H248.242424V108.606061a46.545455 46.545455 0 0 1 46.545455-46.545455h341.333333a46.545455 46.545455 0 0 1 46.545455 46.545455v232.727272zM651.636364 403.393939a31.030303 31.030303 0 0 1-31.030303-31.030303V124.121212H310.30303v248.242424a31.030303 31.030303 0 0 1-31.030303 31.030303h-118.690909L465.454545 707.335758 770.172121 403.393939z"
                        p-id="6017" fill="currentColor"></path>
                </svg>
              </el-icon>
            </el-tooltip>
            <el-icon class="icon-button !text-lg !p-1 cursor-pointer"
                     style="width: 28px !important;height:28px !important;"
                     @click="playVideo(item)">
              <VideoPlay />
            </el-icon>
            <el-dropdown>
              <el-icon class="icon-button !text-lg" style="width: 28px !important;height:28px !important;">
                <MoreFilled/>
              </el-icon>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="!/tempM3u8Url|bilivideo|mgtv\.com/.test(item.m3u8Url)" @click="copyLink(item.m3u8Url)">复制资源链接</el-dropdown-item>
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
      intervalList: null,
      videoSrc: '',
      options: {
        autoplay: false, // 设置自动播放
        muted: true, // 设置了它为true，才可实现自动播放,同时视频也被静音（Chrome66及以上版本，禁止音视频的自动播放）
        preload: "auto", // 预加载
        controls: true, // 显示播放的控件
      },
    };
  },
  async mounted() {
    await this.getLoadingList()
    addService("getM3u8LoadingList", this.getLoadingList.bind(this))
    addService("m3u8VideoDownloadSuccess", this.m3u8VideoDownloadSuccess.bind(this))
    addService('deleteM3u8LoadingSuccess', this.deleteSuccess.bind(this))
    this.intervalList = setInterval(async () => {
      await this.getLoadingList()
    }, 1000)
  },
  methods: {
    async startDownload(item) {
      if(item.message.content !== '合成中...' && this.checkoutDownloadingLimit()) {
        if(item.pause === false && item.isStart === false) {
          await window.electronAPI.startDownloadVideo(item.id)
        }  else {
          await window.window.electronAPI.continueM3u8DownloadVideo(item.id)
          await this.getLoadingList()
        }
      }
    },
    async pauseDownload(item) {
      if(item.message.content !== '合成中...' && !item.pausing) {
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
    },
    playVideo (item) {
      window.electronAPI.openVideoPlayPage(item.m3u8Url, item.name);
    }
  },
  beforeDestroy() {
    clearInterval(this.intervalList)
  }
}
</script>

<style scoped>

</style>
