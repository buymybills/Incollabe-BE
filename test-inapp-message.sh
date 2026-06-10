#!/bin/bash
# After restarting PM2, run this to broadcast with type: "inapp_message"

curl -X POST 'https://api.teamcollabkaroo.com/api/admin/fiam-campaigns/5/broadcast' \
  -H 'accept: application/json' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiYmhhcnRpLm1pc2hyYUBnb2J1eW15YmlsbHMuY29tIiwicm9sZSI6InN1cGVyX2FkbWluIiwidHlwZSI6ImFkbWluIiwiaWF0IjoxNzc0NDE1Njk3LCJleHAiOjE3NzUwMjA0OTcsImp0aSI6ImQ0ZWJhMmYzLTgzNTctNDQ0Yy1hOGMzLWNhN2EzNWU1Njc0NiJ9.4NX1yO05nt45DjD-8l1PnvFXXKNMcY6jMPsMs-y5nfE' \
  -H 'Content-Type: application/json'

echo -e "\n\nNow the message type is 'inapp_message' - check your app for the popup!"
