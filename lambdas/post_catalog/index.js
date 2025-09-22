// Save catalog item to DynamoDB
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall } = require('@aws-sdk/util-dynamodb');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const TABLE_NAME = process.env.CATALOG_TABLE;

const dynamoClient = new DynamoDBClient({ region: REGION });

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    const { type, title, fileKey } = body;
    if (!type || !title || !fileKey) {
      return {
        statusCode: 400,
        headers: { 
          'content-type': 'application/json', 
          'access-control-allow-origin': '*' 
        },
        body: JSON.stringify({ 
          ok: false, 
          error: 'Missing required fields: type, title, fileKey' 
        }),
      };
    }

    // Generate unique IDs
    const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const version = 'v1';
    
    // Create catalog item
    const catalogItem = {
      pk: `${type.toUpperCase()}#${id}`,
      sk: `v#${version}`,
      id,
      type: type.toLowerCase(),
      title,
      fileKey,
      thumbKey: body.thumbKey || null,
      caption: body.caption || '',
      shloka: body.shloka || '',
      meaning: body.meaning || '',
      ratio: body.ratio || '16:9',
      palette: body.palette || '',
      style: body.style || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save to DynamoDB
    const command = new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(catalogItem)
    });

    await dynamoClient.send(command);

    return {
      statusCode: 201,
      headers: { 
        'content-type': 'application/json', 
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'Content-Type, Authorization'
      },
      body: JSON.stringify({ 
        ok: true, 
        item: catalogItem,
        message: 'Catalog item saved successfully'
      }),
    };
  } catch (err) {
    console.error('DynamoDB error:', err);
    return {
      statusCode: 500,
      headers: { 
        'content-type': 'application/json', 
        'access-control-allow-origin': '*' 
      },
      body: JSON.stringify({ 
        ok: false, 
        error: String(err) 
      }),
    };
  }
};