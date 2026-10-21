import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Video,
  PhoneOff,
  Volume2,
  VolumeX,
  User,
  HeartPulse,
  Sparkles,
} from "lucide-react";
import { stopRingtone } from "@/utils/ringtone";

export interface IncomingCallData {
  bookingId: string;
  patientName: string;
  reason?: string;
  time?: string;
  avatar?: string;
}

interface IncomingCallModalProps {
  call: IncomingCallData | null;
  onAccept: (call: IncomingCallData) => void;
  onDismiss: (bookingId: string) => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const IncomingCallModal = ({
  call,
  onAccept,
  onDismiss,
  isMuted,
  onToggleMute,
}: IncomingCallModalProps) => {
  const navigate = useNavigate();

  useEffect(() => {
    // When unmounted or call cleared, stop ringtone
    return () => {
      stopRingtone();
    };
  }, []);

  if (!call) return null;

  const handleAccept = () => {
    stopRingtone();
    onAccept(call);
    navigate(`/dashboard/doctor/consultations?bookingId=${call.bookingId}&autoJoin=true`, {
      state: {
        bookingId: call.bookingId,
        patient: call.patientName,
        autoJoin: true,
      },
    });
  };

  const handleDismiss = () => {
    stopRingtone();
    onDismiss(call.bookingId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md bg-white/95 backdrop-blur-xl rounded-[28px] border-2 border-emerald-400/80 shadow-2xl p-6 overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-[#F2052C]/15 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Badge & Mute Toggle */}
        <div className="flex items-center justify-between mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider">
              Incoming Consultation Call
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMute}
            className="h-8 w-8 rounded-full text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            title={isMuted ? "Unmute ringtone" : "Mute ringtone"}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4 text-slate-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-600 animate-pulse" />
            )}
          </Button>
        </div>

        {/* Patient Profile & Ringing Wave */}
        <div className="flex flex-col items-center text-center my-4">
          <div className="relative mb-4">
            {/* Animated sonar ring waves */}
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping pointer-events-none" />
            <div className="absolute -inset-2 rounded-full border-2 border-emerald-400/40 animate-pulse pointer-events-none" />

            <div className="relative h-20 w-20 rounded-[22px] bg-gradient-to-br from-[#14213D] via-[#1E3A8A] to-[#35B7C9] text-white flex items-center justify-center font-black text-2xl shadow-xl shadow-emerald-500/20">
              {call.avatar ||
                call.patientName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() ||
                "PT"}
            </div>
          </div>

          <h3 className="text-xl font-black text-[#14213D] tracking-tight">
            {call.patientName}
          </h3>

          <p className="text-xs font-semibold text-slate-500 mt-1 max-w-[280px]">
            {call.reason || "Telehealth Consultation"}
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-bold">
            <HeartPulse className="h-3.5 w-3.5 text-[#F2052C]" />
            Patient is waiting in room: <span className="font-mono text-slate-800">room-{call.bookingId.slice(-6)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-slate-100">
          <Button
            variant="outline"
            onClick={handleDismiss}
            className="h-12 rounded-[16px] border-slate-200 text-slate-600 font-bold hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center gap-2"
          >
            <PhoneOff className="h-4 w-4 text-slate-500" /> Dismiss
          </Button>

          <Button
            onClick={handleAccept}
            className="h-12 rounded-[16px] bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 text-sm border-none transition-transform hover:scale-[1.02]"
          >
            <Video className="h-4 w-4" /> Accept & Join
          </Button>
        </div>
      </div>
    </div>
  );
};
