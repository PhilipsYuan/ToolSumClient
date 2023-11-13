<template>
  <div>
    <div v-if="list.length > 0" class="grid gap-3">
      <div v-for="item in list" class="flex justify-between items-center px-5 py-2 border border-gray-300 rounded-md hover:bg-gray-100">
        <div class="flex gap-8 items-center ">
          <div class="text-purple-500 bg-purple-200 px-2 py-0.5 text-sm rounded-md">已过期</div>
          <div>{{item.remarks}}</div>
          <div>{{item.product_price}}<span class="text-xs ml-1">元</span></div>
        </div>
        <div class="flex gap-8 items-center">
          <div class="text-sm">{{dayjs(item.created_time).format('YYYY/MM/DD')}}</div>
          <el-popover
              placement="left"
              :width="80"
              trigger="hover"
              content="删除订单"
          >
            <template #reference>
              <div class="p-1 rounded-md hover:bg-gray-100 flex items-center cursor-pointer"
                   @click="deleteOrder(item.order_num)">
                <el-icon class="hover:text-blue-400 !text-lg ">
                  <CircleClose class=""/>
                </el-icon>
              </div>
            </template>
          </el-popover>
        </div>
      </div>
    </div>
    <el-empty v-if="list.length === 0" description="暂无数据" />
  </div>
</template>

<script>
import dayjs from 'dayjs'
import {deleteBuyVipRecords} from "../../../api/vip";
export default {
  name: "overtimePayList",
  data() {
    return {
      dayjs,
      list: []
    }
  },
  methods: {
    updateList(list) {
      this.list = list
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