const serverless = require('serverless-http');
const app = require('./server');
const logger = require('./logger');

// Wrap the Express app for Lambda
const handler = serverless(app);

// Export the handler function for AWS Lambda
module.exports.handler = async (event, context) => {
  logger.info('Lambda function invoked', { requestId: context.awsRequestId });
  
  try {
    // Call the serverless handler with the event and context
    return await handler(event, context);
  } catch (error) {
    logger.error(`Error in Lambda handler: ${error.message}`);
    throw error;
  }
};
