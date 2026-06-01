import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { ReelScannerService } from '../reel-scanner/reel-scanner.service';
import { CatalogSearchService } from '../catalog-search/catalog-search.service';
import { RazorpayService } from '../shared/razorpay.service';

// ─── DM response types ────────────────────────────────────────────────────────

export interface DmText {
  kind: 'text';
  text: string;
}

export interface DmTiles {
  kind: 'tiles';
  text: string;
  tiles: Array<{ title: string; payload: string }>;
}

export interface DmProducts {
  kind: 'products';
  intro: string;
  hits: any[];
}

export interface DmPaymentLink {
  kind: 'payment_link';
  productName: string;
  brandName: string;
  price: string;
  paymentUrl: string;
}

export type DmResponse = DmText | DmTiles | DmProducts | DmPaymentLink;

// ─── Session item types ───────────────────────────────────────────────────────

interface ReelItem {
  label: string;
  brand?: string;
  category?: string;
  description?: string;
}

// ─── Tool declarations ────────────────────────────────────────────────────────

const TOOLS: any[] = [
  {
    functionDeclarations: [
      {
        name: 'scan_reel',
        description: 'Scan an image URL or web page to detect fashion products. Returns items with brand, type, color, and search query.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            url: { type: Type.STRING, description: 'URL to scan — direct image or web page with og:image' },
          },
          required: ['url'],
        },
      },
      {
        name: 'show_product_tiles',
        description: 'After scan_reel, present identified items as tappable quick-reply tiles. Call this IMMEDIATELY after scan_reel — do NOT call search_catalog right away.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            intro: { type: Type.STRING, description: 'Short intro, e.g. "Found 3 items in this reel 👇"' },
            products: {
              type: 'ARRAY',
              description: 'All products identified from the reel',
              items: {
                type: 'OBJECT',
                properties: {
                  label: { type: 'STRING', description: 'Short tile label ≤18 chars, e.g. "Pink Crop Top"' },
                  brand: { type: 'STRING', description: 'Brand name or "Unknown"' },
                  category: { type: 'STRING', description: 'e.g. "top", "bottom", "footwear", "activewear"' },
                  description: { type: 'STRING', description: 'Color, material, fit details' },
                },
                required: ['label'],
              },
            },
          },
          required: ['intro', 'products'],
        },
      },
      {
        name: 'search_catalog',
        description: 'Search Indian D2C brand catalogs for a product the user selected. Results are buffered — call present_products when done searching.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: 'Search query e.g. "oversized white tee"' },
            gender: { type: Type.STRING, description: 'Optional: "men", "women", or "unisex"' },
            category: { type: Type.STRING, description: 'Optional category e.g. "tee", "jeans", "bag"' },
            limit_per_brand: { type: Type.NUMBER, description: 'Max results per brand (default 4)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'present_products',
        description: 'Flush all buffered search_catalog results and show them to the user as a product list. Call ONCE after all search_catalog calls are done.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            intro: { type: Type.STRING, description: 'Short intro above the cards, e.g. "Here are some picks 👇"' },
          },
          required: ['intro'],
        },
      },
      {
        name: 'check_stock',
        description: 'Check if a specific size is available for a product. Call after user tells you their size.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            product_url: { type: Type.STRING, description: 'The product page URL' },
            product_name: { type: Type.STRING, description: 'Product name for search query' },
            size: { type: Type.STRING, description: 'Size requested by user, e.g. "M", "L", "XL", "38"' },
          },
          required: ['product_url', 'size'],
        },
      },
      {
        name: 'create_payment_link',
        description: 'Create a Razorpay payment link. Only call after stock is confirmed or check failed. Returns a short URL.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            amount_inr: { type: Type.NUMBER, description: 'Amount in INR' },
            product_name: { type: Type.STRING, description: 'Product name' },
            brand_name: { type: Type.STRING, description: 'Brand name' },
            product_url: { type: Type.STRING, description: 'Direct product page URL' },
            size: { type: Type.STRING, description: 'Size selected by user' },
            customer_name: { type: Type.STRING, description: 'Customer full name (if known)' },
            customer_phone: { type: Type.STRING, description: 'Customer phone (if known)' },
            customer_email: { type: Type.STRING, description: 'Customer email (if known)' },
          },
          required: ['amount_inr', 'product_name', 'brand_name', 'product_url'],
        },
      },
    ],
  },
];

const SYSTEM_PROMPT = `You are a fashion shopping assistant in Instagram DMs. Help users discover and buy products from Indian D2C brands.

REEL / POST FLOW:
Step 1 — User shares an Instagram URL → call scan_reel
Step 2 — Immediately call show_product_tiles after scan_reel — do NOT search yet
Step 3 — Output NO text after show_product_tiles — the tiles guide the user
Step 4 — User taps a tile (message: TILE|product_name|brand|category|description) → call search_catalog then present_products

DIRECT SHOPPING QUERIES — when user asks without sharing a reel:
→ Expand into 2–3 specific product types, call search_catalog once per type
→ After ALL search_catalog calls finish, call present_products ONCE with a relevant intro
→ DO NOT ask them to share a reel first

PURCHASE FLOW:
• User taps "I want this 🛍️" → message: WANT|product_title|brand|price|product_url
  → Ask: "What size are you? (XS / S / M / L / XL / XXL)"
• User replies with size → call check_stock(product_url, product_name, size)
  → If available=true: say "Size [X] is in stock ✓" then call create_payment_link
  → If available=false: share available sizes, ask if they want another size
  → If checked=false: call create_payment_link immediately — skip stock text
• After create_payment_link: output NO text — the payment link message is sent automatically

SEARCH → PRESENT RULE:
• search_catalog results are BUFFERED — not shown until present_products is called
• Always call present_products once after all search_catalog calls

RULES:
• Text: short, 1–3 sentences, no markdown formatting
• ₹ for prices. Never invent prices.
• Only call show_product_tiles ONCE per reel
• Help with any clothing/fashion/shopping request — only redirect truly off-topic messages`;

// ─── Model fallback chain ─────────────────────────────────────────────────────

const MODEL_CHAIN = [
  { model: 'gemini-2.5-flash', thinkingBudget: 8000 },
  { model: 'gemini-2.5-flash-lite', thinkingBudget: 8000 },
  { model: 'gemini-2.0-flash', thinkingBudget: 0 },
];

const IG_REEL_RE = /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|reels|p)\/([^/?#\s]+)/i;

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ShoppingAgentService {
  private readonly logger = new Logger(ShoppingAgentService.name);

  // Conversation history per session
  private readonly sessions = new Map<string, any[]>();

  // Products accumulated in session (for REST API backward-compat)
  private readonly sessionProducts = new Map<string, any[]>();

  // v4: reel item tiles per session
  private readonly reelItemStore = new Map<string, ReelItem[]>();

  // v4: which tile items have been explored
  private readonly exploredItems = new Map<string, Set<string>>();

  // v4: reel analysis cache (senderId:normalizedUrl → result)
  private readonly reelAnalysisCache = new Map<string, any>();

  // v4: product buffer per session (search_catalog → present_products)
  private readonly productBuffer = new Map<string, any[]>();

  private readonly ai: GoogleGenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly reelScannerService: ReelScannerService,
    private readonly catalogSearchService: CatalogSearchService,
    private readonly razorpayService: RazorpayService,
  ) {
    const apiKey = this.configService.get<string>('SHOPPING_GEMINI_API_KEY');
    if (apiKey) this.ai = new GoogleGenAI({ apiKey });
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  async chat(sessionId: string | undefined, userMessage: string): Promise<{
    sessionId: string;
    reply: string;
    toolsUsed: string[];
    products: any[];
    responses: DmResponse[];
  }> {
    const sid = sessionId ?? uuidv4();

    if (!this.ai) {
      return { sessionId: sid, reply: 'AI service not configured. Set SHOPPING_GEMINI_API_KEY.', toolsUsed: [], products: [], responses: [] };
    }

    // v4: reset session if a new reel URL is detected
    this.maybeResetForReel(sid, userMessage);

    if (!this.sessions.has(sid)) {
      this.sessions.set(sid, []);
      this.sessionProducts.set(sid, []);
      this.productBuffer.set(sid, []);
    }

    const history = this.sessions.get(sid)!;
    const toolsUsed: string[] = [];
    const responses: DmResponse[] = [];

    history.push({ role: 'user', parts: [{ text: userMessage }] });

    let finalText = '';
    let activeModel = MODEL_CHAIN[0];

    for (let i = 0; i < 10; i++) {
      let response: any;

      for (let m = MODEL_CHAIN.indexOf(activeModel); m < MODEL_CHAIN.length; m++) {
        try {
          const cfg = MODEL_CHAIN[m];
          response = await this.ai.models.generateContent({
            model: cfg.model,
            contents: history,
            config: {
              systemInstruction: SYSTEM_PROMPT,
              tools: TOOLS,
              thinkingConfig: { thinkingBudget: cfg.thinkingBudget },
            },
          });
          if (activeModel !== MODEL_CHAIN[m]) {
            this.logger.warn(`Fell back to ${MODEL_CHAIN[m].model}`);
            activeModel = MODEL_CHAIN[m];
          }
          break;
        } catch (err: any) {
          const code = err?.status ?? err?.code ?? 0;
          const retryable =
            code === 503 || code === 429 ||
            String(err?.message).includes('503') ||
            String(err?.message).includes('429') ||
            String(err?.message).includes('UNAVAILABLE') ||
            String(err?.message).includes('RESOURCE_EXHAUSTED');
          if (retryable && m < MODEL_CHAIN.length - 1) {
            this.logger.warn(`${MODEL_CHAIN[m].model} unavailable — trying ${MODEL_CHAIN[m + 1].model}`);
            continue;
          }
          throw err;
        }
      }

      const parts = response?.candidates?.[0]?.content?.parts ?? [];
      const modelParts: any[] = [];
      const fnCalls: any[] = [];

      for (const part of parts) {
        if (part.functionCall) {
          fnCalls.push(part.functionCall);
          modelParts.push({ functionCall: part.functionCall });
        } else if (part.text && !part.thought) {
          finalText = part.text;
          modelParts.push({ text: part.text });
          responses.push({ kind: 'text', text: part.text });
        } else if (part.thought) {
          modelParts.push(part);
        }
      }

      if (modelParts.length) {
        history.push({ role: 'model', parts: modelParts });
      }

      if (fnCalls.length === 0) break;

      const responseParts: any[] = [];
      for (const fc of fnCalls) {
        toolsUsed.push(fc.name);
        this.logger.debug(`Tool: ${fc.name}(${JSON.stringify(fc.args).slice(0, 120)})`);

        const { result, dmResponse } = await this.executeTool(fc.name, fc.args, sid);
        if (dmResponse) responses.push(dmResponse);

        responseParts.push({ functionResponse: { name: fc.name, response: result } });
      }
      history.push({ role: 'user', parts: responseParts });
    }

    // Trim history to last 40 parts (20 turns)
    this.trimHistory(sid);

    return {
      sessionId: sid,
      reply: finalText || 'Could not process your request. Please try again.',
      toolsUsed,
      products: this.sessionProducts.get(sid) ?? [],
      responses,
    };
  }

  getHistory(sessionId: string) {
    const history = this.sessions.get(sessionId);
    if (!history) return null;
    return history
      .filter((t) => t.parts.some((p: any) => p.text && !p.thought))
      .map((t) => ({
        role: t.role,
        text: t.parts.filter((p: any) => p.text && !p.thought).map((p: any) => p.text).join(''),
      }));
  }

  clearSession(sessionId: string): boolean {
    const existed = this.sessions.has(sessionId);
    this.sessions.delete(sessionId);
    this.sessionProducts.delete(sessionId);
    this.reelItemStore.delete(sessionId);
    this.exploredItems.delete(sessionId);
    this.productBuffer.delete(sessionId);
    return existed;
  }

  // ─── Session helpers ─────────────────────────────────────────────────────────

  private maybeResetForReel(sid: string, text: string): void {
    if (!IG_REEL_RE.test(text)) return;
    this.logger.log(`[shopping-agent] New reel URL detected — resetting session for ${sid}`);
    this.sessions.delete(sid);
    this.reelItemStore.delete(sid);
    this.exploredItems.delete(sid);
    this.productBuffer.delete(sid);
  }

  private trimHistory(sid: string): void {
    const history = this.sessions.get(sid);
    if (!history || history.length <= 40) return;

    // Find a safe cut point — must land on a regular user text turn
    // (not a functionResponse turn) to avoid Gemini INVALID_ARGUMENT errors
    let cutTo = history.length - 40;
    while (cutTo < history.length) {
      const entry = history[cutTo];
      const isUserText =
        entry.role === 'user' &&
        entry.parts.some((p: any) => typeof p.text === 'string');
      if (isUserText) break;
      cutTo++;
    }
    if (cutTo > 0 && cutTo < history.length) {
      history.splice(0, cutTo);
    }
  }

  private getUnexploredItems(sid: string): ReelItem[] {
    const all = this.reelItemStore.get(sid) ?? [];
    const explored = this.exploredItems.get(sid) ?? new Set();
    return all.filter((item) => !explored.has(item.label));
  }

  // ─── Tool execution ──────────────────────────────────────────────────────────

  private async executeTool(
    name: string,
    args: any,
    sid: string,
  ): Promise<{ result: any; dmResponse?: DmResponse }> {
    try {
      switch (name) {

        // ── scan_reel ─────────────────────────────────────────────────────────
        case 'scan_reel': {
          const cacheKey = `${sid}:${this.normalizeReelUrl(args.url)}`;
          if (this.reelAnalysisCache.has(cacheKey)) {
            this.logger.log(`[scan_reel] cache hit: ${cacheKey}`);
            return { result: this.reelAnalysisCache.get(cacheKey) };
          }

          const scan = await this.reelScannerService.scanUrl(args.url);
          const result = { sourceImageUrl: scan.sourceImageUrl, itemsFound: scan.items.length, items: scan.items };

          this.reelAnalysisCache.set(cacheKey, result);
          if (this.reelAnalysisCache.size > 200) {
            const firstKey = this.reelAnalysisCache.keys().next().value;
            if (firstKey) this.reelAnalysisCache.delete(firstKey);
          }

          return { result };
        }

        // ── show_product_tiles ────────────────────────────────────────────────
        case 'show_product_tiles': {
          const intro = (args.intro as string) || 'Found some items 👇 Tap one to explore!';
          const products: ReelItem[] = args.products ?? [];

          // Save all reel items for this session
          this.reelItemStore.set(sid, products);
          this.exploredItems.set(sid, new Set());

          const tiles = products.slice(0, 13).map((p) => ({
            title: (p.label ?? 'Item').slice(0, 18),
            payload: `TILE|${p.label}|${p.brand ?? 'Unknown'}|${p.category ?? ''}|${p.description ?? ''}`,
          }));

          const dmResponse: DmTiles = { kind: 'tiles', text: intro, tiles };
          return { result: { shown: tiles.length }, dmResponse };
        }

        // ── search_catalog ────────────────────────────────────────────────────
        case 'search_catalog': {
          // Mark explored
          if (args.query) {
            const exp = this.exploredItems.get(sid) ?? new Set<string>();
            exp.add(args.query);
            this.exploredItems.set(sid, exp);
          }

          const products = await this.catalogSearchService.search(args.query, {
            gender: args.gender,
            category: args.category,
            limitPerBrand: args.limit_per_brand ?? 4,
          });

          // Buffer — don't send yet
          const buf = this.productBuffer.get(sid) ?? [];
          buf.push(...products);
          this.productBuffer.set(sid, buf);

          // Also update sessionProducts for backward compat
          const existing = this.sessionProducts.get(sid) ?? [];
          this.sessionProducts.set(sid, [...existing, ...products].slice(0, 20));

          return { result: { buffered: products.length, total: products.length } };
        }

        // ── present_products ──────────────────────────────────────────────────
        case 'present_products': {
          const intro = (args.intro as string) || 'Here are some options 👇';
          const buf = this.productBuffer.get(sid) ?? [];

          // Deduplicate by URL, cap at 10
          const seen = new Set<string>();
          const hits = buf.filter((h) => {
            if (seen.has(h.url)) return false;
            seen.add(h.url);
            return true;
          }).slice(0, 10);

          // Clear buffer for next interaction
          this.productBuffer.set(sid, []);

          if (hits.length === 0) {
            return { result: { shown: 0 }, dmResponse: { kind: 'text', text: 'Sorry, no products found for that item right now.' } };
          }

          const dmResponse: DmProducts = { kind: 'products', intro, hits };
          return { result: { shown: hits.length }, dmResponse };
        }

        // ── check_stock ───────────────────────────────────────────────────────
        case 'check_stock': {
          const { available, availableSizes, checked, price } = await this.checkStock(
            args.product_url,
            args.product_name ?? '',
            args.size,
          );

          return {
            result: {
              checked,
              available: checked ? available : true,
              available_sizes: availableSizes,
              size_requested: args.size,
              price_inr: price ?? null,
              message: !checked
                ? `Size ${args.size} assumed available — proceed to payment.`
                : available
                  ? `Size ${args.size} is in stock ✓${price ? ` · ₹${price}` : ''}`
                  : `Size ${args.size} is out of stock. Available: ${availableSizes.join(', ') || 'none listed'}`,
            },
          };
        }

        // ── create_payment_link ───────────────────────────────────────────────
        case 'create_payment_link': {
          const result = await this.razorpayService.createPaymentLink(
            args.amount_inr,
            `${args.product_name} — ${args.brand_name}${args.size ? ` (Size: ${args.size})` : ''}`.slice(0, 100),
            args.customer_name || undefined,
            args.customer_phone || undefined,
            args.customer_email || undefined,
            uuidv4(),
            { product_url: (args.product_url ?? '').slice(0, 256), ...(args.size ? { size: args.size } : {}) },
          );

          if (!result.success) {
            return { result: { error: result.error } };
          }

          const dmResponse: DmPaymentLink = {
            kind: 'payment_link',
            productName: args.product_name,
            brandName: args.brand_name,
            price: `₹${args.amount_inr}`,
            paymentUrl: result.shortUrl,
          };
          return { result: { success: true, message: 'Payment link sent. Do not output any text.' }, dmResponse };
        }

        default:
          return { result: { error: `Unknown tool: ${name}` } };
      }
    } catch (err: any) {
      this.logger.error(`Tool ${name} failed: ${err?.message}`);
      return { result: { error: err?.message ?? String(err) } };
    }
  }

  // ─── Stock check ─────────────────────────────────────────────────────────────

  /**
   * Strategy 1: Parse JSON-LD schema.org structured data from the product page.
   * Fast, free, no API call. Works on Shopify stores and most brand sites.
   */
  private async checkStockViaJsonLd(
    productUrl: string,
    size: string,
  ): Promise<{ available: boolean; availableSizes: string[] } | null> {
    try {
      const res = await fetch(productUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InCollabShopping/1.0)', 'Accept-Language': 'en-US,en;q=0.9' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;

      const html = await res.text();
      const scripts = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];

      for (const [, raw] of scripts) {
        try {
          const schema = JSON.parse(raw);
          const products: unknown[] = Array.isArray(schema) ? schema : [schema];
          for (const item of products) {
            const p = item as Record<string, unknown>;
            if (p['@type'] !== 'Product') continue;

            const variants: Array<{ name: string; available: boolean }> = [];

            const hasVariant = p['hasVariant'] as Array<Record<string, unknown>> | undefined;
            if (Array.isArray(hasVariant)) {
              for (const v of hasVariant) {
                const offers = v['offers'] as Record<string, unknown> | undefined;
                const avail = String(offers?.['availability'] ?? '').toLowerCase().includes('instock');
                variants.push({ name: String(v['name'] ?? ''), available: avail });
              }
            }

            const offers = p['offers'] as Record<string, unknown> | undefined;
            if (offers?.['@type'] === 'AggregateOffer') {
              const offersArr = offers['offers'] as Array<Record<string, unknown>> | undefined;
              for (const o of offersArr ?? []) {
                const avail = String(o['availability'] ?? '').toLowerCase().includes('instock');
                const name = String(o['sku'] ?? o['name'] ?? o['description'] ?? '');
                if (name) variants.push({ name, available: avail });
              }
            }

            if (!variants.length) continue;

            const normalized = size.trim().toUpperCase();
            const availableSizes = variants.filter((v) => v.available).map((v) => v.name.trim());
            const target = variants.find(
              (v) =>
                v.name.trim().toUpperCase() === normalized ||
                v.name.trim().toUpperCase().includes(normalized),
            );
            return { available: target?.available ?? false, availableSizes };
          }
        } catch { /* malformed JSON-LD — try next */ }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Strategy 2: Gemini Google Search grounding — browses the live product page.
   * Same mechanism as the main Gemini chat. Has a 20s timeout.
   */
  private async checkStockViaGrounding(
    productUrl: string,
    productName: string,
    size: string,
  ): Promise<{ available: boolean; availableSizes: string[]; price?: number } | null> {
    if (!this.ai) return null;

    try {
      const result = await Promise.race([
        this.ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{
            role: 'user',
            parts: [{
              text: `Check the current stock and price for "${productName}" at this URL: ${productUrl}
1. Is size "${size}" currently in stock?
2. List all sizes currently available.
3. What is the current price in INR (number only, no symbol)?
Return ONLY valid JSON (no markdown): {"available": true/false, "available_sizes": ["XS","S","M"], "price_inr": 2990, "found": true/false}
If you cannot determine stock, return {"found": false}.`,
            }],
          }],
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0,
          },
        }),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error('timeout')), 20000)),
      ]);

      if (!result) return null;
      const text = (result as any).text ?? '';
      const match = text.match(/\{[\s\S]*?\}/);
      if (!match) return null;
      const data = JSON.parse(match[0]);
      if (!data.found) return null;
      return {
        available: data.available ?? false,
        availableSizes: data.available_sizes ?? [],
        price: typeof data.price_inr === 'number' ? data.price_inr : undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Combined stock check — tries JSON-LD first, then Gemini grounding.
   * If both fail, returns checked=false (assumed available, proceed to checkout).
   */
  private async checkStock(
    productUrl: string,
    productName: string,
    size: string,
  ): Promise<{ available: boolean; availableSizes: string[]; checked: boolean; price?: number }> {
    const jsonLd = await this.checkStockViaJsonLd(productUrl, size);
    if (jsonLd) return { ...jsonLd, checked: true };

    const grounding = await this.checkStockViaGrounding(productUrl, productName, size);
    if (grounding) return { ...grounding, checked: true };

    // Both failed — assume available, proceed to checkout without blocking user
    return { available: true, availableSizes: [], checked: false };
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  private normalizeReelUrl(url: string): string {
    return (url ?? '').replace(/[?&]igsh=[^&]*/gi, '').replace(/\/$/, '');
  }
}
