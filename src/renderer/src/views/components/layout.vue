<template>
  <el-container>
    <el-header>
      <head-part/>
    </el-header>
    <el-container>
      <el-aside>
        <el-menu default-active="1">
          <el-menu-item index="1" @click="goPath('/')">
            <span>m3u8视频下载</span>
          </el-menu-item>
          <el-menu-item index="2" @click="goPath('/setting')">
            <span>设置</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main>
        <router-view/>
      </el-main>
    </el-container>
  </el-container>
</template>

<script>
import headPart from "./head.vue";
export default {
  name: "layout",
  components: {headPart},
  methods: {
    goPath(path) {
      this.$router.push({path: path})
    },
  }
}
</script>

<style scoped>

</style>