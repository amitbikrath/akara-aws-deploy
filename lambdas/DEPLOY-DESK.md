# Deploying the Editorial Desk (manual, one Lambda at a time)

Order: twitter → instagram → times. Check one poll runs clean before the next.

```bash
cd akara/lambdas && ./package-desk.sh
```

1. Publish the layer once. Copy the `LayerVersionArn` it prints.
```bash
aws lambda publish-layer-version --region us-east-1 --layer-name akara-editorial-desk \
  --compatible-runtimes nodejs20.x --zip-file fileb://dist/editorial-desk-layer.zip \
  --query LayerVersionArn --output text
```

2. Per Lambda (replace ARN and names):
```bash
aws lambda update-function-configuration --region us-east-1 --function-name akara-twitter-poller --layers <ARN>
aws lambda wait function-updated --region us-east-1 --function-name akara-twitter-poller
aws lambda update-function-code --region us-east-1 --function-name akara-twitter-poller --zip-file fileb://dist/twitter_poller.zip
```

3. Verify: invoke and read the wire JSON.
```bash
aws lambda invoke --region us-east-1 --function-name akara-twitter-poller --payload '{}' /dev/stdout
```

Rollback: the previous zips are in `~/…/scratchpad/live/*.zip` from the 2026-09-04 review, and `*.pre-desk.bak` sits beside each `index.js`. `update-function-code` with the old zip and `--layers` with an empty list restores it.

Note: `times_daily` keeps `@aws-sdk/client-s3` for `GetObject` (feed read) — the package script excludes only the modules the layer supplies. Terraform does not manage these Lambdas; do not `terraform apply` for this.
