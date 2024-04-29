/**
 * P 站内容只能使用自己的hls.js进行播放
 * @param videoHtml
 * @param videoSrc
 */
import DPlayer from 'dplayer'
export function playPZhan(videoHtml, videoSrc) {
  import('../../../utils/source/PzhanHls')
    .then((res) => {
      new DPlayer({
        container: videoHtml,
        video: {
          url: videoSrc,
          type: 'customHls',
          customType: {
            customHls: function (video, player) {
              const hls = new Hls();
              hls.loadSource(videoSrc);
              hls.attachMedia(videoHtml);
            },
          },
        },
      });
    })
}