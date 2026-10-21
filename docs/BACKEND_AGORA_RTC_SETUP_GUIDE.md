# ONYX HEALTH+ — AGORA RTC VIDEO CONSULTATION BACKEND SETUP GUIDE

**Document Version:** 1.0  
**Target Teams:** Backend Engineering, DevOps, Infrastructure  
**Affected Services:** Telehealth Video Consultation, `/api/video/token/:bookingId` Endpoint  
**Agora App ID:** `323dc81039da44ca9ec8d46607b05b11`

---

## 1. Executive Summary & Problem Diagnosis

During live video consultation testing between the Patient Portal (`onyx-patient-flow`) and Doctor Portal (`onyx-health-flow`), video calls fail to establish a media connection via the Agora RTC Gateway.

### The Root Cause
1. In the **Agora Developer Console**, the project associated with App ID `323dc81039da44ca9ec8d46607b05b11` has an **App Certificate** enabled (Security Mode: Primary / Secondary Certificate).
2. When an App Certificate is enabled, Agora's RTC edge servers strictly reject unauthenticated connections, `token: null`, and mock JWT tokens with the following client-side error:
   ```
   Agora-SDK [ERROR]: [AgoraRTCException: AgoraRTCError CAN_NOT_GET_GATEWAY_SERVER: dynamic use static key]
   ```
3. Currently, the backend `/api/video/token/:bookingId` endpoint either:
   - Returns a placeholder/mock token (e.g. `mock-agora-video-jwt-token-xyz`), OR
   - Rejects the call if booking status is not yet set to `in-progress` or `confirmed`.
4. Without a cryptographically valid Agora RTC Token signed using the **App Certificate**, the Agora Web SDK cannot connect to the gateway server, preventing audio and video streams between Doctor and Patient.

---

## 2. Architecture & Token Specifications

To establish a bidirectional call, both Doctor and Patient must receive a dynamic token from the backend and join the **exact same channel name**.

```
+-----------------------------------------------------------------------------------+
|                                  BACKEND SERVER                                   |
|  Secrets:                                                                         |
|  AGORA_APP_ID = "323dc81039da44ca9ec8d46607b05b11"                                |
|  AGORA_APP_CERTIFICATE = "<primary_certificate_from_agora_console>"                |
+-----------------------------------------+-----------------------------------------+
                                          |
           +------------------------------+------------------------------+
           | Token Request                                               | Token Request
           | GET /api/video/token/:id                                    | GET /api/video/token/:id
           v                                                             v
+-----------------------+                                     +-----------------------+
|    PATIENT PORTAL     |                                     |     DOCTOR PORTAL     |
| (onyx-patient-flow)   |                                     |   (onyx-health-flow)  |
|                       |                                     |                       |
| Joins Channel:        |                                     | Joins Channel:        |
| "room-<bookingId>"    |                                     | "room-<bookingId>"    |
+-----------+-----------+                                     +-----------+-----------+
            |                                                             |
            +---------------------> AGORA RTC EDGE <----------------------+
                                   MEDIA GATEWAY
                             (Real-time Audio/Video)
```

### Key Parameter Guidelines

| Parameter | Recommended Value | Reason |
| :--- | :--- | :--- |
| **Channel Name** | `room-${bookingId}` or `consultation_${bookingId}` | Must be deterministic and identical for both Doctor and Patient for that consultation. |
| **UID for Token** | `0` (Zero) | **CRITICAL:** Signing the token with `uid = 0` generates a wild-card token that allows any participant UID to connect. This prevents UID collisions between doctor and patient! |
| **Role** | `RtcRole.PUBLISHER` | Both Doctor and Patient publish audio/video and subscribe to each other. |
| **Token Expiry** | `3600` seconds (1 hour) | Covers the consultation window with buffer time. |

---

## 3. Backend API Contract

### Endpoint Definition
- **Method:** `GET`
- **Route:** `/api/video/token/:bookingId`
- **Alternative Route (Optional):** `POST /api/video/token` with body `{ "bookingId": "..." }`
- **Authentication:** Bearer JWT Header (`Authorization: Bearer <token>`)

### Success Response (`200 OK`)

```json
{
  "status": "success",
  "data": {
    "token": "007eJxTYJgZ1120e2b2N0kP...",
    "appId": "323dc81039da44ca9ec8d46607b05b11",
    "channelName": "room-6ad920ab08143c836e7e41f2",
    "uid": 0,
    "expiresIn": 3600
  }
}
```

*(Note: The frontend supports both top-level `{ token, channelName, appId, uid }` or wrapped inside `{ data: { ... } }`).*

### Error Response (`404` or `400`)

```json
{
  "status": "fail",
  "message": "Booking not found or not eligible for video consultation"
}
```

---

## 4. Implementation Guide (Node.js / Express)

### Step 1: Install Official Agora Token Builder

In your backend project directory:

```bash
npm install agora-token
# or
npm install agora-access-token
```

### Step 2: Configure Environment Variables

Add to backend `.env`:

```env
AGORA_APP_ID="323dc81039da44ca9ec8d46607b05b11"
AGORA_APP_CERTIFICATE="your_primary_app_certificate_from_agora_console"
```

> **Where to find the App Certificate:**
> 1. Log in to [Agora Console](https://console.agora.io/).
> 2. Go to **Project Management**.
> 3. Locate the project with App ID `323dc81039da44ca9ec8d46607b05b11`.
> 4. Click the edit/pencil icon.
> 5. View/copy the **Primary Certificate**.

---

### Step 3: Implement Token Generator Service

#### Using `agora-token` (Modern SDK - Recommended):

```javascript
// services/agoraService.js
const { RtcTokenBuilder, RtcRole } = require("agora-token");

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

/**
 * Generate an Agora RTC dynamic token for a consultation room.
 * @param {string} bookingId - Unique booking ID.
 * @param {number} [expireSeconds=3600] - Expiration duration in seconds.
 * @returns {object} { token, channelName, appId, uid }
 */
function generateAgoraRtcToken(bookingId, expireSeconds = 3600) {
  if (!APP_ID || !APP_CERTIFICATE) {
    throw new Error("Agora App ID or App Certificate is missing from environment variables.");
  }

  // Consistent channel name across doctor and patient
  const channelName = `room-${bookingId}`;

  // Use uid = 0 so Agora dynamically assigns unique 32-bit UIDs to doctor & patient
  const uid = 0;
  const role = RtcRole.PUBLISHER;

  // Calculate privilege expiration timestamp (epoch in seconds)
  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expireSeconds;

  // Build token
  const token = RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    role,
    privilegeExpiredTs,
    privilegeExpiredTs
  );

  return {
    token,
    channelName,
    appId: APP_ID,
    uid,
    expiresIn: expireSeconds,
  };
}

module.exports = { generateAgoraRtcToken };
```

#### Using `agora-access-token` (Legacy SDK):

```javascript
// If using agora-access-token
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");

function generateAgoraRtcToken(bookingId, expireSeconds = 3600) {
  const channelName = `room-${bookingId}`;
  const uid = 0;
  const role = RtcRole.PUBLISHER;
  const privilegeExpireTime = Math.floor(Date.now() / 1000) + expireSeconds;

  const token = RtcTokenBuilder.buildTokenWithUid(
    process.env.AGORA_APP_ID,
    process.env.AGORA_APP_CERTIFICATE,
    channelName,
    uid,
    role,
    privilegeExpireTime
  );

  return {
    token,
    channelName,
    appId: process.env.AGORA_APP_ID,
    uid,
    expiresIn: expireSeconds,
  };
}
```

---

### Step 4: Add Controller and Route

```javascript
// controllers/videoController.js
const { generateAgoraRtcToken } = require("../services/agoraService");
const Booking = require("../models/Booking"); // or your ORM / DB access layer

async function getVideoToken(req, res) {
  try {
    const { bookingId } = req.params;

    if (!bookingId) {
      return res.status(400).json({ status: "fail", message: "bookingId is required" });
    }

    // Optional: Validate booking exists and current user is authorized
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ status: "fail", message: "Booking not found" });
    }

    // Generate dynamic RTC token
    const tokenData = generateAgoraRtcToken(bookingId, 3600);

    return res.status(200).json({
      status: "success",
      data: tokenData,
      // Top-level fallbacks for client backwards compatibility:
      token: tokenData.token,
      channelName: tokenData.channelName,
      appId: tokenData.appId,
      uid: tokenData.uid,
    });
  } catch (error) {
    console.error("Agora Token Generation Error:", error);
    return res.status(500).json({
      status: "error",
      message: "Failed to generate video consultation token",
      details: error.message,
    });
  }
}

module.exports = { getVideoToken };
```

```javascript
// routes/videoRoutes.js
const express = require("express");
const router = express.Router();
const { getVideoToken } = require("../controllers/videoController");
const { protect } = require("../middleware/authMiddleware");

// Both Doctor and Patient call this endpoint when entering the call room
router.get("/video/token/:bookingId", protect, getVideoToken);
router.post("/video/token", protect, (req, res) => {
  req.params.bookingId = req.body.bookingId;
  return getVideoToken(req, res);
});

module.exports = router;
```

---

## 5. Alternative Implementation Guide (Python / FastAPI or Django)

If the backend is built with Python:

```bash
pip install agora-token-builder
```

```python
import os
import time
from agora_token_builder import RtcTokenBuilder

AGORA_APP_ID = os.getenv("AGORA_APP_ID", "323dc81039da44ca9ec8d46607b05b11")
AGORA_APP_CERTIFICATE = os.getenv("AGORA_APP_CERTIFICATE")

def generate_agora_token(booking_id: str, expire_seconds: int = 3600):
    channel_name = f"room-{booking_id}"
    uid = 0
    role = 1  # 1 = Publisher, 2 = Subscriber
    expire_timestamp = int(time.time()) + expire_seconds

    token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channel_name,
        uid,
        role,
        expire_timestamp
    )

    return {
        "status": "success",
        "data": {
            "token": token,
            "channelName": channel_name,
            "appId": AGORA_APP_ID,
            "uid": uid,
            "expiresIn": expire_seconds
        },
        "token": token,
        "channelName": channel_name,
        "appId": AGORA_APP_ID,
        "uid": uid
    }
```

---

## 6. Quick Alternative: Testing Mode (Zero Backend Code)

If the backend team needs 1–2 days to deploy the token generator, you can enable immediate video calls right now using Agora's **Testing Mode**:

1. Log in to [Agora Console](https://console.agora.io/).
2. Click **Create a New Project**.
3. Choose **Project Type: Testing Mode: App ID (No App Certificate)**.
4. Copy the new **App ID** (this App ID does not require dynamic tokens; any client can connect with `token = null`).
5. Update `.env` in both frontend applications:
   ```env
   VITE_AGORA_APP_ID="<new_test_app_id>"
   ```
6. The frontend's built-in fallback will automatically join Agora channels with `token = null` without error.

*(Note: For production, App Certificate with Dynamic Tokens is required for security and HIPAA/telehealth compliance).*

---

## 7. Verification & Testing Checklist

### 1. Test Endpoint via cURL
Run this in terminal to verify backend generation:

```bash
curl -X GET "https://dev-api.onyxhealthplus.com/api/video/token/6ad920ab08143c836e7e41f2" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"
```

**Expected Result:**
HTTP `200 OK` with a non-empty `token` starting with `007...` or `006...`.

### 2. Verify in Browser Console
When either Doctor or Patient joins a call:
- Open Developer Tools (`F12`) → **Console**.
- Look for:
  ```
  [AgoraRTC] client.join success, uid: 294817264
  [AgoraRTC] local tracks published successfully
  [AgoraRTC] user-published event received: audio, video
  ```

---

## 8. Summary of Action Items

1. **Obtain App Certificate** from the Agora Console for App ID `323dc81039da44ca9ec8d46607b05b11`.
2. **Add `AGORA_APP_CERTIFICATE`** to backend environment secrets.
3. **Install `agora-token`** in the backend service.
4. **Deploy `GET /api/video/token/:bookingId`** using `RtcTokenBuilder.buildTokenWithUid` with `uid = 0` and `channelName = room-${bookingId}`.
5. Notify the frontend team once deployed to run end-to-end video tests.
