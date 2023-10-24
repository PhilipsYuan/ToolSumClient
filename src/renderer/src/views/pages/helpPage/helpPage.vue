<template>
  <div class="h-[calc(100vh-100px)]">
    <div class="help-title">
      如何获取m3u8链接？
    </div>
    <div class="help-answer">
      输入网页网址有可能解析不出来m3u8的下载链接。我们可以通过下面步骤，自己查找m3u8下载链接。
      然后将它放入m3u8链接输入框中。再输入名称，就可以进行下载啦。
      <div><div class="help-answer-index">1</div> 用户chrome浏览器打开网址 (图中1),
        点击浏览器右上角三个点，更多工具（图中2）,选择开发者工具（图中3）
      </div>
      <div><img src="./h-1.png"/></div>
      <div><div class="help-answer-index">2</div> 在打开的部分中,选择network（中文：网络）栏（图中1），在输入框里输入m3u8(图中2)后，再进行页面刷新。
      </div>
      <div><img src="./h-5.png"/></div>
      <div><div class="help-answer-index">3</div> 如果网址的视频是m3u8格式的，就可以在里面找到m3u8链接（后缀是.m3u8)。
      </div>
      <div><img src="./h-3.png"/></div>
      <div class="ml-8">您可以切换到Preview（预览）栏里，看下格式。如果格式像下图这样，那肯定没有错啦。</div>
      <div><img src="./h-4.png"/></div>
      <div><div class="help-answer-index">4</div>
        如果您没有找到m3u8格式的，可能此网站不是m3u8格式的视频，您可以通过邮件将网址发送给我们，并注明：此网址不能解析。
        我们会在收到您的反馈后，去分析，争取在以后更新的软件版本里支持它。我们的邮箱地址：1016027198@qq.com。
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "helpPage"
}
</script>

<style scoped>

</style>