<template>
  <div>
    <div v-if="list.length > 0" class="grid gap-3">
      <div v-for="item in list" class="flex justify-between px-5 py-2 border rounded-md hover:bg-gray-100 border-gray-300">
        <div class="flex gap-8 items-center">
          <div class="text-red-500 bg-red-100 px-2 py-0.5 text-sm rounded-md">未支付</div>
          <div class="text-gray-500">{{item.remarks}}</div>
          <div>{{item.product_price}}<span class="text-xs ml-1">元</span></div>
          <div class="text-red-500">过期时间：30:12</div>
        </div>
        <el-dropdown>
          <el-icon class="icon-button">
            <MoreFilled/>
          </el-icon>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="openVideoFile(item.filePath)">去支付</el-dropdown-item>
              <el-dropdown-item @click="cancelOrder(item.order_num)">取消订单</el-dropdown-item>
              <el-dropdown-item @click="deleteOrder(item.order_num)">删除订单</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    <el-empty v-if="list.length === 0" description="暂无数据" />
  </div>
</template>

<script>
import { cancelBuyVipRecords, deleteBuyVipRecords } from '../../../api/vip'
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
    },
    cancelOrder(orderId) {
      cancelBuyVipRecords(orderId)
          .then(() => {
            this.$emit('getRecords')
          })
    },
    deleteOrder(orderId) {
      deleteBuyVipRecords(orderId)
          .then(() => {
            this.$emit('getRecords')
          })
    }
  }
}
</script>

<style scoped>

</style>