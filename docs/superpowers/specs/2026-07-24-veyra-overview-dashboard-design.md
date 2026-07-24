# Veyra Overview Dashboard Design

**Date:** 2026-07-24  
**Status:** Approved for implementation planning  
**Surface:** Authenticated desktop web application  
**Release:** Overview dashboard v1

## 1. Purpose

Veyra's first dashboard should let a user understand their monthly financial health quickly, then verify that picture through budgets and recent transactions.

The page is a read-only command center. It does not edit financial data or replace the detailed pages that may follow later.

### Primary user outcomes

1. Identify monthly spending, income, cashflow, and spending pace at a glance.
2. Understand where money is going and whether budgets are healthy.
3. Verify the summary against recent transactions.
4. Receive one concise, data-grounded Veyra observation without making the assistant dominant.

### Success criteria

- A user can determine whether monthly cashflow is positive or negative within ten seconds.
- Spending category and budget risks are visible without scrolling at a 1440 × 900 viewport.
- Recent transactions provide enough evidence to trust the summary.
- The selected month updates every financial block consistently.
- Empty or failed data is never presented as a real zero.
- The page contains no dead links or controls for unfinished features.

## 2. Approved product decisions

| Decision | Approved direction |
|---|---|
| Initial scope | Overview dashboard only |
| Product priority | Financial health first; transactions and budgets as verification |
| Layout direction | Scan-first command center, visual option A |
| Interface language | English |
| Currency | Indonesian rupiah (IDR) |
| Interaction model | Read-only |
| Primary viewport | Desktop, 1280–1600px wide |
| Character presence | Subtle and secondary to financial data |
| Frontend | Next.js 16 App Router with TypeScript and Tailwind CSS v4 |

## 3. Scope

### Included

- Authenticated Overview page
- Current-month and previous-month filtering
- Four financial health metrics
- Daily spending trend
- Expense category breakdown
- Budget status summary
- Five recent transactions
- One active alert
- One short Veyra insight
- Loading, empty, partial-error, and populated states
- Keyboard and screen-reader support for the core experience
- Realistic local fixture data for the first implementation

### Excluded

- Login and account creation
- Transaction, budget, category, or account editing
- Bank connection and data synchronization
- Search, export, reports, and notifications
- Assistant chat or generative-finance integration
- Landing page and marketing surfaces
- Separate Transactions, Analytics, Budgets, Goals, Alerts, Reports, or Settings pages
- Dedicated mobile product design
- A standalone component library or speculative API abstraction

Future navigation items are not rendered until their destination pages exist.

## 4. Experience hierarchy

The page follows a fixed information order:

1. **Result:** financial health metrics
2. **Explanation:** spending trend and category distribution
3. **Evidence:** budget status and recent transactions
4. **Guidance:** highest-priority alert and one Veyra insight

This hierarchy keeps the overview scannable while preserving enough detail for the user to validate the result.

## 5. Page structure

### 5.1 Application shell

- Compact left sidebar
- Veyra logo at the top
- Overview as the only navigation destination
- User identity and current financial cycle anchored at the bottom
- White surface, cool-gray divider, and cyan active indicator

The original Veyra logo asset must be used. A screenshot crop or approximate redraw is not acceptable.

User identity uses the account's profile image when available and text initials otherwise. Veyra artwork is never used as the user's identity.

### 5.2 Page header

- Title: `Overview`
- Supporting copy: `Here’s your financial summary.`
- Period selector with two values:
  - `This Month`
  - `Last Month`

Changing the period updates every metric, chart, budget, transaction, alert, and insight together.

### 5.3 Financial health strip

Four equal cards:

1. Total Spent
2. Total Income
3. Net Cashflow
4. Daily Average Spend

Each card includes:

- Plain-English label
- Full IDR value
- Comparison with the previous equivalent period when available
- Direction icon and text so status is not communicated by color alone

### 5.4 Explanation row

#### Spending Trend

- Occupies roughly two-thirds of the row
- Displays daily expense totals for the selected month
- Uses cyan as the primary series
- Supports pointer and keyboard inspection
- Includes a textual chart summary for assistive technology
- Uses compact IDR notation on axes and full values in tooltips

#### Category Breakdown

- Occupies roughly one-third of the row
- Displays expense share by category
- Shows category name, percentage, and IDR amount
- Uses cyan-led colors with purple as a restrained secondary accent
- Shows the five highest-spend categories and combines the remainder into `Others`

### 5.5 Verification row

#### Budget Status

- Shows the four highest-spend budget categories
- Each row includes category, amount spent, budget limit, and percentage used
- A progress bar supplements rather than replaces the numeric value
- Status priority:
  1. Over budget
  2. At or above 80%
  3. Under 80%

#### Recent Transactions

- Shows the five newest transactions for the selected month
- Columns:
  - Date
  - Merchant
  - Category
  - Signed amount
- Income uses a positive sign; expenses use a negative sign
- Transactions are ordered newest first
- Full IDR values are used

No `View All` control is shown until the Transactions page exists.

### 5.6 Guidance row

#### Latest Alert

- Shows the single most important active budget warning
- Priority:
  1. Over-budget category
  2. Category at or above 80%
  3. Category closest to its limit
- If no warning exists, the card confirms that tracked budgets are on course

#### Veyra Insight

- Contains one short interpretation of the visible data
- Uses deterministic fixture-driven copy in v1; it is not an AI chat surface
- Maximum length: two short sentences
- Character artwork is clipped to the right edge and never obscures copy
- The card must remain smaller than the primary data panels

## 6. Financial definitions

| Value | Definition |
|---|---|
| Total Spent | Sum of expense transactions in the selected period |
| Total Income | Sum of income transactions in the selected period |
| Net Cashflow | Total Income minus Total Spent |
| Daily Average Spend | Total Spent divided by elapsed days for the current month, or calendar days for a completed month |
| Spending Trend | Expense totals grouped by calendar day |
| Category Share | Category expense total divided by Total Spent |
| Budget Percentage | Category spending divided by category budget limit |
| Current-month comparison | Selected elapsed days compared with the same number of days in the previous month |
| Completed-month comparison | Full selected month compared with the full preceding month |

All summaries must be calculated from the same filtered transaction set.

### IDR formatting

- Use the browser's native `Intl.NumberFormat` with locale `en-ID`, currency `IDR`, and currency display `code`.
- Show whole rupiah; no decimal places.
- Use full values in cards, tables, labels, and tooltips.
- Use compact notation only on chart axes where full values would reduce readability.
- Negative values keep the minus sign before the formatted amount.
- Use `Asia/Jakarta` for fixture timestamps, month boundaries, and elapsed-day calculations.

## 7. Data boundary

The first implementation uses realistic local fixtures and one pure summary calculation:

```text
transactions + budgets + selected period
                     ↓
          dashboard summary
                     ↓
 cards + charts + budgets + table + guidance
```

### Minimum transaction fields

- Identifier
- Date
- Merchant
- Category
- Amount
- Type: income or expense

Fixture amounts are stored as non-negative whole rupiah. The transaction type determines whether an amount contributes to income or spending.

### Minimum budget fields

- Category
- Limit

Spending is derived from transactions rather than duplicated in the budget fixture.

The loader rejects duplicate transaction identifiers, invalid dates, negative or fractional amounts, and non-positive budget limits. Unknown transaction categories are grouped under `Others` rather than discarded.

The calculation layer returns the exact values consumed by the page. Individual visual blocks do not recalculate financial totals.

The single loader returns transaction and budget results independently. A transaction failure affects transaction-derived metrics, charts, transactions, alerts, and insights. A budget failure affects Budget Status, alerts, and insights while transaction-derived blocks remain available. Every retry calls the same loader; the page does not create separate data clients for individual cards.

## 8. States and failure handling

### Loading

- Each block shows a stable skeleton matching its final dimensions.
- The shell and page header remain visible.
- Layout shift is avoided.

### Empty month

- Metrics show an em dash, not zero.
- Charts and tables show `No transactions for this month.`
- Budget data may still appear if budgets exist.
- Veyra explains that there is not enough activity to form an insight.

### Partial failure

- A failed block displays a local error and retry control.
- Successfully loaded blocks remain usable.
- Every retry reruns the same Overview loader.
- The error message does not expose internal details.

### Complete failure

- The shell and header remain visible.
- The content area explains that the summary could not be loaded and offers one retry.

## 9. Visual direction

### Principles

- Minimal
- Professional
- Data-first
- Cold and precise
- Cyberpunk in restraint, not decoration
- Veyra present but never dominant

### Palette

| Role | Color |
|---|---|
| Primary ink | `#0B0E14` |
| Deep navy | `#121722` |
| Secondary navy | `#182030` |
| Primary accent | `#00B3FF` |
| Secondary accent | `#A64DFF` |
| Border and quiet surface | `#E6E8EF` |
| Success text | `#067647` |
| Warning text | `#9A6700` |
| Danger text | `#B42318` |

Semantic colors are reserved for states. Cyan and purple are not used as success or failure signals.

### Typography

- Use the native system sans-serif stack for the first implementation.
- Use clear weight and size changes rather than decorative fonts.
- Reserve wide letter spacing for the Veyra wordmark asset.
- Keep financial numbers tabular when the selected font supports them.

### Surfaces and density

- White page background
- Thin cool-gray card borders
- Small radii matching Design 2
- Restrained shadows used only where separation needs reinforcement
- Compact but readable financial density
- Generous whitespace around section groups
- No gradients, glow effects, or decorative backgrounds behind data

## 10. Responsive behavior

### 1280–1600px

- Fixed compact sidebar
- Four metrics in one row
- Spending Trend and Category Breakdown share one row
- Budget Status and Recent Transactions share one row
- Latest Alert and Veyra Insight share one row

### 768–1279px

- Sidebar collapses to a compact rail
- Metrics use a two-by-two grid
- Explanation, verification, and guidance panels stack
- Tables retain horizontal readability without hiding financial values

### Below 768px

The page remains readable in a single column, but a dedicated mobile navigation and mobile-specific dashboard composition are outside this release.

## 11. Accessibility

- Core controls work by keyboard.
- Visible focus is never removed.
- Status always includes text or an icon in addition to color.
- Charts provide keyboard-accessible data points and a textual summary.
- Table headers remain programmatically associated with their cells.
- Contrast meets WCAG AA for text and controls.
- Character artwork is decorative in the insight card and uses empty alternative text.
- Reduced-motion preferences disable non-essential transitions.
- Loading announcements do not repeatedly interrupt assistive technology.

## 12. Asset inventory

### Supplied references

| Reference | Source | Use |
|---|---|---|
| Design 2 | `/home/unmeii/.codex/attachments/5d14a544-e026-4f61-8a5c-b183974d8ca0/Design 2.png` | Primary layout, palette, density, cards, and character balance |
| Design 1 | `/home/unmeii/.codex/attachments/a8cc8b95-8277-4eed-9e9d-3c9e3cfafd8a/Design 1.png` | Secondary whitespace and technical-detail reference |
| Character turnaround | `/home/unmeii/.codex/attachments/c72420b8-5ccf-4d34-9102-3c0c6e13cc96/turnaround reference.png` | Silhouette, hair length, coat construction, and cyan trim |
| Costume reference | `/home/unmeii/.codex/attachments/2a81cb4f-b6cc-42ce-89d2-9f22ae687693/costume reference.png` | Open-coat dashboard outfit |
| Telegram portrait | `/home/unmeii/.codex/attachments/fdc7e72f-3b39-456c-a1b0-aea3cfa343c7/telegram.png` | Face, cyan eyes, white hair streak, expression, and lighting |

### Required production assets

#### Original Veyra logo

- Preferred format: SVG
- Accepted fallback: transparent PNG at twice the rendered size
- Required lockups:
  - Mark and wordmark
  - Mark only
- Must be supplied from the original source rather than reconstructed from a screenshot

#### Veyra dashboard portrait

Create one master image after the final insight-card slot is measured:

- Transparent background
- Three-quarter bust
- Open navy coat with cyan trim
- Black high-neck inner layer
- Long dark hair with one white front streak
- Cyan eyes
- Neutral, strict expression
- Body angled subtly toward the dashboard copy
- Even studio lighting with a restrained cyan rim
- No text, props, logos, scenery, or black background
- Master target: portrait-oriented, at least 1600 × 2000px

The character turnaround, costume reference, and Telegram portrait must all be supplied to image generation. The final export is a lossless transparent master plus an optimized WebP for the application.

#### Veyra assistant avatar

If a compact assistant avatar is needed, derive it from the approved dashboard portrait. Do not generate a second character interpretation or use it for the signed-in user.

#### Icons

Use the icon library already present in the selected implementation template. If none exists, use one established outline icon library consistently. Do not create a custom icon set.

### Assets intentionally not required

- Decorative dashboard backgrounds
- Line-art character watermark
- Marketing hero artwork
- Separate chart images
- Multiple character poses or expressions
- Custom cursor, loader, or ornamental cyberpunk textures

## 13. Implementation boundary

Use Next.js 16 App Router with TypeScript and Tailwind CSS v4. Tailwind's CSS-first `@theme` configuration owns the Veyra color, radius, and font tokens so the dashboard and landing page share one visual language. Use React Server Components by default and add a client boundary only around the interactive Overview dashboard.

The initial structure should remain limited to:

- One application shell
- One Overview page
- One fixture loader
- One pure financial-summary calculation
- Visual blocks that map directly to the approved page structure

No general-purpose design system, global state library, API client abstraction, chart library, or assistant service is justified for this phase.

## 14. Verification

### Calculation check

One runnable calculation test covers:

- Income and expense filtering
- Net cashflow
- Daily average for current and completed months
- Daily trend grouping
- Category totals and percentages
- Budget percentages
- Alert priority

### Interaction check

One browser-level check covers:

- This Month and Last Month switching
- Keyboard access to the selector and chart details
- Populated, loading, empty, and local-error states
- Consistent updates across every visible block

### Visual check

- Render at the agreed desktop viewport.
- Compare Design 2 and the implementation screenshot together.
- Correct visible mismatches in hierarchy, spacing, typography, borders, radii, chart density, and character crop.
- Repeat the comparison after fixes.

### Data safety

- Fixtures contain no real personal or financial data.
- Financial payloads are not written to console logs.
- Screenshots use fixtures only.

## 15. Acceptance criteria

The Overview dashboard is ready for handoff when:

- The page matches approved direction A and the visual language of Design 2.
- All approved blocks appear in the required hierarchy.
- IDR formatting and financial formulas follow this specification.
- This Month and Last Month update the entire dashboard consistently.
- Read-only scope is maintained.
- Loading, empty, partial-error, and complete-error states are present.
- Keyboard access, chart summaries, focus treatment, and semantic status cues work.
- The approved Veyra portrait is correctly cropped and remains secondary to data.
- No unfinished destinations, dead links, real financial data, or unapproved features are present.
