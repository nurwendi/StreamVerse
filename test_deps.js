try {
    const NodeMediaServer = require('node-media-server');
    console.log('NodeMediaServer loaded successfully');
    const path = require('ffmpeg-static');
    console.log('ffmpeg loaded successfully: ' + path);
} catch (e) {
    console.error(e);
}
