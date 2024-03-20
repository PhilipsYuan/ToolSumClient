import axios from "axios";
import videoJs from "video.js";

export async function playVideoAndAudio(videoUrl, audioUrl, videoElement, videoJs) {
    const totals = await getTotalLength(videoUrl, audioUrl)
    const audioTotals = totals[0]
    const videoTotals = totals[1]
    const videoNumChunk = getNumChunks(videoTotals);
    const videoChunkSize = 500 * 1024
    const audioChunkSize = Math.ceil(audioTotals / videoNumChunk);
    let index = 0
    const myMediaSource = new MediaSource();
    const url = URL.createObjectURL(myMediaSource);
    const player = videoJs(videoElement, {
        preload: 'auto',
        sources: [{
            src: url,
            type: 'video/mp4',
        }]
    });
    myMediaSource.addEventListener('sourceopen', () => {
        const audioSourceBuffer = myMediaSource
            .addSourceBuffer('audio/mp4; codecs="mp4a.40.2"');
        const videoSourceBuffer = myMediaSource
            .addSourceBuffer('video/mp4; codecs="avc1.64001e"');

        const send = () => {
            if (index >= videoNumChunk) {
                videoSourceBuffer.addEventListener("updateend", function (_) {
                    myMediaSource.endOfStream();
                });
            } else {
                const videoStart = index * videoChunkSize;
                const audioStart = index * audioChunkSize
                const videoEnd = Math.min(videoStart + videoChunkSize - 1, videoTotals - 1);
                const audioEnd = Math.min(audioStart + audioChunkSize - 1, audioTotals - 1)
                fetch(audioUrl, {
                    headers: {
                        Range: `bytes=${audioStart}-${audioEnd}`,
                    }
                }).then((response) =>{
                    return response.arrayBuffer();
                }).then(function(audioData) {
                    audioSourceBuffer.appendBuffer(audioData);
                });
                fetch(videoUrl, {
                    headers: {
                        Range: `bytes=${videoStart}-${videoEnd}`,
                    }
                }).then((response) => {
                    return response.arrayBuffer();
                }).then((videoData) => {
                    index++;
                    videoSourceBuffer.appendBuffer(videoData);
                    send();
                    // videoElement.play();
                });
            }
        };
        send()
    })
}

function getTotalLength(videoUrl, audioUrl) {
    const promise1 = axios.get(audioUrl, {
        headers: { Range: 'bytes=0-1000'}
    })
    const promise2 = axios.get(videoUrl, {
        headers: { Range: 'bytes=0-1000'}
    })
    return Promise.all([promise1, promise2])
        .then((results) => {
            return results.map((item) => item.headers["content-range"].split('/')[1])
        })
}

function getNumChunks(videoLength) {
    return Math.ceil(videoLength / (500 * 1024))
}

