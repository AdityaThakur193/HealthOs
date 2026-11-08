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
        LocalFallback[("Local JSON Dev DB (local_db.json)")]
    end

    Client -->|HTTP Requests| API
    VisionRoute --> GeminiClient
    VisionRoute --> IFCTEngine
    DietRoute --> TDEEEngine
    DietRoute --> DietEngine
    TimelineRoute --> MongoCache
    ProfileRoute --> MongoCache
    MongoCache -->|Primary| MongoAtlas
    MongoCache -.->|Development Fallback| LocalFallback
```

---

### Diagram 2: 14-Day Rolling Linear Regression Adaptive TDEE Loop (MacroFactor Paradigm)
```mermaid
flowchart TD
    Start([User Logs Weight & Meals Daily]) --> QueryTimeline["Query Last 14 Days of Timeline Events from MongoDB"]
    QueryTimeline --> FilterData["Filter Valid Daily Weight Entries & Total Calorie Intakes"]
    
    FilterData --> CheckCount{"3+ Weigh-in Days and 7+ Calorie Days?"}
    CheckCount -- No --> ReturnBMR["Return Static BMR/TDEE (Status: Calibrating)"]
    
    CheckCount -- Yes --> CalcRegression["Calculate Linear Regression Slope of Weight Delta (kg/day)"]
    CalcRegression --> ConvertEnergy["Convert Weight Delta to Daily Energy Balance (1 kg fat ~ 7700 kcal)"]
    ConvertEnergy --> CalcUnclamped["Compute Unclamped Expenditure: TDEE = Daily Intake - (Weight Slope * 7700)"]
    
    CalcUnclamped --> ClampSpikes["Clamp to BMR x Activity Baseline ±200 kcal"]
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

### Diagram 4: Mess-Based Diet Planner
```mermaid
flowchart LR
    Menu["Parsed Mess Menu"] --> Split["Split Into Individual Foods"]
    Split --> Filter["Remove Foods That Break Diet or Allergy Rules"]
    Filter --> Lookup{"Food in IFCT 2017?"}
    Lookup -- Yes --> Portions["Fit Portions Within Realistic Limits"]
    Lookup -- No --> Estimate["AI Estimate, Labelled and Saved"]
    Estimate --> Portions
    Targets["Daily Targets Split Across 4 Meals"] --> Portions
    Portions --> Gap{"Protein Short?"}
    Gap -- "Yes, Additions Allowed" --> Additions["Add Allowed Protein Sources"]
    Additions --> Trim["Trim Portions to Fit Calories"]
    Gap -- No --> Save[("Save Plan to User Profile")]
    Trim --> Save
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
        CompleteSet --> CheckReps: Hit upper boundary of rep target (e.g. 12 reps on all top sets)?
        CheckReps --> AutoIncrement: YES -> Auto-increment next session weight (+2.5kg, or +2.0kg dumbbell and lateral work)
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
- `{ email: 1 }` (Unique Index, stored lowercase)

### 2. `TimelineEvent` Schema (`src/lib/db/models.ts`)
Central event log storing all user health activities (meals, workouts, weights, sleep, water).

Key Compound Indexes:
- `{ userId: 1, timestamp: -1 }` (Fast chronological timeline rendering)
- `{ userId: 1, type: 1, timestamp: -1 }` (Filtered type queries for TDEE regression & weekly reviews)

---

## 🔌 Serverless Connection Pooling & Development Fallback

Health OS uses a **dual-layer database connection manager** (`src/lib/mongodb.ts` & `src/lib/db/fallback.ts`):
1. **Primary Layer**: `connectDB()` attaches the Mongoose connection promise to `global._mongooseCache` to prevent connection pool exhaustion across serverless cold starts.
2. **Development Fallback Layer**: In development only, if MongoDB is unreachable the system falls back to local JSON file persistence (`local_db.json`). In production these routes return `503` instead.

---

## 🔐 Authentication & Data Isolation

- **Login**: A 6-digit code is emailed to the user. Challenges are stored in the `OtpChallenge` collection as HMAC hashes, are single-use, expire after 5 minutes, and lock after 5 wrong guesses. Sending is limited to one code per 30 seconds and 5 per hour.
- **Sessions**: A successful login sets an HTTP-only, `SameSite=Lax` cookie signed with HMAC-SHA256 using `AUTH_SECRET` (`src/lib/auth/session.ts`). Sessions are stateless and last 30 days, so they cannot be revoked individually before expiry. Rotating `AUTH_SECRET` ends all of them.
- **Isolation**: API routes take the user's identity only from the session, and every event lookup filters by the session's `userId`. A test fails if a route outside `/api/auth` does not check the session.
- **Timezones**: The browser's timezone is stored in the session, so "today", streaks, and weekly windows follow the user's calendar rather than the server's UTC clock (`src/lib/dateUtils.ts`).
