# DESIGN_SYSTEM.md

## Property Flipping Management System — Design System
### Visual language, component patterns, and i18n conventions. Referenced by every UI code generation.

> **Reading this doc:** Everything here is a hard rule unless marked *"preference"* or *"guideline."* Claude Code should treat the tokens, typography scale, and component patterns below as non-negotiable. Deviations require explicit justification.

---

## 1. Design philosophy

### 1.1 Three principles

1. **Monochrome base, semantic state color.** The chrome of the UI — navigation, headings, tables, stage pills, role labels, category tags, priority indicators — is strict black, white, and grays. Color is reserved exclusively for **state signals with inherent good/bad directionality**: budget variance, timeline slippage, payment status, task overdue state. This means a "Sold" badge and a "Renovating" badge look identical (no inherent directionality — they're just stages), but a budget that's 15% over looks different from one that's on target (real operational signal). The discipline: **categories stay neutral, states get meaning.** This rule is the whole game — violate it and you get visual noise that dilutes the signals you actually need to spot.

2. **Thai-first, English-available.** The default language is Thai. Every UI string, every system-generated document, every notification is authored in Thai first, then translated to English. IBM Plex Sans Thai is the primary display face. Latin text falls back to Inter for technical content (code, numbers, SQL).

3. **Dense, confident, fast.** Inspired by Attio, shadcn/ui, and Linear. Small default text sizes, tight line-heights, generous use of whitespace, no decorative illustrations, no gradients, no shadows beyond a single subtle level. The product should feel like a professional tool, not a marketing site.

### 1.2 What this design language rejects

To be concrete about the ceiling:

- No gradients. Anywhere.
- No rounded avatars with glow. No photo-realistic illustrations.
- No emoji in UI chrome (emoji in user-generated content is fine)
- No animated loading spinners with color. Grayscale only.
- **No stage color-coding. No priority color-coding. No role color-coding. No category color-coding.** Stages, priorities, roles, and categories are identity/classification — they have no inherent good/bad direction, so they stay neutral.
- No decorative color. No brand accent. No theme colors.
- No marketing-style hero sections inside the app
- No gamification elements, celebratory animations

### 1.3 What this design language allows (narrowly)

Color is permitted **only** on signals with inherent good/bad directionality:

- **Budget variance** — green (under), neutral (on), amber (1–10% over), red (>10% over)
- **Timeline state** — green (ahead of target), neutral (on track), amber (slipping), red (overdue)
- **Task due dates** — neutral (future/no date), amber (due today/tomorrow), red (overdue)
- **Payment status** — green (paid), red (rejected/disputed); all other states stay neutral
- **Destructive actions** — red (delete buttons, irreversible confirmations, required-field errors)

If a state doesn't appear in the above list, it is neutral. When in doubt: **neutral.**

### 1.3 Design references

- **Primary:** [Attio](https://attio.com) — layout density, typography, interaction patterns
- **Secondary:** [shadcn/ui](https://ui.shadcn.com) — component architecture, strict monochrome palette
- **Tertiary:** [Linear](https://linear.app) — keyboard-first interactions, command palette patterns (note: Linear uses color; we don't)

When in doubt: **build it the way shadcn would, with Attio's layout density.**

---

## 2. Color system

### 2.1 The palette

Only these tokens exist. If a color is needed that isn't listed here, the answer is "use one that is."

**Neutrals (the entire UI, effectively):**

| Token | Light mode | Dark mode | Usage |
|---|---|---|---|
| `--color-background` | `#FFFFFF` | `#0A0A0A` | App background |
| `--color-surface` | `#FAFAFA` | `#111111` | Cards, panels, sidebars |
| `--color-surface-raised` | `#FFFFFF` | `#161616` | Modals, popovers, dropdowns |
| `--color-border-subtle` | `#F0F0F0` | `#1F1F1F` | Dividers between sections |
| `--color-border` | `#E5E5E5` | `#2A2A2A` | Input borders, card borders |
| `--color-border-strong` | `#D4D4D4` | `#3A3A3A` | Focused inputs, hovered borders |
| `--color-text-muted` | `#737373` | `#8A8A8A` | Secondary labels, captions, placeholders |
| `--color-text-default` | `#262626` | `#E5E5E5` | Body text, default foreground |
| `--color-text-strong` | `#0A0A0A` | `#FAFAFA` | Headings, primary actions, emphasis |

**Fills for interactive states (derived from neutrals):**

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-fill-hover` | `#F5F5F5` | `#1F1F1F` | Row hover, button hover |
| `--color-fill-active` | `#EBEBEB` | `#2A2A2A` | Pressed state, selected row |
| `--color-fill-selected` | `#E5E5E5` | `#333333` | Selected kanban card, active tab |

**Semantic state colors — used only on signals with good/bad directionality (Section 1.3):**

These are intentionally muted — not vibrant green or alarm red. The design language still reads as quiet and professional; the color is an *accent on data*, not a fill on large surfaces.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-positive` | `#15803D` | `#4ADE80` | Under-budget variance, ahead-of-timeline, paid status, on-time completion |
| `--color-positive-fill` | `#DCFCE7` | `#052E16` | Subtle backgrounds for positive-state pills only — never large surfaces |
| `--color-warning` | `#B45309` | `#FBBF24` | 1–10% over budget, timeline slipping, task due today/tomorrow |
| `--color-warning-fill` | `#FEF3C7` | `#451A03` | Subtle backgrounds for warning-state pills only |
| `--color-destructive` | `#DC2626` | `#EF4444` | >10% over budget, overdue, rejected/disputed, delete actions, validation errors |
| `--color-destructive-fill` | `#FEE2E2` | `#450A0A` | Subtle backgrounds for destructive-state pills and destructive button hover |

**Usage rules for semantic colors (strict):**

- ✅ Text color on a number showing variance (`-฿120,000` in `--color-destructive`)
- ✅ Icon color on a state indicator (`AlertCircle` in `--color-destructive` for overdue)
- ✅ Pill text + subtle fill background (Section 5.4) for state pills — never for category/stage pills
- ✅ Border-left on a row to flag attention (3px `--color-destructive` on a massively over-budget flip row)
- ❌ Large fill areas (card backgrounds, buttons, headers)
- ❌ Decorative use — a "Sold" pill does NOT get `--color-positive` because "Sold" is a stage (identity), not a state (directionality)
- ❌ Combined with fills for emphasis — pick one surface treatment, not both
- ❌ Brand accent, link color, selected tab underline, active nav item — all stay monochrome

**The directionality test:** Before applying a semantic color, ask "does this have an objectively better or worse version?" Budget variance: yes (under is better than over). Flip stage: no (Renovating isn't better than Listing, it's just different). Priority: no (Urgent isn't "bad" — it's just a category of how-to-prioritize). If the answer is no, it stays neutral.

### 2.2 State indication rules

This is the core discipline of the design system. Follow these rules mechanically:

**For stages, roles, categories, priorities, property types** (identity/classification — no directionality):

Text label in a neutral pill:
```
┌──────────────────┐
│  Renovating       │  ← Pill: 1px border, text-muted by default,
└──────────────────┘     text-strong + fill-selected when the row's active stage
```

No color. Ever. If the pill's meaning can be reduced to "what category is this?", it's neutral.

**For priority** → Typography weight + optional icon, no color:
- Urgent: **Bold text-strong** + `!` icon prefix
- High: **Bold text-default**
- Normal: Regular text-default
- Low: Regular text-muted

**For budget variance** (has directionality — color applies):

| State | Treatment |
|---|---|
| Under budget | `--color-positive` text; pill uses `--color-positive-fill` background |
| On budget (±1%) | Neutral text; no pill background |
| 1–10% over | `--color-warning` text; pill uses `--color-warning-fill` |
| >10% over | `--color-destructive` text; pill uses `--color-destructive-fill`; optional 3px left border on row |

Display: `-฿85,000 (-3.1%)` or `+฿340,000 (+12%)` — with the sign, the number, and the percentage. Tabular figures. The color is on the text, not on a separate badge.

**For timeline state** (has directionality — color applies):

Computed as: (actual elapsed days / target days) vs stage-expected progress.

| State | Treatment |
|---|---|
| Ahead of target | `--color-positive` |
| On track | Neutral |
| Slipping (0–15% over) | `--color-warning` |
| Late (>15% over or past target date) | `--color-destructive` |

Display: `Day 47 of 60 (on track)` or `Day 73 of 60 (13 days late)` — the text carries the meaning; color emphasizes it.

**For task due dates** (has directionality — color applies):

| State | Treatment |
|---|---|
| No due date | Neutral, muted |
| Future (>2 days out) | Neutral |
| Due today or tomorrow | `--color-warning` |
| Overdue | `--color-destructive`, bold, explicit text ("3 days overdue") |

**For payment status** (partial directionality — color applies selectively):

| State | Treatment |
|---|---|
| Requested | Neutral |
| Approved | Neutral |
| Paid | `--color-positive` |
| Rejected / Disputed | `--color-destructive` |
| Canceled | Neutral, muted |

Note: "Approved" is neutral, not green. Approved means "ready to pay" — still pending action. Green means "done" — money has moved.

**For flip stages** (no directionality — neutral):

All nine flip stages use the same neutral pill treatment. `Sold` does NOT get green — "sold" is a stage, not a celebration. The PM already knows sold is the goal; they don't need a dopamine hit from a green pill. What they need is fast scanning of *which flips are in trouble*, which only works if non-trouble flips stay quiet.

**For progress bars (budget burn, timeline):**

```
Budget: 2.4M / 3.0M THB                     80%
████████████████████████░░░░░░░
```

- Bar fill: `--color-text-strong` (neutral) when at or under budget
- Bar fill: `--color-destructive` when over budget
- Background track: `--color-border`
- Never use a gradient; the transition at the over-budget threshold is hard

**The unifying rule:** color is a spotlight, not a paint. If everything is colored, nothing stands out. The PM scanning 10 flips should see maybe 2–3 colored signals max across the whole screen — the ones demanding attention. If five flips are all red, that's information too (you're in crisis), but the UI shouldn't create that impression when it's not true.

---

## 3. Typography

### 3.1 Font stack

**Primary (Thai + Latin):**
```css
--font-sans: 'IBM Plex Sans Thai', 'IBM Plex Sans', 'Inter',
             ui-sans-serif, system-ui, sans-serif;
```

**Monospace (codes, IDs, numbers in tables):**
```css
--font-mono: 'IBM Plex Mono', 'JetBrains Mono',
             ui-monospace, 'SF Mono', monospace;
```

**Why IBM Plex Sans Thai as primary (even for Latin):**
- Seamless Thai ↔ English mixing in the same paragraph (very common in this app — Thai labels, English numbers, Thai notes with English property codes)
- Designed with matching x-heights across scripts
- Has real weights (not synthetic bold)
- Free, open-licensed, already used in ECHO

IBM Plex Sans Thai has a Latin variant built in — we do NOT need to fall back to Inter for Latin text in most cases. Only fall back when IBM Plex Sans Thai lacks a glyph (rare) or for technical mono contexts.

### 3.2 Loading the fonts (Next.js)

```typescript
// app/fonts.ts
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from 'next/font/google'

export const fontSans = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})

export const fontMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})
```

Applied to `<html>` via `className={`${fontSans.variable} ${fontMono.variable}`}`.

### 3.3 Type scale

Based on a 14px base (Attio-like density). Thai characters are slightly larger than Latin at the same point size, so this scale is tuned for mixed-script readability.

| Token | Size | Line height | Weight | Usage |
|---|---|---|---|---|
| `--text-3xl` | 30px | 36px | 600 | Page titles (rare — most pages use `--text-2xl`) |
| `--text-2xl` | 24px | 32px | 600 | Section titles, modal headers |
| `--text-xl` | 20px | 28px | 600 | Card headers, flip detail h2 |
| `--text-lg` | 16px | 24px | 500 | Emphasized body, form section headers |
| `--text-base` | 14px | 20px | 400 | Default body text |
| `--text-sm` | 13px | 18px | 400 | Secondary text, table cells, form helper text |
| `--text-xs` | 12px | 16px | 400 | Captions, table headers, timestamps, metadata |
| `--text-micro` | 11px | 14px | 500 | Pill labels, very small UI chrome |

**Weight tokens:**

| Token | Value | Usage |
|---|---|---|
| `--font-light` | 300 | Never for UI; only for large display numbers |
| `--font-regular` | 400 | Default body |
| `--font-medium` | 500 | Emphasized body, buttons, input labels |
| `--font-semibold` | 600 | Headings, strong emphasis |
| `--font-bold` | 700 | Overdue / attention text, destructive warnings |

**Rules:**
- Never use font weight as decoration. Bold means "this matters operationally" (overdue, over-budget, urgent).
- Never mix weights within the same sentence except to highlight a number or status word.
- Headings are 600, never 700 — save 700 for attention states.

### 3.4 Numbers: tabular figures

All financial displays, table columns of numbers, and side-by-side budget/actual comparisons must use tabular figures:

```css
.numeric {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum';
}
```

Apply this class to every `<td>` containing a number, every currency display, every percentage. This ensures columns align vertically. Non-negotiable for financial UI.

### 3.5 Thai-specific typography rules

- **No letter-spacing on Thai text.** It kills readability. Latin-only UI components (like uppercase labels) can use `letter-spacing: 0.05em`, but any component rendering Thai must have `letter-spacing: 0`.
- **Line-height minimums.** Thai has taller ascenders/descenders (top and bottom marks). Minimum line-height is 1.4 for any Thai-containing text — never tighter. The scale above already respects this.
- **Avoid all-caps for Thai.** Thai script doesn't have a case system. Where a design calls for all-caps (table headers, button labels), apply it only to Latin strings — never to Thai labels. Use a slightly smaller size + medium weight for Thai labels that serve the same role.

---

## 4. Spacing, radii, and elevation

### 4.1 Spacing scale (4px base)

```
space-0:   0
space-px:  1px
space-0.5: 2px
space-1:   4px
space-1.5: 6px
space-2:   8px
space-2.5: 10px
space-3:   12px
space-4:   16px
space-5:   20px
space-6:   24px
space-8:   32px
space-10:  40px
space-12:  48px
space-16:  64px
```

**Standard paddings:**
- Input fields: `px-3 py-2` (12px / 8px)
- Buttons (default): `px-3 py-1.5` (12px / 6px)
- Buttons (large): `px-4 py-2`
- Table cells: `px-3 py-2.5` (12px / 10px) — Attio-like density
- Card body: `p-4` (16px)
- Modal body: `p-6` (24px)
- Page container: `px-6 py-4` desktop, `px-4 py-3` mobile

### 4.2 Border radius

```
radius-none:  0
radius-sm:    4px    /* default for most elements */
radius-md:    6px    /* cards, inputs, buttons */
radius-lg:    8px    /* modals, large cards */
radius-xl:    12px   /* reserved — not used in v1 */
radius-full:  9999px /* pills, avatars */
```

**Rule:** Prefer `radius-md` (6px) for most UI. Sharp corners (0) for data-dense tables. Pill `radius-full` for status labels and avatars. Never use `radius-xl` or larger in this app.

### 4.3 Elevation (shadows)

Three levels only. Use sparingly.

```css
--shadow-none: none;

--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.04);
/* Popovers, dropdowns on surface */

--shadow-md: 0 2px 8px -2px rgba(0, 0, 0, 0.08),
             0 1px 3px 0 rgba(0, 0, 0, 0.06);
/* Modals, floating cards */

/* That's it. No --shadow-lg, no --shadow-xl. */
```

**Rules:**
- Never combine a shadow with a strong border. Pick one.
- Dark mode uses no shadows — use `--color-border` instead for separation.
- Tables, cards in content flow, sidebars: 0 elevation, border only.

---

## 5. Component patterns

### 5.1 Buttons

Three variants only. No "destructive-outline," no "ghost-primary," no endless matrix.

**Primary (default action):**
- Background: `--color-text-strong` (near-black in light mode, near-white in dark mode)
- Text: `--color-background` (inverse)
- Hover: slight opacity reduction (0.9)
- Used for: the single primary action per screen

**Secondary (standard action):**
- Background: `--color-background`
- Text: `--color-text-default`
- Border: 1px `--color-border`
- Hover: `background: --color-fill-hover`
- Used for: most buttons in the app

**Ghost (tertiary action):**
- No background, no border
- Text: `--color-text-muted`
- Hover: `background: --color-fill-hover`, text becomes `--color-text-default`
- Used for: toolbar icons, "Cancel" in modals, inline actions

**Destructive:**
- Text: `--color-destructive`
- Background: transparent (or `--color-destructive-fill` on hover)
- Used for: delete, kill flip, remove commitment
- **Always require a confirmation step.** Never one-click destructive.

**Sizes:** `sm` (28px tall), `md` (32px tall — default), `lg` (40px tall).

**Icon-only buttons:** 32×32px, ghost variant. Aria-label required.

### 5.2 Inputs

Single style, consistent across text, number, currency, date:

```
┌─────────────────────────────────────────┐
│ Placeholder text                         │
└─────────────────────────────────────────┘
```

- Height: 36px (density-matched to buttons)
- Border: 1px `--color-border`
- Border-radius: `--radius-md`
- Padding: `px-3 py-2`
- Background: `--color-background`
- Focus: border becomes `--color-text-strong`, no glow, no shadow
- Error: border becomes `--color-destructive`, error text below input in `--color-destructive` `--text-xs`

**Currency inputs:** always show "THB" suffix in `--color-text-muted` inside the input, right-aligned. Number is tabular, right-aligned.

**Thai text inputs:** no IME-specific styling; rely on browser behavior. Autocomplete attributes should be set correctly (`autocomplete="street-address"` etc.).

### 5.3 Tables (the most important UI pattern in this app)

This app is 70% tables. Tables must be fast, dense, and scannable.

**Row height:** 40px default. Dense mode (toggle): 32px.

**Row separation:** `border-bottom: 1px solid --color-border-subtle`. No alternating zebra stripes. No row shadows.

**Header:**
- `--text-xs` + `--font-medium` + `--color-text-muted`
- `text-transform: uppercase` only for Latin headers; Thai headers stay sentence-case, medium weight
- Sticky on vertical scroll
- Sortable headers: arrow indicator, click toggles sort direction

**Cell alignment:**
- Text columns: left-aligned
- Number columns: right-aligned, tabular
- Status/pill columns: left-aligned
- Action columns: right-aligned, always last

**Row hover:** `background: --color-fill-hover`. Row cursor: `pointer` if clickable, `default` if not.

**Row selected:** `background: --color-fill-selected`. Checkbox in first column if multi-select is enabled.

**Empty state:** centered text + secondary button to add first item. No illustrations.

**Loading state:** skeleton rows (gray blocks animated with pulse). Never a spinner.

**Pagination:** "Showing 1–50 of 247" + prev/next buttons. No numbered page links (they're noise on mobile).

### 5.4 Pills (status, stage, tag)

All pills share one form factor:

```
  ┌────────────┐
  │ Renovating │
  └────────────┘
```

- Height: 22px
- Padding: `px-2 py-0.5`
- Border: 1px `--color-border`
- Border-radius: `--radius-full`
- Background: `--color-background`
- Text: `--text-xs` `--font-medium` `--color-text-default`

**Neutral variants (default — used for all categories, stages, roles, property types):**

- **Default:** as described above
- **Active/selected:** background `--color-fill-selected`, text `--color-text-strong`
- **Muted (completed/archived):** text `--color-text-muted`, border `--color-border-subtle`

**Semantic variants (used only for state signals with directionality — Section 2.2):**

- **Positive:** border `--color-positive`, background `--color-positive-fill`, text `--color-positive`
  - Examples: "Paid", "Under budget -3%"
- **Warning:** border `--color-warning`, background `--color-warning-fill`, text `--color-warning`
  - Examples: "Due tomorrow", "+5% over"
- **Destructive:** border `--color-destructive`, background `--color-destructive-fill`, text `--color-destructive`
  - Examples: "Overdue 3d", "+14% over", "Rejected"

**The directionality check (repeat it for every pill you build):** Does this pill's state have an objectively better/worse version? If no → neutral variant. If yes → semantic variant is allowed, but only for that specific state dimension.

A stage pill is NEVER semantic. A payment-status pill MAY be semantic (paid = positive, rejected = destructive), but the "Approved" state is still neutral because it's just a step in the workflow, not an outcome.

### 5.5 Cards

- Background: `--color-background` (light) or `--color-surface` (dark)
- Border: 1px `--color-border`
- Border-radius: `--radius-md`
- Padding: `p-4`
- No shadow by default

**Interactive cards (Kanban):** hover adds `--color-fill-hover` background, border becomes `--color-border-strong`. No lift effect.

### 5.6 Modals

- Overlay: `rgba(0, 0, 0, 0.4)` light mode, `rgba(0, 0, 0, 0.7)` dark mode. No blur.
- Container: `--color-surface-raised`, `--radius-lg`, `--shadow-md`
- Max width: 560px default, 720px for complex forms, 960px for tables
- Header: `--text-lg` `--font-semibold`, close button (ghost) top-right
- Body: `p-6`
- Footer: right-aligned, Cancel (ghost) + Primary action (primary button), 8px gap

**Destructive confirmation modals:** destructive button replaces primary. Body text names the exact thing being destroyed: "Delete flip FLIP-2026-007? This cannot be undone."

### 5.7 Toasts / notifications

- Position: bottom-right (desktop), bottom-center (mobile)
- Max width: 400px
- Background: `--color-surface-raised`
- Border: 1px `--color-border` (default) / `--color-positive` / `--color-destructive`
- No icons in toast body for neutral toasts
- Success toast: left-edge 3px border in `--color-positive`, text stays `--color-text-default`
- Error toast: left-edge 3px border in `--color-destructive`, text stays `--color-text-default` with the error detail in `--color-destructive`
- Auto-dismiss: 4 seconds default, 8 seconds for errors
- Text: `--text-sm` `--color-text-default`

### 5.8 Kanban boards (Deal Pipeline, Lead Inbox)

- Columns: fixed 280px width, vertical scroll per column
- Column header: stage name + count pill + menu icon (ghost)
- Column background: `--color-surface`, no border between columns except `--color-border-subtle` vertical lines
- Cards within: see 5.5
- Drag handle: entire card is draggable; on drag, card gains `--shadow-md` and slight scale (1.02)
- Drop zones: subtle `--color-fill-hover` background on valid targets

---

## 6. Iconography

**Library:** Lucide React (consistent with ECHO).

**Rules:**
- Stroke width: 1.5 (not the default 2)
- Size: 16px default, 14px in dense tables, 20px in empty states
- Color: inherit (`currentColor`) — never set icon color directly
- Never decorative. Every icon has semantic meaning or should be removed.

**Standard icon mapping:**

| Concept | Icon |
|---|---|
| Property | `Home` |
| Flip | `Layers` |
| Budget | `Wallet` |
| Contractor | `HardHat` |
| Task | `CheckSquare` |
| Investor | `Users` |
| Document | `FileText` |
| Comment | `MessageSquare` |
| Timeline | `Calendar` |
| Dashboard | `LayoutDashboard` |
| Search | `Search` |
| Filter | `SlidersHorizontal` |
| More actions | `MoreHorizontal` |
| Delete (destructive) | `Trash2` |
| Edit | `Pencil` |
| Add new | `Plus` |
| Close | `X` |
| Warning / attention | `AlertCircle` |
| Sold / completed | `Check` |

---

## 7. Layout

### 7.1 Application shell

```
┌──────────────────────────────────────────────────────────────┐
│ Top bar (48px): org switcher · global search · user menu    │
├──────────┬───────────────────────────────────────────────────┤
│          │                                                   │
│ Sidebar  │                                                   │
│ (240px)  │   Content area                                    │
│          │                                                   │
│ Nav:     │                                                   │
│ · Dash   │                                                   │
│ · Sourcing│                                                  │
│ · Flips  │                                                   │
│ · Contrs │                                                   │
│ · Invsts │                                                   │
│ · Listings│                                                  │
│          │                                                   │
└──────────┴───────────────────────────────────────────────────┘
```

- Sidebar: `--color-surface` background, collapsible to 56px icon-only on smaller screens
- Top bar: `--color-background`, bottom border `--color-border-subtle`
- Content area: max-width varies by route; default `max-w-screen-2xl mx-auto`

### 7.2 Mobile

The team uses this on phones at property sites. Mobile is first-class.

- Breakpoint: tablet and above (≥768px) gets sidebar; mobile gets bottom tab bar (5 tabs)
- Bottom tab bar: Dashboard, Flips, Contractors, Investors, More
- Tap targets: minimum 44×44px
- Forms stack vertically with full-width inputs
- Tables become cards (each row a stacked card) on mobile
- Photo upload: prominent camera button, client-side compression before upload (target: <500KB per photo)

### 7.3 Density modes

Two modes, toggled in user preferences:

- **Comfortable (default):** 40px row height, 16px card padding, `--text-sm` table content
- **Dense:** 32px row height, 12px card padding, `--text-xs` table content

Dense mode is for heavy operational use (PM reviewing 50+ tasks). Comfortable is the default for new users.

---

## 8. Internationalization (Thai-first, English-available)

### 8.1 Library

**`next-intl`** is the i18n library. It handles:
- String translation
- Date/time formatting per locale
- Number/currency formatting per locale
- Pluralization
- Server- and client-side rendering consistency

### 8.2 Locale setup

**Supported locales:**
- `th` (default — Thai)
- `en` (English)

**Resolution order for active locale:**
1. User's `users.locale` setting (logged-in users)
2. Investor's `investors.preferred_language` (for investor-facing portals in v2)
3. Cookie (anonymous users who've chosen a locale)
4. `Accept-Language` header
5. Fallback: `th`

**URL structure:**
- Default Thai: `/dashboard`, `/flips/FLIP-2026-007`
- Explicit English: `/en/dashboard`, `/en/flips/FLIP-2026-007`
- No `/th/` prefix — Thai is default and prefix-less

### 8.3 File organization

```
/messages
  /th
    common.json            ← Shared UI chrome
    flips.json             ← Flip-related strings
    budget.json
    contractors.json
    investors.json
    listings.json
    notifications.json
    emails.json            ← Email templates
    pdfs.json              ← PDF report templates
  /en
    (mirror of /th)
```

Every string in `/th/*` has a counterpart in `/en/*`. CI check enforces key parity.

### 8.4 Authoring rules

- **Thai strings are authored first.** English is translated from Thai, not the other way around. This is the opposite of most apps and is a deliberate choice to preserve Thai as the "source of truth" voice.
- **No string concatenation.** Use placeholders: `"{count} flips overdue"` not `"" + count + " flips overdue"`. Thai word order differs; concatenation breaks.
- **Pluralization via ICU syntax** — though Thai has no plural forms, English does, and the same key must work for both.
- **Dates and numbers are formatted by the library,** never hardcoded. `formatCurrency(1234567, 'th')` → `฿1,234,567`. `formatCurrency(1234567, 'en')` → `THB 1,234,567`.
- **Thai Buddhist Era dates** are displayed by default in Thai locale (e.g., 2569 instead of 2026). English locale always uses Gregorian. Use `formatDate(date, 'th', { era: 'buddhist' })`.

### 8.5 Data tables that carry i18n

Seeded lookup tables (flip_stages, budget_categories, roles) need Thai and English display names. The schema stores both:

```
name_th   text NOT NULL
name_en   text
```

The `slug` column remains the stable identifier across languages. See updated DATA_MODEL.md for the full change.

### 8.6 User-entered content

User-entered content (property nicknames, flip names, notes, contractor names, investor names) is **not translated.** It's stored as-is. If the user enters Thai, it displays in Thai; if they enter English, English. No auto-translation.

**Listings are the one exception** — they have explicit `description_th` and `description_en` columns because listings are seen by external buyers and need per-language content.

### 8.7 System-generated documents

Every system-generated PDF, email, LINE message respects the **recipient's** locale:

- Investor statement PDF → uses `investors.preferred_language`
- Team notification in LINE → uses `users.locale`
- Lead auto-responder email → uses the listing's locale or the lead's detected language

All templates exist in both languages in `/messages/th/` and `/messages/en/`.

### 8.8 Mixed-script content

Common in this app — example: "Flip FLIP-2026-007 มีปัญหาเรื่อง budget เกินไป 12%". The system:

- Does NOT try to force pure Thai or pure English
- Renders mixed content in IBM Plex Sans Thai (handles both scripts)
- Never auto-formats or "corrects" user input

---

## 9. Accessibility

Baseline requirements for v1 (WCAG AA):

- **Contrast ratios:** all text meets 4.5:1 against its background (tokens above are tested)
- **Keyboard navigation:** tab order logical; all interactive elements reachable; focus ring visible (2px solid `--color-text-strong` outline, no glow)
- **Screen reader labels:** every icon button has `aria-label` (in both Thai and English); every form input has a `<label>` or `aria-labelledby`
- **Focus management:** modals trap focus; opening a modal moves focus to its first focusable element; closing returns focus to the trigger
- **Motion:** respect `prefers-reduced-motion`; disable skeleton pulses and drag scaling when set

Explicitly **deferred to v2:**
- RTL support (not needed for Thai or English)
- High-contrast theme beyond the default dark mode
- Screen reader audits beyond automated tooling

---

## 10. Dark mode

Dark mode is first-class, not a retrofit. Tokens in Section 2.1 include dark mode values.

- Toggle in user preferences
- Default: matches system (`prefers-color-scheme`)
- Persisted in `users.metadata.theme`
- Transitions: instant (no fade between modes)

**Rule:** every component must be verified in both modes before merging. No "light mode only" features in v1.

---

## 11. Loading, empty, and error states

Consistent patterns across the app.

### 11.1 Loading

- **Skeletons** for lists, tables, cards (not spinners)
- **Inline spinner** (12px, grayscale) only for button-local loading (e.g., "Saving…" in a button)
- **Page-level** routes use skeleton of the target UI, not a centered spinner

### 11.2 Empty

- Centered in the container
- `--text-base` heading: "No flips yet" (Thai-first: "ยังไม่มี Flip")
- `--text-sm` `--color-text-muted` subtext: brief action guidance
- Primary or secondary button to add the first item
- **No illustrations.** Ever.

### 11.3 Error

- Inline where possible (field-level errors under inputs)
- Page-level errors: centered text, error message in `--text-base`, "Retry" button
- 404 / 500: single-line Thai message + English fallback + home link
- Never expose stack traces to users

---

## 12. Motion

Minimal and functional only.

- **Duration:** 150ms default, 250ms for modals, 100ms for hover states
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) for enters, `cubic-bezier(0.7, 0, 0.84, 0)` (ease-in-expo) for exits
- **What gets motion:** modals fade+scale in, dropdowns slide down 4px while fading, drag/drop visible feedback
- **What does NOT get motion:** page transitions (instant), tab switches (instant), table row appearance (instant)

---

## 13. Component library baseline

Built on **shadcn/ui**, tuned to match this design system.

Components to install (v1):
- `button`, `input`, `label`, `form`
- `table`, `data-table` (with @tanstack/react-table)
- `dialog` (modals), `alert-dialog` (destructive confirmations)
- `dropdown-menu`, `popover`, `command` (command palette)
- `tabs`, `select`, `checkbox`, `radio-group`
- `toast` (via sonner)
- `sheet` (mobile slide-in panels)
- `skeleton`
- `tooltip`

**Customization rule:** we override the shadcn defaults to match our token system. Every component must be audited against Sections 2, 3, 5 before first use. Don't use shadcn defaults blindly — they include color accents we don't want.

---

## 14. What goes in v1 vs. v2

### 14.1 v1 includes

Everything in Sections 1–13 above, applied to:
- The four pillars (Sourcing, PM, Contractors, Sales)
- Investor reporting (internal view + PDF generation)
- Thai + English UI with `users.locale` toggle
- Dark mode
- Mobile-responsive layout

### 14.2 v2 adds

- RTL support (if commercial customers need it)
- Additional locales (Mandarin, Japanese — if commercial expansion demands)
- Custom themes per tenant (commercial branding)
- Denser "power user" mode with keyboard-only workflows
- Print stylesheet for PDF export refinement
- Custom fonts per tenant (commercial vanity)

---

## 15. Decisions captured here (for the record)

| # | Decision | Rationale |
|---|---|---|
| 1 | Monochrome base + semantic state color (never decorative color) | Financial ops tool requires fast status scanning; color reserved exclusively for signals with good/bad directionality (budget variance, timeline, overdue, payment outcome); categories and stages stay neutral to keep signals un-diluted |
| 2 | IBM Plex Sans Thai as primary for all text | Seamless Thai-Latin mixing; real weights; matches ECHO |
| 3 | Thai-first, English translated from Thai | This is a Thai-market product; preserves Thai voice as canonical |
| 4 | `next-intl`, not custom i18n | Battle-tested; handles SSR correctly; ICU syntax support |
| 5 | No `/th/` URL prefix, `/en/` prefix for English | Thai is default; URLs reflect that |
| 6 | Buddhist Era dates for Thai locale | Matches user expectations in Thai financial/legal context |
| 7 | Tabular figures mandatory for all numbers | Financial app; column alignment is non-negotiable |
| 8 | No illustrations, no gradients, no decorative icons | Professional tool aesthetic; faster to build; ages well |
| 9 | Dark mode first-class from v1 | Cheaper now than retrofitting |
| 10 | Skeletons over spinners | Perceived performance + reduced motion sensitivity |
| 11 | shadcn/ui as component baseline, overridden to match tokens | Don't reinvent; do customize |
| 12 | Lucide React icons, 1.5 stroke width | Consistent with ECHO; more refined than default 2 |
| 13 | User-entered content never auto-translated | Respects user intent; avoids incorrect machine translation in professional context |
| 14 | Mobile uses bottom tab bar, not hamburger | Matches native Thai app conventions; faster thumb reach |
| 15 | Two density modes (comfortable / dense) | Serves different user workflows without two separate UIs |
