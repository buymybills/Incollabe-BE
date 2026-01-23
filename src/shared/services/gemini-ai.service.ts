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

@Injectable()
export class GeminiAIService {
  private readonly logger = new Logger(GeminiAIService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private model: any | null = null;
  private visionModel: any | null = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);

      // Try to initialize both text and vision models
      try {
        // Using Gemini 1.5 Pro for better quality and accuracy
        // This model supports both text-only and image+text inputs
        const modelName = 'gemini-1.5-pro';

        // For text-only analysis (niche, language, sentiment)
        this.model = this.genAI.getGenerativeModel({ model: modelName });

        // For image analysis (visual quality, brand safety) - same model supports multimodal
        this.visionModel = this.genAI.getGenerativeModel({ model: modelName });

        this.logger.log(`✅ Gemini AI service initialized with ${modelName}`);
      } catch (error) {
        this.logger.error('Failed to initialize Gemini models:', error.message);
        this.model = null;
        this.visionModel = null;
      }
    } else {
      this.logger.warn('⚠️ GEMINI_API_KEY not found. AI features disabled - using fallback scoring.');
      this.logger.warn('   To enable AI features:');
      this.logger.warn('   1. Get an API key from https://makersuite.google.com/app/apikey');
      this.logger.warn('   2. Add GEMINI_API_KEY=your-key to .env');
      this.logger.warn('   3. Ensure billing is enabled for your Google Cloud project');
    }
  }

  /**
   * Check if Gemini AI is available
   */
  isAvailable(): boolean {
    return this.model !== null;
  }

  /**
   * Check if vision model is available
   */
  isVisionAvailable(): boolean {
    return this.visionModel !== null;
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
      const prompt = `Analyze this Instagram post image and provide a detailed quality assessment.

Rate the following aspects on a scale of 0-10:
1. Composition (framing, rule of thirds, balance)
2. Lighting (natural/artificial, exposure, shadows)
3. Color harmony (color scheme, saturation, contrast)
4. Clarity (sharpness, focus, resolution)

Also identify:
- Content type (product, lifestyle, selfie, food, travel, fashion, fitness, etc.)
- Professional quality score (0-100)
- Brand safety score (0-100, where 100 is completely safe)
- Whether there's text overlay (yes/no)
- Number of faces visible
- Main objects/subjects in the image

Return your analysis in this exact JSON format:
{
  "composition": 8,
  "lighting": 7,
  "colorHarmony": 9,
  "clarity": 8,
  "contentType": "lifestyle",
  "professionalScore": 75,
  "brandSafetyScore": 95,
  "textOverlay": true,
  "faces": 2,
  "objects": ["person", "phone", "coffee"]
}`;

      const result = await this.visionModel.generateContent([
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: await this.fetchImageAsBase64(imageUrl),
          },
        },
        { text: prompt },
      ]);

      const response = await result.response;
      const text = response.text();

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);

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
          professionalScore: analysis.professionalScore,
          brandSafetyScore: analysis.brandSafetyScore,
          textOverlay: analysis.textOverlay,
          faces: analysis.faces,
          objects: analysis.objects || [],
        };
      }

      return this.getDefaultVisualAnalysis();
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
      const contentTypes = visualAnalyses.map(v => v.contentType).join(', ');
      const allCaptions = captions.slice(0, 20).join('\n---\n');

      const prompt = `Analyze these Instagram post captions and content types to determine the influencer's niche:

CAPTIONS:
${allCaptions}

CONTENT TYPES: ${contentTypes}

Based on this content, identify:
1. Primary niche (main category: fashion, fitness, food, travel, tech, beauty, lifestyle, business, etc.)
2. Secondary niches (2-3 related categories)
3. Confidence level (0-100)
4. Top 5-10 keywords that define their content

Return JSON format:
{
  "primaryNiche": "fitness",
  "secondaryNiches": ["nutrition", "wellness"],
  "confidence": 85,
  "keywords": ["workout", "health", "training", "nutrition", "wellness"]
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

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
      const allCaptions = captions.slice(0, 20).join('\n---\n');

      const prompt = `Analyze the language usage in these Instagram captions:

${allCaptions}

Identify:
1. Primary language used
2. Percentage breakdown of all languages used (must add up to 100%)
3. Market fit score (0-100) - how well the language mix matches the target audience

Return JSON format:
{
  "primaryLanguage": "Hindi",
  "languagePercentages": {"Hindi": 60, "English": 40},
  "marketFit": 85
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

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
   * Returns sentiment score from -100 (very negative) to +100 (very positive)
   */
  async analyzeSentiment(captions: string[]): Promise<number> {
    if (!this.isAvailable() || captions.length === 0) {
      return 70; // Default positive sentiment
    }

    try {
      const allCaptions = captions.slice(0, 20).join('\n---\n');

      const prompt = `Analyze the overall sentiment of these Instagram captions:

${allCaptions}

Rate the sentiment on a scale from -100 (very negative) to +100 (very positive).
Consider:
- Emotional tone (happy, sad, angry, neutral, etc.)
- Positivity vs negativity of language
- Overall vibe and energy

Return just a single number between -100 and +100.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      // Try to extract number from response
      const numberMatch = text.match(/-?\d+/);
      if (numberMatch) {
        const sentiment = parseInt(numberMatch[0], 10);
        return Math.max(-100, Math.min(100, sentiment)); // Clamp to -100 to +100
      }

      return 70; // Default if parsing fails
    } catch (error) {
      this.logger.debug(`Sentiment analysis unavailable (using default): ${error.message}`);
      return 70;
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
      const allCaptions = captions.join('\n---\n');

      const prompt = `Analyze these Instagram captions for trend relevance:

${allCaptions}

Rate the content on a scale from 1-10 based on:
- Alignment with current social media trends
- Relevance of topics discussed
- Niche clarity and consistency
- Use of trending keywords/phrases
- Timeliness and cultural relevance

Return JSON with:
{
  "score": <number 1-10>,
  "trends": ["<trend1>", "<trend2>"],
  "relevanceReason": "<explanation>"
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      // Try to parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          score: Math.max(1, Math.min(10, parsed.score || 7)),
          trends: parsed.trends || [],
          relevanceReason: parsed.relevanceReason || '',
        };
      }

      return { score: 7.0, message: 'Failed to parse AI response' };
    } catch (error) {
      this.logger.debug(`Trend relevance analysis unavailable: ${error.message}`);
      return { score: 7.0, message: 'AI analysis failed' };
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

      const prompt = `Does this image contain a human face or person? Answer only: YES or NO`;

      const imagePart = {
        inlineData: {
          data: imageData,
          mimeType: 'image/jpeg',
        },
      };

      const result = await this.visionModel.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text().trim().toUpperCase();

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
      const allCaptions = captions.join('\n---\n');

      const prompt = `Analyze the hashtag strategy in these Instagram captions:

${allCaptions}

Rate the hashtag effectiveness as one of:
- "outperforming" (excellent hashtag strategy, well-researched, trending, niche-specific)
- "effective" (good hashtag use, decent mix)
- "medium" (average hashtag strategy)
- "need_improvement" (poor hashtag strategy or none)

Return JSON with:
{
  "rating": "<one of the above>",
  "totalHashtags": <number>,
  "avgHashtagsPerPost": <number>,
  "recommendations": "<brief suggestions>"
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          rating: parsed.rating || 'effective',
          totalHashtags: parsed.totalHashtags || 0,
          avgHashtagsPerPost: parsed.avgHashtagsPerPost || 0,
          recommendations: parsed.recommendations || '',
        };
      }

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

      const prompt = `Analyze the color palette and mood consistency across these Instagram images.

Rate on a scale from 1-20 based on:
- Color scheme consistency
- Mood and aesthetic coherence
- Visual branding strength
- Overall aesthetic appeal

Return JSON with:
{
  "rating": <number 1-20>,
  "dominantColors": ["<color1>", "<color2>"],
  "mood": "<mood description>",
  "consistency": "<high/medium/low>"
}`;

      const result = await this.visionModel.generateContent([prompt, ...imageParts]);
      const response = await result.response;
      const text = response.text().trim();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          rating: Math.max(1, Math.min(20, parsed.rating || 14)),
          dominantColors: parsed.dominantColors || [],
          mood: parsed.mood || '',
          consistency: parsed.consistency || 'medium',
        };
      }

      return { rating: 14, message: 'Failed to parse AI response' };
    } catch (error) {
      this.logger.debug(`Color palette analysis unavailable: ${error.message}`);
      return { rating: 14, message: 'AI analysis failed' };
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
      const allCaptions = captions.join('\n---\n');

      const prompt = `Analyze the Call-to-Action (CTA) usage in these Instagram captions:

${allCaptions}

Rate the CTA effectiveness as one of:
- "good" (strong CTAs, clear next steps, engagement-driving)
- "medium" (some CTAs present, could be stronger)
- "less" (weak or no CTAs, no clear action)

Return JSON with:
{
  "rating": "<one of the above>",
  "ctaCount": <number of captions with CTAs>,
  "examples": ["<example CTA 1>", "<example CTA 2>"],
  "recommendations": "<suggestions for improvement>"
}`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          rating: parsed.rating || 'medium',
          ctaCount: parsed.ctaCount || 0,
          examples: parsed.examples || [],
          recommendations: parsed.recommendations || '',
        };
      }

      return { rating: 'medium', message: 'Failed to parse AI response' };
    } catch (error) {
      this.logger.debug(`CTA analysis unavailable: ${error.message}`);
      return { rating: 'medium', message: 'AI analysis failed' };
    }
  }

  /**
   * Predict monetisation potential on 1-50 scale
   */
  async predictMonetisationPotential(profileContext: {
    followerCount: number;
    engagementRate: number;
    accountType: string;
    captions: string[];
  }): Promise<number> {
    if (!this.isAvailable()) {
      return 25; // Default mid-range score
    }

    try {
      const allCaptions = profileContext.captions.slice(0, 10).join('\n---\n');

      const prompt = `Predict the monetisation potential of this Instagram influencer on a scale from 1-50:

PROFILE DATA:
- Follower Count: ${profileContext.followerCount}
- Engagement Rate: ${profileContext.engagementRate}%
- Account Type: ${profileContext.accountType}

RECENT CAPTIONS:
${allCaptions}

Rate monetisation potential (1-50) based on:
- Follower size and quality
- Engagement rate strength
- Content professionalism
- Brand collaboration signals
- Commercial appeal
- Niche profitability
- Account credibility

Scale:
- 40-50: High monetisation potential (ready for premium brand deals)
- 25-39: Medium potential (good for mid-tier collaborations)
- 10-24: Low potential (emerging influencer)
- 1-9: Very low potential (needs growth)

Return just a single number between 1 and 50.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      // Extract number from response
      const numberMatch = text.match(/\d+/);
      if (numberMatch) {
        const rating = parseInt(numberMatch[0], 10);
        return Math.max(1, Math.min(50, rating)); // Clamp to 1-50
      }

      return 25; // Default if parsing fails
    } catch (error) {
      this.logger.debug(`Monetisation prediction unavailable: ${error.message}`);
      return 25;
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
  }): Promise<number> {
    if (!this.isAvailable()) {
      return 500; // Default mid-range payout
    }

    try {
      const prompt = `Predict the appropriate payout (in INR) for an Instagram influencer collaboration:

PROFILE METRICS:
- Active Followers: ${profileData.activeFollowers}
- Average Views per Post: ${profileData.avgViews}
- Engagement Rate: ${profileData.engagementRate}%

PRICING GUIDELINES:
- Industry standard: ₹0.2 to ₹0.5 per view
- Consider engagement quality (higher engagement = higher rate)
- Account for active follower percentage
- Factor in overall reach and impressions

Calculate a fair payout amount based on:
1. Average views × rate per view (₹0.2-0.5)
2. Engagement quality multiplier
3. Active follower quality

Return just a single number representing the predicted payout in INR (Indian Rupees).`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      // Extract number from response
      const numberMatch = text.match(/\d+/);
      if (numberMatch) {
        const payout = parseInt(numberMatch[0], 10);
        return Math.max(0, payout); // Must be non-negative
      }

      return 500; // Default if parsing fails
    } catch (error) {
      this.logger.debug(`Payout prediction unavailable: ${error.message}`);
      return 500;
    }
  }

  /**
   * Analyze audience sentiment on 1-20 scale
   */
  async analyzeAudienceSentiment(captions: string[]): Promise<number> {
    if (!this.isAvailable() || captions.length === 0) {
      return 12; // Default mid-positive sentiment
    }

    try {
      const allCaptions = captions.slice(0, 20).join('\n---\n');

      const prompt = `Analyze the audience sentiment for these Instagram captions on a scale from 1-20:

${allCaptions}

Rate audience sentiment (1-20) based on:
- Overall tone and emotional appeal
- Positivity and authenticity
- Audience connection strength
- Community engagement potential
- Trust and credibility signals
- Relatability factor

Scale:
- 15-20: Very positive sentiment (highly engaging, authentic, trustworthy)
- 10-14: Positive sentiment (good connection, relatable)
- 5-9: Neutral sentiment (average appeal)
- 1-4: Negative sentiment (weak connection, low trust)

Return just a single number between 1 and 20.`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      // Extract number from response
      const numberMatch = text.match(/\d+/);
      if (numberMatch) {
        const sentiment = parseInt(numberMatch[0], 10);
        return Math.max(1, Math.min(20, sentiment)); // Clamp to 1-20
      }

      return 12; // Default if parsing fails
    } catch (error) {
      this.logger.debug(`Audience sentiment analysis unavailable: ${error.message}`);
      return 12;
    }
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
