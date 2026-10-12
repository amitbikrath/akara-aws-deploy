const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(client);

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    // Get query parameters
    const queryParams = event.queryStringParameters || {};
    const { type, limit = '50', includeArchived = 'false' } = queryParams;
    const lastEvaluatedKey =
      queryParams.lastEvaluatedKey || queryParams.lastKey;
    const showArchived = String(includeArchived).toLowerCase() === 'true';

    // Validate type
    if (!type || !['wallpaper', 'music', 'site'].includes(type)) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Type parameter must be "wallpaper", "music", or "site"'
        })
      };
    }

    // Query by type using the GSI (type + createdAt)
    const queryInput = {
      TableName: process.env.CATALOG_TABLE,
      IndexName: 'TypeIndex',
      KeyConditionExpression: '#type = :type',
      ExpressionAttributeNames: {
        '#type': 'type'
      },
      ExpressionAttributeValues: {
        ':type': type
      },
      Limit: parseInt(limit, 10),
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
    const items = (result.Items || [])
      .filter((item) => showArchived || !item.archived)
      .map(item => ({
      id: item.pk.split('#')[1],
      version: item.sk.split('#')[1],
      type: item.type,
      title: item.title,
      caption: item.caption,
      shloka: item.shloka,
      meaning: item.meaning,
      body: item.body,
      contactEmail: item.contactEmail,
      contactPhone: item.contactPhone,
      contactAddress: item.contactAddress,
      contactInstagram: item.contactInstagram,
      storyImageKey: item.storyImageKey,
      fileKey: item.fileKey,
      thumbKey: item.thumbKey,
      mediaType: item.mediaType,
      mimeType: item.mimeType,
      lyrics: item.lyrics,
      albumArtKey: item.albumArtKey,
      ratio: item.ratio,
      palette: item.palette,
      style: item.style,
      // AI-organized metadata (same vocabulary as the iOS app's MediaItem):
      // populated by the admin Organize queue or passed through from iOS uploads.
      deities: item.deities || [],
      moodTag: item.moodTag || '',
      tags: item.tags || [],
      orientation: item.orientation || '',
      // Darśana facets: form/couple/bhava are set only when the owner approves
      // in admin Organize; colours are computed by akara/scripts/darshan_suggest.py.
      form: item.form || '',
      couple: item.couple || '',
      bhava: item.bhava || '',
      accentColor: item.accentColor || '',
      heroFor: Array.isArray(item.heroFor) ? item.heroFor : [],
      // Unapproved AI tags — only the Darśana staging preview (?preview=1) reads these.
      aiPreview: item.aiSuggestion && !item.organizedAt ? {
        title: item.aiSuggestion.title, form: item.aiSuggestion.form,
        deities: item.aiSuggestion.deities, couple: item.aiSuggestion.couple,
        bhava: item.aiSuggestion.bhava, confidence: item.aiSuggestion.confidence,
      } : null,
      colors: Array.isArray(item.colors) ? item.colors.map((c) => ({ hex: c.hex, pct: Number(c.pct) })) : [],
      // Carousel slides (extra fileKeys after the cover), see post_catalog.
      slideKeys: Array.isArray(item.slideKeys) ? item.slideKeys : [],
      // "strip" = one artwork cut into strips (panorama); "carousel" = separate
      // images. Missing on older rows → the site treats them as "strip".
      layout: item.layout || '',
      organizedAt: item.organizedAt || null,
      createdAt: item.createdAt,
      archived: Boolean(item.archived),
      archivedAt: item.archivedAt || null,
      // Phase 3: visibility + freemium teaser flags need to flow back to
      // both admin (so the toggle reflects current state) and the public
      // mini-site (so it can render the FREE badge).
      hiddenFromPublic: Boolean(item.hiddenFromPublic),
      freePreview: Boolean(item.freePreview)
    }));

    const response = {
      ok: true,
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



