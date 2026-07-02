Fix architectural issues in an existing module to bring it up to project standards.

The module to fix is: $ARGUMENTS

## Instructions

First run a full audit (same checks as `/review-module`) by reading all files under `src/<module-name>/`. Then apply all fixes directly to the files — do not just report issues.

---

### Fix priority order

Apply fixes in this order to avoid cascading changes:

#### 1. Models — add missing enums
- Replace any raw string status/type fields with proper enums
- Add `@AllowNull()` to any column missing it
- Add missing `@Index` decorators on foreign key / status columns
- Add `CreationAttributes` interface if missing
- Add `declare` keyword to any property missing it

#### 2. DTOs — add validation and Swagger docs
- For every `@Body()` that uses an inline shape, extract it into a DTO class in `dto/`
- Add `@ApiProperty({ description: '...', example: ... })` to every field
- Add class-validator decorators (`@IsString()`, `@IsOptional()`, `@IsEnum()`, etc.)
- For nested objects, add `@ValidateNested()` + `@Type(() => NestedClass)`
- Create separate response DTOs for structured response shapes

#### 3. Guards — extract inline auth logic
- If a controller is doing token/auth validation inline in handler methods, extract it into a guard class under `guards/<name>.guard.ts`
- Guard must implement `CanActivate`
- Attach the verified payload to `request` so controller handlers can access it
- Apply the guard with `@UseGuards(YourGuard)` on the controller or specific routes

#### 4. Controllers — add Swagger decorators
- Add `@ApiTags('<ModuleName>')` at class level if missing
- Add `@ApiBearerAuth()` if the controller uses auth
- For every endpoint, add:
  - `@ApiOperation({ summary: '...' })`
  - `@ApiResponse({ status: 200/201, description: '...' })`
  - `@ApiResponse({ status: 400, description: 'Bad request' })`
  - `@ApiResponse({ status: 401, description: 'Unauthorized' })` where applicable
  - `@ApiBody({ type: XxxDto })` on POST/PUT
  - `@ApiParam()` / `@ApiQuery()` for path/query params
- Replace any inline `@Body() body: { ... }` with the DTO class created in step 2

#### 5. Service — clean up concerns
- Move any HTTP-layer logic (token parsing, throwing HttpExceptions based on request state) out of the controller and into the service or guard
- Ensure constructor uses `@InjectModel()` for all model dependencies

---

### Conventions to enforce

- No `any` types introduced
- No inline object shapes in `@Body()`
- No raw string literals for status/type fields — use enums
- All new files in `kebab-case.ts`
- All new classes in `PascalCase`
- Do not change business logic — only fix structure/decoration/typing

---

### After fixing

- List every file that was modified with a one-line summary of what changed
- List any new files created
- Show the updated compliance score vs. the original
- Note any issues that require manual attention
- If any model changes require a schema change (new column, new table, new index), create a migration file at `migrations/YYYYMMDD_<description>.sql` — the filename MUST start with the current date in `YYYYMMDD_` format so the auto-migration runner picks it up on next deploy. All SQL must use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` to be idempotent.
