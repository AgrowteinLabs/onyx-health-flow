# ONYX HEALTH+ — FLUTTER INTEGRATION GUIDE
## Seamless Zero-Login Online Consultation Handover

**Document Version:** 1.0  
**Target Audience:** Flutter Mobile App Developers (`onyx-patient-app` / Kiosk App)  
**Objective:** Enable patients to tap **"Start Online Consultation"** from the Screening Results screen and land directly in the Video Consultation Room on the web with **ZERO login prompts**, passing their screening vitals automatically to the doctor.

---

## 1. How It Works (30-Second Summary)

```
[Screening Results Screen in Flutter]
                │
                │ User taps "Start Online Consultation"
                ▼
  POST /api/auth/consultation-handshake
  (Flutter sends user JWT + reportId)
                │
                │ Backend returns { redirectUrl: "https://patient.onyxhealthplus.com/handover?ticket=tkt_..." }
                ▼
  Launch In-App Browser (Chrome Custom Tabs / Safari View Controller)
                │
                │ Web automatically consumes ticket, sets session & launches Agora Video Room
                ▼
[Doctor & Patient in Video Call with Live Screening Vitals!]
```

---

## 2. Dependencies (`pubspec.yaml`)

Add or ensure the following packages are in your Flutter `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter

  # For API network calls
  http: ^1.2.0 # or dio: ^5.4.0

  # For launching in-app web browser
  url_launcher: ^6.3.0
```

Run:
```bash
flutter pub get
```

---

## 3. Native Device Configurations (Permissions for WebRTC Video)

Because the web session includes a live video call via Agora, the mobile in-app browser must have permission to access the camera and microphone.

### 3.1 Android Configuration (`android/app/src/main/AndroidManifest.xml`)

Add the camera and microphone permissions and the `<queries>` block inside `<manifest>`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Permissions required for Agora WebRTC in In-App Browser -->
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />

    <!-- Queries tag required for Android 11+ (API 30+) to launch web browser -->
    <queries>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="https" />
        </intent>
    </queries>

    <application ...>
        ...
    </application>
</manifest>
```

---

### 3.2 iOS Configuration (`ios/Runner/Info.plist`)

Add camera and microphone privacy keys inside the `<dict>` block:

```xml
<key>NSCameraUsageDescription</key>
<string>Onyx Health requires camera access for doctor video consultations.</string>

<key>NSMicrophoneUsageDescription</key>
<string>Onyx Health requires microphone access for doctor video consultations.</string>

<!-- Allow launching https links -->
<key>LSApplicationQueriesSchemes</key>
<array>
    <string>https</string>
</array>
```

---

## 4. Complete Dart Implementation

### 4.1 Data Model: `lib/models/handshake_response.dart`

```dart
class HandshakeResponse {
  final String status;
  final String ticket;
  final String redirectUrl;
  final int expiresInSeconds;

  HandshakeResponse({
    required this.status,
    required this.ticket,
    required this.redirectUrl,
    required this.expiresInSeconds,
  });

  factory HandshakeResponse.fromJson(Map<String, dynamic> json) {
    return HandshakeResponse(
      status: json['status'] ?? 'fail',
      ticket: json['ticket'] ?? '',
      redirectUrl: json['redirectUrl'] ?? '',
      expiresInSeconds: json['expiresInSeconds'] ?? 120,
    );
  }
}
```

---

### 4.2 Service Class: `lib/services/telehealth_service.dart`

```dart
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import '../models/handshake_response.dart';

class TelehealthService {
  // Use your environment-specific backend base URL
  static const String _baseUrl = 'https://dev-api.onyxhealthplus.com';

  /// Request single-use handshake ticket and launch consultation URL
  static Future<bool> startSeamlessConsultation({
    required String userJwtToken,
    required String reportId,
    String? profileId,
    String? doctorId,
    String? bookingId,
  }) async {
    final endpoint = Uri.parse('$_baseUrl/api/auth/consultation-handshake');

    try {
      final response = await http.post(
        endpoint,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $userJwtToken',
        },
        body: jsonEncode({
          'reportId': reportId,
          if (profileId != null) 'profileId': profileId,
          if (doctorId != null) 'doctorId': doctorId,
          if (bookingId != null) 'bookingId': bookingId,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final handshake = HandshakeResponse.fromJson(data);

        if (handshake.redirectUrl.isNotEmpty) {
          final uri = Uri.parse(handshake.redirectUrl);

          // Launch in Chrome Custom Tabs (Android) or Safari In-App View (iOS)
          // This keeps the user within the app experience!
          final launched = await launchUrl(
            uri,
            mode: LaunchMode.inAppBrowserView, // Important for camera/mic support & in-app UX
          );

          return launched;
        }
      } else {
        if (kDebugMode) {
          print('Handshake failed [${response.statusCode}]: ${response.body}');
        }
      }
      return false;
    } catch (e) {
      if (kDebugMode) {
        print('Exception during consultation handshake: $e');
      }
      return false;
    }
  }
}
```

---

### 4.3 UI Button Widget: `lib/widgets/online_consultation_button.dart`

```dart
import 'package:flutter/material.dart';
import '../services/telehealth_service.dart';

class OnlineConsultationButton extends StatefulWidget {
  final String userJwtToken;
  final String reportId;
  final String? profileId;
  final String? doctorId;

  const OnlineConsultationButton({
    super.key,
    required this.userJwtToken,
    required this.reportId,
    this.profileId,
    this.doctorId,
  });

  @override
  State<OnlineConsultationButton> createState() => _OnlineConsultationButtonState();
}

class _OnlineConsultationButtonState extends State<OnlineConsultationButton> {
  bool _isLoading = false;

  Future<void> _handleStartConsultation() async {
    setState(() => _isLoading = true);

    final success = await TelehealthService.startSeamlessConsultation(
      userJwtToken: widget.userJwtToken,
      reportId: widget.reportId,
      profileId: widget.profileId,
      doctorId: widget.doctorId,
    );

    if (mounted) {
      setState(() => _isLoading = false);

      if (!success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Could not start consultation. Please check your internet connection.'),
            backgroundColor: Color(0xFFF2052C),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 52,
      child: ElevatedButton(
        onPressed: _isLoading ? null : _handleStartConsultation,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFFF2052C), // Onyx Brand Red
          foregroundColor: Colors.white,
          elevation: 2,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
        child: _isLoading
            ? const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2.5,
                    ),
                  ),
                  SizedBox(width: 12),
                  Text(
                    'Connecting to Doctor...',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                ],
              )
            : const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.video_call_rounded, size: 24),
                  SizedBox(width: 8),
                  Text(
                    'Consult a Doctor Online',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
      ),
    );
  }
}
```

---

## 5. Usage in the Screening Results Screen

In your screening results view (`screening_results_screen.dart`):

```dart
// Place this button right beneath the vitals summary card
OnlineConsultationButton(
  userJwtToken: currentUserToken, // The existing JWT stored in your Auth Provider/SecureStorage
  reportId: screeningReport.id,   // MongoDB ID of the generated screening report
  profileId: patientProfile.id,   // Optional: Patient Profile ID
)
```

---

## 6. What Happens on the Web When Launched

When `launchUrl(..., mode: LaunchMode.inAppBrowserView)` opens:
1. The web app detects `?ticket=tkt_...`.
2. The web app calls `POST /api/auth/consume-handshake`.
3. The backend issues a web JWT session and destroys the ticket.
4. The patient is **automatically logged in** and placed into the consultation room.
5. The doctor's dashboard displays the patient's **Blood Pressure, Heart Rate, SpO2, and Temperature** directly inside the call's **Telemetry Drawer**!
6. When the call ends, the patient closes the browser view and returns seamlessly to the Flutter app.

---

## 7. QA Testing Checklist for Flutter Developers

- [ ] **Happy Path:** Tap "Consult a Doctor Online" with valid internet $\rightarrow$ In-app browser opens and lands on the consultation page without asking for phone/password.
- [ ] **Camera/Mic Permission:** When the video page loads, the browser prompts for camera/mic permissions and video streams successfully.
- [ ] **Close Browser:** Tapping the "X" on Chrome Custom Tabs or Safari View Controller returns smoothly to the screening results screen without app crash or freezing.
- [ ] **Offline Handling:** Tap button with Wi-Fi off $\rightarrow$ Shows red error SnackBar without crashing.
- [ ] **No Replay Attack:** Even if someone copies the URL with `?ticket=...`, refreshing or opening it again fails gracefully with an expired message.
