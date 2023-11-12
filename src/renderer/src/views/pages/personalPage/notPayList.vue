<template>
  <div>
    <div v-if="list.length > 0" class="grid grid-2">
      <div v-for="item in list" class="flex px-5 py-2 border rounded-md">
        <div>{{item.remarks}}</div>
        <div>未支付</div>
        <el-dropdown>
          <el-icon class="icon-button">
            <MoreFilled/>
          </el-icon>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-if="item.isExist" @click="openVideoFile(item.filePath)">播放</el-dropdown-item>
              <el-dropdown-item @click="copyLink(item.m3u8Url)">复制资源链接</el-dropdown-item>
              <el-dropdown-item @click="deleteRecord(item.id)">删除记录</el-dropdown-item>
              <el-dropdown-item @click="deleteRecordAndFile(item.id)" v-if="item.isExist">删除记录和文件
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    <el-empty v-if="list.length === 0" description="暂无数据" />
  </div>
</template>

<script>
export default {
  name: "notPayList",
  data() {
    return {
      list: []
    }
  },
  methods: {
    updateList(list) {
      this.list = list
    }
  }
}
</script>

<style scoped>

</style>