<template>
  <div>
    <div class="border px-8 py-4 rounded-md mt-8 bg-gray-100">
      <div class="flex justify-between items-center">
        <div class="text-base font-medium">设置下载存储地址</div>
      </div>
      <div class="flex justify-between text-sm mt-3">
        <div class="flex items-center">
          <div class="mr-2">存储地址:</div>
          <div class="mr-2 text-green-600">{{downloadPath}}</div>
        </div>
        <div>
          <el-button type="primary" @click="change">更改</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "setting",
  data() {
    return {
      downloadPath: "",
    }
  },
  async mounted() {
    const downloadSetting = await window.electronAPI.getDownloadSetting()
    this.downloadPath = downloadSetting.downloadPath || ""
  },
  methods: {
    async saveDownloadSetting() {
      await window.electronAPI.setDownloadSetting({
        downloadPath: this.downloadPath,
      })
      this.$message.success("设置成功")
    },
    async change() {
      this.downloadPath = await window.electronAPI.openDirectoryDialog()
      await this.saveDownloadSetting()
    }
  }
}
</script>

<style scoped>

</style>