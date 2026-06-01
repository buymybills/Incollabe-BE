import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir, homedir } from 'os';
import * as path from 'path';
import axios from 'axios';
import { GoogleGenerativeAI } from '@google/generative-ai';

const execFileAsync = promisify(execFile);

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
const IG_URL_RE = /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p)\/([^/?#\s]+)/i;

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

const VIDEO_SCAN_PROMPT = `You are a fashion product detection AI analyzing an Instagram reel/video.
Watch the video and identify every visible clothing item, accessory, bag, or beauty product across all frames.

You have multiple sources to identify brands — use ALL of them:
1. VISUAL: logos, labels, and distinctive designs visible on clothing
2. AUDIO: listen carefully to what is spoken — creators often say brand names aloud
3. Use the most detailed frame(s) to identify each item

For each item return a JSON object with:
- brand: brand name (from audio, visual logo, or "Unknown")
- productName: specific product name
- type: category (e.g. "sneakers", "oversized tee", "cargo pants", "handbag")
- wearerGender: "men" | "women" | "unisex" | "unknown"
- color: dominant color(s)
- pattern: "solid" | "striped" | "checkered" | "printed" | "floral" | "camo" | "other"
- fit: "slim" | "regular" | "oversized" | "relaxed" | "unknown"
- details: notable design details
- searchQuery: a short search string to find this item
- confidence: 0.0 to 1.0

Return ONLY a JSON object: { "items": [ ...array of items above... ] }
If no fashion items are visible, return { "items": [] }`;

// Optional cookies file for yt-dlp — improves access to login-required content.
// Generate with: yt-dlp --cookies-from-browser safari -o /dev/null https://www.instagram.com/
const COOKIES_FILE = path.join(homedir(), '.config', 'yt-dlp', 'ig-cookies.txt');

const SCAN_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-2.0-flash'];

@Injectable()
export class ReelScannerService {
  private readonly logger = new Logger(ReelScannerService.name);
  private readonly genAI: GoogleGenerativeAI | null = null;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('SHOPPING_GEMINI_API_KEY');
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.logger.log('ReelScannerService: Gemini initialized with SHOPPING_GEMINI_API_KEY');
    } else {
      this.logger.warn('ReelScannerService: SHOPPING_GEMINI_API_KEY not set — reel scanning disabled');
    }
  }

  private isAvailable(): boolean {
    return this.genAI !== null;
  }

  private async runWithFallback(
    operation: (model: any) => Promise<any>,
    tag: string,
  ): Promise<any> {
    if (!this.genAI) throw new Error('Gemini not initialized');
    for (const modelName of SCAN_MODELS) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        return await operation(model);
      } catch (err: any) {
        const retryable =
          String(err?.message).includes('429') ||
          String(err?.message).includes('503') ||
          String(err?.message).includes('RESOURCE_EXHAUSTED') ||
          String(err?.message).includes('UNAVAILABLE');
        if (retryable && modelName !== SCAN_MODELS[SCAN_MODELS.length - 1]) {
          this.logger.warn(`[${tag}] ${modelName} unavailable — trying next model`);
          continue;
        }
        throw err;
      }
    }
  }

  async scanUrl(url: string): Promise<ScanResult> {
    const trimmed = url.trim();

    // Direct image URL — scan immediately
    if (IMAGE_EXTENSIONS.test(trimmed)) {
      return this.scanImageUrl(trimmed);
    }

    // Instagram reel or post — download with yt-dlp for best results
    if (IG_URL_RE.test(trimmed)) {
      return this.scanInstagramUrl(trimmed);
    }

    // Other video URL — yt-dlp not supported here
    if (this.isVideoUrl(trimmed)) {
      this.logger.warn(`Non-Instagram video URL detected — yt-dlp not attempted: ${trimmed}`);
      return { sourceImageUrl: trimmed, items: [] };
    }

    // Web page — extract og:image and scan that
    const ogImage = await this.extractOgImage(trimmed);
    if (ogImage) {
      this.logger.log(`og:image extracted: ${ogImage}`);
      return this.scanImageUrl(ogImage);
    }

    this.logger.warn(`Could not extract image from: ${trimmed}`);
    return { sourceImageUrl: trimmed, items: [] };
  }

  // ─── Instagram reel / post flow ──────────────────────────────────────────────

  private async scanInstagramUrl(url: string): Promise<ScanResult> {
    const tmpDir = path.join(tmpdir(), `ig-scan-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });

    try {
      // Download media and extract caption in parallel
      const [caption, media] = await Promise.all([
        this.extractCaption(url),
        this.downloadMedia(url, tmpDir),
      ]);

      if (media?.type === 'video') {
        return this.scanVideoFile(url, media.filePath, caption);
      }

      if (media?.type === 'image') {
        const imgData = await readFile(media.filePath);
        return this.scanImageData(url, imgData, 'image/jpeg', caption);
      }

      // yt-dlp failed — fall back to og:image scrape
      this.logger.warn(`yt-dlp download failed for ${url} — falling back to og:image`);
      const ogImage = await this.extractOgImage(url);
      if (ogImage) {
        return this.scanImageUrl(ogImage);
      }

      return { sourceImageUrl: url, items: [] };
    } finally {
      // Clean up temp files
      try {
        const { readdir } = await import('fs/promises');
        const files = await readdir(tmpDir);
        await Promise.all(files.map((f) => unlink(path.join(tmpDir, f)).catch(() => {})));
      } catch { /* ignore cleanup errors */ }
    }
  }

  private async extractCaption(url: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync('python3', [
        '-m', 'yt_dlp', '--no-playlist', '--skip-download',
        '--print', '%(description)s',
        '--quiet', url,
        ...this.cookiesArgs(),
      ], { timeout: 20000 });
      return stdout.trim();
    } catch {
      return '';
    }
  }

  private async downloadMedia(
    url: string,
    outDir: string,
  ): Promise<{ filePath: string; type: 'video' | 'image' } | null> {
    const outTemplate = path.join(outDir, 'media.%(ext)s');

    try {
      await execFileAsync('python3', [
        '-m', 'yt_dlp', '--no-playlist',
        '--format', 'mp4/bestvideo[ext=mp4]/best',
        '-o', outTemplate, '--quiet', url,
        ...this.cookiesArgs(),
      ], { timeout: 60000 });

      // Check video extensions first
      for (const ext of ['mp4', 'webm', 'mkv', 'mov']) {
        const fp = path.join(outDir, `media.${ext}`);
        if (existsSync(fp)) return { filePath: fp, type: 'video' };
      }

      // Posts may download as images
      for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
        const fp = path.join(outDir, `media.${ext}`);
        if (existsSync(fp)) return { filePath: fp, type: 'image' };
      }
    } catch { /* fall through to thumbnail attempt */ }

    // Fallback: download thumbnail only
    try {
      await execFileAsync('python3', [
        '-m', 'yt_dlp', '--no-playlist',
        '--write-thumbnail', '--skip-download',
        '-o', path.join(outDir, 'media'), '--quiet', url,
        ...this.cookiesArgs(),
      ], { timeout: 30000 });

      for (const ext of ['jpg', 'jpeg', 'png', 'webp']) {
        const fp = path.join(outDir, `media.${ext}`);
        if (existsSync(fp)) return { filePath: fp, type: 'image' };
      }
    } catch { /* ignore */ }

    return null;
  }

  private cookiesArgs(): string[] {
    return existsSync(COOKIES_FILE) ? ['--cookies', COOKIES_FILE] : [];
  }

  // ─── Gemini vision analysis ──────────────────────────────────────────────────

  async scanImageUrl(imageUrl: string): Promise<ScanResult> {
    if (!this.isAvailable()) {
      this.logger.warn('Gemini not available — SHOPPING_GEMINI_API_KEY missing');
      return { sourceImageUrl: imageUrl, items: [] };
    }

    try {
      const imageData = await this.fetchImageAsBase64(imageUrl);
      return this.scanImageData(imageUrl, Buffer.from(imageData, 'base64'), 'image/jpeg');
    } catch (error) {
      this.logger.error(`Scan failed for ${imageUrl}: ${error.message}`);
      return { sourceImageUrl: imageUrl, items: [] };
    }
  }

  private async scanImageData(
    sourceUrl: string,
    imageBuffer: Buffer,
    mimeType: string,
    caption = '',
  ): Promise<ScanResult> {
    if (!this.isAvailable()) {
      return { sourceImageUrl: sourceUrl, items: [] };
    }

    const captionContext = caption
      ? `\n\nCaption context (use @mentions as brand hints): "${caption.slice(0, 500)}"`
      : '';

    try {
      const result = await this.runWithFallback(async (model) => {
        const response = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { mimeType, data: imageBuffer.toString('base64') } },
              { text: SCAN_PROMPT + captionContext },
            ],
          }],
          generationConfig: { response_mime_type: 'application/json', temperature: 0.2 },
        });
        return response.response;
      }, 'scanReelImage');

      return { sourceImageUrl: sourceUrl, items: this.parseItems(result.text()) };
    } catch (error) {
      this.logger.error(`Image scan failed for ${sourceUrl}: ${error.message}`);
      return { sourceImageUrl: sourceUrl, items: [] };
    }
  }

  private async scanVideoFile(sourceUrl: string, filePath: string, caption = ''): Promise<ScanResult> {
    if (!this.isAvailable()) {
      return { sourceImageUrl: sourceUrl, items: [] };
    }

    const captionContext = caption
      ? `\n\nCaption context (use @mentions as brand hints): "${caption.slice(0, 500)}"`
      : '';

    try {
      const fileData = await readFile(filePath);
      const base64 = fileData.toString('base64');

      // Try Gemini Files API first (handles larger videos, enables audio analysis)
      // Inline base64 scan (works for smaller videos)
      const parts = [
        { inlineData: { data: base64, mimeType: 'video/mp4' } },
        { text: VIDEO_SCAN_PROMPT + captionContext },
      ];

      const result = await this.runWithFallback(async (model) => {
        const response = await model.generateContent({
          contents: [{ role: 'user', parts }],
          generationConfig: { response_mime_type: 'application/json', temperature: 0.2 },
        });
        return response.response;
      }, 'scanReelVideo');

      return { sourceImageUrl: sourceUrl, items: this.parseItems(result.text()) };
    } catch (error) {
      this.logger.error(`Video scan failed for ${sourceUrl}: ${error.message}`);
      return { sourceImageUrl: sourceUrl, items: [] };
    }
  }

  // ─── Parsing ─────────────────────────────────────────────────────────────────

  private parseItems(text: string): ScannedItem[] {
    try {
      const parsed = JSON.parse(text);
      return (parsed.items || []).map((item: any) => ({
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
    } catch {
      return [];
    }
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

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
