const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');
const fs = require('fs');

console.log('Path:', ffmpegPath);

if (!fs.existsSync(ffmpegPath)) {
    console.error('FFmpeg binary not found!');
} else {
    console.log('FFmpeg binary exists.');
}

const ffmpeg = spawn(ffmpegPath, ['-version']);

ffmpeg.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
});

ffmpeg.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
});

ffmpeg.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
});
