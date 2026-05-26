import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import { ReelScannerService } from '../reel-scanner/reel-scanner.service';
import { CatalogSearchService } from '../catalog-search/catalog-search.service';
import { RazorpayService } from '../shared/razorpay.service';

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
        name: 'search_catalog',
        description: 'Search 23 Indian D2C brand catalogs (Snitch, Blissclub, Wrogn, Mokobara, Sugar, etc.) for products with price, image, and buy URL.',
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
        name: 'create_payment_link',
        description: 'Create a Razorpay payment link. Returns a short URL the user opens to pay.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            amount_inr: { type: Type.NUMBER, description: 'Amount in INR' },
            description: { type: Type.STRING, description: 'What the user is buying' },
            customer_name: { type: Type.STRING, description: 'Customer full name' },
            customer_phone: { type: Type.STRING, description: 'Customer phone (10 digits)' },
            customer_email: { type: Type.STRING, description: 'Customer email address' },
          },
          required: ['amount_inr', 'description', 'customer_name', 'customer_phone', 'customer_email'],
        },
      },
    ],
  },
];

const SYSTEM_PROMPT = `You are a friendly AI shopping concierge for Incollab.
Your job is to help users find and buy fashion products from Indian D2C brands.

When a user shares a reel, post URL, or image:
1. Use scan_reel to detect what products are visible
2. Use search_catalog to find matching products from our brand catalog
3. Present the top 3–5 results with name, brand, price, and buy link

When a user wants to buy a product:
- Ask for: full name, phone number, email address
- Use create_payment_link to generate a Razorpay checkout link
- Share the short URL with the user

Always be concise, warm, and helpful. Use Indian brand names and INR pricing.
If no exact match is found, suggest the closest available alternatives.`;

// ─── Model fallback chain ─────────────────────────────────────────────────────
// Tried in order — falls back on 503 (overload) or 429 (quota exceeded).

const MODEL_CHAIN = [
  { model: 'gemini-2.5-flash',      thinkingBudget: 8000 },
  { model: 'gemini-2.5-flash-lite', thinkingBudget: 8000 },
  { model: 'gemini-2.0-flash',      thinkingBudget: 0    },  // no thinking, but stable
];

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ShoppingAgentService {
  private readonly logger = new Logger(ShoppingAgentService.name);
  private readonly sessions = new Map<string, any[]>();
  private readonly sessionProducts = new Map<string, any[]>();
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

  async chat(sessionId: string | undefined, userMessage: string) {
    const sid = sessionId ?? uuidv4();

    if (!this.ai) {
      return { sessionId: sid, reply: 'AI service not configured. Set SHOPPING_GEMINI_API_KEY.', toolsUsed: [], products: [] };
    }

    if (!this.sessions.has(sid)) {
      this.sessions.set(sid, []);
      this.sessionProducts.set(sid, []);
    }

    const history = this.sessions.get(sid)!;
    const toolsUsed: string[] = [];

    history.push({ role: 'user', parts: [{ text: userMessage }] });

    let finalText = '';
    let activeModel = MODEL_CHAIN[0];

    for (let i = 0; i < 6; i++) {
      let response: any;
      // On each turn try the current model, fall back down the chain on overload/quota
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
          const retryable = code === 503 || code === 429 ||
            String(err?.message).includes('503') || String(err?.message).includes('429') ||
            String(err?.message).includes('UNAVAILABLE') || String(err?.message).includes('RESOURCE_EXHAUSTED');
          if (retryable && m < MODEL_CHAIN.length - 1) {
            this.logger.warn(`${MODEL_CHAIN[m].model} unavailable (${code}) — trying ${MODEL_CHAIN[m + 1].model}`);
            continue;
          }
          throw err;
        }
      }

      const candidates = response.candidates ?? [];
      const parts = candidates[0]?.content?.parts ?? [];

      // Collect all parts from this turn (thoughts + function calls + text)
      const modelParts: any[] = [];
      const fnCalls: any[] = [];

      for (const part of parts) {
        if (part.functionCall) {
          fnCalls.push(part.functionCall);
          modelParts.push({ functionCall: part.functionCall });
        } else if (part.text && !part.thought) {
          // Only keep non-thought text parts in what we surface to user
          finalText = part.text;
          modelParts.push({ text: part.text });
        } else if (part.thought) {
          // Keep thought parts in history so signatures stay intact
          modelParts.push(part);
        }
      }

      if (modelParts.length) {
        history.push({ role: 'model', parts: modelParts });
      }

      if (fnCalls.length === 0) break;

      // Execute tools and push results
      const responseParts: any[] = [];
      for (const fc of fnCalls) {
        toolsUsed.push(fc.name);
        this.logger.debug(`Tool: ${fc.name}(${JSON.stringify(fc.args).slice(0, 100)})`);
        const toolResult = await this.executeTool(fc.name, fc.args, sid);
        responseParts.push({ functionResponse: { name: fc.name, response: toolResult } });
      }
      history.push({ role: 'user', parts: responseParts });
    }

    if (history.length > 40) this.sessions.set(sid, history.slice(-40));

    return {
      sessionId: sid,
      reply: finalText || 'Could not process your request. Please try again.',
      toolsUsed,
      products: this.sessionProducts.get(sid) ?? [],
    };
  }

  getHistory(sessionId: string) {
    const history = this.sessions.get(sessionId);
    if (!history) return null;
    return history
      .filter(t => t.parts.some((p: any) => p.text && !p.thought))
      .map(t => ({
        role: t.role,
        text: t.parts.filter((p: any) => p.text && !p.thought).map((p: any) => p.text).join(''),
      }));
  }

  clearSession(sessionId: string): boolean {
    const existed = this.sessions.has(sessionId);
    this.sessions.delete(sessionId);
    this.sessionProducts.delete(sessionId);
    return existed;
  }

  private async executeTool(name: string, args: any, sessionId: string): Promise<any> {
    try {
      switch (name) {
        case 'scan_reel': {
          const result = await this.reelScannerService.scanUrl(args.url);
          return { sourceImageUrl: result.sourceImageUrl, itemsFound: result.items.length, items: result.items };
        }
        case 'search_catalog': {
          const products = await this.catalogSearchService.search(args.query, {
            gender: args.gender, category: args.category, limitPerBrand: args.limit_per_brand ?? 4,
          });
          const existing = this.sessionProducts.get(sessionId) ?? [];
          this.sessionProducts.set(sessionId, [...existing, ...products].slice(0, 20));
          return { total: products.length, products };
        }
        case 'create_payment_link': {
          const result = await this.razorpayService.createPaymentLink(
            args.amount_inr, args.description, args.customer_name, args.customer_phone, args.customer_email, uuidv4(),
          );
          return result.success
            ? { success: true, paymentUrl: result.shortUrl, paymentLinkId: result.paymentLinkId, amountInr: args.amount_inr }
            : { success: false, error: result.error };
        }
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err: any) {
      return { error: err?.message ?? String(err) };
    }
  }
}
