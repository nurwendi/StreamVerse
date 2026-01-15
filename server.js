const NodeMediaServer = require('node-media-server');
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');

const HTTP_PORT = 8000;
const RTMP_PORT = 1935;

// Express Setup
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const multer = require('multer');

// Configure Multer for file uploads
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Keep original extension, append timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

// Increase limit for videos (e.g. 2GB)
const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }
});

// Path to settings and content
const settingsPath = path.resolve(__dirname, 'data', 'settings.json');
const contentPath = path.resolve(__dirname, 'data', 'content.json');

// Ensure data directory exists
if (!fs.existsSync(path.dirname(settingsPath))) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
}

// Helper to read content
function getContent() {
  try {
    if (fs.existsSync(contentPath)) {
      return JSON.parse(fs.readFileSync(contentPath, 'utf8'));
    }
  } catch (e) {
    console.error("Error reading content", e);
  }
  return [];
}

// Helper to read settings
function getSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (e) {
    console.error("Error reading settings", e);
  }
  // Default settings
  return {
    title: 'Simple Live Stream',
    description: '',
    logoUrl: '',
    streamKey: 'stream', // Default stream key
    adminUser: 'admin',
    adminPass: 'admin',
    appName: 'Vidio Clone',
    faviconUrl: ''
  };
}

// Auth Middleware
const isAuthenticated = (req, res, next) => {
  // Check for cookie
  if (req.cookies.auth === 'true') {
    next();
  } else {
    // Allow API to return 401, Pages to redirect
    if (req.path.startsWith('/api/') && req.path !== '/api/login') {
      res.status(401).json({ success: false, message: 'Unauthorized' });
    } else if (req.path === '/admin.html') {
      res.redirect('/login.html');
    } else {
      next(); // Allow public access to other pages
    }
  }
};

// Protect Admin Page and Settings API
app.use('/admin.html', isAuthenticated);

// API Routes
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const settings = getSettings();

  if (username === (settings.adminUser || 'admin') && password === (settings.adminPass || 'admin')) {
    res.cookie('auth', 'true', { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }); // 1 day
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('auth');
  res.json({ success: true });
});

// Settings API - Protected
app.get('/api/settings', isAuthenticated, (req, res) => {
  res.json(getSettings());
});

app.post('/api/settings', isAuthenticated, (req, res) => {
  try {
    // Preserve admin credentials if not sent
    const currentSettings = getSettings();
    const newSettings = { ...currentSettings, ...req.body };

    fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2));
    res.json({ success: true, message: 'Settings saved' });
    console.log('Settings updated:', req.body);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to save settings' });
  }
});

// Public Settings API (Branding)
app.get('/api/public-settings', (req, res) => {
  const settings = getSettings();
  const publicData = {
    title: settings.title,
    description: settings.description,
    appName: settings.appName,
    logoUrl: settings.logoUrl,
    faviconUrl: settings.faviconUrl,
    runningText: settings.runningText,
    liveThumbnail: settings.liveThumbnail
  };
  res.json(publicData);
});

app.post('/api/upload', isAuthenticated, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  // Return the web-accessible path
  const webPath = '/uploads/' + req.file.filename;
  res.json({ success: true, path: webPath });
});

// Serve Static Files
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/uploads', isAuthenticated, (req, res) => {
  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Unable to scan directory' });
    }

    // Filter only files (optional: filter by extension if needed)
    // Map to metadata
    const fileList = files.map(file => {
      return {
        name: file,
        url: '/uploads/' + file
      };
    });

    res.json({ success: true, files: fileList });
  });
});

// --- VOD Content API ---

// Get all content (Public)
app.get('/api/content', (req, res) => {
  res.json(getContent());
});

// Add new content (Admin)
app.post('/api/content', isAuthenticated, (req, res) => {
  try {
    const contentList = getContent();
    const newContent = {
      id: Date.now().toString(), // Simple ID
      title: req.body.title || 'Untitled',
      description: req.body.description || '',
      category: req.body.category || 'Uncategorized',
      thumbnailUrl: req.body.thumbnailUrl || '', // /uploads/...
      videoUrl: req.body.videoUrl || '',         // /uploads/...
      createdAt: Date.now()
    };

    contentList.push(newContent);
    fs.writeFileSync(contentPath, JSON.stringify(contentList, null, 2));

    res.json({ success: true, message: 'Content added', content: newContent });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to add content' });
  }
});

// Delete content (Admin)
app.delete('/api/content/:id', isAuthenticated, (req, res) => {
  try {
    let contentList = getContent();
    const id = req.params.id;
    const initialLength = contentList.length;

    contentList = contentList.filter(c => c.id !== id);

    if (contentList.length === initialLength) {
      return res.status(404).json({ success: false, message: 'Content not found' });
    }

    fs.writeFileSync(contentPath, JSON.stringify(contentList, null, 2));
    res.json({ success: true, message: 'Content deleted' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ success: false, message: 'Failed to delete content' });
  }
});

// Serve HLS fragments (media folder at /live in URL to match typical HLS paths, or just root if needed)
// Current NMS setup puts streams in media/live/stream
// Request URL in index.html is /live/stream/index.m3u8
// So mount 'media' at root or handles specific path.
// media/live/stream/index.m3u8 -> /live/stream/index.m3u8 if media is mounted at root.
app.use(express.static(path.join(__dirname, 'media')));

app.listen(HTTP_PORT, () => {
  console.log(`Web Server running on http://localhost:${HTTP_PORT}`);
});


// Node Media Server Setup (RTMP only)
const config = {
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: 8001, // Move NMS HTTP to 8001 to avoid conflict, or use it for stats
    mediaroot: path.resolve(__dirname, 'media'),
    allow_origin: '*',
  }
};

const nms = new NodeMediaServer(config);

// Map of stream IDs to object { hls: Process, restreams: [Process] }
const activeTranscoders = new Map();

nms.on('postPublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);

  // StreamPath is usually "/live/streamkey"
  const parts = StreamPath.split('/');
  if (parts.length < 3) return;

  const app = parts[1]; // 'live'
  const name = parts[2]; // 'stream'

  const hlsDir = path.resolve(__dirname, 'media', app, name);

  // Ensure directory exists
  fs.mkdirSync(hlsDir, { recursive: true });

  const rtmpUrl = `rtmp://localhost:${RTMP_PORT}${StreamPath}`;
  const m3u8Path = path.join(hlsDir, 'index.m3u8');

  console.log(`Starting HLS transcoding for ${rtmpUrl} -> ${m3u8Path}`);

  // 1. HLS Transcoding
  const hlsArgs = [
    '-i', rtmpUrl,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-c:a', 'aac',
    '-ar', '44100',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments',
    m3u8Path
  ];

  const hlsProcess = spawn(ffmpegPath, hlsArgs);

  hlsProcess.on('close', (code) => {
    console.log(`HLS FFmpeg [${name}] exited with code ${code}`);
  });

  // 2. Multi-Restreaming
  const settings = getSettings();
  const restreamProcesses = [];

  if (settings.restreamConfigs && Array.isArray(settings.restreamConfigs)) {
    settings.restreamConfigs.forEach(config => {
      if (config.enabled && config.url) {
        let targetUrl = config.url;
        if (config.key && config.key.trim().length > 0) {
          // Append key, ensuring proper slash handling
          if (!targetUrl.endsWith('/')) {
            targetUrl += '/';
          }
          targetUrl += config.key.trim();
        }

        console.log(`Starting Restream to [${config.name}]: ${targetUrl}`);

        const restreamArgs = [
          '-i', rtmpUrl,
          '-c', 'copy', // Copy codec for minimal CPU usage
          '-f', 'flv',
          targetUrl
        ];

        const p = spawn(ffmpegPath, restreamArgs);

        // Log FFmpeg output for debugging
        p.stderr.on('data', (data) => {
          console.log(`[Restream ${config.name}] FFmpeg: ${data}`);
        });

        p.on('close', (code) => {
          console.log(`Restream [${config.name}] exited with code ${code}`);
        });

        restreamProcesses.push(p);
      }
    });
  }

  // Store metadata
  activeTranscoders.set(id, {
    hls: hlsProcess,
    restreams: restreamProcesses,
    app: app,
    name: name,
    path: StreamPath
  });
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  const session = activeTranscoders.get(id);
  if (session) {
    console.log('Cleaning up FFmpeg processes for', StreamPath);

    // Kill HLS
    if (session.hls) {
      try { session.hls.kill('SIGKILL'); } catch (e) { console.log('Error killing HLS', e); }
    }

    // Kill Restreams
    if (session.restreams) {
      session.restreams.forEach(p => {
        try { p.kill('SIGKILL'); } catch (e) { console.log('Error killing restream', e); }
      });
    }

    activeTranscoders.delete(id);
  }
});

// Expose Active Streams to API
app.get('/api/streams', (req, res) => {
  const streams = [];
  activeTranscoders.forEach((session, id) => {
    streams.push({
      id: id,
      app: session.app,
      name: session.name,
      path: session.path,
      playbackUrl: `/${session.app}/${session.name}/index.m3u8`
    });
  });
  res.json({ success: true, streams });
});

nms.run();

console.log('Streaming Server is running...');
console.log(`RTMP URL: rtmp://localhost:${RTMP_PORT}/live/stream`);
console.log(`Admin Page: http://localhost:${HTTP_PORT}/admin.html`);
