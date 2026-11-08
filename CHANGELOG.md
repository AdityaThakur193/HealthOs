# Changelog

All notable changes to **Health OS** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Mess-aware coaching. Both coaches now know the time, mess hours, Sunday and holiday timings, and which meals are logged, and they no longer suggest a meal that has closed. Mess hours can be edited in Settings.
- The home coach reuses its message until something relevant changes, which reduces AI calls.
- The chat coach can now see today's logs, habits, adaptive TDEE and exam or sick mode.
- Meal reminders. A notification in the last hour before a meal closes, only if it hasn't been logged. Each meal can be turned on or off.
- Tap-to-log from today's mess menu. Pick what you took and adjust the amounts. Your last amount is only a starting point, and nothing is saved until you confirm.
- Rebuilt diet planner. Code now chooses realistic portions from what the mess serves, using IFCT 2017 data, and says when a target can't be reached. AI only estimates dishes IFCT doesn't cover, and those are labelled.

### Security
- Added signed HTTP-only session cookies. API routes now take identity from the session and scope every read and write to the signed-in user. Previously any client could read or change another user's data by supplying their ID or email.
- Login codes are now single-use, limited to 5 guesses, rate limited, and generated with a secure random source. The client no longer receives a value derived from the code, and the hardcoded fallback signing secret is gone.
- Added size limits and per-user rate limits on AI routes, security headers, and generic error messages in place of internal error text.
- Coach chat now loads the profile from the database instead of trusting one sent by the client, and only accepts known actions.

### Fixed
- The meal screen could show different numbers from what was saved, and changing a portion discarded ingredient-level math.
- Meals logged through chat now use IFCT numbers wherever the food and amount are known.
- Pinch-to-zoom is no longer disabled.
- Habit check-ins failed with a 500 after saving because `habit` was missing from the timeline schema. Toggling a habit now keeps exactly one timeline event per day.
- Deleting a habit did nothing because the server had no `delete` action.
- Server-side "today", streaks, and weekly windows used UTC instead of the user's timezone, which was wrong for Indian users until 05:30 each morning.
- Diet plans now respect allergies, medical conditions, and vegan diets, and calculated calorie targets have a safety floor.
- Diet math audit misread "100g Paneer" as protein and "71.5 kcal" as 5 kcal.
- Adaptive TDEE counted repeat same-day weigh-ins as separate days, included today's unfinished log, and ignored activity level when clamping.
- Progressive overload raised weight when only one set reached the top of the range, and could not find history on 6-day splits.
- Weekly review covered eight days instead of seven.
- Journey and data export were limited to the latest 50 events.
- Exam and sick mode could not be turned off. Steps and water edits left stale values behind.
- Account deletion left habits and AI memory behind.

### Added
- Sign out, integration tests against an in-memory MongoDB, React component tests, and ESLint in CI.

### Changed
- Production now requires `AUTH_SECRET` and `RESEND_API_KEY`.

## [1.0.0] - 2026-07-25

### Added
- **14-Day Adaptive TDEE Expenditure Engine (`src/lib/tdee.ts`)**:
  - Implements the MacroFactor paradigm using 14-day rolling window linear regression of daily weight entries and calorie intake.
  - Dynamically recalculates TDEE, maintenance calories, and target calorie budgets based on true energy balance.
  - Features water weight spike clamping (clamping max delta to ±200 kcal/day) and boundary safety limits [1,200 kcal, 4,500 kcal].
- **ICMR-NIN IFCT 2017 Official Indian Food Composition Database (`src/lib/ifctData.ts`)**:
  - Hardcoded official national nutrition composition tables for Indian staples (Rotis, Thin Mess Dal, Home Dal, Cooked Rice, Paneer, Curd, Eggs, Chicken, Whey, Poha, Upma, Idli, Dosa).
  - Standard unit conversion scaling factors (`katori`, `piece`, `scoop`, `gram`, `plate`) and preparation style multipliers (`thin_mess`, `ghee`, `jeera`).
- **4-Stage Perfect Vision Pipeline (`src/lib/gemini.ts` & `/api/vision`)**:
  - Decouples visual dish candidate detection from macro calculation.
  - Gemini 2.5 Flash detects dish names and unit counts, while `ifctData.ts` post-processes candidate detections with 100% deterministic, mathematically verified macros.
- **Interactive Quantity Sliders UI (`MealResultCard.tsx` & `/meal`)**:
  - Replaced vague `Small/Medium/Large` buttons with interactive portion counter controls (`-` / `+`) displaying standard Indian units (`2 Pieces`, `1 Katori`, `1 Scoop`).
  - Real-time macro updates on screen before saving meal events to the timeline.
- **Grounded AI Diet Plan Engine (`src/lib/dietEngine.ts` & `/api/diet/generate`)**:
  - Pre-calculates 4-meal Muscle Protein Synthesis (MPS) leucine protein spacing allocations (25% / 30% / 15% / 30%).
  - Injects pre-calculated IFCT 2017 additions (Whey, Eggs, Paneer, Curd, Chicken Breast) based on user preference (`veg`, `eggetarian`, `non_veg`).
  - Executes `auditAndFixDietPlanMath` to re-sum meal items in TypeScript and override any LLM arithmetic hallucinations (0% error rate).
- **Evidence-Based 5-Day Gym Split & Progressive Overload Engine (`src/lib/workoutPlans.ts`)**:
  - Supports 3-day, 4-day, 5-day, and 6-day training splits.
  - Double progression model calculating automatic weight increases (+2.5kg / +2.0kg) upon hitting target rep ranges.
  - Curated YouTube exercise video timestamp links embedded directly into exercise cards.
- **Automated Vitest Test Suite (`src/__tests__/`)**:
  - 30 unit and security tests covering TDEE regression math, workout split progression, IFCT portion math, diet engine audit logic, API boundary validation, and security sanitization.
- **GitHub Actions CI/CD Pipeline (`.github/workflows/ci.yml`)**:
  - Automated workflow verifying ESLint linting, TypeScript type-checking (`tsc --noEmit`), Vitest test suite execution (`vitest run`), and Next.js production builds.

### Changed
- Refactored `TimelineEvent` MongoDB schema in `src/lib/db/models.ts` to include compound indexes `{ userId: 1, timestamp: -1 }` and `{ userId: 1, type: 1, timestamp: -1 }` for fast timeline lookups.
- Upgraded Next.js to 16.2.9 with Turbopack and React 19.

---

[1.0.0]: https://github.com/AdityaThakur193/HealthOs/releases/tag/v1.0.0
