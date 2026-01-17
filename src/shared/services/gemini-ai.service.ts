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

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      this.logger.log('✅ Gemini AI service initialized');
    } else {
      this.logger.warn('⚠️ GEMINI_API_KEY not found. AI features will be disabled.');
    }
  }

  /**
   * Check if Gemini AI is available
   */
  isAvailable(): boolean {
    return this.model !== null;
  }

  /**
   * Analyze visual quality of an Instagram post image
   */
  async analyzeVisualQuality(imageUrl: string): Promise<VisualAnalysisResult> {
    if (!this.isAvailable()) {
      this.logger.warn('Gemini AI not available, returning default scores');
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

      const result = await this.model.generateContent([
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
      this.logger.error('Error analyzing visual quality:', error);
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
      this.logger.error('Error detecting niche:', error);
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
      this.logger.error('Error analyzing language:', error);
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
      this.logger.error('Error analyzing sentiment:', error);
      return 70;
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
