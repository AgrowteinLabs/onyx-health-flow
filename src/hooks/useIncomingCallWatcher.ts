import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { listBookings } from "@/services/booking.service";
import { startRingtone, stopRingtone } from "@/utils/ringtone";
import { IncomingCallData } from "@/components/dashboard/IncomingCallModal";
import { apiRequest } from "@/lib/api-request";
import { API_ENDPOINTS } from "@/lib/api-config";

export function useIncomingCallWatcher() {
  const location = useLocation();
  const [activeCall, setActiveCall] = useState<IncomingCallData | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const dismissedCallsRef = useRef<Set<string>>(new Set());
  const originalTitleRef = useRef<string>(document.title);

  // Toggle ringtone mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) {
        stopRingtone();
      } else if (activeCall) {
        startRingtone();
      }
      return next;
    });
  }, [activeCall]);

  const dismissCall = useCallback((bookingId: string) => {
    dismissedCallsRef.current.add(bookingId);
    stopRingtone();
    setActiveCall(null);
    document.title = originalTitleRef.current;
  }, []);

  const acceptCall = useCallback((call: IncomingCallData) => {
    dismissedCallsRef.current.add(call.bookingId);
    stopRingtone();
    setActiveCall(null);
    document.title = originalTitleRef.current;
  }, []);

  const checkForIncomingCalls = useCallback(async () => {
    // If user is already on the video consultation page, don't trigger the modal
    if (location.pathname.includes("/dashboard/doctor/consultations")) {
      if (activeCall) {
        stopRingtone();
        setActiveCall(null);
      }
      return;
    }

    try {
      const res = await listBookings().catch(() => null);
      const bookings = Array.isArray(res)
        ? res
        : res?.bookings || res?.data || [];

      if (!bookings || bookings.length === 0) {
        if (activeCall) {
          stopRingtone();
          setActiveCall(null);
          document.title = originalTitleRef.current;
        }
        return;
      }

      // Find any booking that is actively in progress or calling
      const ringingBooking = bookings.find((b: any) => {
        const status = (b.status || "").toLowerCase();
        const isInstantActive =
          b.type === "instant" &&
          (status === "confirmed" ||
            status === "in_consultation" ||
            status === "in_progress" ||
            status === "active" ||
            status === "calling" ||
            status === "pending");

        const isCallingOrActive =
          status === "in_consultation" ||
          status === "in_progress" ||
          status === "active" ||
          status === "calling" ||
          status === "in progress" ||
          isInstantActive ||
          b.isCalling === true;

        return isCallingOrActive && !dismissedCallsRef.current.has(b._id || b.id);
      });

      if (ringingBooking) {
        const id = ringingBooking._id || ringingBooking.id;
        const patientName =
          ringingBooking.profileId?.name ||
          ringingBooking.userId?.name ||
          ringingBooking.patientName ||
          "Patient in Queue";

        const callData: IncomingCallData = {
          bookingId: id,
          patientName,
          reason: ringingBooking.reason || ringingBooking.condition || "Telehealth Video Consultation",
          time: ringingBooking.slot || "Now",
          avatar: patientName
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
        };

        setActiveCall(callData);

        if (!isMuted) {
          startRingtone();
        }

        document.title = `(📞 INCOMING CALL) ${originalTitleRef.current}`;
      } else if (activeCall) {
        // Call ended or cancelled
        stopRingtone();
        setActiveCall(null);
        document.title = originalTitleRef.current;
      }
    } catch (err) {
      console.debug("Incoming call watcher poll note:", err);
    }
  }, [location.pathname, activeCall, isMuted]);

  // WebSocket presence connection for instant incoming call alerts
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let pingInterval: any = null;

    const connectWebSocket = () => {
      const token = localStorage.getItem("authToken");
      if (!token) {
        console.debug("WS: No authToken found in localStorage, postponing connection");
        return;
      }

      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://dev-api.onyxhealthplus.com";
        const wsProtocol = backendUrl.startsWith("https") ? "wss:" : "ws:";
        const wsHost = backendUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
        const wsUrl = `${wsProtocol}//${wsHost}/ws/presence`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          // Identify as doctor with access token (security requirement)
          ws?.send(
            JSON.stringify({
              type: "identify",
              role: "doctor",
              token,
            })
          );

          // Heartbeat ping every 25 seconds
          if (pingInterval) clearInterval(pingInterval);
          pingInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ping" }));
            }
          }, 25000);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const eventType = data.type || data.event;

            if (eventType === "pong" || eventType === "identified") {
              return;
            }

            if (
              eventType === "consultation:incoming" ||
              eventType === "booking:created" ||
              eventType === "booking:scheduled" ||
              eventType === "booking:confirmed"
            ) {
              window.dispatchEvent(new CustomEvent("onyx:refresh_dashboard", { detail: data }));
              const payload = data.payload || data;
              const bookingId = payload.bookingId || data.bookingId;

              if (bookingId && !dismissedCallsRef.current.has(bookingId)) {
                const patientName = payload.patientName || data.patientName || "Incoming Patient";
                const callData: IncomingCallData = {
                  bookingId,
                  patientName,
                  reason: payload.reason || "Instant Telehealth Consultation",
                  time: "Now",
                  avatar: patientName.slice(0, 2).toUpperCase(),
                };

                setActiveCall(callData);
                if (!isMuted) {
                  startRingtone();
                }
                document.title = `(📞 INCOMING CALL) ${originalTitleRef.current}`;
              }
            } else if (eventType === "consultation:ended") {
              // Server broadcast: Consultation completed or rejected
              const payload = data.payload || data;
              const bId = payload.bookingId || data.bookingId;
              if (bId) {
                dismissCall(bId);
              } else {
                stopRingtone();
                setActiveCall(null);
              }
              window.dispatchEvent(new CustomEvent("onyx:refresh_dashboard", { detail: data }));
            } else if (eventType === "booking:status") {
              // Any status change: payment confirmed, doctor-create, admit, postpone, reject, complete, expire
              window.dispatchEvent(new CustomEvent("onyx:refresh_dashboard", { detail: data }));
              window.dispatchEvent(new CustomEvent("onyx:booking_status", { detail: data }));

              const payload = data.payload || data;
              const status = (payload.status || "").toLowerCase();
              if (
                status === "completed" ||
                status === "cancelled" ||
                status === "expired" ||
                status === "rejected"
              ) {
                if (payload.bookingId && activeCall?.bookingId === payload.bookingId) {
                  dismissCall(payload.bookingId);
                }
              }
            } else if (eventType === "ticket:updated" || eventType === "payout:hold_updated") {
              window.dispatchEvent(new CustomEvent("onyx:refresh_dashboard"));
            }
          } catch (e) {
            console.debug("WS message parse error:", e);
          }
        };

        ws.onerror = () => {
          // Fallback to polling silently
        };

        ws.onclose = async (closeEvent) => {
          if (pingInterval) clearInterval(pingInterval);
          // If code is 4401 (unauthorized / invalid token), refresh token before reconnecting
          if (closeEvent.code === 4401) {
            console.warn("WS 4401 unauthorized. Attempting token refresh...");
            try {
              const res = await apiRequest(API_ENDPOINTS.AUTH.ISSUE_TOKEN, { method: "GET" }).catch(() => null);
              if (res?.token || res?.accessToken) {
                localStorage.setItem("authToken", res.token || res.accessToken);
              }
            } catch (err) {
              console.debug("Token refresh on WS 4401 failed:", err);
            }
          }

          // Auto-reconnect after 5 seconds
          reconnectTimeout = setTimeout(connectWebSocket, 5000);
        };
      } catch (err) {
        console.debug("WS presence setup note:", err);
      }
    };

    connectWebSocket();

    return () => {
      if (pingInterval) clearInterval(pingInterval);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [isMuted, dismissCall, activeCall]);

  useEffect(() => {
    const origTitle = originalTitleRef.current;
    checkForIncomingCalls();

    // 15s gentle polling interval as recommended by backend handoff
    const interval = setInterval(checkForIncomingCalls, 15000);

    return () => {
      clearInterval(interval);
      stopRingtone();
      document.title = origTitle;
    };
  }, [checkForIncomingCalls]);

  return {
    activeCall,
    dismissCall,
    acceptCall,
    isMuted,
    toggleMute,
  };
}
