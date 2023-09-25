<template>
  <el-tabs type="border-card" v-model="activeName" @tab-change="tabChanged">
    <el-tab-pane label="视频下载" name="create" />
    <el-tab-pane label="下载中" name="loading" />
    <el-tab-pane label="已完成" name="finish" />
    <m3u8-create v-show="activeName === 'create'" @changeTab="changeTab" />
    <finished-list ref="finishList" v-show="activeName === 'finish'" />
    <loading-list ref="loadingList" v-show="activeName === 'loading'" @changeTab="changeTab"/>
  </el-tabs>

</template>

<script>
import m3u8Create from "./m3u8Create.vue";
import finishedList from "./finishedList.vue";
import loadingList from './loadingList.vue'
export default {
  name: "m3u8VideoPage",
  components: { m3u8Create, finishedList, loadingList },
  data() {
    return {
      activeName: 'loading'
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