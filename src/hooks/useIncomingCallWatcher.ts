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
        const isCallingOrActive =
          status === "in_progress" ||
          status === "active" ||
          status === "calling" ||
          status === "in progress" ||
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
