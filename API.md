# Health OS REST API Specification 📡

This document describes the serverless HTTP API routes provided by **Health OS**.

---

## 🔐 Authentication

Users sign in with an emailed one-time code. A successful verification sets an HTTP-only, signed `healthos_session` cookie, valid for 30 days.

Every route outside `/api/auth/*` requires that cookie and returns `401` without it. The signed-in user always comes from the session. Routes never accept a `userId` or `email` from the client to decide whose data to read or change.

Routes that need a finished profile return `403` with `{ "notInitialized": true }` until onboarding is complete.

---

## 📑 API Endpoints Summary

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/auth/send-otp` | `POST` | Email a 6-digit login code |
| `/api/auth/verify-otp` | `POST` | Exchange a code for a session cookie |
| `/api/auth/logout` | `POST` | Clear the session cookie |
| `/api/profile` | `GET`, `POST`, `DELETE` | Read, update, or permanently delete the signed-in user's profile |
| `/api/timeline` | `GET`, `POST`, `PUT`, `DELETE` | Query, log, edit, or delete health timeline events |
| `/api/habits` | `GET`, `POST` | Read habits with statistics; check in, save, delete, or reset habits |
| `/api/vision` | `POST` | Analyze a meal photo or text using AI detection and IFCT 2017 math |
| `/api/diet/generate` | `POST` | Generate a weekly diet plan with audited macros |
| `/api/mess-menu/parse` | `POST` | Parse a mess menu image or text into structured JSON |
| `/api/mess-menu/today` | `GET` | Today's menu for one meal (`?meal=lunch`), with nutrition per unit and the user's last amounts |
| `/api/coach` | `POST` | Generate today's coaching insight for the dashboard |
| `/api/coach/chat` | `POST` | Conversational coach that returns a reply and an optional action |
| `/api/review` | `GET` | Calculate the review for the last seven calendar days |

---

## Limits

AI routes are rate limited per user. Limits are counted per server instance, so they are a best-effort brake on spend. A route over its limit returns `429`; `/api/coach` falls back to rule-based coaching instead.

| Route | Per hour |
| :--- | :--- |
| `/api/vision` | 40 |
| `/api/coach/chat` | 60 |
| `/api/coach` (AI calls) | 30 |
| `/api/mess-menu/parse` | 10 |
| `/api/diet/generate` | 8 |

---

## `POST /api/auth/send-otp`

```json
{ "email": "user@example.com" }
```

Returns `200 { "success": true }`. Returns `429` if a code was sent in the last 30 seconds, or after 5 codes in an hour.

## `POST /api/auth/verify-otp`

```json
{ "email": "user@example.com", "otp": "123456", "tz": "Asia/Kolkata" }
```

`tz` is the browser's IANA timezone, used to work out the user's calendar day on the server. On success the response sets the session cookie:

```json
{ "success": true, "email": "user@example.com", "userId": null }
```

`userId` is `null` for a new user who still has to complete onboarding. A code works once, expires after 5 minutes, and is locked after 5 wrong guesses.

---

## `GET | POST | DELETE /api/profile`

`GET` returns the profile with adaptive TDEE state, or `{ "notInitialized": true }`.

```json
{
  "profile": { "_id": "507f1f77bcf86cd799439011", "name": "Asha", "email": "user@example.com", "tdee": 2450, "targetCalories": 2200, "targetProteinG": 150 },
  "tdeeMode": "calibrating",
  "daysRemaining": 4,
  "avgCalories": 2100,
  "weightDeltaKg": 0,
  "streak": 3
}
```

`POST` creates or updates the profile. Required fields:

```json
{
  "name": "Asha",
  "age": 22,
  "gender": "female",
  "heightCm": 165,
  "weightKg": 60,
  "goal": "recomp",
  "activityLevel": "moderate",
  "gymExperience": "intermediate"
}
```

Omitted optional fields keep their stored values. `messTimings` sets the mess hours, with `regular` and `holiday` schedules (`holiday` also applies on Sundays). Calculated calorie targets never go below 1,200 kcal (1,500 kcal for men) unless the user sets custom macros.

`DELETE` permanently removes the profile, timeline, habits, and AI memory, and clears the session.

---

## `/api/timeline`

### `GET`

| Query | Description |
| :--- | :--- |
| `type` | Optional event type |
| `limit` | Default 50, maximum 500 |
| `before` | ISO date cursor for pagination |

```json
{ "events": [], "count": 0, "hasMore": false }
```

### `POST`

```json
{ "type": "weight", "payload": { "weightKg": 74.5 }, "timestamp": "2026-07-25T08:30:00.000Z", "source": "manual" }
```

`type` is one of `weight`, `meal`, `workout`, `sleep`, `steps`, `photo`, `measurement`, `note`, `water`. Payloads are range checked, and meals flagged as mock data are rejected.

### `PUT`

```json
{ "eventId": "66a1b2c3d4e5f67890123456", "payload": { "weightKg": 74.2 } }
```

The payload is merged into the stored event and validated. Returns `404` if the event does not belong to the signed-in user.

### `DELETE`

`/api/timeline?eventId=<id>`. Returns `404` if the event does not belong to the signed-in user.

---

## `/api/habits`

`GET` returns active habits with strength, streaks, and a 30-day heatmap, plus a summary. Starter habits are created on first use.

`POST` takes an `action`:

| Action | Body |
| :--- | :--- |
| `checkin` | `{ "checkin": { "habitId": "...", "completed": true, "value": 1, "date": "2026-07-25" } }` |
| `save` | `{ "habit": { "id": "optional", "title": "..." } }` |
| `delete` | `{ "habitId": "..." }` |
| `reset` | No extra fields |

---

## `POST /api/vision`

```json
{ "imageBase64": "data:image/jpeg;base64,...", "mimeType": "image/jpeg" }
```

Send `mealText` instead of an image to analyze a description. The response has `analysis`, `isMock`, and `source`. When `isMock` is `true`, AI was unavailable and the result is demo data that `/api/timeline` refuses to save.

---

## `POST /api/diet/generate`

```json
{ "strictMessOnly": false }
```

Requires a parsed mess menu on the profile. Code chooses realistic portions and takes nutrition from IFCT 2017, with AI estimates only for dishes IFCT doesn't cover. Send `{ "swap": { "day": "monday", "meal": "Lunch" } }` to try different additions for one meal. Returns `{ "success": true, "dietPlan": {}, "savedProfile": {} }`.

---

## `POST /api/mess-menu/parse`

Send `{ "text": "..." }` (up to 50,000 characters) or `{ "image": "data:image/...", "mimeType": "image/jpeg" }`. Returns `{ "parsedMenu": { "monday": { "breakfast": "", "lunch": "", "snacks": "", "dinner": "" } } }`.

---

## `POST /api/coach`

Takes no body. Returns `{ "recommendation": { "greeting", "status", "primaryInsight", "actionItems", "motivation" }, "context": {} }`.

## `POST /api/coach/chat`

```json
{ "message": "I weigh 74 kg today", "history": [{ "role": "user", "content": "..." }] }
```

Returns `{ "message": "...", "action": "log_weight", "updatedData": { "weightKg": 74 } }`. Unknown actions are downgraded to `none`, and the client applies the action through the routes above, so their validation still runs.

---

## `GET /api/review`

Takes no parameters. Covers today and the previous six days in the user's timezone.

```json
{
  "review": {
    "weekNumber": 3,
    "dateRange": { "start": "19 Jul", "end": "25 Jul" },
    "weight": { "startKg": 75.2, "endKg": 74.5, "deltaKg": -0.7 },
    "nutrition": { "avgCalories": 2180, "avgProteinG": 140, "calorieAdherence": 85, "proteinAdherence": 70, "daysLogged": 6 },
    "training": { "sessionsCompleted": 4, "totalVolumeKg": 18000, "topExercise": "Barbell Bench Press (2 RIR)" },
    "recovery": { "avgSleepHours": 7.2, "avgSteps": 8400, "daysWithSleep": 6 }
  }
}
```
