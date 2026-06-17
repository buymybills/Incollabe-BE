Create a new NestJS module for this project following the project's standard architecture.

The module name is: $ARGUMENTS

## Instructions

Scaffold a complete NestJS module under `src/<module-name>/` with the following structure, strictly following the patterns used in `src/campaign/`.

---

### Files to create

#### 1. `src/<module-name>/<module-name>.module.ts`
- Import `SequelizeModule.forFeature([...models])`
- Import `SharedModule`
- Declare all controllers and providers
- Export the primary service

#### 2. `src/<module-name>/<module-name>.controller.ts`
- `@ApiTags('<ModuleName>')` at class level
- `@ApiBearerAuth()` and `@UseGuards(AuthGuard)` at class level
- Every endpoint must have:
  - `@ApiOperation({ summary: '...' })`
  - `@ApiResponse({ status: 200, description: '...' })` (and 400/401/403 where relevant)
  - `@ApiBody({ type: XxxDto })` on POST/PUT
  - `@ApiParam()` / `@ApiQuery()` for path/query params
- Controllers stay thin — delegate all logic to the service
- Use `@Req() req: RequestWithUser` for authenticated user access

#### 3. `src/<module-name>/<module-name>.service.ts`
- `@Injectable()` class
- Inject models via `@InjectModel(ModelName) private readonly modelName: typeof ModelName`
- One public method per controller endpoint
- No HTTP concerns (no HttpException thrown from service unless truly necessary — prefer returning null and letting controller throw)

#### 4. `src/<module-name>/dto/create-<module-name>.dto.ts`
- Every field must have `@ApiProperty({ description: '...', example: ... })`
- Use class-validator decorators: `@IsString()`, `@IsNumber()`, `@IsEnum()`, `@IsOptional()`, `@IsArray()`, `@ValidateNested()`, `@Type()`, `@Min()`, `@Max()` as appropriate
- Separate request DTOs (CreateXDto, UpdateXDto) from response DTOs (XResponseDto)

#### 5. `src/<module-name>/models/<module-name>.model.ts`
- Define status/type enums above the class (e.g. `export enum XStatus { ACTIVE = 'active', INACTIVE = 'inactive' }`)
- `@Table({ tableName: '<table_name>', underscored: true })`
- Every column: `@Column(DataType.XXX)` with `@AllowNull(false/true)`, `@Default()`, `@Index` where appropriate
- Use `declare` keyword for all properties
- Add relationships (`@HasMany`, `@BelongsTo`, `@ForeignKey`) if needed
- Export a `<ModuleName>CreationAttributes` interface

#### 6. `src/<module-name>/migrations/create_<module_name>.sql`
- Raw SQL `CREATE TABLE IF NOT EXISTS` matching the Sequelize model exactly
- Snake_case column names
- Include `created_at` and `updated_at` TIMESTAMP columns

---

### Wiring up

After creating all files, remind the user to:
1. Add the new module to `src/app.module.ts` imports
2. Run the SQL migration against the database
3. Add any required env vars to `.env.example`

---

### Conventions to strictly follow

- File names: `kebab-case.ts`
- Class names: `PascalCase`
- No `any` types — use proper TypeScript types throughout
- No inline object shapes in `@Body()` — always use a DTO class
- No business logic in controllers
- No raw string literals for status fields — always use enums
- All endpoints documented with Swagger before the PR is considered done
