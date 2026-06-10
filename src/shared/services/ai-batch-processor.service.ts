import { Injectable, Logger } from '@nestjs/common';
import { GeminiAIService } from './gemini-ai.service';

export interface BatchProcessingOptions {
  batchSize?: number; // How many items per batch (default: 10)
  delayBetweenBatches?: number; // Delay in ms between batches (default: 0)
  maxConcurrentBatches?: number; // Max batches running at once (default: 3)
}

export interface VisualAnalysisResult {
  overallQuality: number;
  aesthetics: {
    composition: number;
    lighting: number;
    colorHarmony: number;
    clarity: number;
  };
  contentType: string;
  professionalScore: number;
  brandSafetyScore: number;
  textOverlay: boolean;
  faces: number;
  objects: string[];
}

/**
 * AI Batch Processor Service
 *
 * Implements efficient batch processing strategies for AI operations:
 * 1. Multi-image single-request batching (Gemini supports this)
 * 2. Chunked parallel batching (process large sets efficiently)
 * 3. Request queuing and deduplication
 */
@Injectable()
export class AIBatchProcessorService {
  private readonly logger = new Logger(AIBatchProcessorService.name);

  constructor(private readonly geminiAIService: GeminiAIService) {}

  /**
   * STRATEGY 1: Batch Visual Analysis (Multiple Images in Single API Call)
   *
   * Instead of:
   *   10 images = 10 API calls
   * Do:
   *   10 images = 1 API call
   *
   * Cost savings: 90% (10 calls → 1 call)
   */
  async analyzeVisualQualityBatch(
    imageUrls: string[]
  ): Promise<VisualAnalysisResult[]> {
    if (imageUrls.length === 0) {
      return [];
    }

    this.logger.log(`📦 Batch analyzing ${imageUrls.length} images in single request`);

    try {
      // Fetch all images in parallel
      const imageDataArray = await Promise.all(
        imageUrls.map(url => this.fetchImageAsBase64(url))
      );

      // Create parts array with all images
      const imageParts = imageDataArray.map((data, index) => ({
        inlineData: { mimeType: 'image/jpeg', data },
      }));

      // Optimized batch prompt
      const prompt = `Analyze ${imageUrls.length} images. For EACH image (1 to ${imageUrls.length}), rate 0-10: composition, lighting, colorHarmony, clarity. Identify: contentType, profScore(0-100), brandScore(0-100), textOverlay(bool), faces(int), objects(array). Return JSON array with ${imageUrls.length} objects: [{"imageIndex": 0, "composition": N, ...}, {"imageIndex": 1, ...}, ...]`;

      const result = await this.geminiAIService['executeWithFallback'](
        async (model: any) => {
          const response = await model.generateContent({
            contents: [{
              role: 'user',
              parts: [...imageParts, { text: prompt }]
            }],
            generationConfig: {
              response_mime_type: 'application/json',
              temperature: 0.3,
            },
          });
          return await response.response;
        },
        'analyzeVisualQualityBatch'
      );

      const analyses = JSON.parse(result.text());

      // Convert to standard format
      return analyses.map((analysis: any) => ({
        overallQuality: Math.round(
          (analysis.composition + analysis.lighting + analysis.colorHarmony + analysis.clarity) * 2.5
        ),
        aesthetics: {
          composition: analysis.composition || 0,
          lighting: analysis.lighting || 0,
          colorHarmony: analysis.colorHarmony || 0,
          clarity: analysis.clarity || 0,
        },
        contentType: analysis.contentType || 'general',
        professionalScore: analysis.profScore || 0,
        brandSafetyScore: analysis.brandScore || 0,
        textOverlay: analysis.textOverlay || false,
        faces: analysis.faces || 0,
        objects: analysis.objects || [],
      }));
    } catch (error) {
      this.logger.error(`❌ Batch analysis failed: ${error.message}`);
      // Fallback: Process individually
      return this.fallbackToIndividualProcessing(imageUrls);
    }
  }

  /**
   * STRATEGY 2: Chunked Batch Processing (For Large Sets)
   *
   * When you have 100 images, don't send all at once:
   * - Chunk into batches of 10
   * - Process 3 batches concurrently
   *
   * Example: 100 images
   *   Without chunking: 1 massive API call (may fail/timeout)
   *   With chunking: 10 batches of 10 images, 3 at a time = efficient + reliable
   */
  async analyzeVisualQualityChunked(
    imageUrls: string[],
    options: BatchProcessingOptions = {}
  ): Promise<VisualAnalysisResult[]> {
    const {
      batchSize = 10,
      delayBetweenBatches = 0,
      maxConcurrentBatches = 3,
    } = options;

    this.logger.log(
      `📦 Chunked batch processing: ${imageUrls.length} images, ` +
      `${batchSize} per batch, ${maxConcurrentBatches} concurrent batches`
    );

    // Split into chunks
    const chunks: string[][] = [];
    for (let i = 0; i < imageUrls.length; i += batchSize) {
      chunks.push(imageUrls.slice(i, i + batchSize));
    }

    this.logger.log(`   Created ${chunks.length} batches`);

    // Process chunks with concurrency limit
    const results: VisualAnalysisResult[][] = [];

    for (let i = 0; i < chunks.length; i += maxConcurrentBatches) {
      const batchGroup = chunks.slice(i, i + maxConcurrentBatches);

      this.logger.log(
        `   Processing batch group ${Math.floor(i / maxConcurrentBatches) + 1}/${Math.ceil(chunks.length / maxConcurrentBatches)} ` +
        `(${batchGroup.length} batches, ${batchGroup.reduce((sum, b) => sum + b.length, 0)} images)`
      );

      // Process this group of batches in parallel
      const groupResults = await Promise.all(
        batchGroup.map(chunk => this.analyzeVisualQualityBatch(chunk))
      );

      results.push(...groupResults);

      // Optional delay between batch groups
      if (delayBetweenBatches > 0 && i + maxConcurrentBatches < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    // Flatten results
    return results.flat();
  }

  /**
   * STRATEGY 3: Smart Batching with Deduplication
   *
   * Detects duplicate image URLs and only processes unique ones
   */
  async analyzeVisualQualityDeduplicated(
    imageUrls: string[]
  ): Promise<Map<string, VisualAnalysisResult>> {
    // Remove duplicates
    const uniqueUrls = [...new Set(imageUrls)];
    const duplicatesRemoved = imageUrls.length - uniqueUrls.length;

    if (duplicatesRemoved > 0) {
      this.logger.log(
        `✨ Deduplication: Removed ${duplicatesRemoved} duplicate URLs ` +
        `(${imageUrls.length} → ${uniqueUrls.length})`
      );
    }

    // Batch process unique images
    const results = await this.analyzeVisualQualityBatch(uniqueUrls);

    // Create URL → Result map
    const resultMap = new Map<string, VisualAnalysisResult>();
    uniqueUrls.forEach((url, index) => {
      resultMap.set(url, results[index]);
    });

    return resultMap;
  }

  /**
   * STRATEGY 4: Queue-Based Batch Processing
   *
   * Collect requests over time window and batch them
   * Useful for high-traffic scenarios
   */
  private requestQueue: Array<{
    url: string;
    resolve: (result: VisualAnalysisResult) => void;
    reject: (error: Error) => void;
  }> = [];

  private queueTimer: NodeJS.Timeout | null = null;
  private readonly QUEUE_FLUSH_INTERVAL = 2000; // Flush every 2 seconds
  private readonly QUEUE_MAX_SIZE = 20; // Or flush when 20 items queued

  async analyzeVisualQualityQueued(imageUrl: string): Promise<VisualAnalysisResult> {
    return new Promise((resolve, reject) => {
      // Add to queue
      this.requestQueue.push({ url: imageUrl, resolve, reject });

      // Auto-flush if queue is full
      if (this.requestQueue.length >= this.QUEUE_MAX_SIZE) {
        this.flushQueue();
      }

      // Start timer if not already running
      if (!this.queueTimer) {
        this.queueTimer = setTimeout(() => this.flushQueue(), this.QUEUE_FLUSH_INTERVAL);
      }
    });
  }

  private async flushQueue() {
    if (this.requestQueue.length === 0) return;

    // Clear timer
    if (this.queueTimer) {
      clearTimeout(this.queueTimer);
      this.queueTimer = null;
    }

    // Get current queue and reset
    const queue = [...this.requestQueue];
    this.requestQueue = [];

    this.logger.log(`🚀 Flushing queue: ${queue.length} requests batched`);

    try {
      // Extract unique URLs
      const urls = queue.map(q => q.url);
      const results = await this.analyzeVisualQualityBatch(urls);

      // Resolve all promises
      queue.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      // Reject all promises
      queue.forEach(item => {
        item.reject(error as Error);
      });
    }
  }

  /**
   * Helper: Fallback to individual processing
   */
  private async fallbackToIndividualProcessing(
    imageUrls: string[]
  ): Promise<VisualAnalysisResult[]> {
    this.logger.warn(`⚠️ Falling back to individual processing for ${imageUrls.length} images`);

    return Promise.all(
      imageUrls.map(url =>
        this.geminiAIService.analyzeVisualQuality(url).catch(() => ({
          overallQuality: 0,
          aesthetics: { composition: 0, lighting: 0, colorHarmony: 0, clarity: 0 },
          contentType: 'unknown',
          professionalScore: 0,
          brandSafetyScore: 0,
          textOverlay: false,
          faces: 0,
          objects: [],
        }))
      )
    );
  }

  /**
   * Helper: Fetch image as base64
   */
  private async fetchImageAsBase64(url: string): Promise<string> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer).toString('base64');
  }

  /**
   * Get queue stats (for monitoring)
   */
  getQueueStats() {
    return {
      queueLength: this.requestQueue.length,
      isTimerActive: this.queueTimer !== null,
    };
  }

  /**
   * Clear queue (for testing/cleanup)
   */
  clearQueue() {
    this.requestQueue = [];
    if (this.queueTimer) {
      clearTimeout(this.queueTimer);
      this.queueTimer = null;
    }
  }
}
