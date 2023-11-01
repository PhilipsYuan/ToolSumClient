<template>
  <div>
    <div class="mt-16 text-center text-3xl font-medium">
      小滑轮会员
    </div>
    <div class="flex gap-6 mt-16">
      <div v-for="item in buyList" class="border p-8 bg-white rounded-xl w-1/3 hover:border-red-300">
        <div class="flex justify-center font-medium text-xl mb-4">{{ item.name }}会员</div>
        <div class="flex justify-center items-baseline"><span class="text-2xl text-red-400 mr-2">{{ item.price }}</span><span>元</span>/{{
            item.unit
          }}
        </div>
        <div
            class="bg-gradient-to-r from-red-300 to-red-500 rounded-3xl px-4 py-2 text-white w-32 mt-8 m-auto text-center hover:from-red-500 hover:to-red-600 cursor-pointer">
          立即购买
        </div>
      </div>
    </div>
    <div class="mt-8">
      <div class="flex items-center justify-center">
        <div class="w-40 h-0.5 bg-gradient-to-l from-[#f1bd86] to-[#f6f8fc]"></div>
        <div class="px-4 text-amber-400 text-xl">会员尊享</div>
        <div class="w-40 h-0.5 bg-gradient-to-r from-[#f1bd86] to-[#f6f8fc]"></div>
      </div>
      <div class="mt-4 text-base text-yellow-500 text-center">无限量使用下载视频功能</div>
    </div>
  </div>
</template>

<script>
export default {
  name: "vipBuy",
  data() {
    return {
      buyList: [{
        name: '一周',
        date: 7,
        price: '3.9',
        unit: '周'
      }, {
        name: '半月',
        date: 15,
        price: '5.9',
        unit: '半月'
      }, {
        name: '1月',
        date: 31,
        price: '9.9',
        unit: '月'
      }]
    }
  }
}
</script>

<style scoped>

</style>