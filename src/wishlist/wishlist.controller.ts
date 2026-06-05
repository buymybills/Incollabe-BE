import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Logger,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { WishlistService } from './wishlist.service';
import { Public } from '../auth/decorators/public.decorator';

// ─── DTOs ─────────────────────────────────────────────────────────────────────

class RenameFolderDto {
  name: string;
}

// ─── Controller ───────────────────────────────────────────────────────────────

/**
 * Wishlist REST API
 *
 * All private routes identify the Instagram user via the `igSenderId` query param
 * (the user's Instagram sender ID, same identifier used by the shopping agent).
 *
 * Public route:
 *   GET /api/wishlists/share/:token  — shareable HTML page, no auth
 *
 * Private routes (require ?igSenderId=<IG_SENDER_ID>):
 *   GET    /api/wishlists                        — list all folders
 *   GET    /api/wishlists/:id                    — get one folder with items
 *   PATCH  /api/wishlists/:id                    — rename a folder
 *   DELETE /api/wishlists/:id                    — delete a folder + all its items
 *   DELETE /api/wishlists/:id/items/:itemId      — remove one item from a folder
 */
@ApiTags('Wishlist')
@Controller('wishlists')
export class WishlistController {
  private readonly logger = new Logger(WishlistController.name);

  constructor(private readonly wishlistService: WishlistService) {}

  // ─── Public: shared link ──────────────────────────────────────────────────

  @Get('share/:token')
  @Public()
  @ApiOperation({ summary: 'View a shared wishlist (public HTML page)' })
  async viewSharedWishlist(@Param('token') token: string, @Res() res: Response) {
    const wishlist = await this.wishlistService.getByShareToken(token);

    if (!wishlist) {
      return res.status(HttpStatus.NOT_FOUND).send('<h2>Wishlist not found or link has expired.</h2>');
    }

    const items = wishlist.items ?? [];

    const itemsHtml = items.length === 0
      ? '<p style="color:#888">No items in this wishlist yet.</p>'
      : items.map((item) => `
        <div style="display:flex;gap:16px;align-items:flex-start;padding:16px 0;border-bottom:1px solid #f0f0f0">
          ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.productName}" style="width:90px;height:90px;object-fit:cover;border-radius:8px;flex-shrink:0">` : ''}
          <div>
            <div style="font-weight:600;font-size:15px">${item.brandName}</div>
            <div style="color:#333;margin:2px 0 4px">${item.productName}${item.size ? ` · Size ${item.size}` : ''}</div>
            ${item.priceInr ? `<div style="color:#e44d4d;font-weight:500">₹${item.priceInr}</div>` : ''}
            ${item.productUrl ? `<a href="${item.productUrl}" target="_blank" style="display:inline-block;margin-top:8px;padding:6px 14px;background:#000;color:#fff;border-radius:20px;text-decoration:none;font-size:13px">Shop Now</a>` : ''}
          </div>
        </div>`).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${wishlist.name} — Wishlist</title>
  <meta property="og:title" content="${wishlist.name} Wishlist">
  <meta property="og:description" content="${items.length} item${items.length !== 1 ? 's' : ''} saved">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fafafa; color: #111; }
    .container { max-width: 520px; margin: 0 auto; padding: 24px 16px; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .subtitle { color: #888; font-size: 13px; margin-bottom: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🛍️ ${wishlist.name}</h1>
    <p class="subtitle">${items.length} item${items.length !== 1 ? 's' : ''}</p>
    ${itemsHtml}
  </div>
</body>
</html>`;

    return res.status(HttpStatus.OK).type('html').send(html);
  }

  // ─── List all folders ─────────────────────────────────────────────────────

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all wishlist folders for an Instagram user' })
  @ApiQuery({ name: 'igSenderId', required: true, description: 'Instagram sender ID' })
  @ApiResponse({
    status: 200,
    description: 'Array of folders with item counts and share tokens',
  })
  async listFolders(@Query('igSenderId') igSenderId: string) {
    const folders = await this.wishlistService.getFolders(igSenderId);
    return folders.map((f) => ({
      id: f.id,
      name: f.name,
      itemCount: (f.items ?? []).length,
      shareToken: f.shareToken,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));
  }

  // ─── Get one folder with all items ───────────────────────────────────────

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get a wishlist folder with all its items' })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'igSenderId', required: true })
  async getFolder(
    @Param('id', ParseIntPipe) id: number,
    @Query('igSenderId') igSenderId: string,
  ) {
    const wishlist = await this.wishlistService.getFolderById(id, igSenderId);
    if (!wishlist) throw new NotFoundException('Wishlist folder not found');

    return {
      id: wishlist.id,
      name: wishlist.name,
      shareToken: wishlist.shareToken,
      createdAt: wishlist.createdAt,
      updatedAt: wishlist.updatedAt,
      items: (wishlist.items ?? []).map((item) => ({
        id: item.id,
        productName: item.productName,
        brandName: item.brandName,
        productUrl: item.productUrl,
        imageUrl: item.imageUrl,
        priceInr: item.priceInr,
        size: item.size,
        savedAt: item.createdAt,
      })),
    };
  }

  // ─── Rename a folder ──────────────────────────────────────────────────────

  @Patch(':id')
  @Public()
  @ApiOperation({ summary: 'Rename a wishlist folder' })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'igSenderId', required: true })
  @ApiBody({ type: RenameFolderDto })
  async renameFolder(
    @Param('id', ParseIntPipe) id: number,
    @Query('igSenderId') igSenderId: string,
    @Body() body: RenameFolderDto,
  ) {
    const wishlist = await this.wishlistService.renameFolder(id, igSenderId, body.name);
    return {
      id: wishlist.id,
      name: wishlist.name,
      shareToken: wishlist.shareToken,
      updatedAt: wishlist.updatedAt,
    };
  }

  // ─── Delete a folder ──────────────────────────────────────────────────────

  @Delete(':id')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a wishlist folder and all its items' })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'igSenderId', required: true })
  async deleteFolder(
    @Param('id', ParseIntPipe) id: number,
    @Query('igSenderId') igSenderId: string,
  ) {
    const deleted = await this.wishlistService.deleteFolderById(id, igSenderId);
    if (!deleted) throw new NotFoundException('Wishlist folder not found');
  }

  // ─── Remove one item from a folder ───────────────────────────────────────

  @Delete(':id/items/:itemId')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a single item from a wishlist folder' })
  @ApiParam({ name: 'id', type: Number, description: 'Wishlist folder ID' })
  @ApiParam({ name: 'itemId', type: Number, description: 'Item ID to remove' })
  @ApiQuery({ name: 'igSenderId', required: true })
  async removeItem(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Query('igSenderId') igSenderId: string,
  ) {
    const removed = await this.wishlistService.removeItemById(itemId, igSenderId);
    if (!removed) throw new NotFoundException('Item not found');
  }
}
