#!/bin/bash
set -e

echo "Packaging Lambda functions..."

# Create temp directory
mkdir -p temp

# Package getUploadUrl
echo "Packaging getUploadUrl..."
cp src/getUploadUrl/index.js temp/
cd temp
zip -r ../get_upload_url.zip index.js
cd ..
rm -rf temp
mkdir -p temp

# Package getCatalog  
echo "Packaging getCatalog..."
cp src/getCatalog/index.js temp/
cd temp
zip -r ../get_catalog.zip index.js
cd ..
rm -rf temp
mkdir -p temp

# Package postCatalog
echo "Packaging postCatalog..."
cp src/postCatalog/index.js temp/
cd temp
zip -r ../post_catalog.zip index.js
cd ..
rm -rf temp

echo "Lambda functions packaged successfully!"
ls -la *.zip
