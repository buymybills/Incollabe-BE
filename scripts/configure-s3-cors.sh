#!/bin/bash

# Script to configure S3 bucket CORS settings for multipart uploads
# This fixes the 403 CORS error when using presigned URLs from the browser

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}S3 CORS Configuration Script${NC}"
echo "======================================"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    echo "Please install AWS CLI: https://aws.amazon.com/cli/"
    exit 1
fi

# Get bucket name from environment or prompt
BUCKET_NAME="${AWS_S3_BUCKET_NAME:-incollabstaging}"
read -p "Enter S3 bucket name [$BUCKET_NAME]: " input
BUCKET_NAME="${input:-$BUCKET_NAME}"

# Get frontend domains
echo ""
echo "Enter your frontend domains (comma-separated):"
echo "Example: https://app.incollabe.com,https://staging.incollabe.com,http://localhost:3000"
read -p "Domains: " DOMAINS

# Convert comma-separated domains to JSON array
IFS=',' read -ra DOMAIN_ARRAY <<< "$DOMAINS"
DOMAIN_JSON=""
for domain in "${DOMAIN_ARRAY[@]}"; do
    domain=$(echo "$domain" | xargs) # trim whitespace
    if [ -z "$DOMAIN_JSON" ]; then
        DOMAIN_JSON="\"$domain\""
    else
        DOMAIN_JSON="$DOMAIN_JSON, \"$domain\""
    fi
done

# Create CORS configuration
CORS_CONFIG=$(cat <<EOF
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            $DOMAIN_JSON
        ],
        "ExposeHeaders": [
            "ETag",
            "x-amz-server-side-encryption",
            "x-amz-request-id",
            "x-amz-id-2",
            "x-amz-version-id"
        ],
        "MaxAgeSeconds": 3600
    }
]
EOF
)

echo ""
echo -e "${YELLOW}CORS Configuration to be applied:${NC}"
echo "$CORS_CONFIG"
echo ""

read -p "Apply this CORS configuration to bucket '$BUCKET_NAME'? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Save to temp file
    TEMP_FILE=$(mktemp)
    echo "$CORS_CONFIG" > "$TEMP_FILE"

    # Apply CORS configuration
    echo -e "${YELLOW}Applying CORS configuration...${NC}"

    if aws s3api put-bucket-cors --bucket "$BUCKET_NAME" --cors-configuration "file://$TEMP_FILE"; then
        echo -e "${GREEN}✓ CORS configuration applied successfully!${NC}"
        echo ""
        echo "You can verify the configuration with:"
        echo "  aws s3api get-bucket-cors --bucket $BUCKET_NAME"
    else
        echo -e "${RED}✗ Failed to apply CORS configuration${NC}"
        echo "Make sure you have the necessary AWS permissions"
        exit 1
    fi

    # Cleanup
    rm "$TEMP_FILE"
else
    echo "Operation cancelled"
    exit 0
fi

echo ""
echo -e "${GREEN}Done!${NC}"
echo ""
echo "Next steps:"
echo "1. Test your presigned URLs from the frontend"
echo "2. If still having issues, check:"
echo "   - Frontend is using correct domains"
echo "   - S3 bucket policy allows the required actions"
echo "   - CloudFront (if used) has proper CORS settings"
