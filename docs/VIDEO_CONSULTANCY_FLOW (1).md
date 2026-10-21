# Onyx Video Consultancy Flow

This document outlines the entire end-to-end process of how a Patient and Doctor connect via video call on the Onyx platform.

## 1. The Booking Phase
1. **Patient Searches for a Doctor:** The patient browses doctors on the platform and selects an available slot.
2. **Booking Creation:** The patient initiates a booking (either `instant` or `scheduled`).
3. **Payment:** The patient pays for the consultancy (e.g., via Razorpay).
4. **Confirmation:** Once payment is captured, the backend updates the Booking `status` to `"confirmed"`.
5. **Room Generation:** Crucially, during this confirmation step, a unique `roomName` is generated and saved to the booking record (e.g., `room-54321-abcde`).

## 2. The Pre-Call Phase (Joining the Call)
When the time for the appointment arrives, both the Patient and the Doctor will click a "Join Call" button on their respective devices.

1. **Client Request:** The frontend (Patient app or Doctor portal) sends a `GET` request to `/api/video/token/:bookingId`.
   * *The request must include the user's valid JWT in the Authorization header.*
2. **Backend Validation:** The `video-controller.js` checks:
   * Does the booking exist?
   * Is the user requesting the token EITHER the Patient (`userId`) OR the Doctor (`doctorId`) associated with this booking?
   * Is the booking `status` set to `"confirmed"`?
   * Does the booking have a valid `roomName`?
3. **Token Generation:** If all checks pass, the backend uses the `AGORA_APP_ID` and `AGORA_APP_CERTIFICATE` to securely generate a temporary RTC Token using the `agora-token` library.
4. **Response:** The backend returns the `token`, the `channelName` (which is the `roomName`), and the `appId` to the frontend.

## 3. The Call Phase (Agora SDK)
1. **Initialization:** The frontend initializes the Agora Web/Mobile SDK using the `appId`.
2. **Joining the Channel:** The frontend calls the SDK's join method passing the `token` and `channelName` received from the backend.
3. **Publishing Tracks:** Both the Patient and Doctor publish their local audio and video tracks to the channel.
4. **Subscribing:** As soon as one party joins, the other party subscribes to their tracks, and the two-way video/audio connection is established.

## 4. Post-Call Phase
1. **Ending the Call:** When the call is finished, users leave the channel via the SDK.
2. **Status Update:** The frontend (or backend via webhooks/cron) can update the booking status to `"completed"`.
