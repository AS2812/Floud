require('dotenv').config();

const express = require('express');
const multer = require('multer');
const AWSXRay = require('aws-xray-sdk');
const path = require('path');
const { S3Client, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('./logger');
const { uploadFileToS3, listFilesFromS3 } = require('./s3-service');

const app = express();

// AWS X-Ray: capture HTTPS calls and open/close segments in production
if (process.env.NODE_ENV !== 'development') {
  AWSXRay.captureHTTPsGlobal(require('http'));
  app.use(AWSXRay.express.openSegment('S3FileServer'));
}

// Multer setup: memory storage with 5MB limit
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Serve logo file from multiple locations for redundancy
app.get('/logo-png.png', (req, res) => {
  const logoPath = path.join(__dirname, 'logo-png.png');
  const fallbackPath = path.join(__dirname, 'public', 'logo-png.png');
  
  res.sendFile(logoPath, (err) => {
    if (err) {
      res.sendFile(fallbackPath, (fallbackErr) => {
        if (fallbackErr) {
          logger.error(`Failed to serve logo: ${fallbackErr.message}`);
          res.status(404).send('Logo not found');
        }
      });
    }
  });
});

// GET /files - list S3 objects under uploads/
app.get('/files', async (req, res) => {
  try {
    const files = await listFilesFromS3();
    res.json({ files });
  } catch (err) {
    logger.error(`Failed to list files: ${err.message}`);
    res.status(500).json({ error: 'Failed to list files', message: err.message });
  }
});

// POST /upload - upload file to S3
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    logger.warn('No file provided');
    return res.status(400).json({ error: 'No file provided' });
  }

  try {
    const result = await uploadFileToS3(req.file);
    res.status(201).json(result);
  } catch (err) {
    logger.error(`Upload error: ${err.message}`);
    res.status(500).json({ error: 'Upload failed', message: err.message });
  }
});

// DELETE /delete/:filename - Delete file from S3
app.delete('/delete/:filename', async (req, res) => {
  const fileName = req.params.filename;
  const bucket = process.env.S3_BUCKET;
  const region = process.env.AWS_REGION;
  const client = new S3Client({ region });
  
  try {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: `uploads/${fileName}`
    });
    
    await client.send(command);
    logger.info(`File deleted successfully: ${fileName}`);
    res.json({ message: 'File deleted successfully' });
  } catch (err) {
    logger.error(`Delete error: ${err.message}`);
    res.status(500).json({ error: 'Failed to delete file', message: err.message });
  }
});

// Generate pre-signed URL for GET requests
async function generatePresignedUrl(fileName) {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.AWS_REGION;
  const client = new S3Client({ region });
  const command = new GetObjectCommand({ Bucket: bucket, Key: `uploads/${fileName}` });

  try {
    return await getSignedUrl(client, command, { expiresIn: 3600 });
  } catch (err) {
    logger.error(`Presign URL error: ${err.message}`);
    throw err;
  }
}

// GET /api/file-url/:filename - return JSON with a presigned URL
app.get('/api/file-url/:filename', async (req, res) => {
  try {
    const url = await generatePresignedUrl(req.params.filename);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate URL', message: err.message });
  }
});

// GET /uploads/:filename - proxy S3 object stream
app.get('/uploads/:filename', async (req, res) => {
  const bucket = process.env.S3_BUCKET;
  const region = process.env.AWS_REGION;
  const client = new S3Client({ region });
  const command = new GetObjectCommand({ Bucket: bucket, Key: `uploads/${req.params.filename}` });

  try {
    const data = await client.send(command);
    res.set('Content-Type', data.ContentType);
    res.set('Content-Length', data.ContentLength);
    data.Body.pipe(res);
  } catch (err) {
    if (err.$metadata?.httpStatusCode === 404) {
      res.status(404).send('File not found');
    } else {
      logger.error(`Stream error: ${err.message}`);
      res.status(500).send('Error retrieving file');
    }
  }
});

// Error handler
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// Close X-Ray segment
if (process.env.NODE_ENV !== 'development') {
  app.use(AWSXRay.express.closeSegment());
}

// Start server if not imported
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const HOST = '0.0.0.0';
  app.listen(PORT, HOST, () => {
    logger.info(`Server running at http://${HOST}:${PORT}`);
  });
}

module.exports = app;
