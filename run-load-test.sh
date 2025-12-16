#!/bin/bash

# Load Testing Script for Collabkaroo Dev Environment
# Target: api.collabkaroo.co.in

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Collabkaroo Load Testing${NC}"
echo -e "${BLUE}  Target: api.collabkaroo.co.in${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if artillery is installed
if ! command -v artillery &> /dev/null; then
    echo -e "${RED}❌ Artillery is not installed${NC}"
    echo -e "${YELLOW}Installing Artillery...${NC}"
    npm install -g artillery
fi

# Menu
echo -e "${GREEN}Select load test type:${NC}"
echo "1) Quick Test - 200 users for 5 minutes"
echo "2) Gradual Test - Ramp up with warm-up phase"
echo "3) Custom Apache Bench test"
echo "4) Monitor server during test"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        echo -e "\n${YELLOW}Running: 200 concurrent users for 5 minutes${NC}\n"
        artillery run --output report-200users-$(date +%Y%m%d-%H%M%S).json load-test-200-users.yml
        ;;
    2)
        echo -e "\n${YELLOW}Running: Gradual load test with phases${NC}\n"
        artillery run --output report-gradual-$(date +%Y%m%d-%H%M%S).json load-test-dev.yml
        ;;
    3)
        echo -e "\n${YELLOW}Running: Apache Bench - 10,000 requests, 200 concurrent${NC}\n"
        ab -n 10000 -c 200 -g ab-results.tsv https://api.collabkaroo.co.in/health
        echo -e "\n${GREEN}Testing campaigns endpoint...${NC}"
        ab -n 5000 -c 200 https://api.collabkaroo.co.in/api/campaign
        ;;
    4)
        echo -e "\n${YELLOW}Monitor mode - Run this while load test is running${NC}\n"
        echo "Press Ctrl+C to stop monitoring"
        echo ""
        while true; do
            echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} Testing endpoints..."

            # Health check
            health_time=$(curl -o /dev/null -s -w '%{time_total}' https://api.collabkaroo.co.in/health)
            echo -e "  Health: ${health_time}s"

            # Campaigns
            campaign_time=$(curl -o /dev/null -s -w '%{time_total}' https://api.collabkaroo.co.in/api/campaign)
            echo -e "  Campaigns: ${campaign_time}s"

            echo ""
            sleep 5
        done
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo -e "\n${GREEN}✅ Load test completed!${NC}\n"

# Check if report was generated
LATEST_REPORT=$(ls -t report-*.json 2>/dev/null | head -1)
if [ -n "$LATEST_REPORT" ]; then
    echo -e "${YELLOW}Generating HTML report...${NC}"
    artillery report "$LATEST_REPORT"
    echo -e "${GREEN}HTML report generated: ${LATEST_REPORT%.json}.html${NC}"
fi

echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}Test Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo "Check the generated report for detailed metrics:"
echo "  - Response times (p50, p95, p99)"
echo "  - Request rate (requests/second)"
echo "  - Error rate"
echo "  - Throughput"
echo ""
