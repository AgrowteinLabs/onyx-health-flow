# Doctor Management - Quick Reference Guide

## Endpoint Summary

| Method | Endpoint | Auth | Permission | Purpose |
|--------|----------|------|-----------|---------|
| POST | `/api/doctor/admin/create` | ✅ JWT | `create-doctor` | Admin creates doctor account |
| POST | `/api/doctor/create` | ❌ | - | Doctor self-signup (OTP) |
| POST | `/api/doctor/onboarding/step1` | ✅ JWT | - | Personal & medical details |
| POST | `/api/doctor/onboarding/step2` | ✅ JWT | - | Medical credentials |
| POST | `/api/doctor/onboarding/step3` | ✅ JWT | - | Compliance agreements |
| POST | `/api/doctor/onboarding/step4` | ✅ JWT | - | Practice details |

## Quick Test Commands

### 1. Admin Create Doctor
```bash
curl -X POST http://localhost:6000/api/doctor/admin/create \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. Test",
    "country": "India",
    "phone_number": ["91", "9876543210"],
    "password": "SecurePass123",
    "specialization": "Cardiology",
    "consultationFee": 500
  }'
```

### 2. Doctor Login
```bash
curl -X POST http://localhost:6000/api/auth/auth \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": ["91", "9876543210"],
    "password": "SecurePass123"
  }'
```

### 3. Complete Onboarding
```bash
# Step 1
curl -X POST http://localhost:6000/api/doctor/onboarding/step1 \
  -H "Authorization: Bearer YOUR_DOCTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "gender": "male",
    "dateOfBirth": "1985-06-15T00:00:00Z",
    "email": "doctor@example.com",
    "residentialAddress": "Mumbai",
    "qualification": "MBBS",
    "experienceYears": 5,
    "languages": ["English", "Hindi"],
    "bio": "Test bio"
  }'

# Step 2
curl -X POST http://localhost:6000/api/doctor/onboarding/step2 \
  -H "Authorization: Bearer YOUR_DOCTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "registrationNumber": "MCI-123456",
    "registrationCouncilState": "Maharashtra"
  }'

# Step 3
curl -X POST http://localhost:6000/api/doctor/onboarding/step3 \
  -H "Authorization: Bearer YOUR_DOCTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "telemedicineComplianceAccepted": true,
    "digitalPrescriptionConsent": true
  }'

# Step 4
curl -X POST http://localhost:6000/api/doctor/onboarding/step4 \
  -H "Authorization: Bearer YOUR_DOCTOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clinicAddress": "Heart Center",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India"
  }'
```

## Key Code Locations

| Component | File |
|-----------|------|
| Controllers | `src/controller/doctor-controller.js` |
| Validators | `src/controller/doctor-validate.js` |
| Routes | `src/routes/doctor.js` |
| Models | `src/models/User.js`, `src/models/doctorDetails.js` |
| Auth Middleware | `src/middlewares/auth-middleware.js` |
| Permission Middleware | `src/middlewares/permission-middleware.js` |
| Documentation | `docs/routes/doctor-onboarding.md` |

## Required Request Headers

All endpoints except self-signup require:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## Common Response Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success (onboarding steps) |
| 201 | Created (admin create) |
| 400 | Invalid parameters |
| 403 | Permission denied |
| 404 | Doctor not found |
| 409 | Conflict (duplicate) |
| 500 | Server error |

## Required Permissions

For admin endpoints, add to admin role:
```javascript
{
  "create-doctor": true
}
```

## Data Flow Diagram

```
Admin
  ↓
POST /api/doctor/admin/create
  ↓
User (role: doctor) + DoctorDetails created
  ↓
Doctor Login (POST /api/auth/auth)
  ↓
Receives JWT token
  ↓
POST /api/doctor/onboarding/step1-4 (sequential or any order)
  ↓
DoctorDetails progressively updated
  ↓
Onboarding Complete ✓
```

## Validation Rules

### Admin Create Doctor
- name: string, required
- phone_number: [countryCode, number], required
- country: string, required
- password: min 8 chars, required
- specialization: string, required
- consultationFee: number, required

### Onboarding Step 1
- gender: enum (male/female/other), required
- dateOfBirth: ISO date, required
- email: valid email, required
- residentialAddress: string, required
- qualification: string, required
- experienceYears: number ≥ 0, required

### Onboarding Step 2
- registrationNumber: string, required
- registrationCouncilState: string, required

### Onboarding Step 3
- telemedicineComplianceAccepted: boolean, required
- digitalPrescriptionConsent: boolean, required

### Onboarding Step 4
- clinicAddress: string, required
- city: string, required
- state: string, required
- country: string, required

## Error Handling

All errors follow this format:
```json
{
  "status": "fail",
  "error": "error message"
}
```

Success responses:
```json
{
  "status": "success",
  "message": "description",
  "data": { ... }
}
```

## Next Steps (Future Work)

- [ ] Add S3 document upload integration
- [ ] Add admin approval workflow
- [ ] Add GET endpoint for onboarding status
- [ ] Add document validation
- [ ] Add notification system
- [ ] Write comprehensive tests
- [ ] Add rate limiting for signup

## Dependencies

- bcrypt (password hashing)
- uuid (cookie IDs)
- ajv (validation)
- mongoose (MongoDB)
- jose (JWT)

All already available in `package.json`
