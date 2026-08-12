#!/usr/bin/env bash
set -euo pipefail

BUCKET="${S3_BUCKET:-dealflow-local-bucket}"
CORS_FILE="/etc/localstack/init/cors.json"

echo "[localstack] Ensuring bucket: ${BUCKET}"
awslocal s3 mb "s3://${BUCKET}" 2>/dev/null || true

if [[ -f "${CORS_FILE}" ]]; then
  echo "[localstack] Applying CORS from ${CORS_FILE}"
  awslocal s3api put-bucket-cors --bucket "${BUCKET}" --cors-configuration "file://${CORS_FILE}"
else
  echo "[localstack] CORS file missing; applying inline defaults"
  awslocal s3api put-bucket-cors --bucket "${BUCKET}" --cors-configuration '{
    "CORSRules": [{
      "AllowedOrigins": ["http://localhost:3000", "http://127.0.0.1:3000"],
      "AllowedMethods": ["GET", "PUT", "HEAD", "POST", "DELETE"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag", "x-amz-request-id"],
      "MaxAgeSeconds": 3000
    }]
  }'
fi

echo "[localstack] S3 ready"
