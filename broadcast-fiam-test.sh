#!/bin/bash

# Activate campaign 5
echo "Activating campaign..."
curl -X 'PATCH' \
  'https://api.teamcollabkaroo.com/api/admin/fiam-campaigns/5/status' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYmhhcnRpLm1pc2hyYUBnb2J1eW15YmlsbHMuY29tIiwicm9sZSI6InN1cGVyX2FkbWluIiwidHlwZSI6ImFkbWluIiwiaWF0IjoxNzc0NDE1Njk3LCJleHAiOjE3NzUwMjA0OTcsImp0aSI6ImQ0ZWJhMmYzLTgzNTctNDQ0Yy1hOGMzLWNhN2EzNWU1Njc0NiJ9.4NX1yO05nt45DjD-8l1PnvFXXKNMcY6jMPsMs-y5nfE' \
  -H 'Content-Type: application/json' \
  -d '{"status": "active"}'

echo -e "\n\nBroadcasting campaign..."
curl -X 'POST' \
  'https://api.teamcollabkaroo.com/api/admin/fiam-campaigns/5/broadcast' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYmhhcnRpLm1pc2hyYUBnb2J1eW15YmlsbHMuY29tIiwicm9sZSI6InN1cGVyX2FkbWluIiwidHlwZSI6ImFkbWluIiwiaWF0IjoxNzc0NDE1Njk3LCJleHAiOjE3NzUwMjA0OTcsImp0aSI6ImQ0ZWJhMmYzLTgzNTctNDQ0Yy1hOGMzLWNhN2EzNWU1Njc0NiJ9.4NX1yO05nt45DjD-8l1PnvFXXKNMcY6jMPsMs-y5nfE' \
  -H 'Content-Type: application/json'

echo -e "\n\nDone!"
