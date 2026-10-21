# ONYX HEALTH+ DOCTOR MODULE — BACKEND HANDOVER SPECIFICATION

**Document Version:** 1.0  
**Target Audience:** Backend Engineering Team (Node.js, Express, MongoDB, Socket.io)  
**System Scope:** Onyx Health+ Telehealth & Doctor Consultation Infrastructure  

---

## 1. Executive Summary

The frontend of the Doctor Module in **Onyx Health+** (`onyx-health-flow`) is fully built, typed, and integrated with the live API client. It includes:
- 4-Step Medical Onboarding & Document Uploads with S3 metadata preview.
- Executive Admin verification, approval, rejection, and suspension controls.
- Weekly Recurring Multi-Shift Working Hours & real-time Availability toggling.
- Patient Doctor Discovery, search, and slot filtering.
- Agora RTC Video Consultation with In-Call Clinical Notes Drawer & Wrap-Up Prescription Dialog.
- Support Ticket Dispute Tracking with Payout Escrow Hold indicators.
- Razorpay Route Payout & Commission breakdown.
- Real-time Incoming Consultation Ringtone Synthesizer & Notification Center.

To achieve 100% production readiness, the backend team needs to complete and harden specific backend controllers, validators, background workers, and third-party webhook listeners. This document specifies the exact modifications, schemas, API contracts, and business logic required.

---

## 2. Current Status vs Required Backend Modifications

| Component | Current Backend State | Required Modifications to Make It Perfect |
| :--- | :--- | :--- |
| **Doctor Onboarding** | Steps 1–4 implemented with AJV validation (`src/controller/doctor-controller.js`). | 1. Add S3 presigned URL generator for secure document uploads.<br>2. Persist uploaded document S3 URLs into `DoctorDetails.documents`.<br>3. Ensure `onboardingStatus` transitions to `"onboarding_complete"` after step 4, pending admin review. |
| **Admin Approval** | Admin create exists (`/api/doctor/admin/create`). Approval endpoint partially wired. | 1. Implement `POST /api/doctor/admin/approve` with atomic status updates (`"approved"` / `"rejected"`).<br>2. Store mandatory rejection reason in `DoctorDetails.rejectionReason`.<br>3. Filter public doctor listings so that **only** `accountStatus === "approved"` doctors are returned. |
| **Doctor Availability** | Basic boolean toggle exists. | 1. Accept and persist structured `weeklySchedule` array (days, start/end hours).<br>2. Add slot conflict validator to prevent doctors from having overlapping booking slots. |
| **Booking & Payment** | Basic booking list exists. | 1. Implement temporary slot reservation with countdown expiry (e.g., 10 minutes) to prevent concurrent double-booking during checkout.<br>2. Verify Razorpay payment signature server-side (`razorpay_signature`) before confirming booking.<br>3. Make payment callback idempotent. |
| **Instant Consultation** | Flow documented in specs. | 1. Real-time Socket.io push (`consultation:incoming`) to doctor upon payment capture.<br>2. Response window timer (90 seconds). If doctor fails to accept/join, auto-cancel booking and initiate immediate Razorpay refund. |
| **Agora Video Token** | Route documented (`/api/video/token/:bookingId`). | 1. Verify caller authorization: caller must be either `booking.userId` (Patient) or `booking.doctorId.userId` (Doctor).<br>2. Generate Agora RTC dynamic token using `RtcTokenBuilder` with expiry timestamp.<br>3. Restrict token issuance to valid consultation time window. |
| **Consultation Wrap-Up** | Route `/api/booking/complete/:id` called by frontend. | 1. Transition booking to `"completed"`.<br>2. Record actual `startedAt` and `endedAt` timestamps.<br>3. Initiate 24-hour payout hold window (escrow) allowing patient to report issues before doctor payout release. |
| **Prescriptions** | Frontend dialog implemented. | 1. Implement `POST /api/prescription` and `GET /api/prescription/:bookingId`.<br>2. Store medicines, dosage, instructions, and doctor's digital signature stamp. |
| **Support Tickets & Escrow** | Basic ticket endpoints exist. | 1. When a patient raises a ticket with `bookingId`, atomically set `booking.payoutHold = true`.<br>2. In `POST /api/ticket/admin/resolve/:id`, implement two paths:<br>&nbsp;&nbsp;• **Option A (Refund)**: Trigger Razorpay Refund API; doctor payout = ₹0.<br>&nbsp;&nbsp;• **Option B (Release Payout)**: Release hold, deduct platform commission (e.g., 15%), and transfer net amount to doctor via Razorpay Route. |
| **Razorpay Route Payouts** | Linked account creation exists. | 1. Server-side transfer execution using `razorpay.transfers.create({ account, amount, currency: "INR" })`.<br>2. Prevent duplicate transfers using idempotent transfer keys. |

---

## 3. Database Schema Enhancements (MongoDB / Mongoose)

### 3.1 `DoctorDetails` Schema Additions
Ensure the `DoctorDetails` model (`src/models/doctorDetails.js`) contains the following structured fields:

```javascript
const mongoose = require('mongoose');

const weeklyScheduleSchema = new mongoose.Schema({
  day: { 
    type: String, 
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    required: true 
  },
  enabled: { type: Boolean, default: true },
  startTime: { type: String, default: "09:00" }, // "HH:mm" in 24h IST
  endTime: { type: String, default: "17:00" },
}, { _id: false });

const doctorDetailsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  
  // Step 1: Personal & Professional Details
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  dateOfBirth: { type: Date },
  email: { type: String },
  qualification: { type: String },
  experienceYears: { type: Number, default: 0 },
  languages: [{ type: String }],
  bio: { type: String },
  
  // Step 2: Credentials & Practice
  registrationNumber: { type: String, required: true },
  registrationCouncilState: { type: String, required: true },
  specialization: { type: String, required: true },
  subSpecialization: { type: String },
  telemedicineExperienceYears: { type: Number, default: 0 },
  
  // Step 3: Legal & Telemedicine Compliance
  telemedicineComplianceAccepted: { type: Boolean, default: false },
  digitalPrescriptionConsent: { type: Boolean, default: false },
  
  // Step 4: Practice Location
  clinicAddress: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String, default: "India" },
  currentWorkplace: { type: String },
  
  // S3 Document Uploads
  documents: {
    idProof: { type: String }, // S3 URL / Key
    degreeCertificate: { type: String },
    councilRegistration: { type: String },
    bankProof: { type: String },
  },
  
  // Consultation & Availability Settings
  consultationFee: { type: Number, default: 500 }, // In INR (₹)
  isAvailable: { type: Boolean, default: true },
  weeklySchedule: [weeklyScheduleSchema],
  
  // Approval Lifecycle
  accountStatus: { 
    type: String, 
    enum: ['registered', 'onboarding_in_progress', 'onboarding_complete', 'approved', 'rejected', 'suspended'],
    default: 'registered'
  },
  rejectionReason: { type: String, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  
  // Razorpay Route Linked Account
  linkedAccountId: { type: String, default: null }, // e.g. "acc_RzpLinkedAccountId123"
  payoutStatus: { type: String, enum: ['unlinked', 'pending_kyc', 'active'], default: 'unlinked' },
}, { timestamps: true });
```

---

### 3.2 `Booking` Schema Additions
Ensure the `Booking` model (`src/models/booking.js`) tracks the complete consultation, payment, and payout escrow lifecycle:

```javascript
const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Patient
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorDetails', required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true }, // Patient Clinical Profile
  
  type: { type: String, enum: ['instant', 'scheduled'], required: true },
  status: { 
    type: String, 
    enum: ['pending_payment', 'confirmed', 'in_consultation', 'completed', 'cancelled', 'missed', 'rejected'],
    default: 'pending_payment'
  },
  
  // Slot Schedule Details
  slotDate: { type: Date, required: true },
  slotTimeStart: { type: String, required: true }, // "14:00"
  slotTimeEnd: { type: String, required: true },   // "14:30"
  
  // Payment Details (Razorpay)
  amountPaise: { type: Number, required: true }, // e.g. 50000 = ₹500.00
  paymentOrderId: { type: String, required: true },
  paymentId: { type: String },
  paymentStatus: { type: String, enum: ['created', 'authorized', 'captured', 'refunded', 'failed'], default: 'created' },
  
  // Video Room Details (Agora)
  channelName: { type: String, required: true }, // e.g. "room-6ad874c7703f3d2233088660"
  callStartedAt: { type: Date },
  callEndedAt: { type: Date },
  callDurationSeconds: { type: Number, default: 0 },
  
  // Settlement & Dispute Escrow
  payoutHold: { type: Boolean, default: false }, // Set to true if a dispute ticket is raised
  payoutHoldReason: { type: String },
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', default: null },
  payoutTransferred: { type: Boolean, default: false },
  payoutTransferId: { type: String },
  platformCommissionPaise: { type: Number, default: 0 },
  doctorPayoutAmountPaise: { type: Number, default: 0 },
  
  expiresAt: { type: Date }, // Temporary reservation expiry for pending_payment
}, { timestamps: true });

// Prevent concurrent double-booking of same doctor at same slot
bookingSchema.index(
  { doctorId: 1, slotDate: 1, slotTimeStart: 1 }, 
  { 
    unique: true, 
    partialFilterExpression: { status: { $in: ['confirmed', 'in_consultation', 'pending_payment'] } } 
  }
);
```

---

### 3.3 `Prescription` Schema (New Model: `src/models/prescription.js`)
Stores digital prescriptions issued by doctors:

```javascript
const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  dosage: { type: String, required: true },       // "500mg"
  frequency: { type: String, required: true },    // "Twice daily (BD)"
  duration: { type: String, default: "5 days" },
  instructions: { type: String, default: "After meals" }
}, { _id: false });

const prescriptionSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'DoctorDetails', required: true },
  
  diagnosis: { type: String, required: true },
  clinicalNotes: { type: String },
  medications: [medicationSchema],
  
  doctorDigitalSignature: {
    doctorName: { type: String, required: true },
    registrationNumber: { type: String, required: true },
    councilState: { type: String, required: true },
    signedAt: { type: Date, default: Date.now },
  },
  
  refillAllowed: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Prescription', prescriptionSchema);
```

---

## 4. Endpoint Specifications & Controller Logic

### 4.1 S3 Presigned Upload URL Generator
- **Route:** `POST /api/doctor/documents/presigned-url`
- **Auth:** JWT (`ensureAuth`, role: `doctor`)
- **Payload:**
  ```json
  {
    "documentType": "idProof", // "idProof" | "degreeCertificate" | "councilRegistration" | "bankProof"
    "fileName": "doctor_id.pdf",
    "mimeType": "application/pdf"
  }
  ```
- **Controller Logic:**
  1. Validate file size (< 5MB) and mime type (`application/pdf`, `image/jpeg`, `image/png`).
  2. Generate S3 PutObject signed URL with 15-minute expiry.
  3. Key structure: `doctor-documents/${req.user.id}/${documentType}_${Date.now()}.${extension}`.
  4. Return `{ presignedUrl, fileKey, publicUrl }`.

---

### 4.2 Structured Weekly Availability Engine
- **Route:** `POST /api/doctor/availability`
- **Auth:** JWT (`ensureAuth`, role: `doctor`)
- **Payload:**
  ```json
  {
    "isAvailable": true,
    "weeklySchedule": [
      { "day": "Monday", "enabled": true, "startTime": "09:00", "endTime": "17:00" },
      { "day": "Tuesday", "enabled": true, "startTime": "09:00", "endTime": "17:00" },
      { "day": "Wednesday", "enabled": true, "startTime": "09:00", "endTime": "17:00" },
      { "day": "Thursday", "enabled": true, "startTime": "09:00", "endTime": "17:00" },
      { "day": "Friday", "enabled": true, "startTime": "09:00", "endTime": "17:00" },
      { "day": "Saturday", "enabled": false, "startTime": "09:00", "endTime": "13:00" },
      { "day": "Sunday", "enabled": false, "startTime": "09:00", "endTime": "13:00" }
    ],
    "consultationFee": 500
  }
  ```
- **Controller Logic:**
  1. Update `DoctorDetails` record for authenticated doctor.
  2. Emit real-time WebSocket event `doctor:status_changed` to alert patient discovery clients.
  3. Return `{ status: "success", isAvailable: true, weeklySchedule }`.

---

### 4.3 Concurrency-Safe Booking & Temporary Slot Hold
- **Route:** `POST /api/booking/create`
- **Auth:** JWT (`ensureAuth`, role: `user`)
- **Payload:**
  ```json
  {
    "doctorId": "6a47d909f718c2c2cf25cc35",
    "profileId": "6a2954e41dcaeb3c6f8a5aab",
    "type": "scheduled", // or "instant"
    "slotDate": "2026-10-21T00:00:00.000Z",
    "slotTimeStart": "14:00",
    "slotTimeEnd": "14:30"
  }
  ```
- **Controller Logic:**
  1. Verify doctor exists and has `accountStatus === "approved"`.
  2. For `scheduled`:
     - Verify slot falls within doctor's `weeklySchedule` for that weekday.
     - Atomically check if slot is already occupied (`status: { $in: ['confirmed', 'in_consultation', 'pending_payment'] }`).
  3. For `instant`:
     - Verify `doctor.isAvailable === true`.
  4. Create Razorpay Order: `razorpay.orders.create({ amount: doctor.consultationFee * 100, currency: "INR" })`.
  5. Create `Booking` record with `status: "pending_payment"` and `expiresAt: new Date(Date.now() + 10 * 60 * 1000)` (10-minute lock).
  6. Return `{ bookingId, paymentOrderId, amountPaise, keyId, expiresAt }`.

---

### 4.4 Razorpay Server-Side Payment Verification & Idempotency
- **Route:** `POST /api/booking/confirm`
- **Auth:** JWT (`ensureAuth`, role: `user`)
- **Payload:**
  ```json
  {
    "bookingId": "6ad874c7703f3d2233088660",
    "razorpay_order_id": "order_Rzp12345",
    "razorpay_payment_id": "pay_Rzp67890",
    "razorpay_signature": "signature_hash_xyz"
  }
  ```
- **Controller Logic:**
  1. **Cryptographic Verification:**
     ```javascript
     const crypto = require('crypto');
     const generated_signature = crypto
       .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
       .update(razorpay_order_id + "|" + razorpay_payment_id)
       .digest('hex');

     if (generated_signature !== razorpay_signature) {
       return res.status(400).json({ status: "fail", error: "Invalid payment signature." });
     }
     ```
  2. Update `Booking` record:
     - `status = "confirmed"`
     - `paymentStatus = "captured"`
     - `paymentId = razorpay_payment_id`
     - `expiresAt = null`
     - `channelName = "room-" + booking._id`
  3. If `type === "instant"`:
     - Emit WebSocket event `consultation:incoming` to `doctor:<doctorId>` room.
     - Start a 90-second timeout handler in background queue/Redis.
  4. If `type === "scheduled"`:
     - Emit WebSocket event `booking:scheduled` to doctor.
  5. Return `{ status: "success", booking }`.

---

### 4.5 Agora RTC Token Generator
- **Route:** `GET /api/video/token/:bookingId`
- **Auth:** JWT (`ensureAuth`)
- **Controller Logic:**
  ```javascript
  const { RtcTokenBuilder, RtcRole } = require('agora-token');

  const getAgoraToken = async (req, res) => {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId).populate('doctorId');
    if (!booking) return res.status(404).json({ status: "fail", error: "Booking not found." });

    // Authorization: User must be either the patient or the doctor
    const isPatient = String(booking.userId) === String(req.user.id);
    const isDoctor = String(booking.doctorId.userId) === String(req.user.id);

    if (!isPatient && !isDoctor) {
      return res.status(403).json({ status: "fail", error: "Unauthorized access to video room." });
    }

    if (!['confirmed', 'in_consultation'].includes(booking.status)) {
      return res.status(400).json({ status: "fail", error: "Booking is not in a valid consultation state." });
    }

    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    const channelName = booking.channelName;
    const uid = Math.floor(Math.random() * 100000);
    const role = RtcRole.PUBLISHER;
    const privilegeExpireTime = Math.floor(Date.now() / 1000) + (60 * 60); // 1 hour

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      role,
      privilegeExpireTime
    );

    // If first participant joined, mark in_consultation & start timestamp
    if (booking.status === 'confirmed') {
      booking.status = 'in_consultation';
      booking.callStartedAt = new Date();
      await booking.save();
    }

    return res.status(200).json({
      status: "success",
      appId,
      token,
      channelName,
      uid
    });
  };
  ```

---

### 4.6 Consultation Complete Endpoint
- **Route:** `POST /api/booking/complete/:id`
- **Auth:** JWT (`ensureAuth`, role: `doctor`)
- **Controller Logic:**
  1. Find booking by ID where `doctorId.userId === req.user.id`.
  2. Set `booking.status = "completed"`.
  3. Set `booking.callEndedAt = new Date()`.
  4. Calculate duration: `callDurationSeconds = Math.round((endedAt - startedAt) / 1000)`.
  5. Schedule auto-payout job in 24 hours (unless a dispute ticket is raised).
  6. Return `{ status: "success", message: "Consultation marked completed.", booking }`.

---

### 4.7 Support Ticket Payout Hold & Resolution Workflow
- **When Patient Raises Ticket:** `POST /api/ticket/create`
  - If payload contains `bookingId`:
    ```javascript
    await Booking.findByIdAndUpdate(bookingId, {
      payoutHold: true,
      payoutHoldReason: `Dispute ticket #${ticket._id} raised by patient: ${category}`,
      ticketId: ticket._id
    });
    ```
- **Admin Resolve Ticket:** `POST /api/ticket/admin/resolve/:id`
  - **Option A (Refund Patient):**
    ```javascript
    // 1. Issue full refund via Razorpay
    const refund = await razorpay.payments.refund(booking.paymentId, {
      amount: booking.amountPaise,
      notes: { ticketId: ticket._id, adminReason: resolutionNotes }
    });
    
    // 2. Update booking
    booking.paymentStatus = 'refunded';
    booking.payoutHold = false;
    booking.payoutHoldReason = 'Refunded to patient due to dispute.';
    await booking.save();
    ```
  - **Option B (Release Payout to Doctor):**
    ```javascript
    // 1. Calculate commission (e.g. 15% platform commission)
    const commissionPaise = Math.round(booking.amountPaise * 0.15);
    const doctorPayoutPaise = booking.amountPaise - commissionPaise;

    // 2. Initiate Razorpay Route Transfer
    const transfer = await razorpay.transfers.create({
      account: doctor.linkedAccountId,
      amount: doctorPayoutPaise,
      currency: "INR",
      notes: { bookingId: booking._id, ticketId: ticket._id }
    });

    // 3. Mark settled
    booking.payoutHold = false;
    booking.payoutTransferred = true;
    booking.payoutTransferId = transfer.id;
    booking.platformCommissionPaise = commissionPaise;
    booking.doctorPayoutAmountPaise = doctorPayoutPaise;
    await booking.save();
    ```

---

## 5. Real-Time WebSocket (Socket.io) Event Matrix

Ensure `src/services/socket.js` (or equivalent) handles the following rooms and events:

| Event Name | Room / Target | Direction | Payload |
| :--- | :--- | :--- | :--- |
| `consultation:incoming` | `doctor:<doctorId>` | Server → Doctor | `{ bookingId, patientName, patientAge, vitals, type: "instant", timeoutSeconds: 90 }` |
| `consultation:accepted` | `patient:<userId>` | Server → Patient | `{ bookingId, doctorName, channelName, startsNow: true }` |
| `consultation:missed` | Both parties | Server → All | `{ bookingId, reason: "Doctor did not join within timeout. Refund initiated." }` |
| `doctor:status_changed` | `public:doctors` | Server → Public | `{ doctorId, isAvailable: boolean }` |
| `payout:hold_updated` | `doctor:<doctorId>` | Server → Doctor | `{ bookingId, payoutHold: boolean, reason: string }` |
| `ticket:updated` | Both parties | Server → Users | `{ ticketId, status: "resolved", action: "refund" \| "payout_released" }` |

---

## 6. Background Jobs & Cron Tasks

1. **Abandoned Reservation Cleanup Worker (runs every 2 minutes):**
   - Query: `Booking.find({ status: 'pending_payment', expiresAt: { $lt: new Date() } })`.
   - Update: Mark `status = 'cancelled'`.
   - Result: Releases locked slots for other patients immediately.

2. **Instant Consultation Timeout Monitor (90-second timeout):**
   - If an instant booking is created and doctor does not join within 90 seconds:
   - Mark `status = 'missed'`.
   - Execute Razorpay refund: `razorpay.payments.refund(paymentId)`.
   - Notify patient with instant refund confirmation.

3. **Escrow Payout Release Worker (runs hourly):**
   - Query: `Booking.find({ status: 'completed', payoutHold: false, payoutTransferred: false, callEndedAt: { $lt: new Date(Date.now() - 24 * 3600 * 1000) } })`.
   - Calculate platform fee and transfer net balance to doctor's linked account via Razorpay.

---

## 7. Security, Financial Integrity & Compliance Checklist

- [ ] **No Secret Exposure:** Never return `AGORA_APP_CERTIFICATE` or `RAZORPAY_KEY_SECRET` in any API response.
- [ ] **Strict Role-Based Authorization:** Verify that callers cannot complete bookings or generate video tokens for appointments that do not belong to them.
- [ ] **Idempotent Webhooks & Transfers:** Always verify `X-Razorpay-Signature` on Razorpay webhook handlers and guard against duplicate payment capture callbacks.
- [ ] **Medical Document Access Security:** S3 document bucket must **not** be public. All reads must use presigned S3 GetObject URLs with short expiry (e.g., 30 minutes) or cloudfront private signed cookies.
- [ ] **Telemedicine Act Compliance:** Require `telemedicineComplianceAccepted: true` before a doctor is permitted to toggle `isAvailable: true` or accept consultations.

---

## 8. Summary of Handover Deliverables

This specification directly maps to the frontend services and UI pages implemented in `onyx-health-flow`. By completing these endpoints, schema indexes, and webhook listeners, the entire Onyx Health+ Telehealth Doctor Module will operate as an enterprise-grade, secure, and production-ready healthcare ecosystem.
