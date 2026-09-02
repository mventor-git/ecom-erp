/**
 * Mobile API v1 - Image Optimization
 * On-the-fly image resizing and format conversion for mobile apps
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const IMAGES_DIR = path.join(__dirname, '..', 'public', 'images');

/**
 * GET /api/v1/images/:filename
 * Get optimized image with query parameters
 * 
 * Query params:
 * - width: desired width (default: original)
 * - height: desired height (default: original)
 * - quality: image quality 1-100 (default: 80)
 * - format: output format (webp, jpg, png) (default: original)
 */
router.get('/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const { width, height, quality = 80, format } = req.query;

    const imagePath = path.join(IMAGES_DIR, filename);

    // Check if image exists
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Image not found',
        },
      });
    }

    // Build transformation pipeline
    let transformer = sharp(imagePath);

    // Resize if dimensions provided
    if (width || height) {
      transformer = transformer.resize({
        width: width ? parseInt(width) : undefined,
        height: height ? parseInt(height) : undefined,
        fit: 'inside',
        withoutEnlargement: true,
      });
    }

    // Convert format if specified
    if (format) {
      switch (format.toLowerCase()) {
        case 'webp':
          transformer = transformer.webp({ quality: parseInt(quality) });
          res.type('image/webp');
          break;
        case 'jpg':
        case 'jpeg':
          transformer = transformer.jpeg({ quality: parseInt(quality) });
          res.type('image/jpeg');
          break;
        case 'png':
          transformer = transformer.png({ quality: parseInt(quality) });
          res.type('image/png');
          break;
        default:
          // Keep original format
          break;
      }
    } else {
      // Apply quality to original format
      const ext = path.extname(filename).toLowerCase();
      if (ext === '.jpg' || ext === '.jpeg') {
        transformer = transformer.jpeg({ quality: parseInt(quality) });
        res.type('image/jpeg');
      } else if (ext === '.png') {
        transformer = transformer.png({ quality: parseInt(quality) });
        res.type('image/png');
      } else if (ext === '.webp') {
        transformer = transformer.webp({ quality: parseInt(quality) });
        res.type('image/webp');
      }
    }

    // Set cache headers for mobile apps
    res.set({
      'Cache-Control': 'public, max-age=31536000', // 1 year
      'ETag': `"${filename}-${width || 'auto'}-${height || 'auto'}-${quality}"`,
    });

    // Pipe transformed image to response
    transformer.pipe(res);
  } catch (err) {
    console.error('Image optimization error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to process image',
      },
    });
  }
});

/**
 * GET /api/v1/images/:filename/thumbnails
 * Get all thumbnail sizes for an image
 */
router.get('/:filename/thumbnails', (req, res) => {
  try {
    const { filename } = req.params;
    const imagePath = path.join(IMAGES_DIR, filename);

    // Check if image exists
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Image not found',
        },
      });
    }

    const baseUrl = `/api/v1/images/${filename}`;

    res.json({
      success: true,
      data: {
        thumbnail: `${baseUrl}?width=100&height=100&quality=80&format=webp`,
        small: `${baseUrl}?width=300&height=300&quality=80&format=webp`,
        medium: `${baseUrl}?width=600&height=600&quality=80&format=webp`,
        large: `${baseUrl}?width=1200&height=1200&quality=80&format=webp`,
        original: `/images/${filename}`,
      },
    });
  } catch (err) {
    console.error('Get thumbnails error:', err);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get thumbnails',
      },
    });
  }
});

module.exports = router;
