const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Get query parameters
    const queryParams = event.queryStringParameters || {};
    const { type, limit = '50', lastEvaluatedKey } = queryParams;

    // Validate type
    if (!type || !['wallpaper', 'music'].includes(type)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Type parameter must be "wallpaper" or "music"'
        })
      };
    }

    // Query parameters
    const queryInput = {
      TableName: process.env.CATALOG_TABLE,
      KeyConditionExpression: 'begins_with(pk, :typePrefix)',
      ExpressionAttributeValues: {
        ':typePrefix': type.toUpperCase() + '#'
      },
      Limit: parseInt(limit),
      ScanIndexForward: false // Most recent first
    };

    // Add pagination if provided
    if (lastEvaluatedKey) {
      try {
        queryInput.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastEvaluatedKey));
      } catch (e) {
        console.warn('Invalid lastEvaluatedKey:', e);
      }
    }

    // Execute query
    const result = await docClient.send(new QueryCommand(queryInput));

    // Transform items for response
    const items = result.Items.map(item => ({
      id: item.pk.split('#')[1],
      version: item.sk.split('#')[1],
      type: item.type,
      title: item.title,
      caption: item.caption,
      shloka: item.shloka,
      meaning: item.meaning,
      fileKey: item.fileKey,
      thumbKey: item.thumbKey,
      ratio: item.ratio,
      palette: item.palette,
      style: item.style,
      createdAt: item.createdAt
    }));

    const response = {
      items,
      count: items.length,
      type
    };

    // Add pagination info if there are more items
    if (result.LastEvaluatedKey) {
      response.lastEvaluatedKey = encodeURIComponent(JSON.stringify(result.LastEvaluatedKey));
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal server error'
      })
    };
  }
};
