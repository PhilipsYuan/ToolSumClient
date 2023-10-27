import os from "os";
import path from "path";

export function getFfmpegPath () {
    const platform = os.platform() + '-' + os.arch();
    const binary = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const npm2Path = path.resolve(__dirname, 'node_modules', '@ffmpeg-installer', platform);
    const npm2Binary = path.join(npm2Path, binary);
    return npm2Binary
}