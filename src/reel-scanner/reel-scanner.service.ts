import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { GeminiAIService } from '../shared/services/gemini-ai.service';

export interface ScannedItem {
  brand: string;
  productName: string;
  type: string;
  wearerGender: 'men' | 'women' | 'unisex' | 'unknown';
  color: string;
  pattern: string;
  fit: string;
  details: string;
  searchQuery: string;
  confidence: number;
}

export interface ScanResult {
  sourceImageUrl: string;
  items: ScannedItem[];
}

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|heic|gif|bmp)(\?.*)?$/i;

const SCAN_PROMPT = `You are a fashion product detection AI.
Analyze this image and identify every visible clothing item, accessory, bag, or beauty product.
For each item return a JSON object with:
- brand: brand name visible or inferred (e.g. "Nike", "Unknown")
- productName: specific product name (e.g. "Air Force 1 Low")
- type: category (e.g. "sneakers", "oversized tee", "cargo pants", "handbag")
- wearerGender: "men" | "women" | "unisex" | "unknown"
- color: dominant color(s) (e.g. "white", "black and red")
- pattern: "solid" | "striped" | "checkered" | "printed" | "floral" | "camo" | "other"
- fit: "slim" | "regular" | "oversized" | "relaxed" | "unknown"
- details: any notable design details (e.g. "logo on chest, drawstring hem")
- searchQuery: a short search string to find this item (e.g. "Nike Air Force 1 white low top sneakers")
- confidence: your confidence score 0.0 to 1.0

Return ONLY a JSON object: { "items": [ ...array of items above... ] }
If no fashion items are visible, return { "items": [] }`;

@Injectable()
export class ReelScannerService {
  private readonly logger = new Logger(ReelScannerService.name);

  constructor(private readonly geminiService: GeminiAIService) {}

  async scanUrl(url: string): Promise<ScanResult> {
    const trimmed = url.trim();

    if (IMAGE_EXTENSIONS.test(trimmed)) {
      return this.scanImageUrl(trimmed);
    }

    if (this.isVideoUrl(trimmed)) {
      this.logger.warn(`Video URL detected. yt-dlp required for video scanning.`);
      return { sourceImageUrl: trimmed, items: [] };
    }

    // Web page — extract og:image
    const ogImage = await this.extractOgImage(trimmed);
    if (ogImage) {
      this.logger.log(`og:image extracted: ${ogImage}`);
      return this.scanImageUrl(ogImage);
    }

    this.logger.warn(`Could not extract image from: ${trimmed}`);
    return { sourceImageUrl: trimmed, items: [] };
  }

  async scanImageUrl(imageUrl: string): Promise<ScanResult> {
    if (!this.geminiService.isAvailable()) {
      this.logger.warn('Gemini not available — GEMINI_API_KEY missing');
      return { sourceImageUrl: imageUrl, items: [] };
    }

    try {
      const imageData = await this.fetchImageAsBase64(imageUrl);

      const result = await this.geminiService.executeWithFallback(async (model) => {
        const response = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'image/jpeg', data: imageData } },
              { text: SCAN_PROMPT },
            ],
          }],
          generationConfig: { response_mime_type: 'application/json', temperature: 0.2 },
        });
        return response.response;
      }, 'scanReelImage');

      const parsed = JSON.parse(result.text());
      const items: ScannedItem[] = (parsed.items || []).map((item: any) => ({
        brand: item.brand || 'Unknown',
        productName: item.productName || item.product_name || '',
        type: item.type || '',
        wearerGender: item.wearerGender || item.wearer_gender || 'unknown',
        color: item.color || '',
        pattern: item.pattern || 'solid',
        fit: item.fit || 'regular',
        details: item.details || '',
        searchQuery: item.searchQuery || item.search_query || '',
        confidence: Number(item.confidence) || 0.5,
      }));

      return { sourceImageUrl: imageUrl, items };
    } catch (error) {
      this.logger.error(`Scan failed for ${imageUrl}: ${error.message}`);
      return { sourceImageUrl: imageUrl, items: [] };
    }
  }

  private isVideoUrl(url: string): boolean {
    return (
      /\.(mp4|mov|webm|avi|mkv)(\?.*)?$/i.test(url) ||
      url.includes('youtube.com/watch') ||
      url.includes('youtu.be/') ||
      url.includes('tiktok.com/')
    );
  }

  private async extractOgImage(pageUrl: string): Promise<string | null> {
    try {
      const response = await axios.get<string>(pageUrl, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InCollabShopping/1.0)', Accept: 'text/html' },
        maxRedirects: 5,
      });
      const html: string = response.data;
      const patterns = [
        /property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
        /content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
        /name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
        /content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i,
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match?.[1]) return match[1];
      }
      return null;
    } catch {
      return null;
    }
  }

  private async fetchImageAsBase64(url: string): Promise<string> {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InCollabShopping/1.0)' },
    });
    const buffer = Buffer.from(response.data);
    if (buffer.byteLength > 20 * 1024 * 1024) throw new Error('Image too large (max 20MB)');
    return buffer.toString('base64');
  }
}
