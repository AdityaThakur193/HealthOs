# Health OS REST API Specification 📡

This document describes the serverless HTTP API routes provided by **Health OS**.

---

## 📑 API Endpoints Summary

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| [`/api/profile`](#1-get--post-apiprofile) | `GET`, `POST` | Fetch or update user biometrics, goals, and target macros |
| [`/api/timeline`](#2-get--post--delete-apitimeline) | `GET`, `POST`, `DELETE` | Log, query, or delete chronological health timeline events |
| [`/api/vision`](#3-post-apivision) | `POST` | Process meal photos using Gemini 2.5 Vision & ICMR-NIN IFCT 2017 math |
| [`/api/diet/generate`](#4-post-apidietgenerate) | `POST` | Generate grounded weekly diet plan with MPS protein spacing |
| [`/api/mess-menu/parse`](#5-post-apimess-menuparse) | `POST` | Parse unstructured mess menu image/text into structured weekly JSON |
| [`/api/coach`](#6-post-apicoach) | `POST` | Generate contextual daily coaching insights for dashboard HUD |
| [`/api/coach/chat`](#7-post-apicoachchat) | `POST` | Conversational health assistant stream/response |
| [`/api/review`](#8-get-apireview) | `GET` | Calculate Sunday weekly review, weight delta, and metabolic TDEE shift |

---

## 1. `GET | POST /api/profile`

### `GET /api/profile`
Fetches the user profile by email or user ID.

**Query Parameters:**
- `email` (string, optional): User email address.
- `userId` (string, optional): User MongoDB ObjectId hex.

**Response `200 OK`:**
```json
{
  "profile": {
    "_id": "6a4c73d185dcfe8a2843fb2f",
    "name": "ADI",
    "email": "adityath2305@gmail.com",
    "age": 22,
    "gender": "male",
    "heightCm": 178,
    "weightKg": 74.5,
    "goal": "recomp",
    "tdee": 2450,
    "targetCalories": 2200,
    "targetProteinG": 150,
    "strictMessOnly": false,
    "dietPreference": "non_veg"
  }
}
```

### `POST /api/profile`
Creates or updates physical biometrics and target goals.

**Request Body:**
```json
{
  "email": "adityath2305@gmail.com",
  "name": "ADI",
  "age": 22,
  "gender": "male",
  "heightCm": 178,
  "weightKg": 74.5,
  "goal": "recomp",
  "activityLevel": "moderate",
  "gymExperience": "intermediate"
}
```

---

## 2. `GET | POST | DELETE /api/timeline`

### `GET /api/timeline`
Queries chronological events with limit pagination.

**Query Parameters:**
- `userId` (string, required): 24-character hex ObjectId.
- `type` (string, optional): Filter by `meal`, `weight`, `workout`, `sleep`, or `water`.
- `limit` (number, optional, default: 50, max: 100).
- `before` (ISO Date string, optional): Pagination cursor.

**Response `200 OK`:**
```json
{
  "events": [
    {
      "_id": "66a1b2c3d4e5f67890123456",
      "userId": "6a4c73d185dcfe8a2843fb2f",
      "type": "meal",
      "timestamp": "2026-07-25T08:30:00.000Z",
      "payload": {
        "foods": [
          { "name": "Whole Wheat Roti", "quantity": 2, "estimatedCalories": 170, "proteinG": 6.4 },
          { "name": "Yellow Dal", "quantity": 1, "estimatedCalories": 105, "proteinG": 5.2 }
        ],
        "totalCalories": 275,
        "totalProteinG": 11.6
      },
      "source": "ai_vision"
    }
  ],
  "count": 1,
  "hasMore": false
}
```

---

## 3. `POST /api/vision`

Analyzes meal image using visual detection contract and attaches ICMR-NIN IFCT 2017 portion math.

**Request Body:**
```json
{
  "image": "data:image/jpeg;base64,...",
  "userId": "6a4c73d185dcfe8a2843fb2f"
}
```

**Response `200 OK`:**
```json
{
  "foods": [
    {
      "name": "Whole Wheat Roti",
      "dishName": "roti",
      "quantity": 2,
      "unitType": "piece",
      "preparationStyle": "standard",
      "estimatedCalories": 170,
      "proteinG": 6.4,
      "carbsG": 35.0,
      "fatG": 0.8
    }
  ],
  "confidence": 0.92,
  "isMock": false
}
```

---

## 4. `POST /api/diet/generate`

Generates weekly diet plan with MPS leucine spacing and programmatic post-audit verification.

**Request Body:**
```json
{
  "email": "adityath2305@gmail.com",
  "strictMessOnly": false
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "dietPlan": {
    "monday": {
      "meals": [
        {
          "time": "8:00 AM",
          "name": "Breakfast",
          "messItems": "• Whole Wheat Roti (2 pieces - 6.4g P, 170 kcal)\n• Yellow Dal (1 Katori - 5.2g P, 105 kcal)",
          "additions": "• Whey Protein (1 Scoop - 24g P, 120 kcal)",
          "proteinG": 35.6,
          "calories": 395,
          "timingReason": "High protein breakfast to trigger MPS leucine threshold post-overnight fast."
        }
      ],
      "dailySummary": {
        "totalCalories": 2200,
        "totalProteinG": 150.0
      }
    }
  }
}
```

---

## 8. `GET /api/review`

Calculates Sunday weekly review, weight trend delta, and metabolic TDEE adjustments.

**Query Parameters:**
- `userId` (string, required): 24-character hex ObjectId.

**Response `200 OK`:**
```json
{
  "weeklyReview": {
    "startWeight": 75.2,
    "endWeight": 74.5,
    "weightDelta": -0.7,
    "avgDailyCalories": 2180,
    "targetCalories": 2200,
    "adherenceRate": 0.95,
    "previousTdee": 2450,
    "newTdee": 2480,
    "recommendation": "Metabolic expenditure increased by +30 kcal/day based on steady fat loss."
  }
}
```
