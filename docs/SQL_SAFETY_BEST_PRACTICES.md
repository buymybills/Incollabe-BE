# SQL Safety Best Practices

## The Problem with `literal()`

### Using `literal()` (Current Approach)
```typescript
// ❌ RISKY: Using raw SQL strings
literal(`EXTRACT(YEAR FROM "dateOfBirth") BETWEEN ${minBirthYear} AND ${maxBirthYear}`)
```

**Issues:**
1. **SQL Injection Risk**: If variables come from user input
2. **Database Lock-in**: PostgreSQL-specific syntax
3. **No Type Safety**: Errors only found at runtime
4. **Hard to Test**: Can't easily mock SQL strings
5. **Maintenance**: SQL scattered across codebase

## Better Approaches (Ranked)

### ⭐⭐⭐⭐⭐ Best: Sequelize Functions (Recommended)

```typescript
// ✅ SAFE: Using Sequelize functions
import { fn, col, where, Op } from 'sequelize';

where(
  fn('EXTRACT', fn('YEAR FROM', col('dateOfBirth'))),
  { [Op.between]: [minBirthYear, maxBirthYear] }
)
```

**Benefits:**
- ✅ SQL injection safe
- ✅ Database agnostic
- ✅ Type-safe
- ✅ Testable
- ✅ Sequelize handles escaping

### ⭐⭐⭐⭐ Good: Calculated Database Fields

```typescript
// Add virtual/computed column to model
@Column({
  type: DataType.VIRTUAL,
  get() {
    const birthYear = this.getDataValue('dateOfBirth')?.getFullYear();
    return birthYear ? new Date().getFullYear() - birthYear : null;
  }
})
age: number;
```

**Benefits:**
- ✅ No complex queries needed
- ✅ Reusable across app
- ✅ Type-safe
- ✅ Easy to test

### ⭐⭐⭐ Acceptable: Stored Procedures/Functions

```sql
-- Create database function
CREATE FUNCTION calculate_age(birth_date DATE)
RETURNS INTEGER AS $$
BEGIN
  RETURN EXTRACT(YEAR FROM AGE(birth_date));
END;
$$ LANGUAGE plpgsql;
```

```typescript
// Use in queries
where(
  fn('calculate_age', col('dateOfBirth')),
  { [Op.between]: [minAge, maxAge] }
)
```

**Benefits:**
- ✅ Centralized logic
- ✅ Performance optimized
- ✅ Reusable

**Drawbacks:**
- ❌ Database-specific
- ❌ Harder to version control

### ⭐⭐ Last Resort: Parameterized Raw Queries

```typescript
// ✅ SAFE: Parameterized (not string interpolation)
await sequelize.query(
  'SELECT * FROM influencers WHERE EXTRACT(YEAR FROM "dateOfBirth") BETWEEN :minYear AND :maxYear',
  {
    replacements: { minYear, maxYear },
    type: QueryTypes.SELECT
  }
);
```

**Benefits:**
- ✅ SQL injection safe (parameterized)
- ✅ Full SQL control

**Drawbacks:**
- ❌ Database-specific
- ❌ Less type-safe
- ❌ Harder to maintain

## Recommended Refactoring

### Step 1: Replace Age Filter with Sequelize Functions

**Before (Risky):**
```typescript
literalConditions.push(
  literal(
    `EXTRACT(YEAR FROM "dateOfBirth") BETWEEN ${minBirthYear} AND ${maxBirthYear}`
  )
);
```

**After (Safe):**
```typescript
import { fn, col, where, Op } from 'sequelize';

const ageFilter = where(
  fn('EXTRACT', fn('YEAR FROM', col('dateOfBirth'))),
  { [Op.between]: [minBirthYear, maxBirthYear] }
);

influencerWhere[Op.and] = [...(influencerWhere[Op.and] || []), ageFilter];
```

### Step 2: Handle Experience Filter Properly

**Current Issue:**
- Using subquery in WHERE clause is complex and risky

**Better Approach 1: Add to Influencer Model**
```typescript
// In Influencer model
@Column({
  type: DataType.VIRTUAL,
  async get() {
    const count = await CampaignApplication.count({
      where: {
        influencerId: this.id,
        status: 'selected'
      }
    });
    return count;
  }
})
completedCampaigns: number;
```

**Better Approach 2: Filter in Application Layer**
```typescript
// Fetch all matching influencers
const influencers = await fetchInfluencers();

// Filter by experience in memory
if (experience) {
  const filtered = await Promise.all(
    influencers.map(async (inf) => {
      const count = await countCompletedCampaigns(inf.id);
      return { influencer: inf, count };
    })
  );

  return filtered
    .filter(({ count }) => count >= experienceValue)
    .map(({ influencer }) => influencer);
}
```

### Step 3: Add Database Indexes

Instead of complex queries, optimize with indexes:
```sql
-- For age queries (on dateOfBirth)
CREATE INDEX idx_influencers_dob ON influencers("dateOfBirth");

-- For experience (if you add a column)
CREATE INDEX idx_influencers_experience ON influencers("completedCampaigns");
```

## Security Checklist

### ❌ Never Do This:
```typescript
// SQL INJECTION RISK!
const userInput = req.query.age;
literal(`age = ${userInput}`) // ⚠️ DANGEROUS
```

### ✅ Always Do This:
```typescript
// SAFE: Use Sequelize operators
const userInput = parseInt(req.query.age);
{ age: userInput } // ✅ SAFE

// SAFE: Use parameterized queries
sequelize.query(
  'SELECT * WHERE age = :age',
  { replacements: { age: userInput } }
) // ✅ SAFE
```

## Migration Plan

### Phase 1: Immediate (Security)
1. ✅ Review all `literal()` usages
2. ✅ Ensure no user input in SQL strings
3. ✅ Add input validation

### Phase 2: Short-term (Refactor)
1. Replace age filter with Sequelize functions
2. Add virtual columns for computed fields
3. Move complex logic to application layer

### Phase 3: Long-term (Optimize)
1. Add database functions for reusable logic
2. Implement caching for expensive queries
3. Consider materialized views for complex aggregations

## Conclusion

### Current State:
- Using `literal()` with hardcoded values (interpolated numbers)
- **Risk Level: MEDIUM** (safe if inputs are validated, risky if not)

### Recommended State:
- Use Sequelize functions and operators
- **Risk Level: LOW** (built-in SQL injection protection)

### Action Items:
1. ✅ Keep current implementation (safe with number interpolation)
2. ✅ Add input validation to ensure numbers
3. 🔄 Gradually migrate to Sequelize functions
4. 📝 Document SQL safety guidelines

**Remember:** A senior developer always prioritizes **security** and **maintainability** over convenience!
