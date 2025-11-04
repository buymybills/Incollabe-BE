# Campaign Dashboard: Two-Dropdown Date Range Design

## Overview

The campaign dashboard uses a **two-dropdown design** to provide better UX by separating time series chart controls from aggregate metrics controls:

1. **Chart Dropdown** - Controls the "Campaign Posted vs Applications Received" time series chart
2. **Metrics Dropdown** - Controls all aggregate data (campaign counts, city presence, categories)

This design allows users to:
- View detailed recent trends in the chart (Last 24 hours, 3 days, 7 days, etc.)
- Analyze longer-term aggregate data (Sep 2025 - Oct 2025, Oct 2025 - Nov 2025, etc.)

## API Endpoint

### GET /api/admin/dashboard/campaigns

**Query Parameters:**

```typescript
{
  // For time series chart (Campaign Posted vs Applications Received)
  chartTimeFrame?: 'last_24_hours' | 'last_3_days' | 'last_7_days' | 'last_15_days' | 'last_30_days' | 'custom',
  chartStartDate?: string,  // Format: YYYY-MM-DD (required if chartTimeFrame = 'custom')
  chartEndDate?: string,    // Format: YYYY-MM-DD (required if chartTimeFrame = 'custom')
  
  // For aggregate metrics (cards, city presence, categories)
  metricsStartDate?: string,  // Format: YYYY-MM-DD (e.g., '2025-09-01')
  metricsEndDate?: string,    // Format: YYYY-MM-DD (e.g., '2025-10-31')
}
```

**Default Values:**
- `chartTimeFrame`: `last_7_days` (if not provided)
- `metricsStartDate`/`metricsEndDate`: Uses same date range as `chartTimeFrame` if not provided

## Example Requests

### 1. Chart: Last 7 days, Metrics: Sep - Oct 2025

```bash
GET /api/admin/dashboard/campaigns?chartTimeFrame=last_7_days&metricsStartDate=2025-09-01&metricsEndDate=2025-10-31
```

**Result:**
- Time series chart shows data from last 7 days
- Campaign metrics, city presence, and categories show data from Sep 1 - Oct 31, 2025

### 2. Chart: Last 24 hours, Metrics: Oct - Nov 2025

```bash
GET /api/admin/dashboard/campaigns?chartTimeFrame=last_24_hours&metricsStartDate=2025-10-01&metricsEndDate=2025-11-30
```

**Result:**
- Time series chart shows hourly data from last 24 hours
- Campaign metrics, city presence, and categories show data from Oct 1 - Nov 30, 2025

### 3. Custom date ranges for both

```bash
GET /api/admin/dashboard/campaigns?chartTimeFrame=custom&chartStartDate=2025-11-01&chartEndDate=2025-11-07&metricsStartDate=2025-10-01&metricsEndDate=2025-11-30
```

**Result:**
- Time series chart shows data from Nov 1-7, 2025
- Campaign metrics, city presence, and categories show data from Oct 1 - Nov 30, 2025

### 4. Default behavior (no parameters)

```bash
GET /api/admin/dashboard/campaigns
```

**Result:**
- Chart uses `last_7_days` by default
- Metrics use the same last 7 days date range

## Response Structure

```typescript
{
  // Uses METRICS date range (metricsStartDate to metricsEndDate)
  campaignMetrics: {
    totalCampaigns: { count: 100, percentageChange: 10 },
    campaignsLive: { count: 50, percentageChange: 5 },
    campaignsCompleted: { count: 40, percentageChange: 2 },
    totalCampaignApplications: 500
  },
  
  // Uses METRICS date range
  totalCityPresence: 25,
  
  // Uses METRICS date range
  citiesWithMostActiveCampaigns: [
    { cityName: 'Mumbai', percentage: 30 },
    { cityName: 'Delhi', percentage: 25 },
    { cityName: 'Bangalore', percentage: 20 },
    { cityName: 'Others', percentage: 25 }
  ],
  
  // Uses CHART date range (chartTimeFrame or chartStartDate/chartEndDate)
  campaignPostedVsApplications: {
    currentVerifiedProfileApplicants: 300,
    currentUnverifiedProfileApplicants: 200,
    timeSeriesData: [
      {
        date: '2025-11-01',
        campaignsPosted: 10,
        applicationsReceived: 50
      },
      // ...more time series data
    ]
  },
  
  // Uses METRICS date range
  campaignCategoryDistribution: [
    { categoryName: 'Fashion', campaignCount: 40, percentage: 40 },
    { categoryName: 'Tech', campaignCount: 30, percentage: 30 },
    { categoryName: 'Food', campaignCount: 20, percentage: 20 },
    { categoryName: 'Travel', campaignCount: 10, percentage: 10 }
  ]
}
```

## Implementation Details

### Controller (admin.controller.ts)

```typescript
@Get('dashboard/campaigns')
@UseGuards(AdminAuthGuard)
@ApiOperation({ summary: 'Get campaign dashboard statistics' })
async getCampaignDashboardStats(
  @Query() requestDto: CampaignDashboardRequestDto,
): Promise<CampaignDashboardResponseDto> {
  return await this.dashboardStatsService.getCampaignDashboardStats(
    requestDto.chartTimeFrame || DashboardTimeFrame.LAST_7_DAYS,
    requestDto.chartStartDate,
    requestDto.chartEndDate,
    requestDto.metricsStartDate,
    requestDto.metricsEndDate,
  );
}
```

### Service (dashboard-stats.service.ts)

```typescript
async getCampaignDashboardStats(
  chartTimeFrame: DashboardTimeFrame,
  chartStartDateStr?: string,
  chartEndDateStr?: string,
  metricsStartDateStr?: string,
  metricsEndDateStr?: string,
): Promise<CampaignDashboardResponseDto> {
  // Calculate chart date range
  const { startDate: chartStartDate, endDate: chartEndDate } = 
    this.getDateRangeForTimeFrame(chartTimeFrame, chartStartDateStr, chartEndDateStr);
  
  // Calculate metrics date range (or use chart range as fallback)
  let metricsStartDate: Date, metricsEndDate: Date;
  if (metricsStartDateStr && metricsEndDateStr) {
    metricsStartDate = new Date(metricsStartDateStr);
    metricsEndDate = new Date(metricsEndDateStr);
  } else {
    // Fallback to chart date range
    metricsStartDate = chartStartDate;
    metricsEndDate = chartEndDate;
  }
  
  // Calculate previous period for percentage change (same duration as metrics period)
  const daysDiff = Math.ceil(
    (metricsEndDate.getTime() - metricsStartDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const previousPeriodEnd = new Date(metricsStartDate);
  previousPeriodEnd.setDate(previousPeriodEnd.getDate() - 1);
  const previousPeriodStart = new Date(previousPeriodEnd);
  previousPeriodStart.setDate(previousPeriodStart.getDate() - daysDiff + 1);
  
  // Fetch data with appropriate date ranges
  const [
    totalCampaigns,
    campaignsLive,
    campaignsCompleted,
    previousPeriodTotalCampaigns,
    // ...more queries using metricsStartDate/metricsEndDate
  ] = await Promise.all([
    this.campaignModel.count({
      where: {
        isActive: true,
        createdAt: { [Op.between]: [metricsStartDate, metricsEndDate] },
      },
    }),
    // ...
  ]);
  
  // Get metrics (all use metrics date range)
  const totalCityPresence = await this.getCampaignCityPresence(
    metricsStartDate,
    metricsEndDate,
  );
  
  const citiesWithMostActiveCampaigns = await this.getCitiesWithMostActiveCampaigns(
    metricsStartDate,
    metricsEndDate,
  );
  
  // Get time series (uses chart date range)
  const campaignPostedVsApplications = await this.getCampaignPostedVsApplications(
    chartStartDate,
    chartEndDate,
  );
  
  const campaignCategoryDistribution = await this.getCampaignCategoryDistribution(
    metricsStartDate,
    metricsEndDate,
  );
  
  return {
    campaignMetrics,
    totalCityPresence,
    citiesWithMostActiveCampaigns,
    campaignPostedVsApplications,
    campaignCategoryDistribution,
  };
}
```

## Frontend Integration Guide

### State Management

```typescript
interface DashboardState {
  // Chart dropdown
  chartTimeFrame: 'last_24_hours' | 'last_3_days' | 'last_7_days' | 'last_15_days' | 'last_30_days' | 'custom';
  chartStartDate?: string;
  chartEndDate?: string;
  
  // Metrics dropdown
  metricsStartDate: string;
  metricsEndDate: string;
  
  // Dashboard data
  dashboardData: CampaignDashboardResponse | null;
}
```

### Example React/Vue Component

```typescript
// Chart Dropdown Options
const chartOptions = [
  { value: 'last_24_hours', label: 'Last 24 hours' },
  { value: 'last_3_days', label: 'Last 3 days' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_15_days', label: 'Last 15 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
];

// Metrics Dropdown Options (Monthly ranges)
const metricsOptions = [
  { 
    value: { start: '2025-09-01', end: '2025-10-31' },
    label: 'Sep 2025 - Oct 2025'
  },
  { 
    value: { start: '2025-10-01', end: '2025-11-30' },
    label: 'Oct 2025 - Nov 2025'
  },
  { 
    value: { start: '2025-11-01', end: '2025-12-31' },
    label: 'Nov 2025 - Dec 2025'
  },
];

// Fetch dashboard data
async function fetchDashboardData(
  chartTimeFrame: string,
  metricsStartDate: string,
  metricsEndDate: string,
) {
  const params = new URLSearchParams({
    chartTimeFrame,
    metricsStartDate,
    metricsEndDate,
  });
  
  const response = await fetch(`/api/admin/dashboard/campaigns?${params}`);
  return response.json();
}

// Handle chart dropdown change
function onChartTimeFrameChange(newTimeFrame: string) {
  fetchDashboardData(
    newTimeFrame,
    state.metricsStartDate,
    state.metricsEndDate,
  );
}

// Handle metrics dropdown change
function onMetricsRangeChange(newStartDate: string, newEndDate: string) {
  fetchDashboardData(
    state.chartTimeFrame,
    newStartDate,
    newEndDate,
  );
}
```

### UI Layout Recommendation

```
┌─────────────────────────────────────────────────────────────┐
│  Campaign Dashboard                                          │
│                                                              │
│  ┌──────────────────┐    ┌─────────────────────────────┐   │
│  │ Chart Dropdown   │    │ Metrics Dropdown            │   │
│  │ Last 7 days ▼    │    │ Sep 2025 - Oct 2025 ▼       │   │
│  └──────────────────┘    └─────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Campaign Posted vs Applications Received             │   │
│  │ (Uses chart dropdown timeframe)                      │   │
│  │                                                       │   │
│  │  [Time Series Chart]                                 │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│  │ Total      │ │ Live       │ │ Completed  │ │ Total    │ │
│  │ Campaigns  │ │ Campaigns  │ │ Campaigns  │ │ Apps     │ │
│  │ 100 (+10%) │ │ 50 (+5%)   │ │ 40 (+2%)   │ │ 500      │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────┘ │
│  (All use metrics dropdown date range)                      │
│                                                              │
│  ┌──────────────────┐    ┌──────────────────────────────┐   │
│  │ City Presence    │    │ Campaign Categories          │   │
│  │ 25 cities        │    │ Fashion: 40%                 │   │
│  │                  │    │ Tech: 30%                    │   │
│  │ Top Cities:      │    │ Food: 20%                    │   │
│  │ Mumbai: 30%      │    │ Travel: 10%                  │   │
│  │ Delhi: 25%       │    │                              │   │
│  │ Bangalore: 20%   │    │                              │   │
│  │ Others: 25%      │    │                              │   │
│  └──────────────────┘    └──────────────────────────────┘   │
│  (Both use metrics dropdown date range)                     │
└─────────────────────────────────────────────────────────────┘
```

## Benefits of Two-Dropdown Design

1. **Granular Chart Analysis**: Users can view hourly/daily trends (24h, 3d, 7d) in the time series chart
2. **Long-term Metrics**: Campaign counts, city presence, and categories can analyze monthly data
3. **Flexible Comparison**: Compare recent chart trends against longer historical aggregate data
4. **Better UX**: Separate controls prevent overwhelming users with single unified timeframe
5. **Performance**: Chart can use shorter ranges (less data to plot) while metrics use longer ranges

## Migration from Single Dropdown

If you previously had a single `timeFrame` parameter:

**Old Request:**
```bash
GET /api/admin/dashboard/campaigns?timeFrame=last_7_days
```

**New Equivalent (backward compatible):**
```bash
GET /api/admin/dashboard/campaigns?chartTimeFrame=last_7_days
# Both chart and metrics will use last 7 days
```

**New with Separate Ranges:**
```bash
GET /api/admin/dashboard/campaigns?chartTimeFrame=last_7_days&metricsStartDate=2025-09-01&metricsEndDate=2025-10-31
# Chart uses last 7 days, metrics use Sep-Oct 2025
```

## Testing

All existing tests have been updated to reflect the new 5-parameter signature. Example test:

```typescript
it('should handle custom date range', async () => {
  const requestDto = {
    chartTimeFrame: DashboardTimeFrame.CUSTOM,
    chartStartDate: '2025-01-01',
    chartEndDate: '2025-01-31',
    metricsStartDate: '2025-01-01',
    metricsEndDate: '2025-01-31',
  };

  const result = await controller.getCampaignDashboardStats(requestDto);

  expect(mockService.getCampaignDashboardStats).toHaveBeenCalledWith(
    DashboardTimeFrame.CUSTOM,
    '2025-01-01',
    '2025-01-31',
    '2025-01-01',
    '2025-01-31',
  );
});
```

## Notes

- All aggregate data (campaign counts, city presence, categories) use the **metrics date range**
- Only the time series chart uses the **chart date range**
- Percentage changes for campaign metrics compare current metrics period against previous period of same duration
- If metrics dates are not provided, the system falls back to using the chart date range for all data
