<template>
  <div class="max-h-[calc(100vh-124px)] overflow-auto border p-5 bg-white rounded-md border-[#d1d5db]">
    <div class="">
      <el-collapse v-model="activeNames">
        <el-collapse-item title="1. 如何下载视频？" name="1">
          <div class="help-answer">
            <div>
              <div class="help-answer-index">1</div>
              在下载视频页面里，输入某个电影名称后，可以进行自动搜索，或者手动搜索。自动搜索，系统去找是否合适的下载页面网址。自动方式比较快，但是可能不准确。 <br />
              如果自动方式没有找到，可以再用手动搜索，自己确定视频下载的页面。手动搜索时，会有个弹框，在弹框选择你确定视频页面，然后点击确定按钮。<br/>
              在网址栏里就会输入当时确定的页面。
            </div>
            <div><img src="./h-8.png"/></div>
            <div><img src="./h-9.png"/></div>
            <div>
              <div class="help-answer-index">2</div>
              通过点击'解析下载链接'按钮， 软件就会解析出可以下载的m3u8的下载链接。 <br />
              再给视频起一个名称（比如：惊奇队长2 ）， 然后点击'创建'，会创建一个下载任务。
            </div>
            <div><img src="./h-6.png"/></div>
            <div>
              <div class="help-answer-index">3</div>
              您在下载中，就看到这个任务了，点击开始图标，开始进行下载。下载完成后，在已完成中可以看到视频了。
            </div>
            <div><img src="./h-7.png"/></div>
            <div>
              <div class="help-answer-index">4</div>
              如果上面的步骤不是很好用，您可以自己找m3u8链接，具体步骤，可以看问题2（如何获取m3u8链接）。
            </div>
          </div>
        </el-collapse-item>
        <el-collapse-item title="2. 如何获取m3u8链接？" name="2">
          <div class="help-answer">
            输入网页网址有可能解析不出来m3u8的下载链接。我们可以通过下面步骤，自己查找m3u8下载链接。
            然后将它放入m3u8链接输入框中，再输入名称，就可以进行下载了。
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
              如果您没有找到m3u8格式的，可能此网站不是m3u8格式的视频，您可以通过邮件将网址发送给我们，并注明：此网址不能解析。<br />
              我们会在收到您的反馈后，去分析，争取在以后更新的软件版本里支持它。我们的邮箱地址：1016027198@qq.com。
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </div>
  </div>
</template>

<script>
export default {
  name: "helpPage",
  data() {
    return {
      activeNames: '0'
    }
  }
}
</script>

<style scoped>

</style>