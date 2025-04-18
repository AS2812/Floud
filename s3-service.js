const { S3Client, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const logger = require('./logger');

// Initialize the S3 client with fallback values
const region = process.env.AWS_REGION || 'us-east-1'; // Add default region

// Configure S3 client with explicit credential handling
const s3Client = new S3Client({
  region,
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        sessionToken: process.env.AWS_SESSION_TOKEN // Optional session token for temporary credentials
      }
    : undefined // Let SDK use the default credential provider chain if env vars not set
});

// Get the bucket name from environment variables with fallback
const bucketName = process.env.S3_BUCKET || 'demo-file-upload-bucket'; // Add default bucket name

logger.info(`S3 client initialized with region: ${region} and bucket: ${bucketName}`);

/**
 * Upload a file to S3
 * @param {Object} file - The file object from multer
 * @returns {Promise<Object>} The result of the upload operation
 */
async function uploadFileToS3(file) {
  logger.info(`Uploading file ${file.originalname} to S3 bucket ${bucketName}`);
  
  try {
    const uploadParams = {
      Bucket: bucketName,
      Key: `uploads/${file.originalname}`,
      Body: file.buffer,
      ContentType: file.mimetype
    };
    
    const command = new PutObjectCommand(uploadParams);
    const result = await s3Client.send(command);
    
    logger.info(`File uploaded successfully: ${file.originalname}`);
    return {
      fileName: file.originalname,
      s3Key: `uploads/${file.originalname}`,
      etag: result.ETag
    };
  } catch (error) {
    logger.error(`Error uploading file to S3: ${error.message}`);
    throw error;
  }
}

/**
 * List all files in the uploads/ prefix of the S3 bucket
 * @returns {Promise<Array>} Array of file objects with keys and metadata
 */
async function listFilesFromS3() {
  logger.info(`Listing files from S3 bucket ${bucketName} with prefix 'uploads/'`);
  
  try {
    const listParams = {
      Bucket: bucketName,
      Prefix: 'uploads/'
    };
    
    const command = new ListObjectsV2Command(listParams);
    const data = await s3Client.send(command);
    
    const files = data.Contents ? data.Contents.map(item => ({
      key: item.Key,
      size: item.Size,
      lastModified: item.LastModified
    })) : [];
    
    logger.info(`Successfully listed ${files.length} files from S3`);
    return files;
  } catch (error) {
    logger.error(`Error listing files from S3: ${error.message}`);
    throw error;
  }
}

module.exports = {
  uploadFileToS3,
  listFilesFromS3
};
