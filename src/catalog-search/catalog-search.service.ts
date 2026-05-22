import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { CatalogProduct } from './dto/catalog-search.dto';

// ─── Brand registry ──────────────────────────────────────────────────────────

interface BrandConfig {
  brand: string;
  gender: ('men' | 'women' | 'unisex')[];
  type: 'shopify' | 'snitch-sitemap' | 'newme-sitemap';
  origin: string;
}

const BRANDS: BrandConfig[] = [
  // ── Women's fashion ──
  { brand: 'Blissclub',         gender: ['women'],          type: 'shopify',        origin: 'https://blissclub.com' },
  { brand: 'Freakins',          gender: ['women'],          type: 'shopify',        origin: 'https://www.freakins.com' },
  { brand: 'Libas',             gender: ['women'],          type: 'shopify',        origin: 'https://www.libas.in' },
  { brand: 'House of Masaba',   gender: ['women'],          type: 'shopify',        origin: 'https://www.houseofmasaba.com' },
  { brand: 'Nicobar',           gender: ['women', 'men'],   type: 'shopify',        origin: 'https://www.nicobar.com' },
  { brand: 'Nonasties',         gender: ['women'],          type: 'shopify',        origin: 'https://nonasties.in' },
  { brand: 'Suta',              gender: ['women'],          type: 'shopify',        origin: 'https://suta.in' },
  { brand: 'Okhai',             gender: ['women'],          type: 'shopify',        origin: 'https://okhai.org' },
  { brand: 'Khara Kapas',       gender: ['women'],          type: 'shopify',        origin: 'https://kharakapas.com' },
  // ── Men's fashion ──
  { brand: 'Snitch',            gender: ['men'],             type: 'snitch-sitemap', origin: 'https://www.snitch.co' },
  { brand: 'Wrogn',             gender: ['men'],             type: 'shopify',        origin: 'https://wrogn.com' },
  { brand: 'XYXX',              gender: ['men'],             type: 'shopify',        origin: 'https://xyxxcrew.com' },
  { brand: 'Bombay Trooper',    gender: ['men', 'women'],   type: 'shopify',        origin: 'https://www.bombaytrooper.com' },
  // ── Accessories ──
  { brand: 'Mokobara',          gender: ['unisex'],          type: 'shopify',        origin: 'https://mokobara.com' },
  { brand: 'Hidesign',          gender: ['unisex'],          type: 'shopify',        origin: 'https://www.hidesign.com' },
  { brand: 'Caprese',           gender: ['women'],           type: 'shopify',        origin: 'https://www.capresebags.com' },
  { brand: 'Lavie',             gender: ['women'],           type: 'shopify',        origin: 'https://lavieworld.com' },
  // ── Beauty / Skincare ──
  { brand: 'Sugar Cosmetics',   gender: ['women'],           type: 'shopify',        origin: 'https://in.sugarcosmetics.com' },
  { brand: 'Plum',              gender: ['unisex'],          type: 'shopify',        origin: 'https://plumgoodness.com' },
  { brand: 'Mcaffeine',         gender: ['unisex'],          type: 'shopify',        origin: 'https://www.mcaffeine.com' },
  { brand: 'Sirona',            gender: ['unisex'],          type: 'shopify',        origin: 'https://thesirona.com' },
  // ── Men's grooming ──
  { brand: 'Bombay Shaving Co', gender: ['men'],             type: 'shopify',        origin: 'https://bombayshavingcompany.com' },
  { brand: 'BoldCare',          gender: ['men'],             type: 'shopify',        origin: 'https://www.boldcare.in' },
  // ── Activewear / Sports ──
  { brand: 'Newme',             gender: ['women'],           type: 'newme-sitemap',  origin: 'https://newme.asia' },
];

// ─── In-memory cache ─────────────────────────────────────────────────────────

interface CacheEntry {
  products: ShopifyProduct[];
  fetchedAt: number;
}

interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  product_type: string;
  tags: string | string[];
  images: { src: string }[];
  variants: { price: string }[];
  body_html?: string;
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'for', 'with', 'and', 'in', 'on',
  'men', 'mens', "men's", 'women', 'womens', "women's", 'size', 'fit',
]);

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class CatalogSearchService {
  private readonly logger = new Logger(CatalogSearchService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;

  constructor(private readonly configService: ConfigService) {
    this.ttlMs =
      Number(this.configService.get<string>('CATALOG_TTL_MS')) ||
      60 * 60 * 1000; // 1 hour default
  }

  /**
   * Search all relevant brand catalogs in parallel.
   * Filters by gender and category if provided, merges + de-dupes results.
   */
  async search(
    query: string,
    opts: { gender?: string; category?: string; limitPerBrand?: number } = {},
  ): Promise<CatalogProduct[]> {
    const { gender, category, limitPerBrand = 5 } = opts;

    // Which brands match the gender filter?
    const targetBrands = BRANDS.filter((b) => {
      if (!gender) return true;
      if (gender === 'unisex') return true;
      return b.gender.includes(gender as any) || b.gender.includes('unisex');
    });

    const results = await Promise.allSettled(
      targetBrands.map((b) => this.searchBrand(b, query, { category, limit: limitPerBrand })),
    );

    const all: CatalogProduct[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') all.push(...r.value);
    }

    return all.sort((a, b) => b.score - a.score);
  }

  /**
   * List all available brands with gender info.
   */
  listBrands() {
    return BRANDS.map((b) => ({ brand: b.brand, gender: b.gender }));
  }

  // ─── Brand dispatch ────────────────────────────────────────────────────────

  private async searchBrand(
    brand: BrandConfig,
    query: string,
    opts: { category?: string; limit: number },
  ): Promise<CatalogProduct[]> {
    try {
      switch (brand.type) {
        case 'shopify':
          return this.searchShopify(brand, query, opts);
        case 'snitch-sitemap':
          return this.searchSnitchSitemap(brand, query, opts);
        case 'newme-sitemap':
          return this.searchNewmeSitemap(brand, query, opts);
        default:
          return [];
      }
    } catch (err) {
      this.logger.warn(`${brand.brand} search failed: ${err.message?.slice(0, 80)}`);
      return [];
    }
  }

  // ─── Shopify catalog ───────────────────────────────────────────────────────

  private async searchShopify(
    brand: BrandConfig,
    query: string,
    opts: { category?: string; limit: number },
  ): Promise<CatalogProduct[]> {
    const products = await this.loadShopifyProducts(brand);

    const queryTokens = this.tokenize(query);
    const categoryTokens = opts.category ? this.tokenize(opts.category) : [];

    const scored = products
      .map((p) => {
        const haystack = this.productHaystack(p);
        const haystackTokens = this.tokenize(haystack);
        const score = this.scoreTokens(queryTokens, haystackTokens, categoryTokens);
        return { p, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.limit);

    return scored.map(({ p, score }) => ({
      brand: brand.brand,
      title: p.title,
      category: p.product_type || this.guessCategory(p.title),
      image: p.images?.[0]?.src ?? null,
      url: `${brand.origin}/products/${p.handle}`,
      priceInr: this.parsePrice(p.variants?.[0]?.price),
      score,
    }));
  }

  private async loadShopifyProducts(brand: BrandConfig): Promise<ShopifyProduct[]> {
    const cacheKey = brand.brand;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.ttlMs) {
      return cached.products;
    }

    const products: ShopifyProduct[] = [];
    let page = 1;

    while (true) {
      const url = `${brand.origin}/products.json?limit=250&page=${page}`;
      let batch: ShopifyProduct[];

      try {
        const res = await axios.get<{ products: ShopifyProduct[] }>(url, {
          timeout: 12000,
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CollabKaroo/1.0)' },
        });
        batch = res.data?.products ?? [];
      } catch {
        break;
      }

      if (batch.length === 0) break;
      products.push(...batch);
      if (batch.length < 250) break;
      page++;

      if (page > 10) break; // safety cap at 2500 products
    }

    this.cache.set(cacheKey, { products, fetchedAt: Date.now() });
    this.logger.debug(`${brand.brand}: loaded ${products.length} products`);
    return products;
  }

  // ─── Snitch sitemap ────────────────────────────────────────────────────────

  private async searchSnitchSitemap(
    brand: BrandConfig,
    query: string,
    opts: { category?: string; limit: number },
  ): Promise<CatalogProduct[]> {
    const products = await this.loadSnitchProducts(brand);

    const queryTokens = this.tokenize(query);
    const categoryTokens = opts.category ? this.tokenize(opts.category) : [];

    return products
      .map((p) => {
        const score = this.scoreTokens(
          queryTokens,
          this.tokenize(`${p.title} ${p.category}`),
          categoryTokens,
        );
        return { p, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.limit)
      .map(({ p, score }) => ({
        brand: brand.brand,
        title: p.title,
        category: p.category,
        image: p.image,
        url: p.url,
        priceInr: null,
        score,
      }));
  }

  private async loadSnitchProducts(
    brand: BrandConfig,
  ): Promise<{ title: string; category: string; url: string; image: string | null }[]> {
    const cacheKey = `${brand.brand}-sitemap`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.ttlMs) {
      return cached.products as any;
    }

    const sitemapIndexUrl = `${brand.origin}/sitemap.xml`;
    const products: { title: string; category: string; url: string; image: string | null }[] = [];

    try {
      const indexXml = await this.fetchText(sitemapIndexUrl);
      const subSitemaps = this.extractXmlTags(indexXml, 'loc').filter((u) =>
        u.includes('sitemap-products'),
      );

      for (const sub of subSitemaps.slice(0, 5)) {
        const xml = await this.fetchText(sub);
        const urls = this.extractXmlTags(xml, 'loc').filter((u) =>
          u.includes('/products/'),
        );
        const titles = this.extractXmlTags(xml, 'title');
        const images = this.extractXmlTags(xml, 'image:loc');

        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          const slug = url.split('/products/')[1]?.split('?')[0] ?? '';
          const category = slug.split('-')[0] ?? 'other';
          products.push({
            title: this.decodeEntities(titles[i] ?? slug),
            category,
            url,
            image: images[i] ?? null,
          });
        }
      }
    } catch (err) {
      this.logger.warn(`Snitch sitemap failed: ${err.message}`);
    }

    this.cache.set(cacheKey, { products: products as any, fetchedAt: Date.now() });
    return products;
  }

  // ─── Newme sitemap ─────────────────────────────────────────────────────────

  private async searchNewmeSitemap(
    brand: BrandConfig,
    query: string,
    opts: { category?: string; limit: number },
  ): Promise<CatalogProduct[]> {
    const products = await this.loadNewmeProducts(brand);

    const queryTokens = this.tokenize(query);
    const categoryTokens = opts.category ? this.tokenize(opts.category) : [];

    return products
      .map((p) => {
        const score = this.scoreTokens(
          queryTokens,
          this.tokenize(`${p.title} ${p.category}`),
          categoryTokens,
        );
        return { p, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.limit)
      .map(({ p, score }) => ({
        brand: brand.brand,
        title: p.title,
        category: p.category,
        image: p.image,
        url: p.url,
        priceInr: null,
        score,
      }));
  }

  private async loadNewmeProducts(
    brand: BrandConfig,
  ): Promise<{ title: string; category: string; url: string; image: string | null }[]> {
    const cacheKey = `${brand.brand}-newme-sitemap`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < this.ttlMs) {
      return cached.products as any;
    }

    const products: { title: string; category: string; url: string; image: string | null }[] = [];

    try {
      const sitemapUrl = `${brand.origin}/sitemap.xml`;
      const indexXml = await this.fetchText(sitemapUrl);
      const subSitemaps = this.extractXmlTags(indexXml, 'loc').filter((u) =>
        u.includes('sitemap-products'),
      );

      for (const sub of subSitemaps.slice(0, 5)) {
        const xml = await this.fetchText(sub);
        const urls = this.extractXmlTags(xml, 'loc').filter((u) =>
          u.includes('/products/'),
        );
        const titles = this.extractXmlTags(xml, 'title');
        const images = this.extractXmlTags(xml, 'image:loc');

        for (let i = 0; i < urls.length; i++) {
          const url = urls[i];
          const slug = url.split('/products/')[1]?.split('?')[0] ?? '';
          products.push({
            title: this.decodeEntities(titles[i] ?? slug.replace(/-/g, ' ')),
            category: slug.split('-')[0] ?? 'other',
            url,
            image: images[i] ?? null,
          });
        }
      }
    } catch (err) {
      this.logger.warn(`Newme sitemap failed: ${err.message}`);
    }

    this.cache.set(cacheKey, { products: products as any, fetchedAt: Date.now() });
    return products;
  }

  // ─── Scoring & text utilities ──────────────────────────────────────────────

  private tokenize(text: string): string[] {
    return String(text ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  }

  private productHaystack(p: ShopifyProduct): string {
    const tags = Array.isArray(p.tags) ? p.tags.join(' ') : String(p.tags ?? '');
    const variants = (p.variants ?? []).map((v) => v.price).join(' ');
    const body = (p.body_html ?? '').replace(/<[^>]*>/g, ' ');
    return [p.title, p.product_type, tags, body, variants].join(' ');
  }

  /**
   * Simple TF-style scoring: count matching tokens, boost for category matches.
   */
  private scoreTokens(
    queryTokens: string[],
    haystackTokens: string[],
    categoryTokens: string[],
  ): number {
    if (queryTokens.length === 0) return 0;
    const haystackSet = new Set(haystackTokens);
    let score = 0;

    for (const t of queryTokens) {
      if (haystackSet.has(t)) score += 1;
    }

    // Bonus for category match
    for (const t of categoryTokens) {
      if (haystackSet.has(t)) score += 0.5;
    }

    return score / queryTokens.length;
  }

  private parsePrice(raw: string | undefined): number | null {
    if (!raw) return null;
    const n = parseFloat(raw);
    return isNaN(n) ? null : n;
  }

  private guessCategory(title: string): string {
    const lower = title.toLowerCase();
    if (/\bt(-| )?shirt|tee\b/.test(lower)) return 'tee';
    if (/\bjeans?\b/.test(lower)) return 'jeans';
    if (/\bshort(s)?\b/.test(lower)) return 'shorts';
    if (/\bjacket|hoodie|sweatshirt\b/.test(lower)) return 'jacket';
    if (/\bdress|kurti|saree\b/.test(lower)) return 'dress';
    if (/\bbag|tote|backpack|satchel\b/.test(lower)) return 'bag';
    if (/\bsneaker|shoe|boot|sandal\b/.test(lower)) return 'footwear';
    return 'other';
  }

  private async fetchText(url: string): Promise<string> {
    const res = await axios.get<string>(url, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CollabKaroo/1.0)' },
    });
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  }

  private extractXmlTags(xml: string, tag: string): string[] {
    const out: string[] = [];
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
    return out;
  }

  private decodeEntities(s: string): string {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
}
