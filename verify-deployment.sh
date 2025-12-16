#!/bin/bash

echo "==================================="
echo "Deployment Verification Script"
echo "==================================="
echo ""

echo "1. Checking current Docker image on EC2..."
docker images | grep buymybills/incollab

echo ""
echo "2. Checking Docker Hub for latest image timestamp..."
echo "   Visit: https://hub.docker.com/r/buymybills/incollab/tags"

echo ""
echo "3. Current running container..."
docker ps | grep incollab

echo ""
echo "4. Checking .env IMAGE_TAG..."
cat .env | grep IMAGE_TAG

echo ""
echo "5. Forcing image pull and restart..."
read -p "Do you want to force pull and restart? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "Stopping containers..."
    docker compose down
    
    echo "Removing old image..."
    docker rmi buymybills/incollab:dev -f
    
    echo "Pulling latest image..."
    docker compose pull
    
    echo "Starting containers..."
    docker compose up -d
    
    echo "Waiting 5 seconds..."
    sleep 5
    
    echo "Checking logs for 'Database Configuration'..."
    docker compose logs incollab-app | grep -A 10 "Database Configuration"
    
    echo ""
    echo "Full logs (last 50 lines):"
    docker compose logs --tail=50 incollab-app
fi

echo ""
echo "==================================="
echo "Verification Complete"
echo "==================================="
