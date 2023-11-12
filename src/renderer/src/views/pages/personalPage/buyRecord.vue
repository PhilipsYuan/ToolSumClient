<template>
  <el-tabs type="border-card" v-model="activeName" @tab-change="tabChanged">
    <el-tab-pane label="未支付" name="notPay" />
    <el-tab-pane label="已完成" name="complete" />
    <el-tab-pane label="已过期" name="overTime" />
    <el-tab-pane label="已取消" name="cancel" />
    <not-pay-list v-show="activeName === 'notPay'" ref="notPayList" />
    <complete-pay-list v-show="activeName === 'complete'" ref="completePayList" />
    <overtime-pay-list v-show="activeName === 'overTime'" ref="overtimePayList" />
    <cancel-pay-list v-show="activeName === 'cancel'" ref="cancelPayList" />
  </el-tabs>
</template>

<script>
import notPayList from "./notPayList.vue";
import completePayList from "./completePayList.vue";
import overtimePayList from "./overtimePayList.vue";
import cancelPayList from "./cancelPayList.vue";
import {getBuyVipRecords} from "../../../api/vip";
export default {
  name: "buyRecord",
  components: { cancelPayList, overtimePayList, completePayList, notPayList },
  data() {
    return {
      activeName: 'notPay',
      notPays: [],
      completePays: [],
      overTimePays: [],
      cancelPays: []
    }
  },
  mounted() {
    getBuyVipRecords()
        .then((res) => {
          const result = res.data.result || []
          console.log(result)
          result.forEach((item) => {
            console.log('item')
            if(item.order_status === 1) {
              this.notPays.push(item)
            } else if(item.order_status === 2) {
              this.completePays.push(item)
            } else if(item.order_status === 3) {
              this.overTimePays.push(item)
            } else if(item.order_status === 4) {
              this.cancelPays.push(item)
            }
          })
          this.$refs.notPayList.updateList(this.notPays)
          this.$refs.completePayList.updateList(this.completePays)
          this.$refs.overtimePayList.updateList(this.overTimePays)
          this.$refs.cancelPayList.updateList(this.cancelPays)
        })
  },
  methods: {
    tabChanged() {
      if(this.activeName === 'finish') {
        this.$refs.finishList.getFinishList()
      } else if(this.activeName === 'loading') {
        this.$refs.loadingList.getLoadingList()
      }
    },
  }
}
</script>

<style scoped>

</style>