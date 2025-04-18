# S3 File Server

A Node.js Express server for uploading files to Amazon S3 and listing files.

## Features

- Upload files to S3 using multipart/form-data
- List all files in S3 bucket under uploads/ prefix
- Deployable on both EC2 and AWS Lambda
- CloudWatch integration for logging
- X-Ray integration for tracing

## Requirements

- Node.js v18 or higher
- AWS account with S3 bucket
- Appropriate AWS IAM permissions

## Environment Variables

- `AWS_REGION`: AWS region where S3 bucket is located
- `S3_BUCKET`: Name of the S3 bucket
- `PORT`: Port for the server to listen on (default: 3000)
- `LOG_LEVEL`: Winston log level (default: info)

## Installation

```bash
npm install
```

## Running on EC2

```bash
npm start
```

## Deploying to AWS Lambda

1. Package the application:

```bash
zip -r function.zip package.json server.js lambda.js s3-service.js logger.js node_modules/
```

2. Create a Lambda function using the AWS Console or AWS CLI
3. Set up an API Gateway proxy integration
4. Configure environment variables in the Lambda console
5. Ensure Lambda has the appropriate IAM role with S3 permissions

## API Endpoints

### POST /upload
Accepts multipart/form-data with a file field named "file"
Stores the file in S3 under the uploads/ prefix

### GET /files
Returns a JSON array of all files in the S3 bucket under the uploads/ prefix
