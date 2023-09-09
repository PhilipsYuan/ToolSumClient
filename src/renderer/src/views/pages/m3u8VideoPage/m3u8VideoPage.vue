<template>
  <el-tabs type="border-card" v-model="activeName" @tab-change="tabChanged">
    <el-tab-pane label="视频下载" name="create" />
    <el-tab-pane label="已完成" name="finish" />
    <m3u8-create v-show="activeName === 'create'" @changeTab="changeTab" />
    <finished-list ref="finishList" v-show="activeName === 'finish'" />
  </el-tabs>

</template>

<script>
import m3u8Create from "./m3u8Create.vue";
import finishedList from "./finishedList.vue";
export default {
  name: "m3u8VideoPage",
  components: { m3u8Create, finishedList },
  data() {
    return {
      activeName: 'create'
    }
  },
  methods: {
    tabChanged() {
      if(this.activeName === 'finish') {
        this.$refs.finishList.getFinishList()
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