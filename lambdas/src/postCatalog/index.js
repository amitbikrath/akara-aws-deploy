const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { 
      type, 
      title, 
      caption, 
      shloka, 
      meaning, 
      fileKey, 
      thumbKey, 
      ratio, 
      palette, 
      style 
    } = body;

    // Validate required fields
    if (!type || !title || !fileKey) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({
          error: 'Missing required fields: type, title, fileKey'
        })
      };
    }

    if (!['wallpaper', 'music'].includes(type)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true
        },
        body: JSON.stringify({
          error: 'Type must be "wallpaper" or "music"'
        })
      };
    }

    // Generate IDs
    const id = randomUUID();
    const version = '1';
    const createdAt = new Date().toISOString();

    // Create DynamoDB item
    const item = {
      pk: `${type.toUpperCase()}#${id}`,
      sk: `v#${version}`,
      type,
      title,
      caption: caption || '',
      shloka: shloka || '',
      meaning: meaning || '',
      fileKey,
      thumbKey: thumbKey || '',
      ratio: ratio || '16:9',
      palette: palette || [],
      style: style || '',
      createdAt
    };

    // Save to DynamoDB
    await docClient.send(new PutCommand({
      TableName: process.env.CATALOG_TABLE,
      Item: item
    }));

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({
        id,
        version,
        message: 'Catalog item created successfully',
        item: {
          id,
          version,
          type,
          title,
          fileKey,
          createdAt
        }
      })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true
      },
      body: JSON.stringify({
        error: 'Internal server error'
      })
    };
  }
};
