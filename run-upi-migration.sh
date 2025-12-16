#!/bin/bash

# Script to run UPI autopay migration on dev database
# Usage: ./run-upi-migration.sh

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Running UPI Autopay Migration${NC}\n"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ Error: DATABASE_URL environment variable not set${NC}"
    echo -e "${YELLOW}Please set it first:${NC}"
    echo -e "export DATABASE_URL='postgresql://user:pass@host:port/dbname'"
    exit 1
fi

# Display database info (hide password)
DB_INFO=$(echo $DATABASE_URL | sed 's/:\/\/[^:]*:[^@]*@/:\/\/***:***@/')
echo -e "${YELLOW}📍 Database:${NC} $DB_INFO\n"

# Run the migration
echo -e "${YELLOW}📝 Running migration: add_upi_autopay_pause_fields.sql${NC}"

psql "$DATABASE_URL" -f migrations/add_upi_autopay_pause_fields.sql

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✅ Migration completed successfully!${NC}"
else
    echo -e "\n${RED}❌ Migration failed. Check the error above.${NC}"
    exit 1
fi
