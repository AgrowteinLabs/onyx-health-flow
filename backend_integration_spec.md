# ONYX Healthcare Platform - Backend Integration & API Gap Specifications

This document outlines the API endpoints, database schema expansions, and Razorpay payment integrations required to make the **ONYX Admin & Doctor Dashboard** (`onyx-health-flow`) and **Patient Dashboard** (`onyx-patient-flow`) fully functional.

---

## 1. Authentication & Role-Based Scope
Ensure all endpoints enforce JWT verification and validate role permissions. The frontend scopes access via the `userRole` payload claim:
- **`super-admin`** / **`executive-admin`**: Global system read/write.
- **`cluster-head`**: Read/write scoped strictly to the user's `organizationId` (from JWT or user record).
- **`user-head`** / **`nurse`**: Local device reading and patient report submissions.
- **`doctor`**: Personal schedule, consultations, prescriptions, and onboarding state.
- **`patient`**: Personal profiles and appointment bookings.

---

## 2. Doctor Onboarding Wizard (5-Step Registration)
During onboarding, doctors fill out a multi-step wizard. The backend must save these fields progressively or in a staging table before transitioning the status to `Pending Verification`.

### Step 1: Professional Profile
- **Endpoint**: `POST /api/doctor/onboarding/step1`
- **Request Payload**:
  ```json
  {
    "specialty": "Cardiologist",
    "experience": 12,
    "qualification": "MD - Cardiology, MBBS",
    "summary": "Specialist in cardiovascular diseases with 10+ years of clinical experience."
  }
  ```

### Step 2: Location Details
- **Endpoint**: `POST /api/doctor/onboarding/step2`
- **Request Payload**:
  ```json
  {
    "hospitalName": "Apollo Specialty Clinic",
    "location": {
      "line1": "12 Ridge Road, Teynampet",
      "line2": "Chennai",
      "line3": "Tamil Nadu"
    },
    "country": "India"
  }
  ```

### Step 3: Medical Credentials
- **Endpoint**: `POST /api/doctor/onboarding/step3`
- **Request Payload**:
  ```json
  {
    "registrationNumber": "MCI-98765",
    "issuingBoard": "Medical Council of India",
    "expiryDate": "2030-12-31T23:59:59.000Z"
  }
  ```

### Step 4: Availability & Consultation Fees
- **Endpoint**: `POST /api/doctor/onboarding/step4`
- **Request Payload**:
  ```json
  {
    "consultationFee": 800,
    "availability": {
      "startTime": "09:00",
      "endTime": "17:00",
      "days": ["Monday", "Wednesday", "Friday"]
    }
  }
  ```

### Step 5: Bank Account & Linked Account Setup
- **Endpoint**: `POST /create/linked-accounts`
- **Request Payload**:
  ```json
  {
    "accountHolderName": "John Doe",
    "bankName": "HDFC Bank",
    "ifscCode": "HDFC0001234",
    "accountNumber": "50100223344556",
    "status": "Pending Verification"
  }
  ```
- **Backend Responsibility**: 
  - Save bank account parameters in the Doctor/User profile.
  - Automatically flag the doctor user status as `Pending Verification`.

---

## 3. Razorpay Route (Settlements & Splits)
To automate splits, the backend must hook into the **Razorpay Route API** to register doctors as linked accounts.

### 1. Onboarding Start (Create Razorpay Account)
- **Endpoint**: `POST /onboard/start`
- **Request Payload**: `{ "clusterId": "doctor_user_id" }`
- **Backend Responsibility**: Call Razorpay Account API to generate a linked account ID (`acc_xxxxxx`) and return a redirect URL for the doctor to complete KYC.

### 2. Verify Linked Account Status
- **Endpoint**: `POST /validate/linked-accounts`
- **Request Payload**: `{ "razorpayAccountId": "acc_xxxxxx" }`
- **Response**: `{ "status": "active" | "suspended" | "pending" }`

### 3. Update Bank Accounts (Route modifications)
- **Endpoint**: `PUT /update/linked-accounts/:id/bank`
- **Request Payload**: `{ "accountNumber": "...", "ifscCode": "..." }`

---

## 4. Patient Appointment Booking & Payments
These endpoints power the search, slot selection, and checkout flow in the Patient Portal (`onyx-patient-flow`).

### 1. Retrieve Doctor Availability
- **Endpoint**: `GET /api/doctor/availability`
- **Query Params**: `?doctorId=xyz&date=2026-06-15`
- **Response**: List of 30-minute availability slots:
  ```json
  {
    "doctorId": "xyz",
    "date": "2026-06-15",
    "availableSlots": [
      "2026-06-15T09:00:00.000Z",
      "2026-06-15T09:30:00.000Z",
      "2026-06-15T11:00:00.000Z"
    ]
  }
  ```

### 2. Create Order & Booking (Pending State)
- **Endpoint**: `POST /api/booking/create`
- **Request Payload**:
  ```json
  {
    "doctorId": "doctor_user_id",
    "type": "scheduled",
    "slotDate": "2026-06-15T09:00:00.000Z",
    "slotTimeStart": "09:00",
    "slotTimeEnd": "09:30",
    "profileId": "family_member_profile_id"
  }
  ```
- **Backend Responsibility**: 
  - Validate that the slot is open.
  - Create a Razorpay Order (`order_xxxxxx`) with the appropriate fee (e.g. `800 * 100` paise).
  - Create a local Booking record with status = `Pending Payment`.
  - Return the booking record and Razorpay Order details to the client.

### 3. Confirm Booking & Payment Signature Verification
- **Endpoint**: `POST /api/booking/confirm`
- **Request Payload**:
  ```json
  {
    "bookingId": "booking_db_id",
    "razorpay_payment_id": "pay_xxxxxx",
    "razorpay_order_id": "order_xxxxxx",
    "razorpay_signature": "signature_hex"
  }
  ```
- **Backend Responsibility**:
  - Perform HMAC-SHA256 signature verification matching Razorpay specs.
  - If valid, update the Booking status to `Confirmed`.
  - Trigger a transfer split to the doctor's linked account (Razorpay Route) subtracting the platform's processing fee percentage.

---

## 5. Administrative Verification & Status Management
EAs and Cluster Heads need to verify credentials and update statuses.

### 1. View & List Doctors
- **Endpoint**: `GET /api/doctor/list`
- **Query Filters**: Supports filtering by `orgId` (crucial for Cluster Heads to only see their scoped doctors) and `status` (`Active`, `Pending Verification`, `Suspended`, `Inactive`).

### 2. Update Status & Audit Credentials
- **Endpoint**: `PUT /update/user/:id`
- **Request Payload**:
  ```json
  {
    "status": "Active" | "Suspended" | "Inactive" | "Pending Verification",
    "orgId": "new_assigned_organization_id_if_EA"
  }
  ```

### 3. Doctor Verification Approval
- **Endpoint**: `POST /api/doctor/admin/approve`
- **Request Payload**:
  ```json
  {
    "doctorId": "doctor_user_id",
    "action": "approve" | "reject",
    "rejectionReason": "Credentials verification failed"
  }
  ```

---

## 6. Database Schema Additions (MongoDB / SQL Reference)

### Doctor / User Schema Extensions
```typescript
interface UserSchema {
  role: 'super-admin' | 'executive-admin' | 'cluster-head' | 'user-head' | 'nurse' | 'technician' | 'doctor' | 'patient';
  status: 'Active' | 'Inactive' | 'Suspended' | 'Pending Verification';
  
  // Scoping fields
  orgId?: string; // Reference to Organization
  
  // Doctor Profile (Only populated for Doctor role)
  specialty?: string;
  experience?: number;
  qualification?: string;
  summary?: string;
  
  hospitalName?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  
  registrationNumber?: string;
  issuingBoard?: string;
  licenseExpiry?: Date;
  
  consultationFee?: number;
  availability?: {
    startTime: string; // "09:00"
    endTime: string;   // "17:00"
    days: string[];    // ["Monday", "Wednesday"]
  };
  
  // Linked Bank Account
  bankDetails?: {
    accountHolderName: string;
    bankName: string;
    ifscCode: string;
    accountNumber: string;
    razorpayAccountId?: string; // Route Linked Account ID
  };
}
```

### Booking Schema
```typescript
interface BookingSchema {
  patientId: string; // Patient User ID
  profileId?: string; // Sub-profile ID (Family Member)
  doctorId: string; // Doctor User ID
  orgId: string; // Organization ID (copied from Doctor's profile)
  
  type: 'scheduled' | 'instant';
  slotDate: Date;
  slotTimeStart: string; // "09:00"
  slotTimeEnd: string;   // "09:30"
  
  status: 'Pending Payment' | 'Confirmed' | 'Completed' | 'Cancelled';
  
  paymentDetails?: {
    razorpayOrderId: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    amountPaid: number;
    splitTransferId?: string; // Razorpay transfer split record reference
  };
}
```

---

## 7. Agora Telehealth Video Consultations Token Generator
To transition video consultations from mock views to actual calls:
* **Agora Token Builder Server**: The Node.js/Express backend must generateRTC tokens using the Agora App ID and App Certificate.
* **Token Server Endpoint**:
  - **Endpoint**: `GET /api/video/token/:bookingId`
  - **Query Params**: `?role=publisher` or `?role=subscriber`
  - **Response**:
    ```json
    {
      "token": "agora_generated_rtc_token_string",
      "channelName": "booking_id_or_channel_uid",
      "uid": 123456,
      "appId": "agora_app_id"
    }
    ```
  - **Backend Responsibility**: Validate that the authenticated user belongs to the active `bookingId` (either the assigned doctor or patient) before issuing a token.

---

## 8. Prescriptions & Reports AWS S3 Sync
To retrieve dynamic medical data for patient sub-profiles and securely download PDF documents:

### 1. Prescriptions Database Model & API
- **Endpoint**: `GET /api/prescriptions/:profileId`
- **Response**: List of prescriptions associated with the selected family profile ID:
  ```json
  [
    {
      "_id": "prescription_id_1",
      "bookingId": "booking_id",
      "doctorId": "doctor_user_id",
      "doctorName": "Dr. Sarah Johnson",
      "date": "2026-06-14T21:49:00Z",
      "medicines": [
        { "name": "Amoxicillin", "dosage": "500mg", "frequency": "1-0-1", "duration": "5 Days" }
      ]
    }
  ]
  ```

### 2. S3 Secure Document Downloading
- **Endpoint**: `GET /api/report/:reportId/download`
- **Response**: Secure, short-lived AWS S3 presigned URL for downloading diagnostic PDF summaries:
  ```json
  {
    "downloadUrl": "https://onyx-health-reports.s3.amazonaws.com/reports/xyz.pdf?AWSAccessKeyId=...&Expires=...&Signature=..."
  }
  ```

---

## 9. Settlements & Payments Dashboard (Executive Admin)
To display routing volumes and payment splits inside the Admin Panel:
- **Endpoint**: `GET /api/admin/settlements`
- **Response**: Summary of transfers made via Razorpay Route:
  ```json
  {
    "totalVolume": 145000,
    "pendingPayoutsCount": 8,
    "settlements": [
      {
        "transferId": "trf_xxxxxx",
        "doctorName": "Dr. James Brown",
        "amount": 720,
        "commission": 80,
        "status": "settled",
        "date": "2026-06-14T10:00:00Z"
      }
    ]
  }
  ```

