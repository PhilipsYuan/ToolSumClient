<template>
  <el-config-provider :locale="zhCn">
    <div class="flex">
      <el-menu default-active="1">
        <el-menu-item index="1" @click="goPath('/')">
          <span>m3u8视频下载</span>
        </el-menu-item>
      </el-menu>
      <div class="w-full p-8">
        <router-view/>
      </div>
    </div>
  </el-config-provider>
</template>

<script>
import './style/global.css'
import zhCn from 'element-plus/lib/locale/lang/zh-cn'

export default {
  data() {
    return {
      zhCn
    }
  },
  async beforeCreate() {
  },
  created() {
  },
  mounted() {
  },
  methods: {
    goPath(path) {
      this.$router.push({path: path})
    },
  }
}
</script>

<style scoped>
</style>