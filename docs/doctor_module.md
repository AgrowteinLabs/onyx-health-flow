Doctor Module – Functional & Technical Specification
1. Overview
This document describes the new Doctor Module to be implemented in the existing system. The module enables doctors to register, upload onboarding documents, manage availability, handle consultations, receive payments automatically, and interact with patients via video consultation. The entire timeline for development is 3 weeks.
2. Key Actors
Admin: Creates doctor profiles, verifies documents, approves/rejects doctors, handles tickets.
Doctor: Completes onboarding, sets availability, attends consultations, receives payments.
User/Patient: Searches doctors, books consultations, makes payments, raises tickets.
3. Module Flow Summary
1. Admin creates a doctor in user schema.
2. Doctor logs in.
3. Doctor completes onboarding (4 steps with document uploads).
4. The doctor sets weekly availability.
5. Admin reviews and approves/rejects doctors.
6. User searches doctor & views consultancy fee.
7. User starts payment → payment window opens (countdown).
8. Payment accepted → booking created (scheduled or instant video call).
9. Consultation occurs via video platform.
10. Users may raise tickets if they face any issues with the meeting.
11. If ticket raised → doctor payout held.
12. Admin resolves ticket (refund to user or payout to doctor).
4. Doctor Onboarding (4-Step Document Upload)
Each onboarding step includes form fields and mandatory document uploads:
1. Personal Details + ID Upload
2. Education Details + Certificates Upload
3. Medical Registration Documents Upload
4. Bank Details + Cancelled Cheque Upload
All documents stored in S3; validation handled in the backend.
5. Doctor Availability Management
Doctors can set availability in a weekly recurring pattern:
- Select available days (Mon–Sun)
- Define time slots per day (e.g., 9 AM – 12 PM, 2 PM – 5 PM)
- Real-time online/offline status via WebSockets
- Used by users when booking consultations
If the doctor is online → instant meeting option becomes available.
6. Doctor Approval Workflow
- Admin reviews onboarding documents.
- Admin approves or rejects doctors.
- Only approved doctors are visible to users.
7. User Doctor Selection & Fee Display
User can filter doctors by:
- Specialization
- Available dates & time
- Languages
- Ratings
Selected doctor’s consultancy fee fetched from doctor profile.
8. Payment & Booking Window System
When user clicks “Proceed to Pay”:
- A special payment window opens with a **countdown timer (expiry)**.
- The user must complete payment before the timer ends.
- Similar to vending machine workflows.
- Payment received in the Main Merchant Account.

If payment succeeds:
- System evaluates if instant or scheduled call.
- Booking created accordingly.
9. Instant Meeting Flow
Works only if doctor is online and free:
1. The user completes payment.
2. The doctor receives an instant-call request.
3. Video call room generated.
4. Automatic refund if the doctor doesn’t join.
10. Scheduled Meeting Flow
If doctor offline or busy:
1. The user selects date & time from weekly availability.
2. After payment, booking was created.
3. The doctor approves/rejects the scheduled meeting. Refunds will be initiated if rejected.
4. Video call initiates at scheduled time.
11. Ticket Raising Mechanism (User)
Users may raise a ticket if:
- Doctor didn’t join meeting
- Poor experience
- Miscommunication

When a ticket is raised:
- Doctor payout is put **on hold**.
- Admin reviews tickets.
12. Refund / Payout Decision Logic (Admin)
Admin can take two actions:
-Refund to User → Doctor does not receive the amount.
-Release Payout to Doctor → Doctor gets consultation fee after deducting platform commission.
13. Video Call Technology Recommendation
Recommended platform: Agora.io
Reasons:
- Easy Node.js SDK integration
- Flutter & React support
- High-quality video calling
- Low latency
14. Payment Architecture (Razorpay Partner Model)
- The main merchant receives payment from the user.
- Doctor is treated as a linked account.
- After consultation:
   - If no ticket → transfer money to doctor minus commission.
   - If ticket → hold payment until the admin resolves.
15. Tech Stack
- Backend: Node.js, Express, MongoDB
- Frontend: React (web), Flutter (mobile)
- Storage: AWS S3
- Video Calls: Agora.io
- Payment: Razorpay Partner + Transfers API
- Real-time: Socket.io
16. API List Summary
- Doctor onboarding APIs (4)
- Availability set/get API
- Admin approve/reject API
- User doctor listing + filters
- Payment initiation API
- Booking creation
- Ticket creation API
- Ticket resolution API
17. 3-Week Timeline
Week 1:
- Doctor onboarding (backend + frontend)
- S3 upload integration
- Admin approval workflow

Week 2:
- Availability module
- User doctor search filters
- Payment window system
- Instant & scheduled booking logic

Week 3:
- Video call integration
- Ticket & refund system
- Razorpay transfers
- Final testing & deployment.
18. Conclusion
This module will provide a seamless, automated, and secure doctor consultation system covering onboarding, availability, real-time video sessions, automated payouts, and dispute handling.
