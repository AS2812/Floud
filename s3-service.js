// JavaScript code for file upload and management application
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
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
const bucketName = process.env.S3_BUCKET || 'floud-file-upload-bucket'; // Updated default bucket name

logger.info(`S3 client initialized with region: ${region} and bucket: ${bucketName}`);

// Variable to store the most recently uploaded file
let lastUploadedFile = null;

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
    const s3Result = await s3Client.send(command);
    
    logger.info(`File uploaded successfully: ${file.originalname}`);
    
    const uploadResult = {
      fileName: file.originalname,
      s3Key: `uploads/${file.originalname}`,
      etag: s3Result.ETag,
      uploadDate: new Date().toISOString()
    };
    
    // Update last uploaded file
    lastUploadedFile = uploadResult;
    
    return uploadResult;
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

/**
 * Delete a file from S3
 * @param {string} fileName - The name of the file to delete
 * @returns {Promise<Object>} The result of the delete operation
 */
async function deleteFileFromS3(fileName) {
  logger.info(`Deleting file ${fileName} from S3 bucket ${bucketName}`);
  
  try {
    const deleteParams = {
      Bucket: bucketName,
      Key: `uploads/${fileName}`
    };
    
    const command = new DeleteObjectCommand(deleteParams);
    const result = await s3Client.send(command);
    
    logger.info(`File deleted successfully: ${fileName}`);
    return {
      fileName,
      deleted: true
    };
  } catch (error) {
    logger.error(`Error deleting file from S3: ${error.message}`);
    throw error;
  }
}

/**
 * Get the most recently uploaded file
 * @returns {Object|null} The most recently uploaded file or null if none
 */
function getLastUploadedFile() {
  return lastUploadedFile;
}

/**
 * Set the most recently uploaded file
 * @param {Object|null} fileInfo - The file information to set
 */
function setLastUploadedFile(fileInfo) {
  lastUploadedFile = fileInfo;
}

module.exports = {
  uploadFileToS3,
  listFilesFromS3,
  deleteFileFromS3,
  getLastUploadedFile,
  setLastUploadedFile
};
