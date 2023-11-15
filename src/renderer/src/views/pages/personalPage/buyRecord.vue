<template>
  <el-tabs type="border-card" v-model="activeName" @tab-change="tabChanged">
    <el-tab-pane label="未支付" name="notPay" />
    <el-tab-pane label="已完成" name="complete" />
    <el-tab-pane label="已过期" name="overTime" />
    <el-tab-pane label="已取消" name="cancel" />
    <div class="max-h-[calc(100vh-438px)] overflow-auto px-[15px] -mx-[15px]">
      <not-pay-list v-show="activeName === 'notPay'" ref="notPayList" @getRecords="getRecords"/>
      <complete-pay-list v-show="activeName === 'complete'" ref="completePayList" @getRecords="getRecords" />
      <overtime-pay-list v-show="activeName === 'overTime'" ref="overtimePayList" @getRecords="getRecords" />
      <cancel-pay-list v-show="activeName === 'cancel'" ref="cancelPayList" @getRecords="getRecords" />
    </div>
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
    this.getRecords()
  },
  methods: {
    tabChanged() {
      if(this.activeName === 'finish') {
        this.$refs.finishList.getFinishList()
      } else if(this.activeName === 'loading') {
        this.$refs.loadingList.getLoadingList()
      }
    },
    resetList() {
      this.notPays = [];
      this.completePays = [];
      this.overTimePays = [];
      this.cancelPays = [];
    },
    getRecords() {
      this.resetList()
      getBuyVipRecords()
          .then((res) => {
            const result = res.data.result || []
            result.forEach((item) => {
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
    }
  }
}
</script>

<style scoped>

</style>