<template>
  <div class="relative h-[calc(100vh-124px)]">
    <notice v-if="activeName === 'create'" />
    <el-tabs type="border-card" v-model="activeName" @tab-change="tabChanged">
      <el-tab-pane label="视频下载" name="create" />
      <el-tab-pane label="下载中" name="loading" />
      <el-tab-pane label="已完成" name="finish" />
      <m3u8-create v-show="activeName === 'create'" @changeTab="changeTab" />
      <finished-list ref="finishList" v-show="activeName === 'finish'" />
      <loading-list ref="loadingList" v-show="activeName === 'loading'" @changeTab="changeTab"/>
    </el-tabs>
    <div v-if="activeName === 'create'" class="absolute bottom-8 flex justify-center text-gray-500 w-full">Tip: 如果您在使用过程中遇到问题，欢迎给我们邮箱留言(xiaohualun1@gmail.com)或加入小滑轮官方QQ群（876806405），我们会尽快回复您</div>
  </div>
</template>

<script>
import m3u8Create from "./m3u8Create.vue";
import finishedList from "./finishedList.vue";
import loadingList from './loadingList.vue'
import Notice from "../../components/notice.vue";
export default {
  name: "m3u8VideoPage",
  components: {Notice, m3u8Create, finishedList, loadingList },
  data() {
    return {
      activeName: 'create'
    }
  },
  methods: {
    tabChanged() {
      if(this.activeName === 'finish') {
        this.$refs.finishList.getFinishList()
      } else if(this.activeName === 'loading') {
        this.$refs.loadingList.getLoadingList()
      }
    },
    changeTab(tab) {
      this.activeName = tab
    }
  }
}
</script>

<style scoped>

</style>