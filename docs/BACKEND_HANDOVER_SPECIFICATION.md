# ONYX HEALTH+ DOCTOR SYSTEM: BACKEND HANDOVER SPECIFICATION
## Comprehensive API Contracts, Data Schemas, Status Lifecycles & Telehealth Architecture

**Document Version:** 2.1.0  
**Target Systems:** Node.js / Express / NestJS / MongoDB / PostgreSQL Backend Services  
**Consumer Applications:** 
- Onyx Doctor Portal (`onyx-health-flow`)
- Onyx Patient Portal (`onyx-patient-flow`)
- Onyx Kiosk Screening Station  

---

## 1. EXECUTIVE SUMMARY & ECOSYSTEM ARCHITECTURE

The **Onyx Health+ Doctor System** is a unified clinical telemedicine workspace enabling licensed physicians to manage schedules, conduct high-definition Agora RTC video consultations, review patient health reports, and issue digital prescriptions.

```mermaid
graph TD
    DoctorPortal[Onyx Doctor Portal] -->|HTTPS / REST API| BackendGateway[Onyx Backend Gateway]
    PatientPortal[Onyx Patient Portal] -->|HTTPS / REST API| BackendGateway
    KioskStation[Onyx IoT Health Kiosk] -->|Biometrics / Vitals| BackendGateway
    DoctorPortal <-->|WSS Presence & Live Ringing| WebSocketServer[WebSocket Presence Server /ws/presence]
    BackendGateway -->|Token Generator| AgoraRTC[Agora RTC Video Engine]
    BackendGateway -->|Document Vault / Pre-signed URLs| S3Vault[AWS S3 Encrypted Medical Vault]
    BackendGateway -->|Split Payouts & Transfers| RazorpayRoute[Razorpay Route Linked Accounts]
    BackendGateway -->|State & Records| Database[(MongoDB / PostgreSQL)]
```

### Key Functional Requirements & Backend Gaps Addressed
1. **Doctor Availability & Shift Hours:** Persist and retrieve doctor weekly recurring shifts, slot intervals (15m, 20m, 30m, 45m), and buffer durations.
2. **Direct Doctor Slot Booking:** Allow doctors to directly schedule appointments for patients from the calendar without payment gateway dependency.
3. **Standardized 5-State Appointment Lifecycle:** Strict status enforcement (`Confirmed`, `Urgent`, `Pending`, `Completed`, `Expired`).
4. **Consultation Queue Actions:** Dedicated endpoints for **Admit**, **Reject**, and **Postpone** consultations with real-time patient notifications.
5. **Patient Health Reports:** Ingestion, storage, and retrieval of diagnostic reports uploaded by patients during booking and in-call viewing.
6. **Real-Time WebSocket Presence & Incoming Call Signaling (`/ws/presence`):** Instant incoming consultation alerts with audible ringtone triggering.
7. **Agora RTC Token Issuance:** Clean numeric UID partitioning (`200000+` for doctors, `100000+` for patients).
8. **Razorpay Route Doctor Settlements:** 15% platform commission deduction, 85% net doctor payout, 24h escrow hold, and dispute handling.
9. **Doctor 4-Step Onboarding & Document Verification:** AWS S3 pre-signed URLs, credential verification, and admin approval workflows.
10. **ABDM / NMC Audit Logging:** Immutable compliance logging when doctor accesses decrypted patient records.
11. **Date-Filtered Querying:** High-performance index querying by doctor ID, date string (`YYYY-MM-DD`), and status.

---

## 2. STANDARDIZED APPOINTMENT STATUS LIFECYCLE

All appointments throughout the Onyx ecosystem adhere to the following 5 canonical statuses and transitional states:

```mermaid
stateDiagram-v2
    [*] --> Pending: Patient Books / Doctor Pre-books
    Pending --> Confirmed: Payment Verified / Doctor Confirmed
    Pending --> Urgent: Triage Flags High-Risk Vitals
    Confirmed --> InProgress: Doctor Admits Patient
    Urgent --> InProgress: Doctor Admits Patient
    Confirmed --> Postponed: Doctor Postpones (15m, 30m, 1h)
    Postponed --> Confirmed: Rescheduled Slot Active
    Confirmed --> Cancelled: Doctor Declines / Reject
    InProgress --> Completed: Consultation Concluded & Rx Issued
    Confirmed --> Expired: Slot Elapsed > 2h Without Join
    Pending --> Expired: Payment / Check-in Window Elapsed
    Completed --> [*]
    Cancelled --> [*]
    Expired --> [*]
```

### Status Definitions

| Status | Meaning & Clinical Context | Frontend Badge Styling |
| :--- | :--- | :--- |
| `Confirmed` | Verified appointment with reserved slot. Patient expected in waiting room. | Blue (`#2563EB`) |
| `Urgent` | Priority triage / abnormal IoT kiosk telemetry. Requires immediate doctor attention. | Rose / Crimson (`#F2052C`) |
| `Pending` | Pre-booked slot awaiting patient check-in or clinical verification. | Amber (`#F59E0B`) |
| `Completed` | Consultation concluded, clinical notes signed, and digital prescription issued. | Vital Emerald (`#10B981`) |
| `Expired` | Scheduled slot window has passed without attendance. Archived from active queue. | Slate Grey (`#94A3B8`) |
| `Postponed` | Delayed by doctor (e.g. +15m, +30m). Patient notified of revised slot time. | Amber Outline |
| `Cancelled` | Declined or cancelled with recorded clinical rationale. | Rose Outline |
| `In Progress` | Active live Agora video encounter. | Emerald Pulsing |

---

## 3. DOCTOR AVAILABILITY & SHIFT WORKING HOURS API

Doctors configure their recurring consultation availability, slot durations (15m, 20m, 30m, 45m), and buffer times. The backend must persist these records and use them to generate patient-facing booking slots.

### 3.1 Get Doctor Availability
- **Method:** `GET`
- **Route:** `/api/doctor/availability` (or `/api/doctor/availability?doctorId={doctorId}`)
- **Auth:** Bearer JWT (Doctor)

#### Response (`200 OK`)
```json
{
  "success": true,
  "doctorId": "doc_6711a9f029",
  "isAvailable": true,
  "slotDuration": 30,
  "bufferDuration": 5,
  "weeklySchedule": [
    {
      "dayName": "Sunday",
      "dayIndex": 0,
      "enabled": false,
      "shifts": [{ "start": "10:00", "end": "14:00" }]
    },
    {
      "dayName": "Monday",
      "dayIndex": 1,
      "enabled": true,
      "shifts": [
        { "start": "09:00", "end": "13:00" },
        { "start": "14:00", "end": "18:00" }
      ]
    },
    {
      "dayName": "Tuesday",
      "dayIndex": 2,
      "enabled": true,
      "shifts": [
        { "start": "09:00", "end": "13:00" },
        { "start": "14:00", "end": "18:00" }
      ]
    },
    {
      "dayName": "Wednesday",
      "dayIndex": 3,
      "enabled": true,
      "shifts": [
        { "start": "09:00", "end": "13:00" },
        { "start": "14:00", "end": "18:00" }
      ]
    },
    {
      "dayName": "Thursday",
      "dayIndex": 4,
      "enabled": true,
      "shifts": [
        { "start": "09:00", "end": "13:00" },
        { "start": "14:00", "end": "18:00" }
      ]
    },
    {
      "dayName": "Friday",
      "dayIndex": 5,
      "enabled": true,
      "shifts": [
        { "start": "09:00", "end": "13:00" },
        { "start": "14:00", "end": "18:00" }
      ]
    },
    {
      "dayName": "Saturday",
      "dayIndex": 6,
      "enabled": true,
      "shifts": [{ "start": "10:00", "end": "14:00" }]
    }
  ]
}
```

### 3.2 Update Doctor Availability
- **Method:** `POST`
- **Route:** `/api/doctor/availability`
- **Auth:** Bearer JWT (Doctor)

#### Request Payload
```json
{
  "isAvailable": true,
  "slotDuration": 30,
  "bufferDuration": 5,
  "weeklySchedule": [
    {
      "dayName": "Monday",
      "dayIndex": 1,
      "enabled": true,
      "shifts": [
        { "start": "09:00", "end": "13:00" },
        { "start": "14:00", "end": "18:00" }
      ]
    }
  ]
}
```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Doctor availability and shift intervals synchronized successfully.",
  "updatedAt": "2026-10-26T16:00:00.000Z"
}
```

---

## 4. DIRECT DOCTOR APPOINTMENT BOOKING API

Doctors have the clinical authority to directly schedule appointment slots for walk-in patients or scheduled follow-ups.

- **Method:** `POST`
- **Route:** `/api/booking/doctor-create` (or `/api/booking/create`)
- **Auth:** Bearer JWT (Doctor)

#### Request Payload
```json
{
  "doctorId": "doc_6711a9f029",
  "patientName": "Ramesh Verma",
  "patientPhone": "+91 98765 43210",
  "slotDate": "2026-10-26",
  "slotTimeStart": "10:30",
  "slotTimeEnd": "11:00",
  "duration": 30,
  "type": "Consultation",
  "status": "Confirmed",
  "reason": "Cardiovascular routine follow-up"
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "booking": {
    "_id": "bk_88921a44",
    "doctorId": "doc_6711a9f029",
    "patientName": "Ramesh Verma",
    "slotDate": "2026-10-26T00:00:00.000Z",
    "slotTimeStart": "10:30",
    "slotTimeEnd": "11:00",
    "duration": 30,
    "status": "Confirmed",
    "type": "Consultation",
    "createdAt": "2026-10-26T16:05:00.000Z"
  }
}
```

---

## 5. CONSULTATION ACTIONS: ADMIT, REJECT, POSTPONE

Doctors need granular controls over the consultation queue: admitting patients into the video suite, postponing slots with patient notices, or rejecting unsuitable bookings.

### 5.1 Unified Status Change Endpoint
- **Method:** `POST`
- **Route:** `/api/booking/status`
- **Auth:** Bearer JWT (Doctor)

#### 5.1.1 Admit Patient
```json
{
  "bookingId": "bk_88921a44",
  "status": "In Progress",
  "action": "admit"
}
```
*Backend action:* Transitions booking status to `In Progress`. Emits WebSocket/Push event `patient-admitted` to the patient portal so the patient's video interface connects automatically.

#### 5.1.2 Postpone Appointment
```json
{
  "bookingId": "bk_88921a44",
  "status": "Postponed",
  "postponeMinutes": 15,
  "reason": "Doctor attending emergency triage. Session will commence shortly."
}
```
*Backend action:* Adds `postponeMinutes` to `slotTimeStart` (e.g. 10:30 -> 10:45). Updates `status` to `Postponed`. Sends SMS/WebSocket push notification to the patient.

#### 5.1.3 Reject / Decline Appointment
```json
{
  "bookingId": "bk_88921a44",
  "status": "Cancelled",
  "action": "reject",
  "reason": "Specialty mismatch / Out of clinical scope",
  "notes": "Patient advised to consult in-person cardiologist for ECG evaluation."
}
```
*Backend action:* Sets status to `Cancelled`. Logs rejection rationale. Initiates automated refund if paid or credits free consultation coupon. Notifies patient.

---

## 6. PATIENT HEALTH REPORTS IN APPOINTMENT DETAILS & IN-CALL VIEWER

When a patient books an appointment, any diagnostic reports uploaded or selected from their profile must be attached to the booking. During both intake and the live video consultation, the doctor must be able to view these files.

### 6.1 Get Booking Reports
- **Method:** `GET`
- **Route:** `/api/booking/:bookingId/reports` (or `/api/booking/shared-reports/:bookingId`)
- **Auth:** Bearer JWT (Doctor / Patient)

#### Response (`200 OK`)
```json
{
  "success": true,
  "bookingId": "bk_88921a44",
  "reports": [
    {
      "_id": "rep_cbc_001",
      "title": "Comprehensive Metabolic & CBC Blood Panel",
      "type": "Lab Report",
      "date": "2026-10-24",
      "fileUrl": "https://vault.onyxhealth.com/reports/cbc_panel_88921.pdf",
      "fileSize": "1.4 MB",
      "summary": "Hemoglobin 14.2 g/dL, WBC 6,800 /mcL, Fasting Blood Sugar 98 mg/dL. All metabolic parameters normal.",
      "isVerified": true,
      "uploadedBy": "patient"
    },
    {
      "_id": "rep_rad_002",
      "title": "Digital Chest Radiograph (PA View)",
      "type": "Radiology",
      "date": "2026-10-22",
      "fileUrl": "https://vault.onyxhealth.com/reports/chest_xray_88921.dcm",
      "fileSize": "4.8 MB",
      "summary": "Clear lung fields bilaterally without focal consolidation. Normal cardiothoracic ratio.",
      "isVerified": true,
      "uploadedBy": "patient"
    }
  ]
}
```

### 6.2 Attach Report to Booking
- **Method:** `POST`
- **Route:** `/api/booking/:bookingId/attach-report`
- **Auth:** Bearer JWT (Patient / Doctor)

#### Request Payload
```json
{
  "reportId": "rep_cbc_001"
}
```

---

## 7. AGORA RTC ENCRYPTED VIDEO SUITE API

High-definition, end-to-end encrypted video consultations require an Agora RTC token generated per booking room.

- **Method:** `GET`
- **Route:** `/api/video/token/:bookingId`
- **Auth:** Bearer JWT (Doctor / Patient)

#### Response (`200 OK`)
```json
{
  "token": "0062a488e1...[Agora RTC Dynamic Token]...",
  "channelName": "room-bk_88921a44",
  "appId": "2a488e1b6f004928b991b17b2829103c",
  "uid": 249102,
  "role": "publisher",
  "expiresIn": 86400
}
```

> **Backend Developer Note:** Always assign doctors numeric UIDs in the range `200000 - 999999` and patients numeric UIDs in the range `100000 - 199999`. This ensures clean stream attribution across both web clients.

---

## 8. REAL-TIME WEBSOCKET PRESENCE & INCOMING CALL SIGNALING

The doctor dashboard maintains a persistent WebSocket connection to `/ws/presence` to listen for instant consultation calls, patient check-ins, and session terminations.

### 8.1 Connection & Handshake
- **Protocol:** `WSS`
- **URL:** `wss://<api-domain>/ws/presence`

#### Client Handshake Message
```json
{
  "type": "identify",
  "role": "doctor",
  "userId": "doc_6711a9f029"
}
```

### 8.2 Server-to-Doctor Events

#### 8.2.1 Incoming Consultation Alert (`consultation:incoming`)
Triggers the full-screen audible ringtone modal on the doctor portal.
```json
{
  "type": "consultation:incoming",
  "bookingId": "bk_88921a44",
  "patientName": "Sunita Patel",
  "reason": "Sudden Palpitations & Dizziness",
  "slot": "Immediate",
  "vitals": {
    "bp": "142/90",
    "pulse": 104,
    "temp": "98.6°F",
    "spo2": "97%"
  }
}
```

#### 8.2.2 Consultation Ended (`consultation:ended`)
Dismisses the ringing modal and stops the ringtone if patient disconnects before admission.
```json
{
  "type": "consultation:ended",
  "bookingId": "bk_88921a44"
}
```

#### 8.2.3 Heartbeat Ping-Pong
```json
// Client -> Server
{ "type": "ping" }

// Server -> Client
{ "type": "pong" }
```

---

## 9. RAZORPAY ROUTE SETTLEMENT & DOCTOR PAYOUT ARCHITECTURE

Doctor earnings on Onyx Health+ operate on an automated split-payment model:

$$\text{Gross Consultation Fee} - \text{Platform Commission (15\%)} = \text{Net Doctor Payout (85\%)}$$

### 9.1 Linked Account Routes
- `POST /create/linked-accounts`: Register doctor Razorpay Route sub-account.
- `GET /list/linked-accounts`: Return doctor linked account status, KYC verification, and connected bank/UPI.
- `PUT /update/linked-accounts/:id/bank`: Update destination bank account or UPI VPA.

### 9.2 Payout Settlement Lifecycle & Escrow
```mermaid
graph LR
    PaymentReceived[Patient Pays Fee] --> SplitTransfer[Razorpay Route 15% Onyx / 85% Doctor]
    SplitTransfer --> Escrow24h[24h Escrow Hold]
    Escrow24h --> AutoSettlement[Auto-Settled to Doctor Bank/UPI]
    Escrow24h -.->|Dispute Opened| DisputeHold[Payout On Hold Pending Ticket]
```

#### Payout Ledger Entry Schema
```typescript
interface SettlementLedgerEntry {
  bookingId: string;
  grossAmount: number;         // e.g. 500 INR
  commissionRate: number;      // 0.15 (15%)
  commissionAmount: number;    // 75 INR
  netPayout: number;           // 425 INR
  status: "Settled" | "Pending 24h Escrow" | "On Hold";
  razorpayTransferId: string;
  utrNumber?: string;
  escrowReleaseTime: Date;
}
```

---

## 10. DOCTOR 4-STEP ONBOARDING & VERIFICATION API

Doctors must complete a 4-step clinical onboarding wizard before public consultation listing:

| Step | Endpoint | Data Collected |
| :--- | :--- | :--- |
| Step 1 | `POST /api/doctor/onboarding/step1` | Medical specialty, experience years, qualifications, bio summary |
| Step 2 | `POST /api/doctor/onboarding/step2` | Hospital affiliation, clinic street address, city, state, postal code |
| Step 3 | `POST /api/doctor/onboarding/step3` | Medical Council registration number, issuing state board, license expiry |
| Step 4 | `POST /api/doctor/onboarding/step4` | Consultation fee (INR), shift hours, working days |
| Status | `GET /api/doctor/onboarding/status` | Returns `{ onboardingStatus: "pending" | "submitted" | "approved" | "rejected" }` |
| S3 URL | `POST /api/doctor/documents/presigned-url` | Issues AWS S3 pre-signed upload URL for medical degree and license scan |
| Admin | `POST /api/doctor/admin/approve` | Exec Admin approval or rejection with reason |

---

## 11. ABDM / NMC CONSENT & AUDIT LOGGING

Under National Medical Commission (NMC) and Ayushman Bharat Digital Mission (ABDM) guidelines, a doctor must declare clinical intent before decrypting patient health history:

- **Method:** `POST`
- **Route:** `/api/booking/agree-report-access/:bookingId`
- **Auth:** Bearer JWT (Doctor)

#### Request Payload
```json
{
  "agreed": true,
  "declaration": "In accordance with NMC/ABDM Telemedicine Practice Guidelines and patient privacy regulations, I declare that I will access and use this patient's medical records strictly for the purpose of this clinical consultation. I agree to keep all patient health information confidential."
}
```

#### Backend Action
Stores an immutable audit record in `ComplianceAuditLog`:
```typescript
{
  doctorId: "doc_6711a9f029",
  patientId: "pat_990141",
  bookingId: "bk_88921a44",
  timestamp: new Date(),
  ipAddress: req.ip,
  declarationAgreed: true
}
```

---

## 12. DIGITAL PRESCRIPTIONS (e-Rx) & POST-CALL SIGNING

When a doctor concludes a video consultation, the clinical diagnosis and prescribed medications are signed and stored.

- **Method:** `POST`
- **Route:** `/api/prescription`
- **Auth:** Bearer JWT (Doctor)

#### Request Payload
```json
{
  "bookingId": "bk_88921a44",
  "patientName": "Ramesh Verma",
  "diagnosis": "Hypertension Maintenance & Routine Follow-up",
  "duration": "30 days",
  "instructions": "Take with warm water after breakfast.",
  "medications": [
    {
      "name": "Amlodipine 5mg",
      "dosage": "5mg",
      "frequency": "Once daily (OD)",
      "duration": "30 days",
      "instructions": "Morning after food"
    },
    {
      "name": "Telmisartan 40mg",
      "dosage": "40mg",
      "frequency": "Once daily (OD)",
      "duration": "30 days",
      "instructions": "Morning with water"
    }
  ],
  "doctorNotes": "BP recorded at 128/82. Follow-up in 4 weeks."
}
```

#### Response (`201 Created`)
```json
{
  "success": true,
  "prescriptionId": "rx_990141",
  "pdfUrl": "https://vault.onyxhealth.com/prescriptions/rx_990141.pdf",
  "issuedDate": "2026-10-26T16:15:00.000Z"
}
```

---

## 13. DATE-FILTERED QUERYING FOR BOOKING LIST API

To support the Dashboard and Schedule date navigators efficiently, enhance `GET /api/booking/list`:

- **Route:** `GET /api/booking/list`
- **Supported Query Parameters:**
  - `date`: Filter by exact date (`YYYY-MM-DD`).
  - `rangeStart` & `rangeEnd`: Filter by date range (e.g. for week view: `2026-10-25` to `2026-10-31`).
  - `status`: Filter by comma-separated statuses (`Confirmed,Urgent,Pending`).
  - `doctorId`: Doctor identifier (defaults to authenticated doctor).

#### Example
```
GET /api/booking/list?doctorId=doc_6711a9f029&date=2026-10-26&status=Confirmed,Urgent
```

---

## 14. RECOMMENDED DATABASE SCHEMAS (MONGODB / MONGOOSE)

### 14.1 `DoctorAvailability` Schema
```typescript
const ShiftIntervalSchema = new mongoose.Schema({
  start: { type: String, required: true }, // "09:00"
  end: { type: String, required: true },   // "13:00"
});

const DayAvailabilitySchema = new mongoose.Schema({
  dayName: { type: String, required: true },
  dayIndex: { type: Number, required: true, min: 0, max: 6 },
  enabled: { type: Boolean, default: true },
  shifts: [ShiftIntervalSchema],
});

const DoctorAvailabilitySchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true, unique: true },
  isAvailable: { type: Boolean, default: true },
  slotDuration: { type: Number, default: 30 }, // Minutes
  bufferDuration: { type: Number, default: 5 }, // Minutes
  weeklySchedule: [DayAvailabilitySchema],
}, { timestamps: true });

DoctorAvailabilitySchema.index({ doctorId: 1 });
```

### 14.2 `Booking` Schema Additions
```typescript
const BookingSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  profileId: { type: mongoose.Schema.Types.ObjectId, ref: "Profile" },
  patientName: { type: String, required: true },
  slotDate: { type: Date, required: true },
  slotTimeStart: { type: String, required: true }, // "10:30"
  slotTimeEnd: { type: String },                   // "11:00"
  duration: { type: Number, default: 30 },
  status: {
    type: String,
    enum: ["Confirmed", "Urgent", "Pending", "Completed", "Expired", "Postponed", "Cancelled", "In Progress"],
    default: "Confirmed",
  },
  postponeMinutes: { type: Number, default: 0 },
  cancellationReason: { type: String },
  cancellationNotes: { type: String },
  reports: [{ type: mongoose.Schema.Types.ObjectId, ref: "Report" }],
  vitals: {
    bp: { type: String },
    temp: { type: String },
    pulse: { type: Number },
    spo2: { type: String },
  },
  agoraChannel: { type: String },
  paymentSettlementId: { type: String },
}, { timestamps: true });

BookingSchema.index({ doctorId: 1, slotDate: 1, status: 1 });
```

---

## 15. RECONCILIATION WORKER (CRON) FOR EXPIRED APPOINTMENTS

To ensure calendar and dashboard precision, implement a recurring 5-minute background job:

```javascript
// Schedule: Every 5 minutes (cron: '*/5 * * * *')
async function reconcileExpiredBookings() {
  const cutoffTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours past scheduled time
  
  await Booking.updateMany(
    {
      status: { $in: ["Confirmed", "Pending", "Postponed"] },
      slotDate: { $lte: cutoffTime },
    },
    {
      $set: { status: "Expired" }
    }
  );
}
```

---

## 16. VERIFICATION CHECKLIST FOR BACKEND INTEGRATION

- [ ] `POST /api/doctor/availability` persists weekly shift matrices and slot intervals.
- [ ] `GET /api/doctor/availability` returns doctor's configured shifts.
- [ ] `POST /api/booking/doctor-create` allows direct doctor slot bookings.
- [ ] `POST /api/booking/status` handles Admit, Postpone, and Reject actions.
- [ ] `GET /api/booking/:id/reports` serves patient health records with verified URLs.
- [ ] `POST /api/booking/agree-report-access/:id` logs NMC compliance audit entries.
- [ ] `GET /api/video/token/:bookingId` issues valid Agora RTC tokens with integer UIDs.
- [ ] WebSocket presence server `/ws/presence` emits `consultation:incoming` and `consultation:ended`.
- [ ] Razorpay Route linked account creation and automated 15%/85% payout splitting.
- [ ] Background worker archives unattended bookings as `Expired`.
