const express = require('express');
const multer = require('multer');
const AWSXRay = require('aws-xray-sdk');
const path = require('path');
const logger = require('./logger');
const { uploadFileToS3, listFilesFromS3 } = require('./s3-service');

// Initialize Express application
const app = express();

// Configure AWS X-Ray if not running locally
if (process.env.NODE_ENV !== 'development') {
  AWSXRay.captureHTTPsGlobal(require('http'));
  app.use(AWSXRay.express.openSegment('S3FileServer'));
}

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // limit to 5MB
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve logo file
app.get('/logo-png.png', (req, res) => {
  res.sendFile(path.join(__dirname, 'logo-png.png'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// GET /files - List all files in the S3 bucket's uploads/ directory
app.get('/files', async (req, res) => {
  try {
    const files = await listFilesFromS3();
    res.status(200).json({ files });
  } catch (error) {
    logger.error(`Failed to list files: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to list files',
      message: error.message 
    });
  }
});

// POST /upload - Upload file to S3
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    logger.warn('No file provided in the request');
    return res.status(400).json({ error: 'No file provided' });
  }

  try {
    const result = await uploadFileToS3(req.file);
    res.status(201).json(result);
  } catch (error) {
    logger.error(`Failed to upload file: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to upload file',
      message: error.message 
    });
  }
});

// Serve files from S3
app.get('/uploads/:filename', async (req, res) => {
  try {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const { S3Client } = require('@aws-sdk/client-s3');
    const region = process.env.AWS_REGION || 'us-east-1';
    const bucketName = process.env.S3_BUCKET || 'floud-file-upload-bucket';
    const s3Client = new S3Client({ region });
    
    const filename = req.params.filename;
    const key = `uploads/${filename}`;
    
    // Create GetObject command
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    });
    
    try {
      // Get the object from S3
      const data = await s3Client.send(command);
      
      // Set headers for the response
      res.set('Content-Type', data.ContentType);
      res.set('Content-Length', data.ContentLength);
      
      // Stream the file data to the response
      data.Body.pipe(res);
    } catch (err) {
      logger.error(`Error getting S3 object: ${err.message}`);
      res.status(404).send('File not found');
    }
  } catch (error) {
    logger.error(`Error serving S3 file: ${error.message}`);
    res.status(500).send('Error retrieving file');
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// Close X-Ray segment if not running locally
if (process.env.NODE_ENV !== 'development') {
  app.use(AWSXRay.express.closeSegment());
}

// Start the server if not imported as a module
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

module.exports = app;
