# ONYX HEALTH+ — RAZORPAY UPI QR & PRODUCTION DOMAIN WHITELISTING SPECIFICATION

**Document Version:** 1.0  
**Target Teams:** Backend Engineering, DevOps, and Payment Gateway Operations  
**Affected Service:** Razorpay Checkout Integration for Telehealth Consultations & Appointments  

---

## 1. Issue Description

### Observed Behavior
1. **On Localhost (`http://localhost:8080`)**:
   - The user opens Razorpay Checkout.
   - The user scans the dynamic UPI QR code on their mobile UPI app (GPay, PhonePe, Paytm).
   - The payment succeeds, and the Razorpay modal in the desktop browser immediately receives the callback handler (`handler(response)`), confirms the booking via `POST /api/booking/confirm`, and transitions directly into the live consultation room.
2. **On Production Domain (`https://onyx-patient-flow.vercel.app`)**:
   - The user opens Razorpay Checkout.
   - The user scans the UPI QR code and authorizes payment from their phone.
   - **Money is debited from user's bank account**, but the Razorpay window in the browser does not respond, does not close, and does not fire the `handler()` callback.
   - The consultation remains unconfirmed and in a pending state until manual intervention.

---

## 2. Root Cause Analysis

### A. Razorpay Dashboard Allowed Domains (Live Key Security Restrictions)
For security and fraud prevention in Razorpay Live Mode (`rzp_live_...`), Razorpay restricts checkout API calls and WebSocket payment polling to explicitly whitelisted web domains.
- If requests originate from an unwhitelisted domain (such as `https://onyx-patient-flow.vercel.app`), Razorpay blocks real-time WebSocket polling between the desktop browser and Razorpay's payment router.

### B. Server-Side Webhook Listener Missing or Misconfigured
When a user pays via UPI QR on a mobile device, the desktop browser relies on a long-poll/socket connection. If that socket is interrupted, throttled by the browser, or blocked by domain rules, **the only authoritative fallback is Razorpay's Server-to-Server Webhook**.
- If Razorpay does not send (or the backend does not listen to) `payment.captured` or `order.paid` webhooks, the backend never updates the booking status to `confirmed`.

---

## 3. Required Action Items for Backend & DevOps

### Step 1: Whitelist Production Domains in Razorpay Dashboard

1. Log in to the [Razorpay Dashboard](https://dashboard.razorpay.com/) in **Live Mode**.
2. Navigate to **Account & Settings** (gear icon) → **Website and App Settings**.
3. Under **Whitelisted Domains / Allowed Origins**, add the following domains:
   - `https://onyx-patient-flow.vercel.app`
   - `https://patient.onyxhealthplus.com` (if custom domain is active)
   - `https://onyx-health-flow.vercel.app`
   - `https://doctor.onyxhealthplus.com` (if custom domain is active)
   - `http://localhost:8080`
   - `http://localhost:8081`
4. Click **Save Changes**.

---

### Step 2: Configure Server-to-Server Webhook in Razorpay

To ensure 100% payment reliability even if the user closes their browser or the socket disconnects:

1. In the Razorpay Dashboard, navigate to **Account & Settings** → **Webhooks**.
2. Click **Add New Webhook**.
3. Set **Webhook URL**:
   ```
   https://dev-api.onyxhealthplus.com/api/payment/webhook
   ```
   *(or your active production backend webhook URL)*
4. Set a strong **Secret**: e.g., `onyx_razorpay_webhook_secret_2026`
5. Select the following **Active Events**:
   - `order.paid`
   - `payment.captured`
   - `payment.failed`
6. Save the webhook and store the secret in the backend environment variables:
   ```env
   RAZORPAY_WEBHOOK_SECRET="onyx_razorpay_webhook_secret_2026"
   ```

---

### Step 3: Implement Backend Webhook Verification Handler

The backend must listen for incoming POST requests to `/api/payment/webhook` and verify the cryptographic signature:

#### Node.js / Express Example:

```javascript
const crypto = require("crypto");
const { confirmBookingInternal } = require("./booking.controller");

// IMPORTANT: Webhook endpoint MUST use express.raw({ type: 'application/json' }) 
// to compute signature over exact raw request body bytes.
app.post(
  "/api/payment/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const signature = req.headers["x-razorpay-signature"];
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

      const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(req.body) // raw buffer
        .digest("hex");

      if (signature !== expectedSignature) {
        console.error("[Razorpay Webhook] Invalid signature");
        return res.status(400).json({ error: "Invalid signature" });
      }

      const event = JSON.parse(req.body.toString("utf8"));
      console.log("[Razorpay Webhook] Received Event:", event.event);

      if (event.event === "payment.captured" || event.event === "order.paid") {
        const paymentEntity = event.payload.payment.entity;
        const orderId = paymentEntity.order_id;
        const paymentId = paymentEntity.id;
        const bookingId = paymentEntity.notes?.bookingId;

        console.log(`[Razorpay Webhook] Payment verified for Booking ${bookingId}, Order ${orderId}`);

        // Update booking status in database to 'confirmed'
        if (bookingId) {
          await confirmBookingInternal({
            bookingId,
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId,
            status: "confirmed"
          });
        }
      }

      return res.status(200).json({ status: "ok" });
    } catch (err) {
      console.error("[Razorpay Webhook] Processing error:", err);
      return res.status(500).json({ error: "Webhook internal failure" });
    }
  }
);
```

---

### Step 4: Ensure `notes` are Attached in `POST /api/booking/create`

When the backend generates the Razorpay order using `razorpay.orders.create(...)`, ensure the `bookingId` is passed in `notes`:

```javascript
const order = await razorpay.orders.create({
  amount: Math.round(amountInINR * 100), // in paise (e.g. 100 INR = 10000)
  currency: "INR",
  receipt: `rcpt_${booking._id.toString().slice(-10)}`,
  notes: {
    bookingId: booking._id.toString(),
    userId: user._id.toString(),
    type: "instant_consultation"
  }
});
```

---

## 4. Verification & Testing Procedure

1. **Verify Live Domain Whitelist**:
   - Open Chrome DevTools on `https://onyx-patient-flow.vercel.app/dashboard/user/consultations`.
   - Initiate instant consultation and trigger Razorpay.
   - Inspect the Network tab for any blocked requests to `api.razorpay.com` (status 403 / CORS errors).
2. **Scan & Pay**:
   - Scan dynamic QR on mobile device.
   - Verify that payment registers in Razorpay Dashboard under **Live Transactions**.
   - Verify that webhook logs show `200 OK` from `dev-api.onyxhealthplus.com/api/payment/webhook`.
   - The patient browser modal should automatically receive the capture and transition into the consultation room.
