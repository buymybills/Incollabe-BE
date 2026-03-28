#!/bin/bash

# Test script to verify S3 CORS configuration
# This helps diagnose CORS-related issues with presigned URLs

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  S3 CORS Configuration Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get bucket name
BUCKET_NAME="${AWS_S3_BUCKET_NAME:-incollabstaging}"
read -p "Enter S3 bucket name [$BUCKET_NAME]: " input
BUCKET_NAME="${input:-$BUCKET_NAME}"

echo ""
echo -e "${YELLOW}Testing bucket: $BUCKET_NAME${NC}"
echo ""

# Test 1: Check if AWS CLI is configured
echo -e "${BLUE}[1/4]${NC} Checking AWS CLI configuration..."
if aws sts get-caller-identity &> /dev/null; then
    echo -e "${GREEN}✓${NC} AWS CLI is configured"
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    echo "   Account: $AWS_ACCOUNT"
else
    echo -e "${RED}✗${NC} AWS CLI is not configured or lacks permissions"
    exit 1
fi

echo ""

# Test 2: Check if bucket exists
echo -e "${BLUE}[2/4]${NC} Checking if bucket exists..."
if aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Bucket exists and is accessible"
else
    echo -e "${RED}✗${NC} Bucket does not exist or you don't have access"
    exit 1
fi

echo ""

# Test 3: Check CORS configuration
echo -e "${BLUE}[3/4]${NC} Checking CORS configuration..."
CORS_CONFIG=$(aws s3api get-bucket-cors --bucket "$BUCKET_NAME" 2>&1)

if echo "$CORS_CONFIG" | grep -q "NoSuchCORSConfiguration"; then
    echo -e "${RED}✗${NC} No CORS configuration found!"
    echo ""
    echo "This is the problem! You need to configure CORS."
    echo "Run: ./scripts/configure-s3-cors.sh"
    exit 1
elif echo "$CORS_CONFIG" | grep -q "AccessDenied"; then
    echo -e "${RED}✗${NC} Access denied - insufficient permissions"
    exit 1
else
    echo -e "${GREEN}✓${NC} CORS configuration exists"
    echo ""
    echo -e "${YELLOW}Current CORS configuration:${NC}"
    echo "$CORS_CONFIG" | jq '.' 2>/dev/null || echo "$CORS_CONFIG"
fi

echo ""

# Test 4: Validate CORS configuration
echo -e "${BLUE}[4/4]${NC} Validating CORS configuration..."

# Check for required methods
if echo "$CORS_CONFIG" | grep -q "PUT"; then
    echo -e "${GREEN}✓${NC} PUT method is allowed (required for uploads)"
else
    echo -e "${RED}✗${NC} PUT method is NOT allowed"
fi

if echo "$CORS_CONFIG" | grep -q "HEAD"; then
    echo -e "${GREEN}✓${NC} HEAD method is allowed"
else
    echo -e "${YELLOW}⚠${NC} HEAD method is NOT allowed (may cause issues)"
fi

# Check for ETag in ExposeHeaders
if echo "$CORS_CONFIG" | grep -q "ETag"; then
    echo -e "${GREEN}✓${NC} ETag is exposed (required for multipart uploads)"
else
    echo -e "${RED}✗${NC} ETag is NOT exposed (multipart uploads will fail)"
fi

# Check AllowedOrigins
echo ""
echo -e "${YELLOW}Checking AllowedOrigins:${NC}"
ORIGINS=$(echo "$CORS_CONFIG" | jq -r '.[0].AllowedOrigins[]' 2>/dev/null)

if [ -n "$ORIGINS" ]; then
    while IFS= read -r origin; do
        if [ "$origin" = "*" ]; then
            echo -e "${YELLOW}⚠${NC} $origin (not recommended for production)"
        else
            echo -e "${GREEN}✓${NC} $origin"
        fi
    done <<< "$ORIGINS"
else
    echo -e "${RED}✗${NC} Could not parse AllowedOrigins"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Test Complete!${NC}"
echo ""

# Provide recommendations
echo -e "${YELLOW}Recommendations:${NC}"
echo ""
echo "1. Make sure your frontend domain is in AllowedOrigins"
echo "2. Include the protocol: https://domain.com (not just domain.com)"
echo "3. For local testing, include: http://localhost:3000"
echo "4. Test the actual presigned URL from your browser"
echo ""
echo "To update CORS configuration, run:"
echo "  ./scripts/configure-s3-cors.sh"
echo ""
