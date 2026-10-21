# Frontend: Demo mode, consultation without payment (TEMPORARY)

Status: temporary, for client demos on the **development backend only**.
Payment stays the default. Nothing changes unless the backend has
`APP_ENV=dev` **and** `DEMO_FREE_CONSULTATIONS=true`.

## What changes for the frontend

Only the response of `POST /api/booking/create` (same request body as today).

| | Normal (payment) | Demo mode |
|---|---|---|
| HTTP status | 201 | 201 |
| `demoPayment` | absent | `true` |
| `razorpayOrderId` | `order_xxx` | `null` |
| `booking.status` | `pending` | `confirmed` |
| `booking.paymentStatus` | `pending` | `captured` |
| `booking.channelName` / `roomName` | empty until paid | set immediately |

Demo response example:

```json
{
  "status": "success",
  "demoPayment": true,
  "razorpayOrderId": null,
  "amount": 50000,
  "currency": "INR",
  "booking": { "_id": "...", "status": "confirmed", "paymentStatus": "captured", "channelName": "room-<id>" }
}
```

## Required frontend branch

```ts
const res = await api.post("/api/booking/create", payload);

if (res.demoPayment === true) {
  // Skip Razorpay Checkout and POST /api/booking/confirm entirely.
  goToConsultation(res.booking);   // same waiting/join screen used after a paid booking
} else {
  openRazorpayCheckout(res);       // unchanged
}
```

Rules:
- Branch on `demoPayment === true`, not on environment or a build flag. The same
  build then works with payment on or off.
- Do **not** call `POST /api/booking/confirm` for demo bookings (there is no
  Razorpay signature; it would fail).
- The doctor gets the usual socket event (`consultation:incoming` for instant,
  `booking:scheduled` for scheduled). Agora token and join flow are unchanged.
- Hide or relabel the price/"Pay" UI if you want the demo to read as free. The
  `amount` field is still returned.

## Doctor list in demo mode

`GET /api/doctor/list` (user-facing list) normally returns only doctors with an
activated Razorpay linked account. In demo mode it returns all **approved**
doctors, and `createBooking` no longer requires the doctor's payment
onboarding. The doctor still needs `consultationFee > 0` (validation unchanged).

## Backend operator notes

Enable (dev only):
```env
APP_ENV=dev
DEMO_FREE_CONSULTATIONS=true
```

Rollback: set `DEMO_FREE_CONSULTATIONS=false` (or remove it) and restart the dev
service. Verify `POST /api/booking/create` returns a non-null `razorpayOrderId`
and no `demoPayment`. In `APP_ENV=prod` the flag has no effect.

Known limits (acceptable for demo): demo bookings have no Order/Payment/Transfer
records, so refunds and payout tickets do not apply to them.
