<template>
  <div>
    <div v-if="list.length > 0" class="grid gap-3">
      <div v-for="item in list" class="flex justify-between px-5 py-2 border rounded-md hover:bg-gray-100 border-gray-300">
        <div class="flex gap-8 items-center">
          <div class="text-red-500 bg-red-100 px-2 py-0.5 text-sm rounded-md">未支付</div>
          <div class="text-gray-500">{{item.remarks}}</div>
          <div>{{item.product_price}}<span class="text-xs ml-1">元</span></div>
        </div>
        <el-dropdown>
          <el-icon class="icon-button">
            <MoreFilled/>
          </el-icon>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="toBuy(item)">去支付</el-dropdown-item>
              <el-dropdown-item @click="cancelOrder(item.order_num)">取消订单</el-dropdown-item>
              <el-dropdown-item @click="deleteOrder(item.order_num)">删除订单</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    <el-empty v-if="list.length === 0" description="暂无数据" />
    <show-code-modal ref="showCodeModal"  @openOrderModal="openOrderModal" />
    <order-status-modal ref="orderStatusModal" />
  </div>
</template>

<script>
import {cancelBuyVipRecords, deleteBuyVipRecords, overtimeBuyVipRecordsApi} from '../../../api/vip'
import ShowCodeModal from "../vipBuy/showCodeModal.vue";
import orderStatusModal from "../vipBuy/orderStatusModal.vue";
import { productTypeList } from "../../../utils/const/productTypeList";
import dayjs from 'dayjs'
export default {
  name: "notPayList",
  components: {ShowCodeModal, orderStatusModal},
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
    },
    toBuy(item) {
      const name = productTypeList.find((i) => i.type === item.product_type).name
      const restMinutes = dayjs(new Date()).diff(dayjs(item.created_time), 'minute')
      if(restMinutes >= 15) {
        this.$message.error({ message: "该订单已经过期了, 请选择其他订单。", duration: 4 * 1000} )
        overtimeBuyVipRecordsApi(item.order_num)
            .then((res) => {
              if(res) {
                this.$emit('getRecords')
              }
            })
      } else {
        this.$refs.showCodeModal.open(item.code_url, name, item.product_price, item.order_num, 15 - restMinutes)
      }
    },
    openOrderModal(message, status) {
      console.log('here1')
      this.$refs.orderStatusModal.open(message, status)
    }
  }
}
</script>

<style scoped>

</style>