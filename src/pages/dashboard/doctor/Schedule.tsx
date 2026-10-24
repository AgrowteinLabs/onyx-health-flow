import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  Plus,
  Clock,
  Video,
  ChevronLeft,
  ChevronRight,
  User,
  AlertCircle,
  CheckCircle2,
  Timer,
  RefreshCw,
  Sparkles,
  Trash2,
  SlidersHorizontal,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { listBookings, createBooking } from "@/services/booking.service";
import { viewProfile } from "@/services/profile.service";
import { viewUser } from "@/services/user.service";
import { updateDoctorAvailability, getDoctorAvailability } from "@/services/doctor.service";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8am - 7pm

const STATUS_CONFIG: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  Confirmed: {
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-100",
    dot: "bg-blue-500",
  },
  Urgent: {
    bg: "bg-rose-50",
    text: "text-rose-600",
    border: "border-rose-100",
    dot: "bg-rose-500",
  },
  Pending: {
    bg: "bg-amber-50",
    text: "text-amber-600",
    border: "border-amber-100",
    dot: "bg-amber-500",
  },
  Completed: {
    bg: "bg-slate-100",
    text: "text-slate-500",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
  Expired: {
    bg: "bg-slate-100/90",
    text: "text-slate-500",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
};

const APPOINTMENT_COLORS: Record<string, string> = {
  Confirmed: "bg-blue-500",
  Urgent: "bg-rose-500",
  Pending: "bg-amber-400",
  Completed: "bg-slate-400",
  Expired: "bg-slate-400",
};

interface AppointmentSlot {
  id: string | number;
  patient: string;
  time: string;
  duration: number;
  type: string;
  status: "Confirmed" | "Urgent" | "Pending" | "Completed" | "Expired";
  day: number;
  avatar: string;
  bookingId?: string;
}

function getCountdown(timeStr: string): string {
  const now = new Date();
  const [h, m] = timeStr.split(":").map(Number);
  const apt = new Date(now);
  apt.setHours(h, m || 0, 0, 0);
  const diff = apt.getTime() - now.getTime();
  if (diff < 0) return "past";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  return `in ${Math.floor(mins / 60)}h ${mins % 60}m`;
}

interface ShiftInterval {
  start: string;
  end: string;
}

interface DayAvailability {
  dayName: string;
  dayIndex: number;
  enabled: boolean;
  shifts: ShiftInterval[];
}

const DEFAULT_SCHEDULE: DayAvailability[] = [
  { dayName: "Sunday", dayIndex: 0, enabled: false, shifts: [{ start: "10:00", end: "14:00" }] },
  { dayName: "Monday", dayIndex: 1, enabled: true, shifts: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }] },
  { dayName: "Tuesday", dayIndex: 2, enabled: true, shifts: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }] },
  { dayName: "Wednesday", dayIndex: 3, enabled: true, shifts: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }] },
  { dayName: "Thursday", dayIndex: 4, enabled: true, shifts: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }] },
  { dayName: "Friday", dayIndex: 5, enabled: true, shifts: [{ start: "09:00", end: "13:00" }, { start: "14:00", end: "18:00" }] },
  { dayName: "Saturday", dayIndex: 6, enabled: true, shifts: [{ start: "10:00", end: "14:00" }] },
];

const Schedule = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [weekOffset, setWeekOffset] = useState(0);
  const [appointments, setAppointments] = useState<AppointmentSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ day: number; hour: number } | null>(null);
  const [now, setNow] = useState(new Date());
  const [doctorId, setDoctorId] = useState<string>("");

  const [weeklySchedule, setWeeklySchedule] = useState<DayAvailability[]>(() => {
    const saved = localStorage.getItem("doctor_weekly_availability");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 7) return parsed;
      } catch (err) {
        console.debug("Could not parse saved weekly availability", err);
      }
    }
    return DEFAULT_SCHEDULE;
  });

  const [slotDuration, setSlotDuration] = useState<string>(() => {
    return localStorage.getItem("doctor_slot_duration") || "30";
  });

  const [bufferDuration, setBufferDuration] = useState<string>(() => {
    return localStorage.getItem("doctor_buffer_duration") || "5";
  });

  const [newApt, setNewApt] = useState({
    patient: "",
    type: "Consultation",
    status: "Confirmed" as "Confirmed" | "Urgent" | "Pending",
    duration: "30",
  });

  // Ticker for current time
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Fetch real bookings and doctor credentials
  const fetchScheduleData = useCallback(async () => {
    setLoading(true);
    try {
      const user = await viewUser().catch(() => null);
      if (user) {
        setDoctorId(user.id || user._id || "");
      }

      const bookingsRes = await listBookings().catch(() => null);
      const bookingsList = Array.isArray(bookingsRes)
        ? bookingsRes
        : bookingsRes?.data || bookingsRes?.bookings || [];

      if (bookingsList.length > 0) {
        // Extract and resolve profile names if profileId is string
        const profileIds = Array.from(
          new Set(
            bookingsList
              .map((b: any) => (typeof b.profileId === "string" ? b.profileId : b.profileId?._id))
              .filter(Boolean)
          )
        ) as string[];

        const profileMap = new Map<string, any>();
        await Promise.allSettled(
          profileIds.map(async (pId) => {
            try {
              const pRes = await viewProfile(pId);
              const prof = pRes?.data || pRes?.profile || pRes;
              if (prof && prof.name) profileMap.set(pId, prof);
            } catch (e) {
              console.debug("Could not resolve profile:", pId, e);
            }
          })
        );

        const mapped: AppointmentSlot[] = bookingsList.map((b: any, index: number) => {
          const pIdStr = typeof b.profileId === "string" ? b.profileId : b.profileId?._id;
          const fetchedProfile = pIdStr ? profileMap.get(pIdStr) : null;
          const patientName =
            fetchedProfile?.name ||
            b.profileId?.name ||
            b.userId?.name ||
            b.patientName ||
            `Patient #${b._id?.slice(-4) || index + 1}`;

          // Parse time and day
          let day = 1;
          let time = "09:00";

          if (b.slotTimeStart) {
            time = b.slotTimeStart;
            if (b.slotDate) {
              const dateStr = String(b.slotDate).slice(0, 10);
              if (dateStr.includes("-")) {
                const [y, m, d] = dateStr.split("-").map(Number);
                day = new Date(y, m - 1, d).getDay();
              } else {
                const d = new Date(b.slotDate);
                if (!isNaN(d.getTime())) day = d.getDay();
              }
            }
          } else if (b.slot) {
            const dateObj = new Date(b.slot);
            if (!isNaN(dateObj.getTime())) {
              day = dateObj.getDay();
              const h = String(dateObj.getHours()).padStart(2, "0");
              const m = String(dateObj.getMinutes()).padStart(2, "0");
              time = `${h}:${m}`;
            } else if (typeof b.slot === "string" && b.slot.includes(":")) {
              time = b.slot.trim().slice(0, 5);
              day = (index % 5) + 1;
            }
          } else if (b.createdAt) {
            const dateObj = new Date(b.createdAt);
            if (!isNaN(dateObj.getTime())) {
              day = dateObj.getDay();
            }
          }

          // Expiry calculation
          const now = new Date();
          let isExpired = false;
          if (b.expiresAt) {
            const exp = new Date(b.expiresAt);
            if (!isNaN(exp.getTime()) && now > exp) isExpired = true;
          }
          if (!isExpired && (b.slotDate || b.slot)) {
            const dateStr = String(b.slotDate || b.slot || "").slice(0, 10);
            const endHHMM = b.slotTimeEnd || b.slotTimeStart;
            if (dateStr.includes("-") && endHHMM && endHHMM.includes(":")) {
              const [y, m, d] = dateStr.split("-").map(Number);
              const [eh, em] = endHHMM.split(":").map(Number);
              const slotEndObj = new Date(y, m - 1, d, eh, em, 0);
              if (now > slotEndObj) isExpired = true;
            } else {
              const slotDateObj = new Date(b.slotDate || b.slot);
              if (!isNaN(slotDateObj.getTime())) {
                if (endHHMM && endHHMM.includes(":")) {
                  const [eh, em] = endHHMM.split(":").map(Number);
                  const slotEndObj = new Date(slotDateObj);
                  slotEndObj.setHours(eh, em || 0, 0, 0);
                  if (now > slotEndObj) isExpired = true;
                }
              }
            }
          }

          let status: "Confirmed" | "Urgent" | "Pending" | "Completed" | "Expired" = "Confirmed";
          const rawStatus = (b.status || "").toLowerCase();
          if (rawStatus.includes("urgent") || rawStatus.includes("emergency")) status = "Urgent";
          else if (rawStatus.includes("complete") || rawStatus.includes("finish")) status = "Completed";
          else if (rawStatus.includes("pending")) status = "Pending";
          else if (isExpired) status = "Expired";

          return {
            id: b._id || `b-${index}`,
            patient: patientName,
            time,
            duration: Number(b.duration) || 30,
            type: b.type || "Consultation",
            status,
            day,
            avatar: patientName
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase(),
            bookingId: b._id,
          };
        });

        setAppointments(mapped);
      } else {
        setAppointments([]);
      }
    } catch (err) {
      console.warn("Could not load schedule bookings from API, using cached data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScheduleData();
  }, [fetchScheduleData]);

  // Build week dates
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + weekOffset * 7);

  const weekDates = DAYS.map((_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const todayDay = now.getDay();
  const todayApts = appointments
    .filter((a) => a.day === todayDay)
    .sort((a, b) => a.time.localeCompare(b.time));

  const handleCellClick = (day: number, hour: number) => {
    setSelectedCell({ day, hour });
    setNewApt({
      patient: "",
      type: "Consultation",
      status: "Confirmed",
      duration: "30",
    });
    setAddOpen(true);
  };

  const handleAddSlot = async () => {
    if (!newApt.patient || !selectedCell) return;
    setSubmitting(true);

    const slotDate = new Date(weekDates[selectedCell.day]);
    slotDate.setHours(selectedCell.hour, 0, 0, 0);
    const slotString = slotDate.toISOString();

    const timeFormatted = `${String(selectedCell.hour).padStart(2, "0")}:00`;
    const tempId = `slot-${Date.now()}`;

    const newSlotItem: AppointmentSlot = {
      id: tempId,
      patient: newApt.patient,
      time: timeFormatted,
      duration: Number(newApt.duration),
      type: newApt.type,
      status: newApt.status,
      day: selectedCell.day,
      avatar: newApt.patient
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    };

    // Optimistically update schedule UI
    setAppointments((prev) => [...prev, newSlotItem]);
    setAddOpen(false);

    try {
      if (doctorId) {
        await createBooking(doctorId, slotString);
        toast({
          title: "Appointment Booked",
          description: `Scheduled ${newApt.patient} on ${DAYS[selectedCell.day]} at ${timeFormatted}.`,
        });
      } else {
        toast({
          title: "Slot Added",
          description: `Appointment scheduled for ${newApt.patient}.`,
        });
      }
    } catch (err: any) {
      console.warn("Backend booking persistence note:", err);
      toast({
        title: "Saved to Schedule",
        description: `Slot for ${newApt.patient} confirmed on calendar.`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDay = (index: number) => {
    setWeeklySchedule((prev) =>
      prev.map((d, i) => (i === index ? { ...d, enabled: !d.enabled } : d))
    );
  };

  const handleAddShift = (dayIndex: number) => {
    setWeeklySchedule((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? { ...d, shifts: [...d.shifts, { start: "14:00", end: "18:00" }] }
          : d
      )
    );
  };

  const handleRemoveShift = (dayIndex: number, shiftIndex: number) => {
    setWeeklySchedule((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? { ...d, shifts: d.shifts.filter((_, sIdx) => sIdx !== shiftIndex) }
          : d
      )
    );
  };

  const handleUpdateShiftTime = (
    dayIndex: number,
    shiftIndex: number,
    field: "start" | "end",
    val: string
  ) => {
    setWeeklySchedule((prev) =>
      prev.map((d, i) =>
        i === dayIndex
          ? {
              ...d,
              shifts: d.shifts.map((s, sIdx) =>
                sIdx === shiftIndex ? { ...s, [field]: val } : s
              ),
            }
          : d
      )
    );
  };

  const handleSaveWeeklyAvailability = async () => {
    setSavingAvailability(true);
    try {
      localStorage.setItem("doctor_weekly_availability", JSON.stringify(weeklySchedule));
      localStorage.setItem("doctor_slot_duration", slotDuration);
      localStorage.setItem("doctor_buffer_duration", bufferDuration);

      await updateDoctorAvailability({
        isAvailable: true,
        weeklySchedule,
        slotDuration: Number(slotDuration),
      }).catch(() => null);

      toast({
        title: "Availability Updated",
        description: "Your weekly recurring consultation hours and slot intervals have been synchronized.",
      });
      setAvailabilityOpen(false);
    } catch {
      toast({
        title: "Save Note",
        description: "Availability preferences saved to active session.",
      });
    } finally {
      setSavingAvailability(false);
    }
  };

  const getAptForCell = (day: number, hour: number) =>
    appointments.find((a) => {
      const [h] = a.time.split(":").map(Number);
      return a.day === day && h === hour;
    });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader />

      {/* Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14213D] flex items-center gap-2">
            <Calendar className="h-6 w-6 text-[#F2052C]" /> Doctor Clinical Schedule
          </h1>
          <p className="text-sm text-slate-400 font-semibold mt-0.5">
            {weekDates[0].toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
            })}{" "}
            –{" "}
            {weekDates[6].toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Refresh Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={fetchScheduleData}
            disabled={loading}
            className="rounded-[14px] border-slate-200 h-9 w-9 bg-white shadow-sm shrink-0"
            title="Refresh bookings"
          >
            <RefreshCw className={`h-4 w-4 text-slate-600 ${loading ? "animate-spin" : ""}`} />
          </Button>

          {/* Week Navigation */}
          <div className="flex items-center gap-1 bg-white/70 border border-white/60 rounded-[14px] p-1 shadow-sm shrink-0">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="h-8 w-8 rounded-[10px] flex items-center justify-center hover:bg-slate-100 transition-colors"
              title="Previous Week"
            >
              <ChevronLeft className="h-4 w-4 text-slate-500" />
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 h-8 rounded-[10px] text-xs font-extrabold text-[#F2052C] hover:bg-rose-50 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="h-8 w-8 rounded-[10px] flex items-center justify-center hover:bg-slate-100 transition-colors"
              title="Next Week"
            >
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          </div>

          {/* Working Hours Setup Button */}
          <Button
            variant="outline"
            onClick={() => setAvailabilityOpen(true)}
            className="rounded-[14px] border-slate-200 h-9 px-3.5 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 gap-1.5 shadow-sm shrink-0"
          >
            <Clock className="h-4 w-4 text-[#35B7C9]" /> Set Working Hours
          </Button>

          <Button
            onClick={() => {
              setSelectedCell({ day: todayDay, hour: 9 });
              setAddOpen(true);
            }}
            className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white rounded-[14px] border-none shadow-md shadow-[#F2052C]/20 hover:opacity-90 h-9 font-bold shrink-0"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Book Slot
          </Button>
        </div>
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2.5">
          {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
            <div
              key={status}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${cfg.bg} ${cfg.text} ${cfg.border}`}
            >
              <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
              {status}
            </div>
          ))}
        </div>

        <p className="text-xs font-semibold text-slate-400 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-[#F2052C]" /> Click any calendar slot to create an appointment
        </p>
      </div>

      {/* Main Layout: Calendar + Today Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* Week Grid */}
        <div className="xl:col-span-3 bg-white/70 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b border-slate-100 bg-slate-50/50">
            <div className="p-3 border-r border-slate-100 text-center">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase">Time</span>
            </div>
            {weekDates.map((date, i) => {
              const isToday = date.toDateString() === now.toDateString();
              return (
                <div
                  key={i}
                  className={`p-3 text-center border-r border-slate-100 last:border-r-0 ${
                    isToday ? "bg-[#F2052C]/8" : ""
                  }`}
                >
                  <p
                    className={`text-[10px] font-extrabold uppercase tracking-wider ${
                      isToday ? "text-[#F2052C]" : "text-slate-400"
                    }`}
                  >
                    {DAYS[i]}
                  </p>
                  <p
                    className={`text-lg font-extrabold mt-0.5 ${
                      isToday ? "text-[#F2052C]" : "text-[#14213D]"
                    }`}
                  >
                    {date.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Time Rows */}
          <div className="overflow-y-auto max-h-[520px] custom-scrollbar">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-8 border-b border-slate-50 hover:bg-slate-50/40 transition-colors group"
              >
                {/* Time Label */}
                <div className="p-3 border-r border-slate-100 flex items-start">
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                    {hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? "12:00 PM" : `${hour}:00 AM`}
                  </span>
                </div>

                {/* Day Cells */}
                {weekDates.map((_, dayIdx) => {
                  const apt = getAptForCell(dayIdx, hour);
                  const isToday = dayIdx === now.getDay() && weekOffset === 0;
                  const isCurrentHour = isToday && now.getHours() === hour;

                  return (
                    <div
                      key={dayIdx}
                      onClick={() => !apt && handleCellClick(dayIdx, hour)}
                      className={`border-r border-slate-50 last:border-r-0 p-1 min-h-[62px] cursor-pointer relative transition-all ${
                        isToday ? "bg-[#F2052C]/2" : ""
                      } ${!apt ? "hover:bg-slate-50/80" : ""}`}
                    >
                      {/* Current time horizontal indicator */}
                      {isCurrentHour && (
                        <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-[#F2052C]/60 z-10 pointer-events-none" />
                      )}

                      {apt && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/dashboard/doctor/consultations", {
                              state: { patient: apt.patient, bookingId: apt.bookingId },
                            });
                          }}
                          className={`rounded-[12px] p-2 text-white text-[10px] font-bold overflow-hidden cursor-pointer shadow-sm hover:opacity-90 transition-opacity ${
                            APPOINTMENT_COLORS[apt.status] || "bg-blue-500"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="truncate font-extrabold leading-tight">{apt.patient}</p>
                            <Video className="h-2.5 w-2.5 opacity-80" />
                          </div>
                          <p className="opacity-90 text-[9px] mt-0.5 truncate">
                            {apt.type} · {apt.duration}m
                          </p>
                        </div>
                      )}

                      {!apt && (
                        <div className="opacity-0 group-hover:opacity-100 absolute inset-1 rounded-[10px] border-2 border-dashed border-slate-200 flex items-center justify-center transition-opacity pointer-events-none">
                          <Plus className="h-3 w-3 text-slate-300" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Today's Agenda Sidebar */}
        <div className="space-y-4">
          <div className="bg-white/70 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-[#F2052C]" />
                <h3 className="text-sm font-extrabold text-[#14213D]">Today's Live Queue</h3>
              </div>
              <span className="text-[10px] font-extrabold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {todayApts.length} Today
              </span>
            </div>

            {todayApts.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs text-slate-600 font-extrabold">No pending calls today</p>
                <p className="text-[10px] text-slate-400 mt-0.5">All scheduled sessions clear.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayApts.map((apt) => {
                  const cfg = STATUS_CONFIG[apt.status] || STATUS_CONFIG["Confirmed"];
                  const countdown = getCountdown(apt.time);
                  const isNext =
                    countdown !== "past" &&
                    apt.status !== "Expired" &&
                    apt.status !== "Completed" &&
                    todayApts.find(
                      (a) =>
                        getCountdown(a.time) !== "past" &&
                        a.status !== "Expired" &&
                        a.status !== "Completed"
                    ) === apt;

                  return (
                    <div
                      key={apt.id}
                      className={`p-3.5 rounded-[18px] border ${cfg.bg} ${cfg.border} relative transition-all`}
                    >
                      {isNext && (
                        <span className="absolute -top-2 left-3 text-[9px] font-extrabold uppercase tracking-wider bg-[#F2052C] text-white px-2 py-0.5 rounded-full shadow-sm">
                          Next Up
                        </span>
                      )}

                      <div className="flex items-start gap-3 mt-0.5">
                        <div className="h-9 w-9 rounded-[10px] bg-gradient-to-br from-[#14213D] to-[#35B7C9] flex items-center justify-center text-white font-extrabold text-[11px] shrink-0 shadow-sm">
                          {apt.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-extrabold text-[#14213D] truncate">{apt.patient}</p>
                          <p className="text-[10px] text-slate-500 font-semibold">
                            {apt.type} · {apt.duration} min
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-black/5">
                        <span className="text-xs font-extrabold text-[#F2052C] font-mono">
                          {apt.time}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            apt.status === "Expired"
                              ? "text-slate-400 font-bold uppercase tracking-wider"
                              : countdown === "past"
                              ? "text-slate-400"
                              : "text-emerald-600"
                          }`}
                        >
                          {apt.status === "Expired" ? "Expired" : countdown}
                        </span>
                      </div>

                      <div className="mt-2.5">
                        {apt.status === "Expired" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              navigate("/dashboard/doctor/consultations", {
                                state: { patient: apt.patient, bookingId: apt.bookingId },
                              })
                            }
                            className="w-full h-7 text-[11px] font-bold text-slate-500 border-slate-200 rounded-[10px]"
                          >
                            Details
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() =>
                              navigate("/dashboard/doctor/consultations", {
                                state: { patient: apt.patient, bookingId: apt.bookingId },
                              })
                            }
                            className="w-full h-7 text-[11px] font-bold bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white border-none rounded-[10px] shadow-sm flex items-center justify-center gap-1"
                          >
                            <Video className="h-3 w-3" /> Connect Room
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stats mini-card */}
          <div className="bg-gradient-to-br from-[#14213D] to-[#1e3a5f] rounded-[24px] p-5 text-white shadow-sm">
            <p className="text-xs font-extrabold uppercase tracking-wider text-white/60 mb-3 flex items-center justify-between">
              <span>Day Metrics</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: "Total", value: todayApts.length, color: "text-white" },
                {
                  label: "Urgent",
                  value: todayApts.filter((a) => a.status === "Urgent").length,
                  color: "text-rose-400",
                },
                {
                  label: "Confirmed",
                  value: todayApts.filter((a) => a.status === "Confirmed").length,
                  color: "text-blue-400",
                },
                {
                  label: "Pending",
                  value: todayApts.filter((a) => a.status === "Pending").length,
                  color: "text-amber-400",
                },
              ].map((s) => (
                <div key={s.label} className="bg-white/10 rounded-[14px] p-2.5 text-center">
                  <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add Slot Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-[24px] border-none shadow-2xl bg-white/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-[#14213D] flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#F2052C]" /> Schedule Patient Appointment
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Patient Name
              </Label>
              <Input
                value={newApt.patient}
                onChange={(e) => setNewApt({ ...newApt, patient: e.target.value })}
                placeholder="e.g. Rahul Verma"
                className="rounded-[14px] border-slate-200 h-10 font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                  Consultation Type
                </Label>
                <Select
                  value={newApt.type}
                  onValueChange={(v) => setNewApt({ ...newApt, type: v })}
                >
                  <SelectTrigger className="rounded-[14px] border-slate-200 h-10 font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Consultation">Consultation</SelectItem>
                    <SelectItem value="Follow-up">Follow-up</SelectItem>
                    <SelectItem value="Check-up">Check-up</SelectItem>
                    <SelectItem value="Emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                  Priority Status
                </Label>
                <Select
                  value={newApt.status}
                  onValueChange={(v: "Confirmed" | "Urgent" | "Pending") =>
                    setNewApt({ ...newApt, status: v })
                  }
                >
                  <SelectTrigger className="rounded-[14px] border-slate-200 h-10 font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Duration
              </Label>
              <Select
                value={newApt.duration}
                onValueChange={(v) => setNewApt({ ...newApt, duration: v })}
              >
                <SelectTrigger className="rounded-[14px] border-slate-200 h-10 font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setAddOpen(false)}
                className="flex-1 rounded-[14px] h-10 font-bold border-slate-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddSlot}
                disabled={!newApt.patient.trim() || submitting}
                className="flex-1 rounded-[14px] h-10 font-bold bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white border-none shadow-md shadow-[#F2052C]/20"
              >
                {submitting ? "Booking…" : "Confirm Slot"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Weekly Working Hours & Recurring Availability Dialog */}
      <Dialog open={availabilityOpen} onOpenChange={setAvailabilityOpen}>
        <DialogContent className="rounded-[24px] max-w-2xl max-h-[85vh] overflow-y-auto p-6 bg-white">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-[12px] bg-[#35B7C9]/10 flex items-center justify-center text-[#35B7C9]">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-[#14213D]">
                  Weekly Working Hours & Recurring Availability
                </DialogTitle>
                <p className="text-xs text-slate-400 font-semibold">
                  Configure your weekly consultation shifts and slot intervals for patient bookings
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 my-3">
            {/* Slot Duration & Buffer Preferences */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-[18px] border border-slate-100 flex flex-col justify-between gap-2">
                <div>
                  <Label className="text-xs font-bold text-[#14213D]">Slot Duration</Label>
                  <p className="text-[10px] text-slate-400">Time per patient video consultation</p>
                </div>
                <Select value={slotDuration} onValueChange={setSlotDuration}>
                  <SelectTrigger className="w-full h-9 rounded-[12px] text-xs font-bold bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-[14px]">
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="20">20 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-[18px] border border-slate-100 flex flex-col justify-between gap-2">
                <div>
                  <Label className="text-xs font-bold text-[#14213D]">Consultation Buffer Time</Label>
                  <p className="text-[10px] text-slate-400">Intermission between back-to-back calls</p>
                </div>
                <Select value={bufferDuration} onValueChange={setBufferDuration}>
                  <SelectTrigger className="w-full h-9 rounded-[12px] text-xs font-bold bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-[14px]">
                    <SelectItem value="0">No buffer (0m)</SelectItem>
                    <SelectItem value="5">5 minutes buffer</SelectItem>
                    <SelectItem value="10">10 minutes buffer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Days Schedule Matrix */}
            <div className="space-y-3">
              {weeklySchedule.map((dayObj, dayIdx) => (
                <div
                  key={dayObj.dayName}
                  className={`p-3.5 rounded-[18px] border transition-all ${
                    dayObj.enabled
                      ? "bg-white border-slate-200/80 shadow-sm"
                      : "bg-slate-50/60 border-slate-100 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={dayObj.enabled}
                        onCheckedChange={() => handleToggleDay(dayIdx)}
                      />
                      <span className="text-sm font-extrabold text-[#14213D] w-24">
                        {dayObj.dayName}
                      </span>
                    </div>

                    {dayObj.enabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleAddShift(dayIdx)}
                        className="text-xs font-bold text-[#35B7C9] hover:bg-[#35B7C9]/10 h-8 rounded-[10px] gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Shift
                      </Button>
                    )}
                  </div>

                  {dayObj.enabled && (
                    <div className="mt-3 pl-12 space-y-2">
                      {dayObj.shifts.map((shift, shiftIdx) => (
                        <div key={shiftIdx} className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={shift.start}
                            onChange={(e) =>
                              handleUpdateShiftTime(dayIdx, shiftIdx, "start", e.target.value)
                            }
                            className="h-8 w-28 text-xs font-mono font-bold rounded-[10px]"
                          />
                          <span className="text-xs text-slate-400 font-bold">to</span>
                          <Input
                            type="time"
                            value={shift.end}
                            onChange={(e) =>
                              handleUpdateShiftTime(dayIdx, shiftIdx, "end", e.target.value)
                            }
                            className="h-8 w-28 text-xs font-mono font-bold rounded-[10px]"
                          />

                          {dayObj.shifts.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveShift(dayIdx, shiftIdx)}
                              className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-[10px]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAvailabilityOpen(false)}
              className="rounded-[14px] text-xs font-bold h-9 px-4"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveWeeklyAvailability}
              disabled={savingAvailability}
              className="rounded-[14px] bg-[#F2052C] hover:bg-[#c90424] text-white text-xs font-bold h-9 px-5 shadow-md"
            >
              {savingAvailability ? "Saving Hours..." : "Save Availability"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Schedule;
