### iqiyi的请求数据，靠接口： https://cache.video.iqiyi.com/dash？

### vip会员的破解方式：
1. 在数据库里存储 cookie，因为爱奇艺的cookie可以保存3个月。所以只需要每三个月更新下cookie就可以了。
2. 爱奇艺里的cookie值，只有P00001 和 IMS 参数有用。
3. 账号不能够进行退出登录，一旦退出，生成的cookie也会跟着失效。所以要保证账号不能动


### cookie的例子
1. P00001=0a0m1pRim2YElm1wCr3JJr727JwZ4lKTkt1rAIVe2m2fF3sJKFyDA5zI5Xaqc5jF95Hm13W12; IMS=IggQABj_obqtBioyCiAzNzBhNTY5YTUxZTUxMGY5MGYzYjU1ZmMwNDg5ODNkYRAAIggI0AUQAhiwCShOMAUwADAAciQKIDM3MGE1NjlhNTFlNTEwZjkwZjNiNTVmYzA0ODk4M2RhEAA;


### iqiyi待解决的问题
1. 验证下，只用cookie可否在多台设备上下载
2. cookie的时间(3个月)是否真的好用
3. 调节bid参数，选择视频的清晰度 800的清晰度，



/Users/smart-philip/philip/project/selfProject/ToolSumClient/ffmpegPlatforms/darwin-x64/ffmpeg -allowed_extensions ALL -protocol_whitelist "file,http,crypto,tcp,https,tls" -i 2448711522834300.mpd -c copy output.mp4

