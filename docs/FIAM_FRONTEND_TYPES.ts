/**
 * FIAM Campaign - Frontend TypeScript Types
 *
 * Complete type definitions for creating and managing FIAM campaigns
 * from the admin panel frontend.
 *
 * Generated: 2026-03-28
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum LayoutType {
  CARD = 'card',
  MODAL = 'modal',
  BANNER = 'banner',
  TOP_BANNER = 'top_banner',
  IMAGE_ONLY = 'image_only',
}

export enum CampaignStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
}

export enum TriggerType {
  EVENT = 'event',
  SCHEDULED = 'scheduled',
}

export enum TriggerEvent {
  APP_OPEN = 'app_open',
  SCREEN_VIEW_HOME = 'screen_view_home',
  SCREEN_VIEW_CAMPAIGNS = 'screen_view_campaigns',
  SCREEN_VIEW_PROFILE = 'screen_view_profile',
  SCREEN_VIEW_WALLET = 'screen_view_wallet',
  SCREEN_VIEW_HYPE_STORE = 'screen_view_hype_store',
  PROFILE_VIEW_SELF = 'profile_view_self',
  POST_CREATE = 'post_create',
  CAMPAIGN_APPLICATION_SUBMITTED = 'campaign_application_submitted',
  LOW_CREDITS = 'low_credits',
  OUT_OF_CREDITS = 'out_of_credits',
}

export enum EventType {
  IMPRESSION = 'impression',
  CLICK = 'click',
  DISMISS = 'dismiss',
  CONVERSION = 'conversion',
}

export type UserType = 'influencer' | 'brand';
export type Gender = 'male' | 'female' | 'others' | null;

// ============================================================================
// STEP 1: STYLE AND CONTENT
// ============================================================================

export interface ButtonConfig {
  text: string;
  actionUrl: string;
  backgroundColor: string;
  textColor: string;
}

export interface UIConfig {
  layoutType: LayoutType;
  backgroundColor: string;
  textColor: string;
  title: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string; // For banner/image_only layouts (entire element is clickable)
  buttonConfig?: ButtonConfig; // For modal/card layouts (explicit buttons)
  secondaryButtonConfig?: ButtonConfig;
}

// ============================================================================
// STEP 2: TARGETING
// ============================================================================

export interface BehaviorFilters {
  isPro?: boolean | null; // true = Pro only, false = non-Pro only, null = all
  minFollowers?: number;
  maxFollowers?: number;
  minCredits?: number;
  maxCredits?: number;
  minApplications?: number;
  maxApplications?: number;
}

export interface TargetingConfig {
  targetUserTypes?: UserType[];
  targetGender?: Gender;
  targetMinAge?: number;
  targetMaxAge?: number;
  targetIsPanIndia?: boolean;
  targetLocations?: string[]; // City names
  targetNicheIds?: number[];
  targetSpecificUserIds?: number[];
  targetBehaviorFilters?: BehaviorFilters;
}

// ============================================================================
// STEP 3: SCHEDULING
// ============================================================================

export interface SchedulingConfig {
  name: string;
  internalName?: string;
  description?: string;
  scheduledAt?: string; // ISO 8601 date string
  startDate?: string; // ISO 8601 date string
  endDate?: string; // ISO 8601 date string
  status: CampaignStatus;
}

// ============================================================================
// STEP 4: KEY EVENTS & FREQUENCY
// ============================================================================

export interface FrequencyConfig {
  maxImpressionsPerUser?: number;
  maxImpressionsPerDay?: number;
  cooldownHours?: number;
  globalMaxImpressions?: number;
}

export interface KeyEventsConfig {
  triggerType: TriggerType;
  triggerEvents?: TriggerEvent[];
  conversionEvent?: string;
  conversionWindowHours?: number;
  frequencyConfig?: FrequencyConfig;
}

// ============================================================================
// COMPLETE CAMPAIGN REQUEST
// ============================================================================

export interface CreateCampaignRequest {
  // Step 3: Scheduling
  name: string;
  internalName?: string;
  description?: string;

  // Step 1: UI Configuration
  uiConfig: UIConfig;

  // Step 4: Trigger Configuration
  triggerType: TriggerType;
  triggerEvents?: TriggerEvent[];
  scheduledAt?: string;

  // Step 2: Targeting
  targetUserTypes?: UserType[];
  targetGender?: Gender;
  targetMinAge?: number;
  targetMaxAge?: number;
  targetIsPanIndia?: boolean;
  targetLocations?: string[];
  targetNicheIds?: number[];
  targetSpecificUserIds?: number[];
  targetBehaviorFilters?: BehaviorFilters;

  // Step 4: Frequency & Conversion
  frequencyConfig?: FrequencyConfig;
  conversionEvent?: string;
  conversionWindowHours?: number;

  // Step 3: Date Range
  startDate?: string;
  endDate?: string;

  // Additional
  priority?: number;
  internalNotes?: string;
  status: CampaignStatus;
}

export interface UpdateCampaignRequest {
  name?: string;
  internalName?: string;
  description?: string;
  priority?: number;
  uiConfig?: UIConfig;
  triggerType?: TriggerType;
  triggerEvents?: TriggerEvent[];
  scheduledAt?: string;
  targetUserTypes?: UserType[];
  targetGender?: Gender;
  targetMinAge?: number;
  targetMaxAge?: number;
  targetIsPanIndia?: boolean;
  targetLocations?: string[];
  targetNicheIds?: number[];
  targetSpecificUserIds?: number[];
  targetBehaviorFilters?: BehaviorFilters;
  frequencyConfig?: FrequencyConfig;
  startDate?: string;
  endDate?: string;
  conversionEvent?: string;
  conversionWindowHours?: number;
  internalNotes?: string;
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface CampaignAnalytics {
  id: number;
  name: string;
  totalImpressions: number;
  totalClicks: number;
  totalDismissals: number;
  totalConversions: number;
  conversionRate: number;
  clickThroughRate: number;
  dismissalRate: number;
}

export interface CampaignResponse {
  id: number;
  name: string;
  internalName: string | null;
  description: string | null;
  status: CampaignStatus;
  priority: number;
  uiConfig: UIConfig;
  triggerType: TriggerType;
  triggerEvents: TriggerEvent[] | null;
  scheduledAt: string | null;
  targetUserTypes: UserType[] | null;
  targetGender: Gender;
  targetMinAge: number | null;
  targetMaxAge: number | null;
  targetLocations: string[] | null;
  targetIsPanIndia: boolean;
  targetNicheIds: number[] | null;
  targetSpecificUserIds: number[] | null;
  targetBehaviorFilters: BehaviorFilters | null;
  frequencyConfig: FrequencyConfig | null;
  startDate: string | null;
  endDate: string | null;
  totalImpressions: number;
  totalClicks: number;
  totalDismissals: number;
  totalConversions: number;
  conversionEvent: string | null;
  conversionWindowHours: number;
  createdBy: number;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  analytics: CampaignAnalytics;
}

export interface CampaignListResponse {
  campaigns: CampaignResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface BroadcastResponse {
  success: boolean;
  totalSent: number;
  eligibleUsers: number;
  errors: number;
  message: string;
}

export interface AnalyticsSummaryResponse {
  totalCampaigns: number;
  activeCampaigns: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  averageConversionRate: number;
  averageClickThroughRate: number;
}

// ============================================================================
// WIZARD FORM DATA (Frontend State Management)
// ============================================================================

export interface WizardFormData {
  step1: {
    layoutType: LayoutType;
    backgroundColor: string;
    textColor: string;
    title: string;
    body: string;
    imageUrl?: string;
    actionUrl?: string;
    buttonText?: string;
    buttonActionUrl?: string;
    buttonBackgroundColor?: string;
    buttonTextColor?: string;
    secondaryButtonText?: string;
    secondaryButtonActionUrl?: string;
  };

  step2: {
    userTypes: UserType[];
    gender?: Gender;
    minAge?: number;
    maxAge?: number;
    isPanIndia: boolean;
    locations: string[];
    nicheIds: number[];
    specificUserIds: number[];
    isPro?: boolean | null;
    minFollowers?: number;
    maxFollowers?: number;
    minCredits?: number;
    maxCredits?: number;
  };

  step3: {
    campaignName: string;
    internalName?: string;
    description?: string;
    publishImmediately: boolean;
    scheduledAt?: string;
    startDate?: string;
    endDate?: string;
  };

  step4: {
    triggerType: TriggerType;
    triggerEvents: TriggerEvent[];
    conversionEvent?: string;
    conversionWindowHours: number;
    maxImpressionsPerUser?: number;
    cooldownHours?: number;
    maxImpressionsPerDay?: number;
    globalMaxImpressions?: number;
  };
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export interface Niche {
  id: number;
  name: string;
}

export interface City {
  id: number;
  name: string;
  stateId: number;
  stateName?: string;
}

export interface SelectOption {
  label: string;
  value: string | number;
}

// ============================================================================
// API CLIENT FUNCTIONS (Example Usage)
// ============================================================================

/**
 * Example API client functions your frontend can use
 */
export class FiamCampaignAPI {
  private baseUrl: string;
  private authToken: string;

  constructor(baseUrl: string, authToken: string) {
    this.baseUrl = baseUrl;
    this.authToken = authToken;
  }

  /**
   * Create a new FIAM campaign
   */
  async createCampaign(data: CreateCampaignRequest): Promise<CampaignResponse> {
    const response = await fetch(`${this.baseUrl}/api/admin/fiam-campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to create campaign: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get all campaigns
   */
  async getCampaigns(params?: {
    page?: number;
    limit?: number;
    status?: CampaignStatus;
    triggerType?: TriggerType;
  }): Promise<CampaignListResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.status) queryParams.set('status', params.status);
    if (params?.triggerType) queryParams.set('triggerType', params.triggerType);

    const response = await fetch(
      `${this.baseUrl}/api/admin/fiam-campaigns?${queryParams}`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch campaigns: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get campaign by ID
   */
  async getCampaignById(id: number): Promise<CampaignResponse> {
    const response = await fetch(`${this.baseUrl}/api/admin/fiam-campaigns/${id}`, {
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch campaign: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update campaign
   */
  async updateCampaign(
    id: number,
    data: UpdateCampaignRequest
  ): Promise<CampaignResponse> {
    const response = await fetch(`${this.baseUrl}/api/admin/fiam-campaigns/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`Failed to update campaign: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Update campaign status
   */
  async updateCampaignStatus(
    id: number,
    status: CampaignStatus
  ): Promise<CampaignResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/admin/fiam-campaigns/${id}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
        },
        body: JSON.stringify({ status }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to update campaign status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Manually broadcast campaign
   */
  async broadcastCampaign(id: number): Promise<BroadcastResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/admin/fiam-campaigns/${id}/broadcast`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to broadcast campaign: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(id: number): Promise<CampaignAnalytics> {
    const response = await fetch(
      `${this.baseUrl}/api/admin/fiam-campaigns/${id}/analytics`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch analytics: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get analytics summary for all campaigns
   */
  async getAnalyticsSummary(): Promise<AnalyticsSummaryResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/admin/fiam-campaigns/analytics/summary`,
      {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch analytics summary: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete campaign (soft delete)
   */
  async deleteCampaign(id: number): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/admin/fiam-campaigns/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete campaign: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Permanently delete campaign
   */
  async permanentlyDeleteCampaign(
    id: number
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(
      `${this.baseUrl}/api/admin/fiam-campaigns/${id}/permanent`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to permanently delete campaign: ${response.statusText}`);
    }

    return response.json();
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Convert wizard form data to API request
 */
export function convertWizardDataToRequest(
  wizardData: WizardFormData
): CreateCampaignRequest {
  const { step1, step2, step3, step4 } = wizardData;

  // Build button config
  const buttonConfig: ButtonConfig | undefined = step1.buttonText
    ? {
        text: step1.buttonText,
        actionUrl: step1.buttonActionUrl || '',
        backgroundColor: step1.buttonBackgroundColor || '#000000',
        textColor: step1.buttonTextColor || '#FFFFFF',
      }
    : undefined;

  const secondaryButtonConfig: ButtonConfig | undefined = step1.secondaryButtonText
    ? {
        text: step1.secondaryButtonText,
        actionUrl: step1.secondaryButtonActionUrl || 'dismiss',
        backgroundColor: 'transparent',
        textColor: step1.textColor,
      }
    : undefined;

  return {
    // Step 3: Scheduling
    name: step3.campaignName,
    internalName: step3.internalName || undefined,
    description: step3.description || undefined,

    // Step 1: UI Configuration
    uiConfig: {
      layoutType: step1.layoutType,
      backgroundColor: step1.backgroundColor,
      textColor: step1.textColor,
      title: step1.title,
      body: step1.body,
      imageUrl: step1.imageUrl || undefined,
      actionUrl: step1.actionUrl || undefined,
      buttonConfig,
      secondaryButtonConfig,
    },

    // Step 4: Trigger Configuration
    triggerType: step4.triggerType,
    triggerEvents: step4.triggerEvents.length > 0 ? step4.triggerEvents : undefined,
    scheduledAt: step3.publishImmediately
      ? new Date().toISOString()
      : step3.scheduledAt,

    // Step 2: Targeting
    targetUserTypes: step2.userTypes.length > 0 ? step2.userTypes : undefined,
    targetGender: step2.gender || undefined,
    targetMinAge: step2.minAge || undefined,
    targetMaxAge: step2.maxAge || undefined,
    targetIsPanIndia: step2.isPanIndia || false,
    targetLocations: step2.locations.length > 0 ? step2.locations : undefined,
    targetNicheIds: step2.nicheIds.length > 0 ? step2.nicheIds : undefined,
    targetSpecificUserIds:
      step2.specificUserIds.length > 0 ? step2.specificUserIds : undefined,
    targetBehaviorFilters: {
      isPro: step2.isPro,
      minFollowers: step2.minFollowers || undefined,
      maxFollowers: step2.maxFollowers || undefined,
      minCredits: step2.minCredits || undefined,
      maxCredits: step2.maxCredits || undefined,
    },

    // Step 4: Frequency & Conversion
    frequencyConfig: {
      maxImpressionsPerUser: step4.maxImpressionsPerUser || undefined,
      cooldownHours: step4.cooldownHours || undefined,
      maxImpressionsPerDay: step4.maxImpressionsPerDay || undefined,
      globalMaxImpressions: step4.globalMaxImpressions || undefined,
    },
    conversionEvent: step4.conversionEvent || undefined,
    conversionWindowHours: step4.conversionWindowHours || 24,

    // Step 3: Date Range
    startDate: step3.startDate || undefined,
    endDate: step3.endDate || undefined,

    // Status
    status: step3.publishImmediately ? CampaignStatus.ACTIVE : CampaignStatus.DRAFT,
  };
}

/**
 * Validate wizard form data
 */
export function validateWizardData(wizardData: WizardFormData): string[] {
  const errors: string[] = [];

  // Step 1 validation
  if (!wizardData.step1.layoutType) {
    errors.push('Layout type is required');
  }
  if (!wizardData.step1.title || wizardData.step1.title.trim() === '') {
    errors.push('Title is required');
  }
  if (!wizardData.step1.body || wizardData.step1.body.trim() === '') {
    errors.push('Body text is required');
  }

  // Step 2 validation
  if (!wizardData.step2.userTypes || wizardData.step2.userTypes.length === 0) {
    errors.push('At least one user type must be selected');
  }

  // Step 3 validation
  if (!wizardData.step3.campaignName || wizardData.step3.campaignName.trim() === '') {
    errors.push('Campaign name is required');
  }
  if (!wizardData.step3.publishImmediately && !wizardData.step3.scheduledAt) {
    errors.push('Scheduled date is required when not publishing immediately');
  }

  // Step 4 validation
  if (!wizardData.step4.triggerType) {
    errors.push('Trigger type is required');
  }
  if (
    wizardData.step4.triggerType === TriggerType.EVENT &&
    wizardData.step4.triggerEvents.length === 0
  ) {
    errors.push('At least one trigger event must be selected for event-based campaigns');
  }

  return errors;
}
