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
          <el-menu-item index="2" @click="goPath('/personal')">
            <span>个人信息</span>
          </el-menu-item>
          <el-menu-item index="3" @click="goPath('/setting')">
            <span>设置</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      <el-main>
        <div v-if="notice"
            class="-ml-5 -mt-5 mb-8 text-sm text-red-400 border-b text-center bg-white p-2 w-[calc(100%+40px)] shadow-[0px_8px_16px_rgba(147,151,159,0.16)]">
          {{notice}}
        </div>
        <router-view/>
      </el-main>
    </el-container>
  </el-container>
</template>

<script>
import headPart from "./head.vue";
import { getSystemUpdateNotice } from "../../api/user";

export default {
  name: "layout",
  components: {headPart},
  data() {
    return {
      notice: null
    }
  },
  async mounted() {
    getSystemUpdateNotice()
        .then((res) => {
          this.notice = res.data.result
        })
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