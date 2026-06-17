Review a module in this NestJS project for architectural compliance against project standards.

The module to review is: $ARGUMENTS

## Instructions

Read all files under `src/<module-name>/` and audit them against the patterns established in `src/campaign/`. Produce a structured report.

---

### What to read

1. `<module-name>.module.ts`
2. `<module-name>.controller.ts` (and any additional controllers)
3. `<module-name>.service.ts` (and any sub-services)
4. All files in `dto/`
5. All files in `models/`
6. All files in `guards/` (if present)
7. Any migration SQL files

---

### What to check

#### Controllers
- [ ] `@ApiTags()` present at class level
- [ ] `@ApiBearerAuth()` + `@UseGuards(AuthGuard)` (or appropriate guard) present
- [ ] Every endpoint has `@ApiOperation({ summary: '...' })`
- [ ] Every endpoint has `@ApiResponse()` for success + error cases
- [ ] POST/PUT endpoints have `@ApiBody({ type: XxxDto })`
- [ ] Path params have `@ApiParam()`, query params have `@ApiQuery()`
- [ ] No business logic — all delegated to service
- [ ] No inline `@Body() body: { field: string }` shapes — DTO classes only
- [ ] Uses `@Req() req: RequestWithUser` (not raw `req: any`)

#### DTOs
- [ ] Every field has `@ApiProperty()`
- [ ] Every field has class-validator decorator (`@IsString()`, `@IsNumber()`, etc.)
- [ ] `@IsOptional()` on optional fields
- [ ] Nested objects use `@ValidateNested()` + `@Type(() => NestedDto)`
- [ ] Separate create/update/response DTOs (no reuse for different shapes)

#### Models
- [ ] Status/type fields use enums (not raw strings)
- [ ] `@Table({ tableName: '...', underscored: true })` present
- [ ] All columns have `@AllowNull()` explicitly set
- [ ] `declare` keyword used on all properties
- [ ] `@Index` on frequently queried columns (foreign keys, status)
- [ ] `CreationAttributes` interface exported

#### Service
- [ ] `@Injectable()` decorator present
- [ ] Models injected via `@InjectModel()`
- [ ] No HTTP-layer concerns (no `@Res()`, no `HttpCode` logic)
- [ ] Methods are focused and single-purpose

#### Module
- [ ] `SequelizeModule.forFeature([...models])` present
- [ ] `SharedModule` imported
- [ ] Primary service exported

#### Guards (if custom guard present)
- [ ] Implements `CanActivate`
- [ ] Uses `ConfigService` for secrets (no hardcoded values)
- [ ] Attaches validated payload to `request` object
- [ ] Throws `UnauthorizedException` (not generic Error)

---

### Report format

For each file, output:
- **Status**: ✅ Compliant / ⚠️ Minor issues / ❌ Significant issues
- A bullet list of specific problems found with file path and line reference
- A concrete code fix for each issue (show before/after)

End with:
- **Overall compliance score** (percentage)
- **Priority fixes** — ordered by impact (High / Medium / Low)
- A checklist the developer can copy into a PR description
