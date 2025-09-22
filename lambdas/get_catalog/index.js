// Query catalog items from DynamoDB
const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const TABLE_NAME = process.env.CATALOG_TABLE;

const dynamoClient = new DynamoDBClient({ region: REGION });

exports.handler = async (event) => {
  try {
    const queryParams = event?.queryStringParameters || {};
    const type = queryParams.type || 'wallpaper';
    const limit = parseInt(queryParams.limit) || 20;
    const lastKey = queryParams.lastKey;

    // Query items by type (using GSI or scan with filter)
    const command = new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'TypeIndex', // We'll need to add this GSI
      KeyConditionExpression: '#type = :type',
      ExpressionAttributeNames: {
        '#type': 'type'
      },
      ExpressionAttributeValues: marshall({
        ':type': type
      }),
      Limit: limit,
      ExclusiveStartKey: lastKey ? JSON.parse(decodeURIComponent(lastKey)) : undefined
    });

    const result = await dynamoClient.send(command);
    
    const items = result.Items ? result.Items.map(item => unmarshall(item)) : [];
    
    return {
      statusCode: 200,
      headers: { 
        'content-type': 'application/json', 
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, OPTIONS',
        'access-control-allow-headers': 'Content-Type'
      },
      body: JSON.stringify({ 
        ok: true, 
        items,
        lastEvaluatedKey: result.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(result.LastEvaluatedKey)) : null,
        count: items.length
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
        error: String(err),
        items: []
      }),
    };
  }
};