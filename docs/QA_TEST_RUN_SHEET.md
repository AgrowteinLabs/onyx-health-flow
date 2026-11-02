# ONYX HEALTH+ FLOW — REGULATORY & QA VERIFICATION TEST RUN SHEET

**Software / Client**: ONYX Health+ Flow (Frontend Web Application)  
**Applicable Standards**: IEC 62304 / ISO 13485 / ISO 14971 / IEC 62366-1 (Usability) / HIPAA Security Rule  
**Target Environment**: Staging / Pre-Production  
**Backend API Gateway**: `https://api.onyxhealthplus.com` (or active ngrok development URL)  
**Test Date**: `[DD-MMM-YYYY]`  
**Tester Name**: `[Tester Full Name / Role]`  
**Git Commit SHA**: `[e.g., 7f8a9bc]`  
**Browser / Platform Tested**: `Google Chrome v120+ / Edge v120+ / Safari v17+ (1920x1080)`  

---

## EXECUTION INSTRUCTIONS FOR QA & VERIFICATION TESTERS

1. Execute test cases sequentially across all 12 modules (Groups A through L).
2. For each test case, record:
   - **Pass/Fail Status** (`[ ] PASS`, `[ ] FAIL`, `[ ] BLOCKED`)
   - **Actual Result / Defect Reference**
   - **Evidence Artifact Name** matching the standardized naming format below.
3. Attach all screenshots, network HAR traces, and video recordings to the `evidence/` compliance folder.
4. If a test fails, log a defect referencing the **Test ID** and **SRS/Spec ID** in the issue tracker.

### Evidence Artifact Naming Standard

- **Screenshots**: `<TEST_ID>_<SCENARIO>_SCREENSHOT_<TIMESTAMP>.png` (e.g., `TC_AUTH_01_LOGIN_SUCCESS_20260916.png`)
- **Network Traces**: `<TEST_ID>_NETWORK_HAR_<TIMESTAMP>.har` (e.g., `TC_AUTH_02_TOKEN_REFRESH.har`)
- **Video Sessions**: `<TEST_ID>_WORKFLOW_<TIMESTAMP>.mp4` (e.g., `TC_DOC_01_AGORA_CALL.mp4`)

---

## A. AUTHENTICATION & SESSION MANAGEMENT

### `TC-AUTH-01`: Multi-Role Login with Phone OTP & Password

- **SRS / Spec ID**: `SPEC-AUTH-01`
- **Preconditions**: Valid administrator phone registered on backend.
- **Test Steps**:
  1. Navigate to `/login`.
  2. Enter registered phone number and click **"Get Verification Code"**.
  3. Verify 6-digit OTP field and Password field are displayed with a 30s resend timer.
  4. Enter OTP and password, then click **"Confirm Login"**.
- **Expected Result**: 
  - Login succeeds with toast: *"Login successful, redirecting to your dashboard..."*.
  - `authToken`, `refreshToken`, and `userRole` stored in `localStorage`.
  - User redirected to their respective role dashboard (e.g., `/dashboard/executive-admin`).
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Screenshot  |  [ ] Network HAR Trace`

---

### `TC-AUTH-02`: Automatic 401 Token Refresh Interception

- **SRS / Spec ID**: `SPEC-AUTH-02`
- **Preconditions**: Active user session with an expired `authToken` and valid `refreshToken`.
- **Test Steps**:
  1. Navigate to `/dashboard/executive-admin/reports`.
  2. API returns `401 Unauthorized` for initial request.
  3. Observe Network tab for automatic invocation of `/api/auth/issue-token`.
- **Expected Result**:
  - Axios interceptor catches 401, invokes `/api/auth/issue-token`, receives fresh access token.
  - Retries original request transparently; page renders data without user re-login or screen flicker.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Network HAR Trace showing /issue-token retry`

---

### `TC-AUTH-03`: Multi-Tab Logout Synchronization

- **SRS / Spec ID**: `SPEC-AUTH-03`
- **Preconditions**: User logged into Web App in two separate browser tabs (Tab A & Tab B).
- **Test Steps**:
  1. In Tab A, click **"Logout"** (or clear `authToken` from `localStorage`).
  2. Immediately switch to Tab B and observe application behavior.
- **Expected Result**:
  - Tab B detects `storage` event, clears React Query client cache, and redirects immediately to `/login`.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Video recording of two tabs`

---

### `TC-AUTH-04`: Password Visibility Masking & Resend Timer

- **SRS / Spec ID**: `SPEC-AUTH-01`
- **Preconditions**: On `/login` password verification step.
- **Test Steps**:
  1. Enter password; verify default input type is `password` (dots/asterisks).
  2. Click the eye icon; verify plain text is shown. Click again to re-mask.
  3. Click **"Resend OTP"**; verify button is disabled for 30 seconds with countdown ticker.
- **Expected Result**: Password masks/unmasks cleanly; resend button prevents spamming requests.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Screenshot`

---

## B. ROLE-BASED ACCESS CONTROL (RBAC)

### `TC-RBAC-01`: Unauthorized Deep Route Direct URL Access

- **SRS / Spec ID**: `SPEC-AUTH-01` / `SPEC-ADMIN-01`
- **Preconditions**: User logged in with `doctor` role.
- **Test Steps**:
  1. In the browser address bar, manually type `/dashboard/super-admin/roles`.
  2. Press Enter.
- **Expected Result**:
  - `ProtectedRoute` detects role mismatch, prevents rendering of super-admin components, and redirects user to `/dashboard/doctor` or `/login`.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Screenshot of redirect / route log`

---

### `TC-RBAC-02`: Role-Scoped Sidebar Navigation

- **SRS / Spec ID**: `SPEC-AUTH-01`
- **Preconditions**: Log in as `nurse`, `technician`, `doctor`, and `executive-admin`.
- **Test Steps**:
  1. For each role, inspect the sidebar menu items.
- **Expected Result**:
  - Doctor sees only Schedule, Consultations, Prescriptions, Reports, Payments, Onboarding.
  - Nurse sees Devices, Reports, Organization.
  - Executive Admin sees Organizations, Analytics, Doctors, Devices, Reports, Team listings.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Sidebar screenshots per role`

---

## C. PATIENT CONTEXT & ISOLATION

### `TC-PAT-01`: Zero Cross-Patient Data Bleed

- **SRS / Spec ID**: `SPEC-SESS-01`
- **Preconditions**: Multiple patients with diagnostic vitals loaded in system.
- **Test Steps**:
  1. Navigate to `/dashboard/doctor/consultations`.
  2. Click on Patient A; verify vitals and clinical notes drawer open.
  3. Close drawer and immediately click on Patient B.
- **Expected Result**:
  - Patient A state is completely unmounted.
  - Patient B data loads freshly with no residual or flickering vitals from Patient A.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Screen recording`

---

### `TC-PAT-02`: Missing Patient Demographic Fields Handling

- **SRS / Spec ID**: `SPEC-SESS-01`
- **Preconditions**: Patient record missing secondary contact or BMI.
- **Test Steps**:
  1. View patient details in consultation sidebar or report summary.
- **Expected Result**: Missing fields display explicit em-dash (`—`), never `null`, `undefined`, or `NaN`.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Screenshot`

---

## D. CLINICAL SCREENING & TELEMETRY RESULTS DISPLAY

### `TC-TELEM-01`: Numerical Precision & Unit Consistency

- **SRS / Spec ID**: `SPEC-SESS-01`
- **Preconditions**: Clinical vitals recorded for patient.
- **Test Steps**:
  1. Inspect Blood Pressure, Heart Rate, SpO2, Body Temperature, and BMI values.
- **Expected Result**:
  - Blood Pressure displayed in integer format `mmHg` (e.g. `120/80`).
  - Heart Rate / Pulse in `bpm`.
  - Body Temperature in single decimal precision `°F` (e.g. `98.6°F`).
  - No floating-point inaccuracies (e.g. `98.600000001`).
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Vitals card screenshot`

---

## E. CLINICAL LABELLING & SCREENING DISCLAIMERS

### `TC-DISC-01`: Regulatory Screening Disclaimers Presence

- **SRS / Spec ID**: `SPEC-REP-01` / `ONYX-SW-12`
- **Preconditions**: User logged in as Doctor or Executive Admin.
- **Test Steps**:
  1. Navigate to `/dashboard/executive-admin/reports`.
  2. Inspect the top banner and click **"Info"** on any report to open Report Details.
  3. Navigate to `/dashboard/doctor/consultations` and open patient overview drawer.
- **Expected Result**:
  - Clinical screening notice is clearly visible on Reports page: *"Notice: For health screening and triage support only. Not a definitive medical diagnosis..."*.
  - Confidentiality PHI notice is present in Report Details dialog.
  - Vitals drawer contains screening notice.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Screenshots of 3 disclaimer locations`

---

## F. DIAGNOSTIC REPORTS & S3 PRESIGNED DOWNLOADS

### `TC-REP-01`: Secure S3 Presigned PDF Report Download

- **SRS / Spec ID**: `SPEC-REP-01`
- **Preconditions**: Reports exist in `/dashboard/executive-admin/reports`.
- **Test Steps**:
  1. Open `/dashboard/executive-admin/reports`.
  2. Click the **Download** icon on any report row or inside the Details modal.
  3. Observe Network tab for call to `/api/report/:reportId/download`.
- **Expected Result**:
  - Frontend requests fresh presigned URL and opens PDF in a secure new tab (`noopener,noreferrer`).
  - Loading spinner is displayed during retrieval.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Downloaded PDF artifact & Network trace`

---

### `TC-REP-02`: Handling Missing / In-Progress Report Artifacts

- **SRS / Spec ID**: `SPEC-REP-01`
- **Preconditions**: Report record has empty or invalid `s3Link`.
- **Test Steps**:
  1. Click Download on an in-progress report record.
- **Expected Result**: Toast displays: *"Diagnostic PDF report artifact is not yet uploaded or available for this session."*. App does not crash or navigate to 404.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Toast screenshot`

---

## G. TELEHEALTH VIDEO CONSULTATIONS (AGORA RTC) & PRESCRIPTIONS

### `TC-DOC-01`: Telehealth Video Room Connection & Teardown

- **SRS / Spec ID**: `SPEC-DOC-03`
- **Preconditions**: Doctor has an active appointment in `/dashboard/doctor/consultations`.
- **Test Steps**:
  1. Click **"Start Call"** on patient card.
  2. Verify RTC token fetch and camera/mic permissions prompt.
  3. Toggle Microphone Mute and Camera Off buttons.
  4. Click **"Leave Consultation"**.
- **Expected Result**:
  - Video session connects; call timer increments.
  - Mute/camera toggles respond immediately.
  - Leaving call cleanly stops and releases media tracks; camera indicator light on device turns off.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] WebRTC video recording`

---

### `TC-RX-01`: Electronic Prescription Issue & PDF Preview

- **SRS / Spec ID**: `SPEC-DOC-04`
- **Preconditions**: Logged in as Doctor on `/dashboard/doctor/prescriptions`.
- **Test Steps**:
  1. Click **"Issue Prescription"**.
  2. Select patient appointment, enter Medication (`Amoxicillin`), Dosage (`500mg`), Frequency, and Duration.
  3. Click **"Issue Rx"**.
  4. On the newly created card, click **"View Rx"**.
- **Expected Result**:
  - Prescription created and added to list.
  - Prescription Preview dialog renders formatted Rx card with doctor name, patient name, and instructions.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Rx card & preview screenshots`

---

## H. RAZORPAY ROUTE & DOCTOR SETTLEMENT LEDGERS

### `TC-SET-01`: Settlements Ledger Display & Fee Split Accuracy

- **SRS / Spec ID**: `SPEC-ADMIN-02`
- **Preconditions**: Logged in as Executive Admin on `/dashboard/executive-admin/reports` (Doctor Consultations tab).
- **Test Steps**:
  1. Switch to **"Doctor Consultations"** tab.
  2. Inspect Booking ID, Doctor Name, Consultation Fee, Date, Status, and Split Transfer ID columns.
- **Expected Result**: All amounts formatted in Indian Rupee currency (`₹`), status badges colored appropriately (Confirmed = Emerald, Pending = Amber), and Split Transfer IDs displayed in monospace font.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Ledger screenshot`

---

## I. DEVICE FLEET TELEMETRY & MANAGEMENT

### `TC-DEV-01`: Device Active/Inactive Status Toggle with Confirmation

- **SRS / Spec ID**: `SPEC-HW-01` / `SPEC-ADMIN-01`
- **Preconditions**: Logged in as Executive Admin on `/dashboard/executive-admin/devices`.
- **Test Steps**:
  1. Click the status switch on a device.
  2. Verify confirmation dialog appears with *"Confirm Status Change"*.
  3. Click **"Confirm"**.
- **Expected Result**:
  - Device status updates; toast confirms status update; device list refreshes.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] UI modal & toast screenshot`

---

## J. API INTEGRATION, ERROR HANDLING & NETWORK RESILIENCE

### `TC-API-01`: Network Disconnection Error Handling

- **SRS / Spec ID**: `SPEC-AUTH-01`
- **Preconditions**: Active dashboard session.
- **Test Steps**:
  1. In Chrome DevTools Network tab, set throttling to **Offline**.
  2. Attempt an action (e.g. Refresh reports or search).
- **Expected Result**: UI displays user-friendly error toast: *"Network error. Please check server connection."*; does not crash with unhandled exception.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Network error toast screenshot`

---

### `TC-API-02`: 15-Second Request Timeout Handling

- **SRS / Spec ID**: `SPEC-AUTH-01`
- **Preconditions**: API client configuration in `api-request.ts`.
- **Test Steps**:
  1. Simulate API delay exceeding 15000ms.
- **Expected Result**: Request cleanly aborts; UI displays timeout notification.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Timeout log`

---

## K. BROWSER COMPATIBILITY & RESPONSIVE MATRIX

### `TC-BROWSER-01`: Cross-Browser Viewport & Layout Integrity

- **SRS / Spec ID**: `ONYX-SW-12`
- **Preconditions**: Web App deployed to test URL.
- **Test Matrix**:
  - [ ] Google Chrome v120+ (1920×1080 Desktop)
  - [ ] Microsoft Edge v120+ (1366×768 Laptop)
  - [ ] Mozilla Firefox v120+ (1920×1080 Desktop)
  - [ ] Apple Safari v17+ (Mac / iPad)
- **Expected Result**: Glassmorphic panels, grid command layouts, modals, and charts render without overflow or visual distortion.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Screenshots across 4 browsers`

---

## L. PRODUCTION SECURITY, CONSOLE AUDIT & STORAGE

### `TC-SEC-01`: Clean Console in Production Builds

- **SRS / Spec ID**: `SPEC-DATA-01`
- **Preconditions**: Production build running (`npm run build && npm run preview`).
- **Test Steps**:
  1. Open Chrome DevTools Console.
  2. Perform login, view patient records, and open reports.
- **Expected Result**: No plaintext JWT bearer tokens, patient PII, or internal secrets logged to console.
- **Actual Result**: `[ ] PASS  |  [ ] FAIL` — ___________________________________
- **Evidence Collected**: `[ ] Clean console log screenshot`

---

## SUMMARY OF VERIFICATION RUN

| Total Test Cases | Passed | Failed | Blocked | Pass Rate (%) |
| :---: | :---: | :---: | :---: | :---: |
| 16 | [ ] | [ ] | [ ] | % |

**Overall Verification Recommendation**:
`[ ] ACCEPT FOR PRODUCTION RELEASE  |  [ ] REJECT (DEFECTS PENDING RESOLUTION)`

**QA Lead Sign-off**: ___________________________ **Date**: _______________  
**Clinical / Product Sign-off**: __________________ **Date**: _______________  
**Regulatory / Quality Sign-off**: _______________ **Date**: _______________  
