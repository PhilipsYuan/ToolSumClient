<template>
  <el-dialog v-model="show" :width="width" :fullscreen="fullscreen" :top="top || '35vh'"
             :modal="modal" :append-to-body="appendToBody" :lock-scroll="lockScroll" :open-delay="openDelay"
             :close-delay="closeDelay" :close-on-click-modal="closeOnClickModal" :close-on-press-escape="closeOnPressEscape"
             :show-close="showClose" :before-close="beforeClose" :draggable="draggable" :center="center"
             :align-center="alignCenter" :destroy-on-close="destroyOnClose"
  >
    <template #header="{ close, titleId, titleClass }" >
      <div class="">
        {{title}}
      </div>
    </template>
    <slot></slot>
    <template v-if="showFooter" #footer >
      <div>
        <el-button @click="handleCancel">{{closeText || '取消'}}</el-button>
        <el-button type="primary" @click="handleOk">{{okText || '确认'}}</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script>
export default {
  name: "PDialog",
  props: {
    vModel: Boolean,
    title: String,
    width: {
      type: [String, Number],
      default: '30%'
    },
    fullscreen: {
      type: Boolean,
      default: false
    },
    top: {
      type:String,
      default: '15vh'
    },
    modal: {
      type: Boolean,
      default: true
    },
    appendToBody: {
      type: Boolean,
      default: false
    },
    lockScroll: {
      type: Boolean,
      default: true
    },
    openDelay: {
      type: Number,
      default: 0
    },
    closeDelay: {
      type: Number,
      default: 0
    },
    closeOnClickModal: {
      type: Boolean,
      default: true
    },
    closeOnPressEscape: {
      type: Boolean,
      default: true
    },
    showClose: {
      type: Boolean,
      default: true
    },
    beforeClose: Function,
    draggable: {
      type: Boolean,
      default: false
    },
    center: {
      type: Boolean,
      default: false
    },
    alignCenter: {
      type: Boolean,
      default: false
    },
    destroyOnClose: {
      type: Boolean,
      default: false
    },
    showFooter: {
      type: Boolean,
      default: true
    },
    okText: String,
    closeText: String
  },
  data() {
    return {
      show: false,
    }
  },
  watch: {
    vModel(newVal, oldVal)  {
      this.show = newVal
    }
  },
  methods: {
    handleOk(e) {
      this.$emit('ok', e)
    },
    handleCancel(e) {
      this.$emit('cancel', e)
    }
  }
}
</script>

<style lang="scss" scoped>
</style>