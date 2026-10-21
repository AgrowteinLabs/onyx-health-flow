import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { listBookings } from "@/services/booking.service";
import { startRingtone, stopRingtone } from "@/utils/ringtone";
import { IncomingCallData } from "@/components/dashboard/IncomingCallModal";

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
          (status === "confirmed" || status === "in_progress" || status === "active" || status === "calling" || status === "pending");

        const isCallingOrActive =
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
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWebSocket = () => {
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://dev-api.onyxhealthplus.com";
        const wsProtocol = backendUrl.startsWith("https") ? "wss:" : "ws:";
        const wsHost = backendUrl.replace(/^https?:\/\//, "");
        const wsUrl = `${wsProtocol}//${wsHost}/ws/presence`;

        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          // Identify as doctor upon connection
          ws?.send(
            JSON.stringify({
              type: "identify",
              role: "doctor",
              userId,
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const eventType = data.type || data.event;

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
            } else if (eventType === "ticket:updated" || eventType === "payout:hold_updated") {
              // Trigger a background refresh of dashboard data
              window.dispatchEvent(new CustomEvent("onyx:refresh_dashboard"));
            }
          } catch (e) {
            console.debug("WS incoming call parse error:", e);
          }
        };

        ws.onerror = () => {
          // Fallback to polling silently
        };

        ws.onclose = () => {
          // Auto-reconnect after 5 seconds
          reconnectTimeout = setTimeout(connectWebSocket, 5000);
        };
      } catch (err) {
        console.debug("WS presence setup note:", err);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [isMuted]);

  useEffect(() => {
    const origTitle = originalTitleRef.current;
    checkForIncomingCalls();

    const interval = setInterval(checkForIncomingCalls, 8000);

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
