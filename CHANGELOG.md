# Changelog

All notable changes to **Health OS** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
- **Zomato/Swiggy Style PWA Web Push Notification System (`src/lib/notifications.ts` & `sw.js`)**:
  - Auto-registers Service Worker with immediate lifecycle activation (`skipWaiting` and `clients.claim`).
  - Sends local background push notifications for meal logging reminders, workout alerts, and water intake check-ins.
- **Automated Vitest Test Suite (`src/__tests__/`)**:
  - 30 unit and security tests covering TDEE regression math, workout split progression, IFCT portion math, diet engine audit logic, API boundary validation, and security sanitization.
- **GitHub Actions CI/CD Pipeline (`.github/workflows/ci.yml`)**:
  - Automated workflow verifying ESLint linting, TypeScript type-checking (`tsc --noEmit`), Vitest test suite execution (`vitest run`), and Next.js production builds.

### Changed
- Refactored `TimelineEvent` MongoDB schema in `src/lib/db/models.ts` to include compound indexes `{ userId: 1, timestamp: -1 }` and `{ userId: 1, type: 1, timestamp: -1 }` for fast timeline lookups.
- Upgraded Next.js to 16.2.9 with Turbopack and React 19.

---

[1.0.0]: https://github.com/AdityaThakur193/HealthOs/releases/tag/v1.0.0
