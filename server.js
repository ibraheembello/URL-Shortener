// Required dependencies
const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cache = require('memory-cache');
const morgan = require('morgan');
const validUrl = require('valid-url');

const app = express();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(express.json());
app.use(cors());
app.use(morgan('combined')); // Request logging
app.use('/shorten', limiter); // Apply rate limiting to /shorten endpoints

// MongoDB connection (replace with your MongoDB URI)
mongoose.connect('mongodb://localhost/url-shortener', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// URL Schema
const urlSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    trim: true
  },
  shortCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  accessCount: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const URL = mongoose.model('URL', urlSchema);

// Generate random short code
function generateShortCode(length = 6) {
  return crypto.randomBytes(length).toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, length);
}

// Improved URL validation
function validateUrl(url) {
  if (!validUrl.isUri(url)) {
    return false;
  }
  try {
    new URL(url);
    return true;
  } catch (err) {
    return false;
  }
}

// Cache middleware
function cacheMiddleware(duration) {
  return (req, res, next) => {
    const key = req.originalUrl || req.url;
    const cachedResponse = cache.get(key);
    
    if (cachedResponse) {
      return res.json(cachedResponse);
    }
    
    res.sendResponse = res.json;
    res.json = (body) => {
      cache.put(key, body, duration * 1000);
      res.sendResponse(body);
    };
    next();
  };
}

// Create short URL
app.post('/shorten', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    if (!validateUrl(url)) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Generate unique short code
    let shortCode;
    let isUnique = false;
    while (!isUnique) {
      shortCode = generateShortCode();
      const existingUrl = await URL.findOne({ shortCode });
      if (!existingUrl) {
        isUnique = true;
      }
    }

    const newUrl = new URL({
      url,
      shortCode
    });

    await newUrl.save();

    res.status(201).json({
      id: newUrl._id,
      url: newUrl.url,
      shortCode: newUrl.shortCode,
      createdAt: newUrl.createdAt,
      updatedAt: newUrl.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Retrieve original URL
app.get('/shorten/:shortCode', cacheMiddleware(30), async (req, res) => {
  try {
    const { shortCode } = req.params;
    const url = await URL.findOne({ shortCode });

    if (!url) {
      return res.status(404).json({ error: 'URL not found' });
    }

    // Increment access count
    url.accessCount += 1;
    await url.save();

    res.json({
      id: url._id,
      url: url.url,
      shortCode: url.shortCode,
      createdAt: url.createdAt,
      updatedAt: url.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update URL
app.put('/shorten/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Validate URL format
    if (!validateUrl(url)) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const updatedUrl = await URL.findOne({ shortCode });

    if (!updatedUrl) {
      return res.status(404).json({ error: 'URL not found' });
    }

    updatedUrl.url = url;
    updatedUrl.updatedAt = Date.now();
    await updatedUrl.save();

    res.json({
      id: updatedUrl._id,
      url: updatedUrl.url,
      shortCode: updatedUrl.shortCode,
      createdAt: updatedUrl.createdAt,
      updatedAt: updatedUrl.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete URL
app.delete('/shorten/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;
    const url = await URL.findOne({ shortCode });

    if (!url) {
      return res.status(404).json({ error: 'URL not found' });
    }

    await url.deleteOne();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get URL statistics
app.get('/shorten/:shortCode/stats', cacheMiddleware(30), async (req, res) => {
  try {
    const { shortCode } = req.params;
    const url = await URL.findOne({ shortCode });

    if (!url) {
      return res.status(404).json({ error: 'URL not found' });
    }

    res.json({
      id: url._id,
      url: url.url,
      shortCode: url.shortCode,
      createdAt: url.createdAt,
      updatedAt: url.updatedAt,
      accessCount: url.accessCount
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Redirect endpoint (for frontend integration)
app.get('/r/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;
    const url = await URL.findOne({ shortCode });

    if (!url) {
      return res.status(404).json({ error: 'URL not found' });
    }

    url.accessCount += 1;
    await url.save();

    res.redirect(url.url);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});