import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  SchemaType,
  FunctionDeclaration,
  FunctionDeclarationsTool,
} from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import { ReelScannerService } from '../reel-scanner/reel-scanner.service';
import { CatalogSearchService } from '../catalog-search/catalog-search.service';
import { RazorpayService } from '../shared/razorpay.service';

// ─── Tool declarations ────────────────────────────────────────────────────────

const scanReelTool: FunctionDeclaration = {
  name: 'scan_reel',
  description: 'Scan an image URL or web page to detect fashion products. Returns items with brand, type, color, and search query.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      url: { type: SchemaType.STRING, description: 'URL to scan — direct image or web page with og:image' },
    },
    required: ['url'],
  },
};

const searchCatalogTool: FunctionDeclaration = {
  name: 'search_catalog',
  description: 'Search 23 Indian D2C brand catalogs (Snitch, Blissclub, Wrogn, Mokobara, Sugar, etc.) for products with price, image, and buy URL.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: { type: SchemaType.STRING, description: 'Search query e.g. "oversized white tee"' },
      gender: { type: SchemaType.STRING, description: 'Optional: "men", "women", or "unisex"' },
      category: { type: SchemaType.STRING, description: 'Optional category e.g. "tee", "jeans", "bag"' },
      limit_per_brand: { type: SchemaType.NUMBER, description: 'Max results per brand (default 4)' },
    },
    required: ['query'],
  },
};

const createPaymentLinkTool: FunctionDeclaration = {
  name: 'create_payment_link',
  description: 'Create a Razorpay payment link. Returns a short URL the user opens to pay.',
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      amount_inr: { type: SchemaType.NUMBER, description: 'Amount in INR' },
      description: { type: SchemaType.STRING, description: 'What the user is buying' },
      customer_name: { type: SchemaType.STRING, description: 'Customer full name' },
      customer_phone: { type: SchemaType.STRING, description: 'Customer phone (10 digits)' },
      customer_email: { type: SchemaType.STRING, description: 'Customer email address' },
    },
    required: ['amount_inr', 'description', 'customer_name', 'customer_phone', 'customer_email'],
  },
};

const TOOLS: FunctionDeclarationsTool[] = [
  { functionDeclarations: [scanReelTool, searchCatalogTool, createPaymentLinkTool] },
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

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class ShoppingAgentService {
  private readonly logger = new Logger(ShoppingAgentService.name);
  private readonly sessions = new Map<string, any[]>();
  private readonly sessionProducts = new Map<string, any[]>();
  // Own Gemini client for function-calling (needs tools attached at model creation)
  private readonly agentGenAI: GoogleGenerativeAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly reelScannerService: ReelScannerService,
    private readonly catalogSearchService: CatalogSearchService,
    private readonly razorpayService: RazorpayService,
  ) {
    const apiKey = this.configService.get<string>('SHOPPING_GEMINI_API_KEY');
    if (apiKey) this.agentGenAI = new GoogleGenerativeAI(apiKey);
  }

  async chat(sessionId: string | undefined, userMessage: string) {
    const sid = sessionId ?? uuidv4();

    if (!this.agentGenAI) {
      return { sessionId: sid, reply: 'AI service not configured. Set GEMINI_API_KEY.', toolsUsed: [], products: [] };
    }

    if (!this.sessions.has(sid)) {
      this.sessions.set(sid, []);
      this.sessionProducts.set(sid, []);
    }

    const history = this.sessions.get(sid)!;
    const toolsUsed: string[] = [];

    history.push({ role: 'user', parts: [{ text: userMessage }] });

    const model = this.agentGenAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      tools: TOOLS,
      systemInstruction: { role: 'system', parts: [{ text: SYSTEM_PROMPT }] },
    });

    let finalText = '';

    for (let i = 0; i < 6; i++) {
      const result = await model.generateContent({ contents: history });
      const response = result.response;
      const fnCalls = response.functionCalls();

      if (!fnCalls || fnCalls.length === 0) {
        finalText = response.text();
        history.push({ role: 'model', parts: [{ text: finalText }] });
        break;
      }

      history.push({ role: 'model', parts: fnCalls.map(fc => ({ functionCall: fc })) });

      const responseParts: any[] = [];
      for (const fnCall of fnCalls) {
        toolsUsed.push(fnCall.name);
        this.logger.debug(`Tool: ${fnCall.name}`);
        const toolResult = await this.executeTool(fnCall.name, fnCall.args, sid);
        responseParts.push({ functionResponse: { name: fnCall.name, response: toolResult } });
      }

      history.push({ role: 'user', parts: responseParts });
    }

    if (history.length > 30) this.sessions.set(sid, history.slice(-30));

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
      .filter(t => t.parts.some((p: any) => p.text))
      .map(t => ({ role: t.role, text: t.parts.filter((p: any) => p.text).map((p: any) => p.text).join('') }));
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
