const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const DATA_FILE = path.join(ROOT_DIR, 'data.json');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const DEFAULT_DATA = {
  settings: {
    title: 'Picnic Moments Contest 2026',
    subtitle: 'পিকনিক খোৱা-বোৱা, ফটো আৰু ভিডিঅ’ আপলোড কৰক — সৰ্বশ্ৰেষ্ঠ ফটো/ভিডিঅ’ই পাব নগদ পুৰস্কাৰ!',
    eventDate: 'December 2026',
    prizes: {
      first: '₹5,000',
      second: '₹2,500',
      third: '₹1,000'
    },
    adsEnabled: true,
    adsenseClientId: '',
    sponsors: [
      {
        id: 'sp-1',
        name: 'Brahmaputra River Tours & Picnic Spot',
        tagline: 'Book riverside tents, bamboo huts & sound systems for your group picnic!',
        cta: 'Sponsor Slot #1 — Click to Visit',
        url: '#sponsor-demo-1',
        badge: 'Sponsored'
      },
      {
        id: 'sp-2',
        name: 'Assam Kitchen & Catering',
        tagline: 'Fresh local picnic catering packages starting at ₹299/plate.',
        cta: 'Sponsor Slot #2 — Advertise Here',
        url: '#sponsor-demo-2',
        badge: 'Local Ad'
      }
    ],
    adminPin: '1234',
    winnerId: null
  },
  entries: [
    {
      id: 'sample-1',
      name: 'Rituraj Bora',
      phone: '9876543210',
      title: 'Riverside Banana Leaf Picnic Feast!',
      category: 'Picnic Feast',
      mediaType: 'photo',
      mediaUrl: '/samples/feast.jpg',
      votes: 42,
      createdAt: '2026-11-23T09:30:00.000Z',
      isSample: true
    },
    {
      id: 'sample-2',
      name: 'Priyanka Kalita',
      phone: '9876543211',
      title: 'Best Friends Forever — Picnic Vibes 2026',
      category: 'Group Fun',
      mediaType: 'photo',
      mediaUrl: '/samples/group.jpg',
      votes: 36,
      createdAt: '2026-11-23T11:15:00.000Z',
      isSample: true
    },
    {
      id: 'sample-3',
      name: 'Manash Das',
      phone: '9876543212',
      title: 'Morning Sunshine by the Crystal River',
      category: 'Nature & Spot',
      mediaType: 'photo',
      mediaUrl: '/samples/nature.jpg',
      votes: 28,
      createdAt: '2026-11-24T06:00:00.000Z',
      isSample: true
    }
  ]
};

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Initialize data file on startup
loadData();

app.use(express.json({ limit: '2mb' }));
app.use(express.static(PUBLIC_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
    const safeName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    if (mime.startsWith('image/') || mime.startsWith('video/')) {
      return cb(null, true);
    }
    cb(new Error('Only image and video files are allowed!'));
  }
});

function sanitizeEntryPublic(entry) {
  return {
    id: entry.id,
    name: entry.name,
    title: entry.title,
    category: entry.category,
    mediaType: entry.mediaType,
    mediaUrl: entry.mediaUrl,
    votes: entry.votes || 0,
    createdAt: entry.createdAt,
    isSample: Boolean(entry.isSample)
  };
}

function checkAdmin(req, res, next) {
  const data = loadData();
  const pin = req.headers['x-admin-pin'] || '';
  if (String(pin) !== String(data.settings.adminPin)) {
    return res.status(401).json({ error: 'Invalid Admin PIN' });
  }
  next();
}

// Public contest state
app.get('/api/state', (_req, res) => {
  const data = loadData();
  const { adminPin, ...publicSettings } = data.settings;
  res.json({
    settings: publicSettings,
    entries: data.entries.map(sanitizeEntryPublic)
  });
});

// Upload photo or video entry (consent required)
app.post('/api/upload', (req, res) => {
  upload.single('media')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Please select a photo or video file to upload.' });
    }

    const { name, phone, title, category, consent } = req.body || {};
    if (consent !== 'true') {
      // Remove uploaded file if consent was not confirmed
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Consent confirmation is required to enter the contest.' });
    }
    if (!name || !name.trim() || !title || !title.trim()) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ error: 'Please enter your name and a photo/video title.' });
    }

    const isVideo = (req.file.mimetype || '').toLowerCase().startsWith('video/');
    const newEntry = {
      id: `entry-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      name: name.trim().slice(0, 60),
      phone: (phone || '').trim().slice(0, 40),
      title: title.trim().slice(0, 120),
      category: (category || 'Picnic Feast').trim().slice(0, 40),
      mediaType: isVideo ? 'video' : 'photo',
      mediaUrl: `/uploads/${req.file.filename}`,
      votes: 1,
      createdAt: new Date().toISOString(),
      isSample: false
    };

    const data = loadData();
    data.entries.unshift(newEntry);
    saveData(data);

    res.status(201).json({ entry: sanitizeEntryPublic(newEntry) });
  });
});

// Vote / unvote an entry
app.post('/api/entries/:id/vote', (req, res) => {
  const { id } = req.params;
  const { action } = req.body || {};
  const data = loadData();
  const entry = data.entries.find((e) => e.id === id);
  if (!entry) {
    return res.status(404).json({ error: 'Entry not found' });
  }
  if (action === 'down') {
    entry.votes = Math.max(0, (entry.votes || 0) - 1);
  } else {
    entry.votes = (entry.votes || 0) + 1;
  }
  saveData(data);
  res.json({ id: entry.id, votes: entry.votes });
});

// Admin login verification
app.post('/api/admin/login', (req, res) => {
  const { pin } = req.body || {};
  const data = loadData();
  if (String(pin) === String(data.settings.adminPin)) {
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Wrong Admin PIN' });
});

// Admin: full entries list (includes contact info for prize payout)
app.get('/api/admin/entries', checkAdmin, (_req, res) => {
  const data = loadData();
  res.json({
    settings: data.settings,
    entries: data.entries
  });
});

// Admin: update contest, prizes, or ad/sponsor settings
app.post('/api/admin/settings', checkAdmin, (req, res) => {
  const data = loadData();
  const body = req.body || {};

  if (typeof body.title === 'string' && body.title.trim()) {
    data.settings.title = body.title.trim().slice(0, 120);
  }
  if (typeof body.subtitle === 'string') {
    data.settings.subtitle = body.subtitle.trim().slice(0, 260);
  }
  if (typeof body.eventDate === 'string') {
    data.settings.eventDate = body.eventDate.trim().slice(0, 60);
  }
  if (body.prizes && typeof body.prizes === 'object') {
    data.settings.prizes = {
      first: String(body.prizes.first || data.settings.prizes.first).slice(0, 30),
      second: String(body.prizes.second || data.settings.prizes.second).slice(0, 30),
      third: String(body.prizes.third || data.settings.prizes.third).slice(0, 30)
    };
  }
  if (typeof body.adsEnabled === 'boolean') {
    data.settings.adsEnabled = body.adsEnabled;
  }
  if (typeof body.adsenseClientId === 'string') {
    data.settings.adsenseClientId = body.adsenseClientId.trim().slice(0, 60);
  }
  if (Array.isArray(body.sponsors)) {
    data.settings.sponsors = body.sponsors.slice(0, 6).map((sp, idx) => ({
      id: sp.id || `sp-${idx + 1}`,
      name: String(sp.name || 'Sponsor').slice(0, 80),
      tagline: String(sp.tagline || '').slice(0, 160),
      cta: String(sp.cta || 'Visit Sponsor').slice(0, 50),
      url: String(sp.url || '#').slice(0, 240),
      badge: String(sp.badge || 'Sponsored').slice(0, 24)
    }));
  }
  if (typeof body.newPin === 'string' && body.newPin.trim().length >= 4) {
    data.settings.adminPin = body.newPin.trim().slice(0, 20);
  }

  saveData(data);
  const { adminPin, ...publicSettings } = data.settings;
  res.json({ ok: true, settings: publicSettings });
});

// Admin: declare winner
app.post('/api/admin/winner', checkAdmin, (req, res) => {
  const { winnerId } = req.body || {};
  const data = loadData();
  if (winnerId && !data.entries.some((e) => e.id === winnerId)) {
    return res.status(404).json({ error: 'Entry not found' });
  }
  data.settings.winnerId = winnerId || null;
  saveData(data);
  res.json({ ok: true, winnerId: data.settings.winnerId });
});

// Admin: delete entry
app.delete('/api/admin/entries/:id', checkAdmin, (req, res) => {
  const { id } = req.params;
  const data = loadData();
  const idx = data.entries.findIndex((e) => e.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Entry not found' });
  }
  const [removed] = data.entries.splice(idx, 1);
  if (data.settings.winnerId === id) {
    data.settings.winnerId = null;
  }
  if (removed && removed.mediaUrl && removed.mediaUrl.startsWith('/uploads/')) {
    const filePath = path.join(UPLOADS_DIR, path.basename(removed.mediaUrl));
    fs.unlink(filePath, () => {});
  }
  saveData(data);
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Picnic Contest server running on http://0.0.0.0:${PORT}`);
});
