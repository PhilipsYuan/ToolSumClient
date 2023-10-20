/**
 * @Type    : Model
 * @Module    : Downloader
 * @Brief    : Provide time function
 * @Author    : Linxiaozhou
 * @Date    : 2017/02/23
 */

//  中间件
const path = require('path');
const fs = require("fs");
const OL_Downloader = function() {};


/* ************ 内部使用函数 ************ */
/**
 *@Brief:      规定MIME
 */
const OL_Mimes = {
    "css"    :     "text/css",
    "gif"    :     "image/gif",
    "html"    :     "text/html",
    "js"    :     "text/javascript",
    "tiff"    :     "image/tiff",
    "xml"    :     "text/xml",
    "json"    :     "application/json",

    "txt"    :     "text/plain",

    "ico"    :     "image/x-icon",
    "jpeg"    :     "image/jpeg",
    "jpg"    :     "image/jpeg",
    "png"    :     "image/png",
    "svg"    :     "image/svg+xml",

    "pdf"    :     "application/pdf",

    "wav"    :     "audio/x-wav",
    "flac"    :     "audio/x-flac",
    "wma"    :     "audio/x-ms-wma",
    "mp3"    :     "audio/mpeg",

    "wmv"    :     "video/x-ms-wmv",
    "mp4"    :     "video/x-ms-mp4",
    "mov"    :     "video/quicktime",
    "avi"    :     "video/x-msvideo",
    "mpg"    :     "video/mpeg",
    "mpeg"    :     "video/mpeg",
    "mpe"    :     "video/mpeg",
    "mpa"    :     "video/mpeg",
    "mp2"    :     "video/mpeg",

    "swf"    :     "application/x-shockwave-flash",

    "zip"    :     "application/zip",
    "tar"    :     "application/x-tar",
    "gz"    :     "application/x-hdf",
    "gtar"    :     "application/x-gtar",
    "tgz"    :     "application/x-compressed",

    "ppt"    :     "application/vnd.ms-powerpoint",
    "pptx"    :     "application/vnd.ms-powerpoint",
    "xls"    :     "application/vnd.ms-excel",
    "xlsx"    :     "application/vnd.ms-excel",
    "doc"    :     "application/msword",
    "docx"    :     "application/msword",

    "dll"    :     "application/x-msdownload",
    "bin"    :     "application/octet-stream",
    "exe"    :     "application/octet-stream",
};


/**
 *@Name:      OL_ParseHttpRange
 *@Brief:   解析http头的Range信息
 */
const OL_ParseHttpRange = function (str, size) {
    if (str.indexOf(",") != -1) {
        return -1;
    }
    // str原始值为："bytes=xxxx-xxxxxx"；先把"bytes="去掉后再分割起止值
    str = str.split("=")[1];
    var range = str.split("-"),
        start = parseInt(range[0], 10),
        end = parseInt(range[1], 10);

    // Case: -100
    if (isNaN(start)) {
        start = size - end;
        end = size - 1;
        // Case: 100-
    } else if (isNaN(end)) {
        end = size - 1;
    }

    // Invalid
    if (isNaN(start) || isNaN(end) || start > end || end > size) {
        return -2;
    }

    return {
        start: start,
        end: end
    };
};


/* ********* 外部接口 ********* */
/**
 *@Func:   断点下载
 *@Name:   ProcDownload
 *@Input1: relative_url - 文件所在的相对路径，以项目根目录为参照
 *@Input2: name - 要下载的文件名
 */
OL_Downloader.prototype.ProcDownload = function(relative_url, name, reqres) {

    var realPath = relative_url+name;
    var req = reqres.req,
        res = reqres.res,
        next = reqres.next;

    // 获取 Content-Type
    var ext = path.extname(realPath);
    ext = ext ? ext.slice(1) : 'unknown';
    var contentType = OL_Mimes[ext] || "text/plain";

    fs.stat(realPath, function(err, stats){
        if(undefined == stats){
            res.render('error', {
                message: "File Not Existed",
                error: "Please contact the administrator for new url!"
            });
            return 0;
        }

        if (req.headers["range"]) {

            // 非第一次下载（断点下载）
            var range = OL_ParseHttpRange(req.headers["range"], stats.size);
            if (range) {
                var len = (range.end - range.start + 1);
                // 设置响应头
                res.setHeader("Content-Range", "bytes " + range.start + "-" + range.end + "/" + stats.size);
                res.setHeader("Content-Length", len);
                res.setHeader('Content-Type', contentType);
                res.writeHead(206, "Partial Content");
                // 建立管道流
                fs.createReadStream(realPath, {
                    "start"        :     range.start,
                    "end"        :     range.end
                }).pipe(res);

            } else {
                res.removeHeader("Content-Length");
                res.writeHead(416, "Request Range Not Satisfiable");
                res.end();
            }

        } else {
            // 第一次下载（正常下载）
            // 设置响应头
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader("Content-Disposition", "attachment; filename="+encodeURIComponent(name));
            res.setHeader("Content-Length", stats.size);
            // 建立管道流
            fs.createReadStream(realPath).pipe(res);
        }
    })
};

module.exports = new OL_Downloader();