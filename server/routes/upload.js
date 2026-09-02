const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const adminAuth = require('../middleware/adminAuth');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'images');
const THUMBNAILS_DIR = path.join(UPLOAD_DIR, 'thumbnails');

// Ensure upload directories exist
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(THUMBNAILS_DIR)) {
  fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
}

// Allowed image types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Generate unique filename with original extension
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, name);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: JPEG, PNG, GIF, WebP, SVG`), false);
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } });

// ── 3D model uploads (.glb/.gltf) — used by the welcome-page showcase ───
const MODEL_TYPES = ['model/gltf-binary', 'model/gltf+json', 'application/octet-stream'];
const MODEL_MAX_SIZE = 30 * 1024 * 1024; // 30MB
const modelStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.glb';
    cb(null, crypto.randomBytes(16).toString('hex') + ext);
  },
});
const modelFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const ok = ['.glb', '.gltf'].includes(ext) &&
    (MODEL_TYPES.includes(file.mimetype) || file.mimetype === 'application/octet-stream' || !file.mimetype);
  if (ok) return cb(null, true);
  cb(new Error('Invalid model type: only .glb / .gltf files are allowed'), false);
};
const uploadModel = multer({
  storage: modelStorage,
  fileFilter: modelFileFilter,
  limits: { fileSize: MODEL_MAX_SIZE },
});

// POST /api/admin/upload/model — Upload a 3D model (admin auth)
router.post('/model', adminAuth, (req, res) => {
  uploadModel.single('model')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Model too large. Maximum size is 30MB.' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    res.json({ url: `/images/${req.file.filename}`, filename: req.file.filename, size: req.file.size });
  });
});

/**
 * Optimize image using sharp
 * - Resize if larger than max dimensions
 * - Convert to WebP (better compression)
 * - Reduce quality for smaller file size
 * - Generate thumbnail
 *
 * @param {string} filePath - Full path to uploaded image
 * @param {string} filename - Filename
 * @returns {Promise<Object>} Optimization result with sizes
 */
async function optimizeImage(filePath, filename) {
  const ext = path.extname(filename).toLowerCase();

  // Skip SVG files (vector, already optimized)
  if (ext === '.svg') {
    return {
      optimized: false,
      reason: 'SVG files are not processed',
      originalSize: fs.statSync(filePath).size,
      thumbnail: null
    };
  }

  try {
    const image = sharp(filePath);
    const metadata = await image.metadata();

    // Configuration
    const MAX_WIDTH = 1920;
    const MAX_HEIGHT = 1920;
    const THUMB_SIZE = 300;
    const QUALITY = 85;

    // Generate optimized filename (force .webp for better compression)
    const baseFilename = path.basename(filename, ext);
    const optimizedFilename = baseFilename + '.webp';
    const optimizedPath = path.join(UPLOAD_DIR, optimizedFilename);
    const thumbnailFilename = baseFilename + '-thumb.webp';
    const thumbnailPath = path.join(THUMBNAILS_DIR, thumbnailFilename);

    // Optimize main image
    let pipeline = sharp(filePath);

    // Resize if too large
    if (metadata.width > MAX_WIDTH || metadata.height > MAX_HEIGHT) {
      pipeline = pipeline.resize(MAX_WIDTH, MAX_HEIGHT, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert to WebP with quality setting
    await pipeline
      .webp({ quality: QUALITY })
      .toFile(optimizedPath);

    // Generate thumbnail (300x300, cover fit)
    await sharp(filePath)
      .resize(THUMB_SIZE, THUMB_SIZE, {
        fit: 'cover',
        position: 'center'
      })
      .webp({ quality: 80 })
      .toFile(thumbnailPath);

    // Get file sizes
    const originalSize = fs.statSync(filePath).size;
    const optimizedSize = fs.statSync(optimizedPath).size;
    const thumbnailSize = fs.statSync(thumbnailPath).size;

    // Delete original file (keep only optimized version)
    fs.unlinkSync(filePath);

    const savings = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);

    return {
      optimized: true,
      originalSize,
      optimizedSize,
      thumbnailSize,
      savings: `${savings}%`,
      thumbnail: `/images/thumbnails/${thumbnailFilename}`,
      filename: optimizedFilename
    };
  } catch (err) {
    console.error('Image optimization failed:', err);
    // If optimization fails, keep original file
    return {
      optimized: false,
      reason: err.message,
      originalSize: fs.statSync(filePath).size,
      thumbnail: null
    };
  }
}

// POST /api/admin/upload — Upload image with automatic optimization (admin auth)
router.post('/', adminAuth, (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      // Optimize image (resize, convert to WebP, generate thumbnail)
      const optimization = await optimizeImage(
        path.join(UPLOAD_DIR, req.file.filename),
        req.file.filename
      );

      const finalFilename = optimization.filename || req.file.filename;
      const imageUrl = `/images/${finalFilename}`;

      res.json({
        success: true,
        url: imageUrl,
        filename: finalFilename,
        size: optimization.optimizedSize || req.file.size,
        mimetype: optimization.optimized ? 'image/webp' : req.file.mimetype,
        thumbnail: optimization.thumbnail,
        optimization: {
          optimized: optimization.optimized,
          originalSize: optimization.originalSize,
          optimizedSize: optimization.optimizedSize,
          thumbnailSize: optimization.thumbnailSize,
          savings: optimization.savings,
          reason: optimization.reason
        }
      });
    } catch (err) {
      console.error('Error processing image:', err);
      // If processing fails, return original file info
      res.json({
        success: true,
        url: `/images/${req.file.filename}`,
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype,
        optimization: {
          optimized: false,
          reason: err.message
        }
      });
    }
  });
});

// GET /api/admin/images — List uploaded images (admin auth)
router.get('/list', adminAuth, (req, res) => {
  try {
    const files = fs.readdirSync(UPLOAD_DIR).filter(f => {
      const ext = path.extname(f).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);
    }).map(f => ({
      filename: f,
      url: `/images/${f}`,
      size: fs.statSync(path.join(UPLOAD_DIR, f)).size,
      uploaded: fs.statSync(path.join(UPLOAD_DIR, f)).mtime
    })).sort((a, b) => b.uploaded - a.uploaded);

    res.json(files);
  } catch (err) {
    console.error('Error listing images:', err);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// DELETE /api/admin/images/:filename — Delete an image (admin auth)
router.delete('/:filename', adminAuth, (req, res) => {
  try {
    const filepath = path.join(UPLOAD_DIR, req.params.filename);

    // Security: prevent directory traversal
    if (req.params.filename.includes('..') || req.params.filename.includes('/') || req.params.filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    fs.unlinkSync(filepath);
    res.json({ success: true, message: 'Image deleted' });
  } catch (err) {
    console.error('Error deleting image:', err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

module.exports = router;
