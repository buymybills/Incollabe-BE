import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConfigService } from '@nestjs/config';

export interface VisualAnalysisResult {
  overallQuality: number; // 0-100
  aesthetics: {
    composition: number; // 0-10
    lighting: number; // 0-10
    colorHarmony: number; // 0-10
    clarity: number; // 0-10
  };
  contentType: string; // 'product', 'lifestyle', 'selfie', 'food', 'travel', etc.
  professionalScore: number; // 0-100
  brandSafetyScore: number; // 0-100
  textOverlay: boolean;
  faces: number;
  objects: string[];
  feedback?: string; // AI-generated 4-6 word feedback
}

export interface NicheDetectionResult {
  primaryNiche: string;
  secondaryNiches: string[];
  confidence: number; // 0-100
  keywords: string[];
}

export interface LanguageAnalysisResult {
  primaryLanguage: string;
  languagePercentages: { [key: string]: number };
  marketFit: number; // 0-100
}

export interface ContentIntelligenceResult {
  visualQuality: VisualAnalysisResult;
  niche: NicheDetectionResult;
  language: LanguageAnalysisResult;
  sentiment: number; // -100 to +100
  engagementPotential: number; // 0-100
}

// Model configuration with fallback priority
interface ModelConfig {
  name: string;
  tier: 'free' | 'paid';
  priority: number; // Lower = higher priority
  description: string;
}

@Injectable()
export class GeminiAIService {
  private readonly logger = new Logger(GeminiAIService.name);
  private genAI: GoogleGenerativeAI | null = null;

  // Model fallback configuration (in priority order)
  private readonly modelConfigs: ModelConfig[] = [
    {
      name: 'gemini-flash-lite-latest',
      tier: 'free',
      priority: 1,
      description: 'Free - Gemini Flash-Lite (fastest)',
    },
    {
      name: 'gemini-flash-latest',
      tier: 'free',
      priority: 2,
      description: 'Free - Gemini Flash',
    },
    {
      name: 'gemini-pro-latest',
      tier: 'free',
      priority: 3,
      description: 'Free - Gemini Pro',
    },
    {
      name: 'gemini-2.5-pro',
      tier: 'paid',
      priority: 4,
      description: 'Paid - Gemini 2.5 Pro (final fallback)',
    },
  ];

  // Track failed models to avoid retrying in the same session
  private failedModels: Set<string> = new Set();

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log('✅ Gemini AI service initialized with fallback support');
      this.logger.log(`   Available models: ${this.modelConfigs.map(m => `${m.name} (${m.tier})`).join(', ')}`);
    } else {
      this.logger.warn('⚠️ GEMINI_API_KEY not found. AI features disabled - using fallback scoring.');
      this.logger.warn('   To enable AI features:');
      this.logger.warn('   1. Get an API key from https://makersuite.google.com/app/apikey');
      this.logger.warn('   2. Add GEMINI_API_KEY=your-key to .env');
      this.logger.warn('   3. Ensure billing is enabled for your Google Cloud project');
    }
  }

  /**
   * Execute AI request with automatic fallback to next available model
   */
  async executeWithFallback<T>(
    operation: (model: any) => Promise<T>,
    operationName: string,
  ): Promise<T> {
    if (!this.genAI) {
      throw new Error('Gemini AI not initialized');
    }

    const availableModels = this.modelConfigs
      .filter(config => !this.failedModels.has(config.name))
      .sort((a, b) => a.priority - b.priority);

    if (availableModels.length === 0) {
      this.logger.error('❌ All Gemini models exhausted. Resetting failed models list.');
      this.failedModels.clear();
      throw new Error('All Gemini models quota exhausted. Please try again later.');
    }

    for (const config of availableModels) {
      try {
        this.logger.debug(`🔄 Trying ${config.name} (${config.tier}) for ${operationName}...`);

        const model = this.genAI.getGenerativeModel({ model: config.name });
        const result = await operation(model);

        this.logger.debug(`✅ Success with ${config.name} (${config.tier})`);
        return result;
      } catch (error) {
        const errorMessage = error.message || String(error);

        // Check if it's a rate limit or quota error
        const isQuotaError =
          errorMessage.includes('quota') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('429') ||
          errorMessage.includes('RESOURCE_EXHAUSTED');

        if (isQuotaError) {
          this.logger.warn(`⚠️ ${config.name} (${config.tier}) quota exhausted: ${errorMessage}`);
          this.failedModels.add(config.name);

          // Try next model
          continue;
        } else {
          // Non-quota error (e.g., invalid request) - don't try other models
          this.logger.error(`❌ ${config.name} failed with non-quota error: ${errorMessage}`);
          throw error;
        }
      }
    }

    // All models failed
    throw new Error(`All available Gemini models failed for ${operationName}`);
  }

  /**
   * Check if Gemini AI is available
   */
  isAvailable(): boolean {
    return this.genAI !== null;
  }

  /**
   * Check if vision model is available
   */
  isVisionAvailable(): boolean {
    return this.genAI !== null;
  }

  /**
   * Get current model status and availability
   */
  getModelStatus(): { available: string[]; failed: string[]; nextModel: string | null } {
    const available = this.modelConfigs
      .filter(config => !this.failedModels.has(config.name))
      .map(config => `${config.name} (${config.tier})`);

    const failed = Array.from(this.failedModels);

    const nextModel = this.modelConfigs
      .filter(config => !this.failedModels.has(config.name))
      .sort((a, b) => a.priority - b.priority)[0]?.name || null;

    return { available, failed, nextModel };
  }

  /**
   * Reset failed models list (useful for testing or after quota resets)
   */
  resetFailedModels(): void {
    this.logger.log('🔄 Resetting failed models list');
    this.failedModels.clear();
  }

  /**
   * Manually mark a model as failed (useful for testing)
   */
  markModelAsFailed(modelName: string): void {
    this.failedModels.add(modelName);
    this.logger.log(`❌ Manually marked ${modelName} as failed`);
  }

  /**
   * Analyze visual quality of an Instagram post image
   */
  async analyzeVisualQuality(imageUrl: string): Promise<VisualAnalysisResult> {
    if (!this.isVisionAvailable()) {
      this.logger.warn('Gemini Vision AI not available, returning default scores');
      return this.getDefaultVisualAnalysis();
    }

    try {
      // Optimized: 80% shorter prompt with feedback
      const prompt = `Rate image 0-10: composition, lighting, colorHarmony, clarity. Identify: contentType(product/lifestyle/selfie/food/travel/fashion/fitness), profScore(0-100), brandScore(0-100), textOverlay(bool), faces(int), objects(array), feedback(4-6 words actionable). JSON only.`;

      const imageData = await this.fetchImageAsBase64(imageUrl);

      const result = await this.executeWithFallback(async (model) => {
        const response = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: imageData } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.3,
          }
        });
        return await response.response;
      }, 'analyzeVisualQuality');

      const text = result.text();
      const analysis = JSON.parse(text);

      return {
        overallQuality: Math.round(
          (analysis.composition + analysis.lighting + analysis.colorHarmony + analysis.clarity) * 2.5
        ),
        aesthetics: {
          composition: analysis.composition,
          lighting: analysis.lighting,
          colorHarmony: analysis.colorHarmony,
          clarity: analysis.clarity,
        },
        contentType: analysis.contentType,
        professionalScore: analysis.profScore || analysis.professionalScore,
        brandSafetyScore: analysis.brandScore || analysis.brandSafetyScore,
        textOverlay: analysis.textOverlay,
        faces: analysis.faces,
        objects: analysis.objects || [],
        feedback: analysis.feedback || '',
      };
    } catch (error) {
      this.logger.debug(`Visual analysis unavailable (using defaults): ${error.message}`);
      return this.getDefaultVisualAnalysis();
    }
  }

  /**
   * Detect niche from post captions and content
   */
  async detectNiche(captions: string[], visualAnalyses: VisualAnalysisResult[]): Promise<NicheDetectionResult> {
    if (!this.isAvailable() || captions.length === 0) {
      return {
        primaryNiche: 'general',
        secondaryNiches: [],
        confidence: 0,
        keywords: [],
      };
    }

    try {
      const contentTypes = visualAnalyses.map(v => v.contentType).join(',');
      const allCaptions = captions.slice(0, 15).join('\n');

      // Optimized: 70% shorter with feedback
      const prompt = `Captions: ${allCaptions}\nTypes: ${contentTypes}\nIdentify: primaryNiche(fashion/fitness/food/travel/tech/beauty/lifestyle/business), secondaryNiches(2-3), confidence(0-100), keywords(5-10), feedback(4-6 words actionable). JSON only.`;

      const result = await this.executeWithFallback(async (model) => {
        const response = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.3,
          }
        });
        return await response.response;
      }, 'detectNiche');

      const text = result.text();
      return JSON.parse(text);

      return {
        primaryNiche: 'general',
        secondaryNiches: [],
        confidence: 0,
        keywords: [],
      };
    } catch (error) {
      this.logger.debug(`Niche detection unavailable (using defaults): ${error.message}`);
      return {
        primaryNiche: 'general',
        secondaryNiches: [],
        confidence: 0,
        keywords: [],
      };
    }
  }

  /**
   * Analyze language usage in captions
   */
  async analyzeLanguage(captions: string[]): Promise<LanguageAnalysisResult> {
    if (!this.isAvailable() || captions.length === 0) {
      return {
        primaryLanguage: 'English',
        languagePercentages: { English: 100 },
        marketFit: 50,
      };
    }

    try {
      const allCaptions = captions.slice(0, 15).join('\n');

      // Optimized: 75% shorter
      const prompt = `Captions: ${allCaptions}\nIdentify: primaryLanguage, languagePercentages(%), marketFit(0-100), feedback(4-6 words actionable). JSON only.`;

      const result = await this.executeWithFallback(async (model) => {
        const response = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.3,
          }
        });
        return await response.response;
      }, 'analyzeLanguage');

      const text = result.text();
      return JSON.parse(text);

      return {
        primaryLanguage: 'English',
        languagePercentages: { English: 100 },
        marketFit: 50,
      };
    } catch (error) {
      this.logger.debug(`Language analysis unavailable (using defaults): ${error.message}`);
      return {
        primaryLanguage: 'English',
        languagePercentages: { English: 100 },
        marketFit: 50,
      };
    }
  }

  /**
   * Comprehensive content intelligence analysis
   */
  async analyzeContentIntelligence(
    posts: Array<{ caption: string; mediaUrl: string }>
  ): Promise<ContentIntelligenceResult> {
    const captions = posts.map(p => p.caption).filter(Boolean);
    const imageUrls = posts.map(p => p.mediaUrl).filter(Boolean);

    // Analyze first 5 images for visual quality
    const visualAnalyses: VisualAnalysisResult[] = [];
    for (const url of imageUrls.slice(0, 5)) {
      try {
        const analysis = await this.analyzeVisualQuality(url);
        visualAnalyses.push(analysis);
      } catch (error) {
        this.logger.warn(`Failed to analyze image ${url}:`, error.message);
      }
    }

    // Calculate average visual quality
    const avgVisualQuality =
      visualAnalyses.length > 0
        ? visualAnalyses.reduce((sum, v) => sum + v.overallQuality, 0) / visualAnalyses.length
        : 0;

    const avgVisualAnalysis: VisualAnalysisResult = {
      overallQuality: Math.round(avgVisualQuality),
      aesthetics: {
        composition: Math.round(
          visualAnalyses.reduce((sum, v) => sum + v.aesthetics.composition, 0) / (visualAnalyses.length || 1)
        ),
        lighting: Math.round(
          visualAnalyses.reduce((sum, v) => sum + v.aesthetics.lighting, 0) / (visualAnalyses.length || 1)
        ),
        colorHarmony: Math.round(
          visualAnalyses.reduce((sum, v) => sum + v.aesthetics.colorHarmony, 0) / (visualAnalyses.length || 1)
        ),
        clarity: Math.round(
          visualAnalyses.reduce((sum, v) => sum + v.aesthetics.clarity, 0) / (visualAnalyses.length || 1)
        ),
      },
      contentType: visualAnalyses[0]?.contentType || 'general',
      professionalScore: Math.round(
        visualAnalyses.reduce((sum, v) => sum + v.professionalScore, 0) / (visualAnalyses.length || 1)
      ),
      brandSafetyScore: Math.round(
        visualAnalyses.reduce((sum, v) => sum + v.brandSafetyScore, 0) / (visualAnalyses.length || 1)
      ),
      textOverlay: visualAnalyses.some(v => v.textOverlay),
      faces: Math.round(visualAnalyses.reduce((sum, v) => sum + v.faces, 0) / (visualAnalyses.length || 1)),
      objects: [],
    };

    // Detect niche
    const niche = await this.detectNiche(captions, visualAnalyses);

    // Analyze language
    const language = await this.analyzeLanguage(captions);

    // Calculate engagement potential (based on quality + niche clarity)
    const engagementPotential = Math.round((avgVisualQuality * 0.6 + niche.confidence * 0.4));

    return {
      visualQuality: avgVisualAnalysis,
      niche,
      language,
      sentiment: 70, // Placeholder - could be enhanced with sentiment analysis
      engagementPotential,
    };
  }

  /**
   * Helper: Fetch image as base64
   */
  private async fetchImageAsBase64(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return buffer.toString('base64');
    } catch (error) {
      this.logger.error(`Failed to fetch image ${url}:`, error);
      throw error;
    }
  }

  /**
   * Analyze sentiment from captions
   * Returns sentiment score from -100 (very negative) to +100 (very positive) with feedback
   */
  async analyzeSentiment(captions: string[]): Promise<{ score: number; feedback: string }> {
    if (!this.isAvailable() || captions.length === 0) {
      return { score: 70, feedback: 'Sentiment analysis unavailable.' };
    }

    try {
      const allCaptions = captions.slice(0, 15).join('\n');

      // Optimized with feedback
      const prompt = `Captions: ${allCaptions}\nRate sentiment -100 to +100. Return JSON: {"score": number, "feedback": "4-6 words actionable"}`;

      const result = await this.executeWithFallback(async (model) => {
        const response = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.3,
          }
        });
        return await response.response;
      }, 'analyzeSentiment');

      const text = result.text().trim();
      const parsed = JSON.parse(text);

      return {
        score: Math.max(-100, Math.min(100, parsed.score || 70)),
        feedback: parsed.feedback || 'Moderate sentiment detected.',
      };
    } catch (error) {
      this.logger.debug(`Sentiment analysis unavailable (using default): ${error.message}`);
      return { score: 70, feedback: 'Sentiment analysis unavailable.' };
    }
  }

  /**
   * Analyze trend relevance - AI rates content on scale of 1-10 based on trends, topics, niche relevance
   */
  async analyzeTrendRelevance(captions: string[]): Promise<{ score: number; [key: string]: any }> {
    if (!this.isAvailable()) {
      return { score: 7.0, message: 'AI not available' };
    }

    try {
      const allCaptions = captions.join('\n');

      // Optimized: 80% shorter with feedback
      const prompt = `Captions: ${allCaptions}\nRate trend relevance 1-10. Return JSON: {"score": number, "trends": ["trend1", "trend2"], "feedback": "4-6 words actionable"}`;

      const result = await this.executeWithFallback(async (model) => {
        const response = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.3,
          }
        });
        return await response.response;
      }, 'generateRetentionCurve');

      const text = result.text().trim();
      const parsed = JSON.parse(text);
      return {
        score: Math.max(1, Math.min(10, parsed.score || 7)),
        trends: parsed.trends || [],
        feedback: parsed.feedback || 'Moderate trend relevance.',
        relevanceReason: parsed.reason || parsed.relevanceReason || parsed.feedback || '',
      };
    } catch (error) {
      this.logger.debug(`Trend relevance analysis unavailable: ${error.message}`);
      return { score: 7.0, message: 'AI analysis failed', feedback: 'Trend analysis unavailable.' };
    }
  }

  /**
   * Detect if content has face/person
   */
  async detectFaceInContent(imageUrl: string): Promise<boolean> {
    if (!this.isVisionAvailable()) {
      return true; // Default assume face present
    }

    try {
      // Fetch image and convert to base64
      const axios = (await import('axios')).default;
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const imageData = Buffer.from(imageResponse.data).toString('base64');

      // Optimized: 50% shorter
      const prompt = `Face/person in image? YES or NO only.`;

      const imagePart = {
        inlineData: {
          data: imageData,
          mimeType: 'image/jpeg',
        },
      };

      const result = await this.executeWithFallback(async (model) => {
        const response = await model.generateContent([prompt, imagePart]);
        return await response.response;
      }, 'detectFaceInContent');

      const text = result.text().trim().toUpperCase();

      return text.includes('YES');
    } catch (error) {
      this.logger.debug(`Face detection unavailable: ${error.message}`);
      return true; // Default assume face present
    }
  }

  /**
   * Analyze hashtag effectiveness
   */
  async analyzeHashtagEffectiveness(captions: string[]): Promise<{ rating: string; [key: string]: any }> {
    if (!this.isAvailable()) {
      return { rating: 'effective', message: 'AI not available' };
    }

    try {
      const allCaptions = captions.join('\n');

      // Optimized: 80% shorter with feedback
      const prompt = `Captions: ${allCaptions}\nRate hashtags: outperforming/effective/medium/need_improvement. Return JSON: {"rating": "outperforming/effective/medium/need_improvement", "totalHashtags": number, "avgHashtagsPerPost": number, "feedback": "4-6 words actionable"}`;

      const result = await this.executeWithFallback(async (model) => {
        const response = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.3,
          }
        });
        return await response.response;
      }, 'analyzeHashtagEffectiveness');

      const text = result.text().trim();
      const parsed = JSON.parse(text);
      return {
        rating: parsed.rating || 'effective',
        totalHashtags: parsed.totalHashtags || 0,
        avgHashtagsPerPost: parsed.avgHashtagsPerPost || 0,
        feedback: parsed.feedback || 'Moderate hashtag usage.',
      };

      return { rating: 'effective', message: 'Failed to parse AI response' };
    } catch (error) {
      this.logger.debug(`Hashtag analysis unavailable: ${error.message}`);
      return { rating: 'effective', message: 'AI analysis failed' };
    }
  }

  /**
   * Analyze color palette and mood consistency
   */
  async analyzeColorPaletteMood(imageUrls: string[]): Promise<{ rating: number; [key: string]: any }> {
    if (!this.isVisionAvailable()) {
      return { rating: 14, message: 'AI not available' }; // Default 14/20
    }

    try {
      const axios = (await import('axios')).default;

      // Analyze first 5 images
      const imageParts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
      for (const url of imageUrls.slice(0, 5)) {
        try {
          const imageResponse = await axios.get(url, { responseType: 'arraybuffer' });
          const imageData = Buffer.from(imageResponse.data).toString('base64');
          imageParts.push({
            inlineData: {
              data: imageData,
              mimeType: 'image/jpeg',
            },
          });
        } catch (error) {
          // Skip failed images
        }
      }

      if (imageParts.length === 0) {
        return { rating: 14, message: 'No images loaded' };
      }

      // Optimized: 75% shorter with feedback
      const prompt = `Analyze these images for color palette. Rate consistency 1-20. Return JSON: {"rating": number, "dominantColors": ["Color1", "Color2", "Color3"], "mood": "Cool/Warm/Vibrant/Muted/Neutral", "consistency": "high/medium/low", "feedback": "4-6 words actionable"}. List 3-5 main colors.`;

      const result = await this.executeWithFallback(async (model) => {
        const response = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [{ text: prompt }, ...imageParts]
          }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.3,
          }
        });
        return await response.response;
      }, 'analyzeColorPaletteMood');

      const text = result.text().trim();
      const parsed = JSON.parse(text);
      return {
        rating: Math.max(1, Math.min(20, parsed.rating || 14)),
        dominantColors: parsed.dominantColors || [],
        mood: parsed.mood || '',
        consistency: parsed.consistency || 'medium',
        feedback: parsed.feedback || 'Moderate color consistency.',
      };
    } catch (error) {
      this.logger.debug(`Color palette analysis unavailable: ${error.message}`);
      return { rating: 14, message: 'AI analysis failed', feedback: 'Color analysis unavailable.' };
    }
  }

  /**
   * Analyze CTA (Call-to-Action) usage effectiveness
   */
  async analyzeCTAUsage(captions: string[]): Promise<{ rating: string; [key: string]: any }> {
    if (!this.isAvailable()) {
      return { rating: 'medium', message: 'AI not available' };
    }

    try {
      const allCaptions = captions.join('\n');

      // Optimized: 80% shorter with feedback
      const prompt = `Captions: ${allCaptions}\nRate CTA: good/medium/less. Return JSON: {"rating": "good/medium/less", "ctaCount": number, "examples": ["ex1", "ex2"], "feedback": "4-6 words actionable"}`;

      const result = await this.executeWithFallback(async (model) => {
        const response = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.3,
          }
        });
        return await response.response;
      }, 'analyzeCTAUsage');

      const text = result.text().trim();
      const parsed = JSON.parse(text);
      return {
        rating: parsed.rating || 'medium',
        ctaCount: parsed.ctaCount || 0,
        examples: parsed.examples || [],
        feedback: parsed.feedback || 'Moderate CTA usage.',
      };

      return { rating: 'medium', message: 'Failed to parse AI response' };
    } catch (error) {
      this.logger.debug(`CTA analysis unavailable: ${error.message}`);
      return { rating: 'medium', message: 'AI analysis failed' };
    }
  }

  /**
   * Predict monetisation potential on 1-50 scale with feedback
   */
  async predictMonetisationPotential(profileContext: {
    followerCount: number;
    engagementRate: number;
    accountType: string;
    captions: string[];
  }): Promise<{ rating: number; feedback: string }> {
    if (!this.isAvailable()) {
      return { rating: 25, feedback: 'Monetization analysis unavailable.' };
    }

    try {
      const allCaptions = profileContext.captions.slice(0, 8).join('\n');

      // Optimized with feedback
      const prompt = `Followers:${profileContext.followerCount}, Eng:${profileContext.engagementRate}%, Type:${profileContext.accountType}. Captions: ${allCaptions}\nRate monetisation 1-50. Return JSON: {"rating": number, "feedback": "4-6 words actionable"}`;

      const result = await this.executeWithFallback(async (model) => {
        const response = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.3,
          }
        });
        return await response.response;
      }, 'predictMonetisationPotential');

      const text = result.text().trim();
      const parsed = JSON.parse(text);

      return {
        rating: Math.max(1, Math.min(50, parsed.rating || 25)),
        feedback: parsed.feedback || 'Moderate monetization potential.',
      };
    } catch (error) {
      this.logger.debug(`Monetisation prediction unavailable: ${error.message}`);
      return { rating: 25, feedback: 'Monetization analysis unavailable.' };
    }
  }

  /**
   * Predict influencer payout based on active followers and avg views
   * Considers rate of 0.2-0.5 rupees per view
   */
  async predictInfluencerPayout(profileData: {
    activeFollowers: number;
    avgViews: number;
    engagementRate: number;
  }): Promise<{ payout: number; feedback: string }> {
    if (!this.isAvailable()) {
      // Fallback calculation: avgViews * 0.35 (average of 0.2-0.5 range)
      return {
        payout: Math.round(profileData.avgViews * 0.35),
        feedback: 'Payout analysis unavailable.',
      };
    }

    try {
      // Optimized prompt with JSON mode and feedback
      const prompt = `Calculate influencer payout in INR. Profile: Active followers=${profileData.activeFollowers}, Avg views=${profileData.avgViews}, Engagement=${profileData.engagementRate}%. Rate: ₹0.2-0.5 per view. Consider: higher engagement = higher rate (0.4-0.5), lower engagement = lower rate (0.2-0.3). Return JSON: {"payout": number, "rateUsed": number, "feedback": "4-6 words actionable"}`;

      const result = await this.executeWithFallback(async (model) => {
        const response = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.3,
          }
        });
        return await response.response;
      }, 'predictInfluencerPayout');

      const text = result.text().trim();
      const parsed = JSON.parse(text);

      if (parsed.payout && typeof parsed.payout === 'number') {
        return {
          payout: Math.max(0, Math.round(parsed.payout)),
          feedback: parsed.feedback || 'Moderate payout potential.',
        };
      }

      // Fallback calculation
      return {
        payout: Math.round(profileData.avgViews * 0.35),
        feedback: 'Calculated from average views.',
      };
    } catch (error) {
      this.logger.debug(`Payout prediction unavailable: ${error.message}`);
      // Fallback calculation
      return {
        payout: Math.round(profileData.avgViews * 0.35),
        feedback: 'Payout analysis unavailable.',
      };
    }
  }

  /**
   * Analyze audience sentiment on 1-20 scale with feedback
   */
  async analyzeAudienceSentiment(captions: string[]): Promise<{ rating: number; feedback: string }> {
    if (!this.isAvailable() || captions.length === 0) {
      return { rating: 12, feedback: 'Audience sentiment unavailable.' };
    }

    try {
      const allCaptions = captions.slice(0, 15).join('\n');

      // Optimized with feedback
      const prompt = `Captions: ${allCaptions}\nRate audience sentiment 1-20. Return JSON: {"rating": number, "feedback": "4-6 words actionable"}`;

      const result = await this.executeWithFallback(async (model) => {
        const response = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.3,
          }
        });
        return await response.response;
      }, 'generateRetentionCurve');

      const text = result.text().trim();
      const parsed = JSON.parse(text);

      return {
        rating: Math.max(1, Math.min(20, parsed.rating || 12)),
        feedback: parsed.feedback || 'Moderate audience sentiment.',
      };
    } catch (error) {
      this.logger.debug(`Audience sentiment analysis unavailable: ${error.message}`);
      return { rating: 12, feedback: 'Audience sentiment unavailable.' };
    }
  }

  /**
   * Generate realistic retention curve data for reels/videos
   * Returns time-series data points showing how retention drops over time
   */
  async generateRetentionCurve(params: {
    retentionRate: number; // Overall retention rate (e.g., 72.22)
    avgDuration: string; // Average duration (e.g., "25-45 Sec")
    engagementRate: number; // Engagement rate percentage
    contentQuality?: number; // Optional content quality score (0-100)
  }): Promise<Array<{ time: string; retention: number }>> {
    if (!this.isAvailable()) {
      // Return default curve pattern if AI not available
      return this.getDefaultRetentionCurve(params.retentionRate, params.avgDuration);
    }

    try {
      // Optimized: 85% shorter
      const qualityText = params.contentQuality ? `, quality:${params.contentQuality}` : '';
      const prompt = `Gen retention curve: retention:${params.retentionRate}%, dur:${params.avgDuration}, eng:${params.engagementRate}%${qualityText}. 8 points 0:00-0:30, start:100, end:~${params.retentionRate}. Realistic drop. JSON array only.`;

      const result = await this.executeWithFallback(async (model) => {
        const response = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            response_mime_type: "application/json",
            temperature: 0.4,
          }
        });
        return await response.response;
      }, 'generateRetentionCurve');

      const text = result.text().trim();
      const curveData = JSON.parse(text);

      // Validate the data structure
      if (Array.isArray(curveData) && curveData.length > 0 && curveData[0].time && curveData[0].retention !== undefined) {
        return curveData;
      }

      // Fallback to default curve if parsing fails
      return this.getDefaultRetentionCurve(params.retentionRate, params.avgDuration);
    } catch (error) {
      this.logger.debug(`Retention curve generation unavailable: ${error.message}`);
      return this.getDefaultRetentionCurve(params.retentionRate, params.avgDuration);
    }
  }

  /**
   * Generate a default retention curve when AI is not available
   */
  private getDefaultRetentionCurve(retentionRate: number, _avgDuration: string): Array<{ time: string; retention: number }> {
    // Create a realistic drop-off curve that ends at the retention rate
    const startRetention = 100;
    const endRetention = retentionRate;

    // Calculate drop points (steeper at start, gradual later)
    return [
      { time: '0:00', retention: 100 },
      { time: '0:03', retention: Math.round(startRetention - (startRetention - endRetention) * 0.1) },
      { time: '0:05', retention: Math.round(startRetention - (startRetention - endRetention) * 0.2) },
      { time: '0:10', retention: Math.round(startRetention - (startRetention - endRetention) * 0.4) },
      { time: '0:15', retention: Math.round(startRetention - (startRetention - endRetention) * 0.6) },
      { time: '0:20', retention: Math.round(startRetention - (startRetention - endRetention) * 0.8) },
      { time: '0:25', retention: Math.round(startRetention - (startRetention - endRetention) * 0.9) },
      { time: '0:30', retention: Math.round(endRetention) },
    ];
  }

  /**
   * Get default visual analysis when AI is not available
   */
  private getDefaultVisualAnalysis(): VisualAnalysisResult {
    return {
      overallQuality: 75,
      aesthetics: {
        composition: 7,
        lighting: 7,
        colorHarmony: 8,
        clarity: 8,
      },
      contentType: 'general',
      professionalScore: 70,
      brandSafetyScore: 95,
      textOverlay: false,
      faces: 1,
      objects: [],
    };
  }
}
