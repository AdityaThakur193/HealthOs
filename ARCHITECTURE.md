# Health OS Architecture & Engineering Specification 🏛️

This document outlines the system architecture, mathematical algorithms, data pipeline models, and security principles powering **Health OS**.

---

## 📐 System Overview Diagrams

### Diagram 1: High-Level System Architecture & Data Pipelines
```mermaid
graph TD
    subgraph Client ["Client Layer (Next.js 16 App Router)"]
        HUD["Dashboard HUD (page.tsx)"]
        MealUI["AI Vision Meal Capture (/meal)"]
        WorkoutUI["Progressive Gym HUD (/workout)"]
        ReviewUI["Weekly Review (/review)"]
        SW["Service Worker (sw.js Push Notifications)"]
    end

    subgraph API ["Serverless API Layer (Node.js / Edge)"]
        VisionRoute["POST /api/vision"]
        DietRoute["POST /api/diet/generate"]
        TimelineRoute["POST / GET /api/timeline"]
        ProfileRoute["POST / GET /api/profile"]
        CoachRoute["POST /api/coach/chat"]
    end

    subgraph Core ["Core Engineering Modules (src/lib)"]
        TDEEEngine["Adaptive TDEE Engine (tdee.ts)"]
        IFCTEngine["ICMR-NIN IFCT 2017 DB (ifctData.ts)"]
        DietEngine["Grounded Diet Engine (dietEngine.ts)"]
        GymEngine["Workout Split Engine (workoutPlans.ts)"]
        GeminiClient["Gemini 2.5 Flash Vision (gemini.ts)"]
    end

    subgraph Data ["Data Storage & Persistence"]
        MongoCache["Global Mongoose Connection Pool (mongodb.ts)"]
        MongoAtlas[("MongoDB Atlas Cloud DB")]
        LocalFallback[("Local JSON Fallback DB (local_db.json)")]
    end

    Client -->|HTTP Requests| API
    VisionRoute --> GeminiClient
    VisionRoute --> IFCTEngine
    DietRoute --> TDEEEngine
    DietRoute --> DietEngine
    TimelineRoute --> MongoCache
    ProfileRoute --> MongoCache
    MongoCache -->|Primary| MongoAtlas
    MongoCache -.->|Offline Fallback| LocalFallback
```

---

### Diagram 2: 14-Day Rolling Linear Regression Adaptive TDEE Loop (MacroFactor Paradigm)
```mermaid
flowchart TD
    Start([User Logs Weight & Meals Daily]) --> QueryTimeline["Query Last 14 Days of Timeline Events from MongoDB"]
    QueryTimeline --> FilterData["Filter Valid Daily Weight Entries & Total Calorie Intakes"]
    
    FilterData --> CheckCount{"Valid Weight Days >= 7?"}
    CheckCount -- No --> ReturnBMR["Return Static BMR/TDEE (Status: Calibrating)"]
    
    CheckCount -- Yes --> CalcRegression["Calculate Linear Regression Slope of Weight Delta (kg/day)"]
    CalcRegression --> ConvertEnergy["Convert Weight Delta to Daily Energy Balance (1 kg fat ~ 7700 kcal)"]
    ConvertEnergy --> CalcUnclamped["Compute Unclamped Expenditure: TDEE = Daily Intake - (Weight Slope * 7700)"]
    
    CalcUnclamped --> ClampSpikes["Apply Water Weight Spike Clamping (Max Δ ±200 kcal/day)"]
    ClampSpikes --> EnforceBounds["Enforce Safety Boundaries [1200 kcal, 4500 kcal]"]
    
    EnforceBounds --> UpdateProfile["Update UserProfile.tdee & Recalibrate Maintenance Calories"]
    UpdateProfile --> OutputHUD["Render Recalibrated Calories on Dashboard Progress Ring"]
```

---

### Diagram 3: 4-Stage Perfect Vision & ICMR-NIN IFCT 2017 Portion Engine
```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant MealUI as Meal Capture UI (/meal)
    participant VisionAPI as Vision Route (/api/vision)
    participant Gemini as Gemini 2.5 Flash API
    participant IFCT as IFCT 2017 Module (ifctData.ts)
    participant DB as Health Timeline (MongoDB)

    User->>MealUI: Snaps photo / selects meal image
    MealUI->>VisionAPI: Sends compressed base64 image
    VisionAPI->>Gemini: Requests visual detection (Dishes & Unit Counts)
    Note over Gemini: Visual Contract Prompt (No LLM macro guessing)
    Gemini-->>VisionAPI: Returns candidate items (e.g., 2 Rotis, 1 Katori Dal)
    VisionAPI->>IFCT: Look up exact ICMR-NIN 2017 macros per item
    IFCT-->>VisionAPI: Returns 100% deterministic macros (Calories, P, C, F)
    VisionAPI-->>MealUI: Displays candidate list with Interactive Quantity Sliders (+/-)
    User->>MealUI: Adjusts portion quantity (e.g. 2 -> 3 Rotis)
    Note over MealUI: Real-time IFCT portion math recalculation
    User->>MealUI: Taps "Log Meal"
    MealUI->>DB: Saves audited meal event to Timeline
```

---

### Diagram 4: Grounded AI Diet Allocation & Math Audit Pipeline
```mermaid
flowchart LR
    subgraph Allocator ["1. Pre-Calculation Math"]
        DailyTarget["Daily Targets (e.g. 2200 kcal, 150g P)"] --> MPSAlloc["MPS Leucine Allocation (25% B / 30% L / 15% S / 30% D)"]
        MPSAlloc --> AdditionsCalc["Calculate Required Additions (Whey, Eggs, Paneer)"]
    end

    subgraph Prompt ["2. Grounded LLM Contract"]
        AdditionsCalc --> GeminiPrompt["Inject Exact Macro Parentheses Contract into Gemini"]
        GeminiPrompt --> GeneratePlan["Gemini Generates Natural Meal Rationale & Timing"]
    end

    subgraph Audit ["3. Programmatic Math Audit"]
        GeneratePlan --> ParseJSON["Parse Response JSON"]
        ParseJSON --> AuditMath["auditAndFixDietPlanMath() (Re-sum item macros in TypeScript)"]
        AuditMath --> FixHallucinations["Override LLM Arithmetic Errors (0% Error Rate)"]
    end

    FixHallucinations --> SaveDB[("Save Verified Diet Plan to User Profile")]
```

---

### Diagram 5: Double Progression Workout & Progressive Overload Engine
```mermaid
stateDiagram-v2
    [*] --> SelectSplit: User selects gym frequency (3, 4, 5, or 6 days)
    SelectSplit --> LoadWorkout: Load today's targeted workout plan (e.g., Push Day 1)
    
    state LoadWorkout {
        [*] --> DisplayExercise: Render exercise cards with target sets & reps (e.g. 3 sets x 8-12 reps)
        DisplayExercise --> EmbeddedVideo: Provide curated YouTube video timestamp guidance
    }

    LoadWorkout --> CompleteSet: User logs performed weight and reps
    
    state ProgressiveOverload {
        CompleteSet --> CheckReps: Hit upper boundary of rep target (e.g. 12 reps on all sets)?
        CheckReps --> AutoIncrement: YES -> Auto-increment next session weight (+2.5kg compound / +2.0kg isolation)
        CheckReps --> MaintainWeight: NO -> Maintain weight, target higher reps next session
    }

    AutoIncrement --> SaveTimeline: Log workout completion event to Timeline
    MaintainWeight --> SaveTimeline
```

---

## 🗄️ Database Schemas & Data Models

### 1. `UserProfile` Schema (`src/lib/db/models.ts`)
Stores identity, physical biometrics, calculated TDEE, mess menu configurations, and generated diet plans.

Key Compound Indexes:
- `{ email: 1 }` (Unique Index)

### 2. `TimelineEvent` Schema (`src/lib/db/models.ts`)
Central event log storing all user health activities (meals, workouts, weights, sleep, water).

Key Compound Indexes:
- `{ userId: 1, timestamp: -1 }` (Fast chronological timeline rendering)
- `{ userId: 1, type: 1, timestamp: -1 }` (Filtered type queries for TDEE regression & weekly reviews)

---

## 🔌 Serverless Connection Pooling & Offline Resilience

Health OS uses a **dual-layer database connection manager** (`src/lib/mongodb.ts` & `src/lib/db/fallback.ts`):
1. **Primary Layer**: `connectDB()` attaches the Mongoose connection promise to `global._mongooseCache` to prevent connection pool exhaustion across serverless cold starts.
2. **Offline Fallback Layer**: If MongoDB Atlas is unreachable, the system gracefully falls back to local JSON file persistence (`local_db.json`), ensuring uninterrupted user experience.
