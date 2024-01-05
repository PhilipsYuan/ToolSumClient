import axios from '../../../../../util/source/axios'
import { auth } from "./authKey.js";
import { getVf } from "./mmc";

export async function getIQiYiTVDownloadLink (htmlUrl) {
    const { tvId, vid } = await getVid(htmlUrl)
    const authKey =  auth('')
    const bob = '{"version":"10.0","dfp":"a0ecf8e4c6312b4cb6b07659066e7caca9279d3d666b49de92ddf17cab892223b9","b_ft1":8}'
    const bobCode = bob.replace(/:/g, '%3A').replace(/,/g, '%2C').replace(/{/g, '%7B').replace(/"/g, '%22').replace(/}/g, '%7D')
    const params = {
        tvid: tvId, // 需要处理
        bid: '300', // 资源的格式
        vid: '', // 需要处理
        src: '01080031010000000000',
        vt: 0,
        rs: 1,
        uid: '',
        ori: 'pcw',
        ps: 0,
        k_uid: '80f0bd95358b2c98c3107bd7091ebd5b',
        pt: 0,
        d: 0,
        s: '',
        lid: 0,
        cf: 0,
        ct: 0,
        authKey: '4ebde0429d79f0724de7a11f54075bb3',  // 需要处理
        k_tag: 1,
        dfp: 'a0ecf8e4c6312b4cb6b07659066e7caca9279d3d666b49de92ddf17cab892223b9',
        locale: 'zh_cn',
        pck: '',
        k_err_retries: 0,
        up: '',
        sr: 1,
        qd_v: 5,
       //  tm: new Date().getTime(),
        tm: '1704444890828',
        qdy: 'u',
        qds: 0,
        ppt: 0,
        k_ft1: '706436220846852',
        k_ft4: '1162321298202628',
        k_ft2: '262335',
        k_ft5: '134217729',
        k_ft6: '128',
        k_ft7: '755499012',
        fr_300: '120_120_120_120_120_120',
        fr_500: '120_120_120_120_120_120',
        fr_600: '120_120_120_120_120_120',
        fr_800: '120_120_120_120_120_120',
        fr_1020: '120_120_120_120_120_120',
        bop: bobCode,
        ut: 0,
        // vf: '' // 需要处理
    }
    let temp = '/dash?'
    for(let key in params) {
        let value = params[key]
        // if(key === 'bop') {
        //     value = value.replace(/:/g, '%3A').replace(/,/g, '%2C').replace(/{/g, '%7B').replace(/"/g, '%22').replace(/}/g, '%7D')
        // }
        temp = temp + key + '=' + value +'&'
    }
    temp = temp.substring(0, temp.length-1)
    const vfString = getVf(temp)
    const search = temp + '&vf=' + vfString
    return axios.get(`https://cache.video.iqiyi.com${search}`)
        .then((res) => {
            console.log(res.request)
        })
        .catch((e) => {
            console.log(e)
        })
}


function getVid(htmlUrl) {
    return axios
        .get(htmlUrl, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
                referer: 'https://www.iqiyi.com',
            },
        })
        .then((res) => {
            const data = res.data;
            const tvId = data.match(/"tvId":(\d+),"albumId"/)[1]
            const vid = data.match(/"vid":"(.*?)",/)[1]
            return {tvId, vid}
        })
        .catch((e) => {
            return null
        })
}


// getInfo('https://www.iqiyi.com/v_24pub4hbr5k.html?r_area=recent_popular&r_source=1001&bkt=hp_bkt_02&e=05e05563edf585c08266cf7aa4f7ac0a&stype=2&vfrm=pcw_home&vfrmblk=pcw_home_hot&vfrmrst=pcw_home_hot_image2')


