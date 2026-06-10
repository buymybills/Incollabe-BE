#!/bin/bash

# Migration Runner Script for 30-Day Return Period
# This script helps you run the migration and verify it worked

echo "======================================"
echo "30-Day Return Period Migration Runner"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if migration file exists
if [ ! -f "migrations/add_return_period_tracking.sql" ]; then
    echo -e "${RED}ERROR: Migration file not found!${NC}"
    echo "Expected: migrations/add_return_period_tracking.sql"
    exit 1
fi

echo -e "${GREEN}✓ Migration file found${NC}"
echo ""

# Prompt for database connection details
echo "Please provide database connection details:"
echo "(Press Enter to use default values shown in brackets)"
echo ""

read -p "Database host [localhost]: " DB_HOST
DB_HOST=${DB_HOST:-localhost}

read -p "Database port [5432]: " DB_PORT
DB_PORT=${DB_PORT:-5432}

read -p "Database name: " DB_NAME
if [ -z "$DB_NAME" ]; then
    echo -e "${RED}ERROR: Database name is required${NC}"
    exit 1
fi

read -p "Database user: " DB_USER
if [ -z "$DB_USER" ]; then
    echo -e "${RED}ERROR: Database user is required${NC}"
    exit 1
fi

read -sp "Database password: " DB_PASSWORD
echo ""
echo ""

# Test database connection
echo "Testing database connection..."
export PGPASSWORD=$DB_PASSWORD
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT 1" > /dev/null 2>&1

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Cannot connect to database${NC}"
    echo "Please check your connection details and try again"
    exit 1
fi

echo -e "${GREEN}✓ Database connection successful${NC}"
echo ""

# Step 1: Run verification script first
echo "======================================"
echo "Step 1: Checking current state..."
echo "======================================"
echo ""

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f scripts/verify-migration.sql

echo ""
read -p "Do you want to continue with migration? (y/n): " CONTINUE

if [ "$CONTINUE" != "y" ] && [ "$CONTINUE" != "Y" ]; then
    echo "Migration cancelled"
    exit 0
fi

# Step 2: Backup current schema
echo ""
echo "======================================"
echo "Step 2: Creating backup..."
echo "======================================"
echo ""

BACKUP_FILE="backups/hype_store_orders_backup_$(date +%Y%m%d_%H%M%S).sql"
mkdir -p backups

echo "Creating backup of hype_store_orders table..."
pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
    -t hype_store_orders --schema-only > $BACKUP_FILE

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}WARNING: Backup failed, but continuing...${NC}"
fi

# Step 3: Run migration
echo ""
echo "======================================"
echo "Step 3: Running migration..."
echo "======================================"
echo ""

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME \
    -f migrations/add_return_period_tracking.sql

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migration completed successfully${NC}"
else
    echo -e "${RED}ERROR: Migration failed${NC}"
    echo "Check error messages above"
    echo "You can restore from: $BACKUP_FILE"
    exit 1
fi

# Step 4: Verify migration
echo ""
echo "======================================"
echo "Step 4: Verifying migration..."
echo "======================================"
echo ""

# Check if columns exist
COLUMN_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_name = 'hype_store_orders'
    AND column_name IN ('return_period_days', 'return_period_ends_at', 'visible_to_influencer', 'visibility_checked_at')
")

if [ "$COLUMN_COUNT" -eq 4 ]; then
    echo -e "${GREEN}✓ All 4 columns created successfully${NC}"
else
    echo -e "${RED}ERROR: Expected 4 columns, found $COLUMN_COUNT${NC}"
    exit 1
fi

# Check if trigger exists
TRIGGER_COUNT=$(psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
    SELECT COUNT(*)
    FROM information_schema.triggers
    WHERE trigger_name = 'trigger_set_return_period_ends_at'
")

if [ "$TRIGGER_COUNT" -eq 1 ]; then
    echo -e "${GREEN}✓ Trigger created successfully${NC}"
else
    echo -e "${RED}ERROR: Trigger not found${NC}"
    exit 1
fi

# Step 5: Show summary
echo ""
echo "======================================"
echo "Migration Summary"
echo "======================================"
echo ""

psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
    SELECT
        COUNT(*) as total_orders,
        SUM(CASE WHEN visible_to_influencer = true THEN 1 ELSE 0 END) as visible_orders,
        SUM(CASE WHEN visible_to_influencer = false THEN 1 ELSE 0 END) as hidden_orders,
        SUM(CASE WHEN return_period_ends_at <= NOW() AND visible_to_influencer = false AND order_status NOT IN ('returned', 'cancelled') THEN 1 ELSE 0 END) as should_be_visible
    FROM hype_store_orders;
"

echo ""
echo -e "${GREEN}======================================"
echo "Migration completed successfully!"
echo "======================================${NC}"
echo ""
echo "Next steps:"
echo "1. Restart your application: npm run start:dev"
echo "2. Check logs for scheduler startup"
echo "3. Test with a new order webhook"
echo "4. Verify orders are hidden initially"
echo ""
echo "See TESTING_GUIDE.md for detailed testing steps"
echo ""

# Unset password
unset PGPASSWORD
