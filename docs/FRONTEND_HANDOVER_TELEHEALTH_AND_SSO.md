# ONYX HEALTH+ TELEHEALTH & SEAMLESS CONSULTATION — FRONTEND HANDOVER SPECIFICATION

**Document Version:** 1.0  
**Target Teams:** Frontend Engineering (Patient Web App, Doctor Web App, Mobile App Teams)  
**Status:** Live & Deployed to Development and Production EC2  
**Base URLs:**
- **Development:** `https://dev-api.onyxhealthplus.com` (or direct configured dev server IP)
- **Production:** `https://api.onyxhealthplus.com` (or direct configured prod server IP)

---

## 1. Executive Summary

All required backend modules for **Seamless Mobile-to-Web Consultation Handshake (SSO)** and the **Telehealth Doctor Module** are live, tested, and running in production and development clusters.

This document serves as the exact reference for frontend engineers integrating:
1. **Zero-login consultation launcher** from Mobile (Flutter/React Native) to Web.
2. **Web Handshake landing page** consumption.
3. **Doctor onboarding document uploads** via AWS S3 presigned URLs.
4. **Doctor weekly availability & multi-shift scheduling**.
5. **Concurrency-safe booking creation & Razorpay payment confirmation**.
6. **Agora RTC video room access** and consultation lifecycle.
7. **Digital prescription issuance**.
8. **Dispute ticket resolution and payout escrow holds**.
9. **Real-time WebSocket event matrix**.

---

## 2. Seamless Mobile App to Web Handover (SSO)

### 2.1 Mobile App: Initiate Handover Ticket
When a patient completes screening in the mobile app and taps **"Start Online Consultation"**:

- **Method & Path:** `POST /api/auth/consultation-handshake`
- **Headers:** `Authorization: Bearer <USER_JWT>`, `Content-Type: application/json`
- **Request Body:**
```json
{
  "reportId": "6ad874c7703f3d2233088660",
  "profileId": "6a2954e41dcaeb3c6f8a5aab",
  "doctorId": "6a47d909f718c2c2cf25cc35",       // Optional
  "bookingId": "6ad8a123f001122334455667",      // Optional
  "targetRoute": "/consultation/room"            // Optional custom redirect
}
```
- **Response `200 OK`:**
```json
{
  "status": "success",
  "ticket": "tkt_5f2b8...",
  "redirectUrl": "https://patient.onyxhealthplus.com/handover?ticket=tkt_5f2b8...",
  "expiresInSeconds": 120
}
```
- **Mobile Action:** Open `redirectUrl` using **Chrome Custom Tabs / Safari In-App Browser** (`LaunchMode.inAppBrowserView` in Flutter).

---

### 2.2 Patient Web App: Consume Ticket & Establish Session
In `src/pages/HandoverLanding.tsx` (Route: `/handover?ticket=...`):

- **Method & Path:** `POST /api/auth/consume-handshake`
- **Auth:** Public (Ticket acts as single-use temporary bearer credential)
- **Request Body:**
```json
{
  "ticket": "tkt_5f2b8..."
}
```
- **Response `200 OK`:**
```json
{
  "status": "success",
  "token": "eyJhbGciOi...",
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi...",
  "user": {
    "id": "6ad874...",
    "_id": "6ad874...",
    "name": "Jane Doe",
    "phone_number": ["91", "9876543210"],
    "role": "user"
  },
  "payload": {
    "reportId": "6ad874c7703f3d2233088660",
    "profileId": "6a2954e41dcaeb3c6f8a5aab",
    "doctorId": "6a47d909f718c2c2cf25cc35",
    "bookingId": "6ad8a123f001122334455667",
    "targetRoute": "/consultation/room/6ad8a123f001122334455667"
  }
}
```
- **Frontend Action:**
  1. Store `token` / `accessToken` in `localStorage.setItem("authToken", token)`.
  2. Call `window.history.replaceState({}, document.title, window.location.pathname)` to scrub `?ticket=` from the browser URL.
  3. Navigate user to `payload.targetRoute` or directly into the consultation room.

---

## 3. Doctor Module APIs

### 3.1 S3 Presigned Upload URL for Doctor Documents
Used in Onboarding Step 3 / Document management:

- **Method & Path:** `POST /api/doctor/documents/presigned-url`
- **Auth:** `Bearer <DOCTOR_JWT>`
- **Request Body:**
```json
{
  "documentType": "idProof", // "idProof" | "degreeCertificate" | "councilRegistration" | "bankProof" | "aadhaar" | "pan" | "indemnityInsurance" | "digitalSignature"
  "fileName": "degree.pdf",
  "mimeType": "application/pdf"
}
```
- **Response `200 OK`:**
```json
{
  "status": "success",
  "presignedUrl": "https://onyx-doctor-documents.s3.ap-south-1.amazonaws.com/doctor-documents/...?X-Amz-Signature=...",
  "fileKey": "doctor-documents/6ad8.../degreeCertificate_172951...pdf",
  "publicUrl": "https://onyx-doctor-documents.s3.ap-south-1.amazonaws.com/doctor-documents/...",
  "documentType": "degreeCertificate",
  "expiresInSeconds": 900
}
```
- **Frontend Action:** Execute a direct HTTP `PUT` to `presignedUrl` with file binary body and matching `Content-Type`. Backend automatically persists the file in `DoctorDetails.documents`.

---

### 3.2 Doctor Availability & Weekly Multi-Shift Schedule
- **Method & Path:** `POST /api/doctor/availability`
- **Auth:** `Bearer <DOCTOR_JWT>`
- **Request Body:**
```json
{
  "isAvailable": true,
  "consultationFee": 750,
  "weeklySchedule": [
    { "day": "Monday", "enabled": true, "startTime": "09:00", "endTime": "17:00" },
    { "day": "Tuesday", "enabled": true, "startTime": "09:00", "endTime": "17:00" },
    { "day": "Wednesday", "enabled": true, "startTime": "09:00", "endTime": "17:00" },
    { "day": "Thursday", "enabled": true, "startTime": "09:00", "endTime": "17:00" },
    { "day": "Friday", "enabled": true, "startTime": "09:00", "endTime": "17:00" },
    { "day": "Saturday", "enabled": false, "startTime": "09:00", "endTime": "13:00" },
    { "day": "Sunday", "enabled": false, "startTime": "09:00", "endTime": "13:00" }
  ]
}
```
- **Response `200 OK`:**
```json
{
  "status": "success",
  "isAvailable": true,
  "weeklySchedule": [...],
  "consultationFee": 750,
  "message": "Doctor availability and schedule updated successfully"
}
```

---

### 3.3 Patient Booking Creation (10-Minute Lock)
- **Method & Path:** `POST /api/booking/create`
- **Auth:** `Bearer <PATIENT_JWT>`
- **Request Body:**
```json
{
  "doctorId": "6a47d909f718c2c2cf25cc35",
  "type": "scheduled", // or "instant"
  "slotDate": "2026-10-22T00:00:00.000Z",
  "slotTimeStart": "14:00",
  "slotTimeEnd": "14:30",
  "profileId": "6a2954e41dcaeb3c6f8a5aab",
  "reportId": "6ad874c7703f3d2233088660" // Optional screening report
}
```
- **Response `201 Created`:**
```json
{
  "status": "success",
  "booking": {
    "_id": "6ad8a123f001122334455667",
    "status": "pending",
    "amountPaise": 75000,
    "expiresAt": "2026-10-21T12:10:00.000Z"
  },
  "razorpayOrderId": "order_Rzp12345",
  "amount": 75000,
  "currency": "INR",
  "key": "rzp_test_..."
}
```

---

### 3.4 Razorpay Payment Confirmation & Room Initialization
- **Method & Path:** `POST /api/booking/confirm`
- **Auth:** `Bearer <PATIENT_JWT>`
- **Request Body:**
```json
{
  "bookingId": "6ad8a123f001122334455667",
  "razorpay_payment_id": "pay_Rzp67890",
  "razorpay_order_id": "order_Rzp12345",
  "razorpay_signature": "generated_signature_hash"
}
```
- **Response `200 OK`:**
```json
{
  "status": "success",
  "message": "Booking confirmed",
  "booking": {
    "_id": "6ad8a123f001122334455667",
    "status": "confirmed",
    "channelName": "room-6ad8a123f001122334455667",
    "paymentStatus": "captured"
  }
}
```

---

### 3.5 Agora RTC Video Token Generator
- **Method & Path:** `GET /api/video/token/:bookingId`
- **Auth:** `Bearer <PATIENT_JWT>` or `Bearer <DOCTOR_JWT>`
- **Response `200 OK`:**
```json
{
  "status": "success",
  "token": "006mock_agora_token...",
  "channelName": "room-6ad8a123f001122334455667",
  "uid": 48291,
  "appId": "mock_agora_app_id"
}
```

---

### 3.6 Consultation Wrap-Up
- **Method & Path:** `POST /api/booking/complete/:id` (or `POST /api/booking/complete` with `{ "bookingId": "..." }`)
- **Auth:** `Bearer <DOCTOR_JWT>`
- **Response `200 OK`:**
```json
{
  "status": "success",
  "message": "Consultation marked completed.",
  "booking": {
    "_id": "6ad8a123f001122334455667",
    "status": "completed",
    "callStartedAt": "2026-10-21T12:00:00.000Z",
    "callEndedAt": "2026-10-21T12:15:30.000Z",
    "callDurationSeconds": 930
  }
}
```

---

### 3.7 Digital Prescription
- **Create:** `POST /api/prescription`
- **Auth:** `Bearer <DOCTOR_JWT>`
- **Request Body:**
```json
{
  "bookingId": "6ad8a123f001122334455667",
  "diagnosis": "Acute Bronchitis",
  "clinicalNotes": "Mild wheezing in chest, hydration recommended.",
  "medications": [
    {
      "name": "Amoxicillin",
      "dosage": "500mg",
      "frequency": "Three times daily (TDS)",
      "duration": "5 days",
      "instructions": "After meals"
    }
  ],
  "doctorDigitalSignature": {
    "doctorName": "Dr. Dave",
    "registrationNumber": "MCI-12345",
    "councilState": "Maharashtra"
  },
  "refillAllowed": false
}
```
- **Fetch:** `GET /api/prescription/:bookingId`
- **Auth:** `Bearer <PATIENT_OR_DOCTOR_JWT>`

---

## 4. WebSocket Real-Time Events (`/ws/presence`)

Connect WebSocket to `wss://<HOST>/ws/presence`.

### Connection Handshake
Send identify message upon connection:
```json
{
  "type": "identify",
  "role": "doctor", // or "patient"
  "userId": "6ad874..."
}
```

### Server-to-Client Events
| Event Name | Recipient | Payload | Trigger |
| :--- | :--- | :--- | :--- |
| `consultation:incoming` | Doctor | `{ bookingId, patientId, profileId, reportId, type: "instant", timeoutSeconds: 90 }` | Patient confirms payment on instant booking |
| `booking:scheduled` | Doctor | `{ bookingId, patientId, profileId, slotDate, slotTimeStart, slotTimeEnd }` | Patient confirms payment on scheduled booking |
| `doctor:status_changed` | All / Public | `{ doctorId, userId, isAvailable, consultationFee }` | Doctor updates availability or fee |
| `payout:hold_updated` | Doctor | `{ bookingId, payoutHold, reason, action }` | Dispute ticket raised or resolved |
| `ticket:updated` | Patient & Doctor | `{ ticketId, status: "resolved", action: "refunded_patient" \| "paid_doctor" }` | Admin resolves dispute |
