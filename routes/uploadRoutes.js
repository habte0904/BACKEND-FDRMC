import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { protect } from '../middleware/authMiddleware.js';
import { checkPermission } from '../middleware/permissionMiddleware.js';

import { fileURLToPath } from 'url';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsRoot = path.join(__dirname, '..', 'uploads');

const uploadDir = path.join(uploadsRoot, 'portal');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const incidentDir = path.join(uploadsRoot, 'incidents');
if (!fs.existsSync(incidentDir)) {
  fs.mkdirSync(incidentDir, { recursive: true });
}

const inspectionDir = path.join(uploadsRoot, 'inspection-certificates');
if (!fs.existsSync(inspectionDir)) {
  fs.mkdirSync(inspectionDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `portal-${unique}${ext}`);
  },
});

const upload = multer({ storage });

const incidentStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, incidentDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.dat';
    cb(null, `incident-${unique}${ext}`);
  },
});

const incidentUpload = multer({
  storage: incidentStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
      return;
    }
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
  },
});

const inspectionStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, inspectionDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `inspection-certificate-${unique}${ext}`);
  },
});

const inspectionUpload = multer({ storage: inspectionStorage });

const newsDir = path.join(uploadsRoot, 'news');
if (!fs.existsSync(newsDir)) {
  fs.mkdirSync(newsDir, { recursive: true });
}

const newsStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, newsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `news-${unique}${ext}`);
  },
});

const newsUpload = multer({ storage: newsStorage });

router.post('/news-media', newsUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  res.json({ url: `/api/uploads/news/${req.file.filename}` });
});

router.post('/portal-image', protect, checkPermission('portalcontent', 'update'), upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  res.json({ url: `/api/uploads/portal/${req.file.filename}` });
});

router.post('/incident-media', incidentUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  res.json({ url: `/api/uploads/incidents/${req.file.filename}` });
});

router.post('/inspection-certificate', protect, inspectionUpload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  res.json({ url: `/api/uploads/inspection-certificates/${req.file.filename}` });
});

export default router;
