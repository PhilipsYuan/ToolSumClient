<template>
  <el-tabs type="border-card" v-model="activeName">
    <el-tab-pane label="视频下载" name="create" />
    <el-tab-pane label="已完成" name="finish" />
    <m3u8-create v-if="activeName === 'create'" />
  </el-tabs>

</template>

<script>
import m3u8Create from "./m3u8Create.vue";

export default {
  name: "m3u8VideoPage",
  components: { m3u8Create },
  data() {
    return {
      activeName: 'create'
    }
  }

}
</script>

<style scoped>

</style>