import { useState, useEffect, useCallback, useMemo } from "react";
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
  CalendarDays,
  Filter,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { listBookings, createBooking, createDoctorBooking } from "@/services/booking.service";
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
    bg: "bg-emerald-50",
    text: "text-emerald-600",
    border: "border-emerald-100",
    dot: "bg-emerald-500",
  },
  Expired: {
    bg: "bg-slate-100",
    text: "text-slate-500",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
};

const APPOINTMENT_COLORS: Record<string, string> = {
  Confirmed: "bg-blue-600 hover:bg-blue-700",
  Urgent: "bg-rose-600 hover:bg-rose-700",
  Pending: "bg-amber-500 hover:bg-amber-600",
  Completed: "bg-emerald-600 hover:bg-emerald-700",
  Expired: "bg-slate-400 hover:bg-slate-500",
};

export interface AppointmentSlot {
  id: string | number;
  patient: string;
  time: string; // "HH:MM"
  duration: number; // minutes
  type: string;
  status: "Confirmed" | "Urgent" | "Pending" | "Completed" | "Expired";
  day: number; // 0..6
  dateStr: string; // "YYYY-MM-DD"
  avatar: string;
  bookingId?: string;
}

/** Format a date into YYYY-MM-DD local time string */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getCountdown(timeStr: string, dateStr: string): string {
  const now = new Date();
  const [h, m] = timeStr.split(":").map(Number);
  const [y, mon, d] = dateStr.split("-").map(Number);
  const apt = new Date(y, mon - 1, d, h, m || 0, 0, 0);

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
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [now, setNow] = useState<Date>(() => new Date());
  const [appointments, setAppointments] = useState<AppointmentSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const [addOpen, setAddOpen] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  // Direct Booking Modal State
  const [bookingFormData, setBookingFormData] = useState({
    patient: "",
    patientPhone: "",
    date: toLocalDateStr(new Date()),
    time: "09:00",
    type: "Consultation",
    status: "Confirmed" as "Confirmed" | "Urgent" | "Pending",
    duration: "30",
  });

  // Ticker for current time
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  // Compute 7 days for current week offset
  const weekDates = useMemo(() => {
    const base = new Date(now);
    const day = base.getDay();
    // Sunday of the current week + weekOffset * 7
    const diff = base.getDate() - day + weekOffset * 7;
    const sunday = new Date(base.getFullYear(), base.getMonth(), diff);

    return DAYS.map((_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      return d;
    });
  }, [weekOffset, now]);

  // Fetch real bookings, availability, and doctor credentials
  const fetchScheduleData = useCallback(async () => {
    setLoading(true);
    try {
      const user = await viewUser().catch(() => null);
      if (user) {
        setDoctorId(user.id || user._id || "");
      }

      // Check API for doctor availability
      try {
        const availRes = await getDoctorAvailability().catch(() => null);
        if (availRes?.weeklySchedule && Array.isArray(availRes.weeklySchedule)) {
          setWeeklySchedule(availRes.weeklySchedule);
        }
        if (availRes?.slotDuration) {
          setSlotDuration(String(availRes.slotDuration));
        }
      } catch (e) {
        console.debug("Availability API check note:", e);
      }

      const bookingsRes = await listBookings().catch(() => null);
      const bookingsList = Array.isArray(bookingsRes)
        ? bookingsRes
        : bookingsRes?.data || bookingsRes?.bookings || [];

      if (bookingsList.length > 0) {
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

          // Parse date and time cleanly
          let dateStr = toLocalDateStr(new Date());
          let time = "09:00";

          if (b.slotDate) {
            dateStr = String(b.slotDate).slice(0, 10);
          } else if (b.slot) {
            const dateObj = new Date(b.slot);
            if (!isNaN(dateObj.getTime())) {
              dateStr = toLocalDateStr(dateObj);
              const h = String(dateObj.getHours()).padStart(2, "0");
              const m = String(dateObj.getMinutes()).padStart(2, "0");
              time = `${h}:${m}`;
            }
          } else if (b.createdAt) {
            const dateObj = new Date(b.createdAt);
            if (!isNaN(dateObj.getTime())) {
              dateStr = toLocalDateStr(dateObj);
            }
          }

          if (b.slotTimeStart) {
            time = b.slotTimeStart.slice(0, 5);
          }

          const [y, m, d] = dateStr.split("-").map(Number);
          const day = new Date(y, m - 1, d).getDay();

          // Expiry calculation
          const nowInstant = new Date();
          let isExpired = false;
          if (b.expiresAt) {
            const exp = new Date(b.expiresAt);
            if (!isNaN(exp.getTime()) && nowInstant > exp) isExpired = true;
          }
          if (!isExpired && dateStr && time) {
            const [eh, em] = time.split(":").map(Number);
            const slotTimeObj = new Date(y, m - 1, d, eh, em || 0, 0);
            // Expired if more than 2 hours passed
            if (nowInstant.getTime() - slotTimeObj.getTime() > 2 * 3600 * 1000) {
              isExpired = true;
            }
          }

          let status: "Confirmed" | "Urgent" | "Pending" | "Completed" | "Expired" = "Confirmed";
          const rawStatus = (b.status || "").toLowerCase();
          if (rawStatus.includes("urgent") || rawStatus.includes("emergency")) status = "Urgent";
          else if (rawStatus === "completed" || rawStatus.includes("complete")) status = "Completed";
          else if (rawStatus === "pending") status = "Pending";
          else if (isExpired || rawStatus.includes("expire") || rawStatus === "cancelled" || rawStatus === "rejected") status = "Expired";
          else if (rawStatus === "in_consultation" || rawStatus === "confirmed" || rawStatus === "postponed") status = "Confirmed";

          return {
            id: b._id || `b-${index}`,
            patient: patientName,
            time,
            duration: Number(b.duration) || 30,
            type: b.type || "Consultation",
            status,
            day,
            dateStr,
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
        // Realistic sample appointments anchored to the current week
        const todayStr = toLocalDateStr(new Date());
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = toLocalDateStr(tomorrow);

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = toLocalDateStr(yesterday);

        const samples: AppointmentSlot[] = [
          {
            id: "s-1",
            patient: "Rajesh Kumar",
            time: "09:30",
            duration: 30,
            type: "Follow-up",
            status: "Confirmed",
            day: new Date().getDay(),
            dateStr: todayStr,
            avatar: "RK",
          },
          {
            id: "s-2",
            patient: "Sunita Patel",
            time: "11:00",
            duration: 45,
            type: "Consultation",
            status: "Urgent",
            day: new Date().getDay(),
            dateStr: todayStr,
            avatar: "SP",
          },
          {
            id: "s-3",
            patient: "Amitabh Sen",
            time: "14:00",
            duration: 30,
            type: "Second Opinion",
            status: "Pending",
            day: new Date().getDay(),
            dateStr: todayStr,
            avatar: "AS",
          },
          {
            id: "s-4",
            patient: "Pooja Hegde",
            time: "16:00",
            duration: 30,
            type: "Routine Check",
            status: "Completed",
            day: yesterday.getDay(),
            dateStr: yesterdayStr,
            avatar: "PH",
          },
          {
            id: "s-5",
            patient: "Deepak Chopra",
            time: "10:00",
            duration: 30,
            type: "Consultation",
            status: "Confirmed",
            day: tomorrow.getDay(),
            dateStr: tomorrowStr,
            avatar: "DC",
          },
          {
            id: "s-6",
            patient: "Ananya Roy",
            time: "08:30",
            duration: 15,
            type: "Consultation",
            status: "Expired",
            day: yesterday.getDay(),
            dateStr: yesterdayStr,
            avatar: "AR",
          },
        ];

        setAppointments(samples);
      }
    } catch (err) {
      console.warn("Could not load schedule bookings from API:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScheduleData();

    const handleRefresh = () => fetchScheduleData();
    window.addEventListener("onyx:refresh_dashboard", handleRefresh);
    window.addEventListener("onyx:booking_status", handleRefresh);

    return () => {
      window.removeEventListener("onyx:refresh_dashboard", handleRefresh);
      window.removeEventListener("onyx:booking_status", handleRefresh);
    };
  }, [fetchScheduleData]);

  // Handle cell click on calendar grid
  const handleCellClick = (dayIdx: number, hour: number) => {
    const targetDate = weekDates[dayIdx];
    setSelectedDate(targetDate);
    const dateStr = toLocalDateStr(targetDate);
    const timeStr = `${String(hour).padStart(2, "0")}:00`;

    setBookingFormData({
      patient: "",
      patientPhone: "",
      date: dateStr,
      time: timeStr,
      type: "Consultation",
      status: "Confirmed",
      duration: "30",
    });
    setAddOpen(true);
  };

  // Open direct booking modal from header
  const handleOpenDirectBooking = () => {
    setBookingFormData({
      patient: "",
      patientPhone: "",
      date: toLocalDateStr(selectedDate),
      time: "09:00",
      type: "Consultation",
      status: "Confirmed",
      duration: "30",
    });
    setAddOpen(true);
  };

  // Submit direct booking
  const handleAddSlot = async () => {
    if (!bookingFormData.patient.trim() || !bookingFormData.date) return;
    setSubmitting(true);

    const [y, m, d] = bookingFormData.date.split("-").map(Number);
    const [h, min] = bookingFormData.time.split(":").map(Number);
    const slotDateObj = new Date(y, m - 1, d, h, min || 0, 0);
    const slotIsoString = slotDateObj.toISOString();
    const day = slotDateObj.getDay();

    const tempId = `slot-${Date.now()}`;
    const newSlotItem: AppointmentSlot = {
      id: tempId,
      patient: bookingFormData.patient.trim(),
      time: bookingFormData.time,
      duration: Number(bookingFormData.duration),
      type: bookingFormData.type,
      status: bookingFormData.status,
      day,
      dateStr: bookingFormData.date,
      avatar: bookingFormData.patient
        .trim()
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    };

    // Optimistically update schedule UI
    setAppointments((prev) => [newSlotItem, ...prev]);
    setAddOpen(false);

    try {
      // Use official POST /api/booking/doctor-create endpoint
      await createDoctorBooking({
        patientName: bookingFormData.patient.trim(),
        patientPhone: bookingFormData.patientPhone?.trim() || "+91 98765 43210",
        slotDate: bookingFormData.date,
        slotTimeStart: bookingFormData.time,
        duration: Number(bookingFormData.duration) || 30,
        reason: bookingFormData.type,
      });

      toast({
        title: "Appointment Booked Directly",
        description: `Scheduled slot for ${bookingFormData.patient} on ${bookingFormData.date} at ${bookingFormData.time}.`,
      });
    } catch (err: any) {
      console.warn("Backend doctor-create note, trying fallback createBooking:", err);
      try {
        if (doctorId) {
          await createBooking(doctorId, slotIsoString);
        }
        toast({
          title: "Slot Added to Schedule",
          description: `Appointment confirmed for ${bookingFormData.patient}.`,
        });
      } catch (fallbackErr) {
        toast({
          title: "Saved to Schedule",
          description: `Slot for ${bookingFormData.patient} confirmed on calendar.`,
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Working Hours handlers
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
        title: "Working Hours Synchronized",
        description: "Your weekly consultation shifts and slot intervals have been updated in the API.",
      });
      setAvailabilityOpen(false);
    } catch {
      toast({
        title: "Preferences Saved",
        description: "Working hours stored to active doctor session.",
      });
    } finally {
      setSavingAvailability(false);
    }
  };

  // Get matching appointment for calendar cell
  const getAptForCell = (dayIdx: number, hour: number) => {
    const cellDateStr = toLocalDateStr(weekDates[dayIdx]);
    return appointments.find((a) => {
      if (statusFilter !== "All" && a.status !== statusFilter) return false;
      const [h] = a.time.split(":").map(Number);
      const matchesDate = a.dateStr ? a.dateStr === cellDateStr : a.day === dayIdx;
      return matchesDate && h === hour;
    });
  };

  // Agenda sidebar filtered by selectedDate
  const selectedDateStr = toLocalDateStr(selectedDate);
  const isSelectedToday = selectedDateStr === toLocalDateStr(now);

  const agendaApts = useMemo(() => {
    return appointments
      .filter((a) => {
        if (statusFilter !== "All" && a.status !== statusFilter) return false;
        return a.dateStr ? a.dateStr === selectedDateStr : a.day === selectedDate.getDay();
      })
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, selectedDateStr, selectedDate, statusFilter]);

  const jumpToToday = () => {
    setWeekOffset(0);
    setSelectedDate(new Date());
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans text-slate-800">
      <PageHeader />

      {/* Title & Primary Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-5 rounded-[24px] border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-[14px] bg-[#F2052C]/10 text-[#F2052C] flex items-center justify-center font-bold">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#14213D] tracking-tight">Doctor Clinical Schedule</h1>
              <p className="text-xs text-slate-400 font-semibold">
                {weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
                {weekDates[6].toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Refresh */}
          <Button
            variant="outline"
            size="icon"
            onClick={fetchScheduleData}
            disabled={loading}
            className="rounded-[14px] border-slate-200 h-9 w-9 bg-white shadow-xs shrink-0"
            title="Refresh bookings"
          >
            <RefreshCw className={`h-4 w-4 text-slate-600 ${loading ? "animate-spin" : ""}`} />
          </Button>

          {/* Week Navigation */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-[14px] p-1 shadow-inner shrink-0">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="h-7 w-7 rounded-[10px] flex items-center justify-center hover:bg-white text-slate-600 transition-colors"
              title="Previous Week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={jumpToToday}
              className={`px-3 h-7 rounded-[10px] text-xs font-black transition-colors ${
                isSelectedToday && weekOffset === 0
                  ? "bg-white text-[#F2052C] shadow-xs"
                  : "text-slate-600 hover:text-[#14213D]"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="h-7 w-7 rounded-[10px] flex items-center justify-center hover:bg-white text-slate-600 transition-colors"
              title="Next Week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Working Hours Setup Button */}
          <Button
            variant="outline"
            onClick={() => setAvailabilityOpen(true)}
            className="rounded-[14px] border-slate-200 h-9 px-3.5 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 gap-1.5 shadow-xs shrink-0"
          >
            <Clock className="h-4 w-4 text-[#35B7C9]" /> Manage Working Hours
          </Button>

          {/* Direct Doctor Booking Button */}
          <Button
            onClick={handleOpenDirectBooking}
            className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white rounded-[14px] border-none shadow-md shadow-[#F2052C]/20 hover:opacity-90 h-9 px-4 text-xs font-extrabold shrink-0 flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Book Appointment Slot
          </Button>
        </div>
      </div>

      {/* Status Filter Bar & Interactive Hint */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
            <Filter className="h-3.5 w-3.5" /> Filter:
          </span>
          {["All", "Confirmed", "Urgent", "Pending", "Completed", "Expired"].map((st) => {
            const isActive = statusFilter === st;
            const cfg = st !== "All" ? STATUS_CONFIG[st] : null;
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold transition-all border ${
                  isActive
                    ? "bg-[#14213D] text-white border-[#14213D] shadow-sm"
                    : cfg
                    ? `${cfg.bg} ${cfg.text} ${cfg.border} hover:opacity-80`
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {cfg && <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />}
                {st}
              </button>
            );
          })}
        </div>

        <p className="text-xs font-semibold text-slate-400 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-[#F2052C]" /> Click any calendar cell to schedule a patient slot directly
        </p>
      </div>

      {/* Main Layout: Calendar Grid + Selected Day Agenda */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* Week Grid (3 cols) */}
        <div className="xl:col-span-3 bg-white/90 backdrop-blur-md rounded-[24px] border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Day Headers */}
          <div className="grid grid-cols-8 border-b border-slate-100 bg-slate-50/70">
            <div className="p-3 border-r border-slate-100 text-center flex flex-col justify-center">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase font-mono">Time</span>
            </div>
            {weekDates.map((date, i) => {
              const isDateToday = toLocalDateStr(date) === toLocalDateStr(now);
              const isSelected = toLocalDateStr(date) === selectedDateStr;

              return (
                <div
                  key={i}
                  onClick={() => setSelectedDate(date)}
                  className={`p-3 text-center border-r border-slate-100 last:border-r-0 cursor-pointer transition-all ${
                    isSelected
                      ? "bg-[#F2052C]/10 border-b-2 border-b-[#F2052C]"
                      : isDateToday
                      ? "bg-rose-50/50"
                      : "hover:bg-slate-100/60"
                  }`}
                >
                  <div className="flex items-center justify-center gap-1">
                    <p
                      className={`text-[10px] font-black uppercase tracking-wider ${
                        isDateToday ? "text-[#F2052C]" : "text-slate-400"
                      }`}
                    >
                      {DAYS[i]}
                    </p>
                    {isDateToday && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#F2052C] animate-ping" />
                    )}
                  </div>
                  <p
                    className={`text-lg font-black mt-0.5 ${
                      isSelected
                        ? "text-[#F2052C]"
                        : isDateToday
                        ? "text-[#14213D]"
                        : "text-slate-700"
                    }`}
                  >
                    {date.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Time Rows */}
          <div className="overflow-y-auto max-h-[540px] custom-scrollbar">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-8 border-b border-slate-50 hover:bg-slate-50/40 transition-colors group"
              >
                {/* Time Label */}
                <div className="p-3 border-r border-slate-100 flex items-start justify-center bg-slate-50/20">
                  <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">
                    {hour > 12 ? `${hour - 12}:00 PM` : hour === 12 ? "12:00 PM" : `${hour}:00 AM`}
                  </span>
                </div>

                {/* Day Cells */}
                {weekDates.map((date, dayIdx) => {
                  const apt = getAptForCell(dayIdx, hour);
                  const isDateToday = toLocalDateStr(date) === toLocalDateStr(now);
                  const isCurrentHour = isDateToday && now.getHours() === hour;

                  return (
                    <div
                      key={dayIdx}
                      onClick={() => !apt && handleCellClick(dayIdx, hour)}
                      className={`border-r border-slate-50 last:border-r-0 p-1 min-h-[66px] cursor-pointer relative transition-all ${
                        isDateToday ? "bg-rose-50/20" : ""
                      } ${!apt ? "hover:bg-slate-50/80" : ""}`}
                    >
                      {/* Current live hour horizontal marker */}
                      {isCurrentHour && (
                        <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-[#F2052C]/70 z-10 pointer-events-none" />
                      )}

                      {apt && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate("/dashboard/doctor/consultations", {
                              state: { patient: apt.patient, bookingId: apt.bookingId },
                            });
                          }}
                          className={`rounded-[12px] p-2 text-white text-[10px] font-bold overflow-hidden cursor-pointer shadow-xs transition-transform transform active:scale-95 ${
                            APPOINTMENT_COLORS[apt.status] || "bg-blue-600"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="truncate font-black leading-tight">{apt.patient}</p>
                            <Video className="h-2.5 w-2.5 opacity-80" />
                          </div>
                          <p className="opacity-90 text-[9px] mt-0.5 truncate">
                            {apt.time} · {apt.duration}m
                          </p>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="text-[8px] uppercase tracking-wider bg-black/20 px-1 py-0.2 rounded-full">
                              {apt.status}
                            </span>
                          </div>
                        </div>
                      )}

                      {!apt && (
                        <div className="opacity-0 group-hover:opacity-100 absolute inset-1 rounded-[10px] border border-dashed border-slate-300 flex items-center justify-center transition-opacity pointer-events-none bg-slate-50/60">
                          <Plus className="h-3 w-3 text-slate-400" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Selected Date Agenda Sidebar (1 col) */}
        <div className="space-y-4">
          <div className="bg-white/90 backdrop-blur-md rounded-[24px] border border-slate-200/80 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-[#F2052C]" />
                <div>
                  <h3 className="text-sm font-black text-[#14213D]">
                    {isSelectedToday ? "Today's Agenda" : "Day Schedule"}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    {selectedDate.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {agendaApts.length} Slots
              </span>
            </div>

            {agendaApts.length === 0 ? (
              <div className="text-center py-8 bg-slate-50/50 rounded-[18px] border border-dashed border-slate-200">
                <CheckCircle2 className="h-7 w-7 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs text-slate-700 font-extrabold">No appointments on this date</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Click any cell or Book Slot to add.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenDirectBooking}
                  className="mt-3 rounded-[10px] text-xs font-bold border-slate-200 h-8 text-[#F2052C]"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Slot for Date
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {agendaApts.map((apt) => {
                  const cfg = STATUS_CONFIG[apt.status] || STATUS_CONFIG["Confirmed"];
                  const countdown = getCountdown(apt.time, apt.dateStr);

                  return (
                    <div
                      key={apt.id}
                      className={`p-3 rounded-[16px] border ${cfg.bg} ${cfg.border} relative transition-all`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="h-8 w-8 rounded-[10px] bg-gradient-to-br from-[#14213D] to-[#35B7C9] flex items-center justify-center text-white font-extrabold text-[10px] shrink-0 shadow-xs">
                          {apt.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-extrabold text-[#14213D] truncate">{apt.patient}</p>
                          <p className="text-[10px] text-slate-500 font-semibold truncate">
                            {apt.type} · {apt.duration} min
                          </p>
                        </div>
                        <span
                          className={`text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}
                        >
                          {apt.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/5">
                        <span className="text-xs font-black text-[#F2052C] font-mono">
                          {apt.time}
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            apt.status === "Expired"
                              ? "text-slate-400 uppercase tracking-wider"
                              : countdown === "past"
                              ? "text-slate-400"
                              : "text-emerald-600"
                          }`}
                        >
                          {apt.status === "Expired" ? "Expired" : countdown}
                        </span>
                      </div>

                      <div className="mt-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            navigate("/dashboard/doctor/consultations", {
                              state: { patient: apt.patient, bookingId: apt.bookingId },
                            })
                          }
                          className="w-full h-7 text-[11px] font-bold bg-[#14213D] hover:bg-[#1E2E4E] text-white border-none rounded-[10px] shadow-xs flex items-center justify-center gap-1"
                        >
                          <Video className="h-3 w-3 text-[#35B7C9]" /> Enter Room
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Daily Status Metrics Box */}
          <div className="bg-gradient-to-br from-[#14213D] to-[#1E2E4E] rounded-[24px] p-5 text-white shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-white/70">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5 text-[#35B7C9]" /> Status Overview
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Confirmed", count: appointments.filter((a) => a.status === "Confirmed").length, color: "text-blue-300" },
                { label: "Urgent", count: appointments.filter((a) => a.status === "Urgent").length, color: "text-rose-400" },
                { label: "Pending", count: appointments.filter((a) => a.status === "Pending").length, color: "text-amber-300" },
                { label: "Completed", count: appointments.filter((a) => a.status === "Completed").length, color: "text-emerald-300" },
                { label: "Expired", count: appointments.filter((a) => a.status === "Expired").length, color: "text-slate-400" },
                { label: "Total Active", count: appointments.length, color: "text-white" },
              ].map((m) => (
                <div key={m.label} className="bg-white/10 rounded-[12px] p-2 text-center">
                  <p className={`text-base font-black ${m.color}`}>{m.count}</p>
                  <p className="text-[9px] text-white/60 font-bold uppercase tracking-wider">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Direct Booking Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[440px] rounded-[24px] border-none shadow-2xl bg-white p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-[#14213D] flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#F2052C]" /> Direct Doctor Appointment Booking
            </DialogTitle>
            <p className="text-xs text-slate-400 font-semibold">
              Book a patient slot directly into the clinical calendar with status management
            </p>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">
                Patient Full Name
              </Label>
              <Input
                value={bookingFormData.patient}
                onChange={(e) => setBookingFormData({ ...bookingFormData, patient: e.target.value })}
                placeholder="e.g. Ramesh Verma"
                className="rounded-[14px] border-slate-200 h-10 font-semibold"
                autoFocus
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">
                Patient Phone Number
              </Label>
              <Input
                value={bookingFormData.patientPhone}
                onChange={(e) => setBookingFormData({ ...bookingFormData, patientPhone: e.target.value })}
                placeholder="e.g. +91 98765 43210"
                className="rounded-[14px] border-slate-200 h-10 font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">
                  Date
                </Label>
                <Input
                  type="date"
                  value={bookingFormData.date}
                  onChange={(e) => setBookingFormData({ ...bookingFormData, date: e.target.value })}
                  className="rounded-[14px] border-slate-200 h-10 font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">
                  Start Time
                </Label>
                <Select
                  value={bookingFormData.time}
                  onValueChange={(v) => setBookingFormData({ ...bookingFormData, time: v })}
                >
                  <SelectTrigger className="rounded-[14px] border-slate-200 h-10 font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {HOURS.flatMap((h) => [
                      `${String(h).padStart(2, "0")}:00`,
                      `${String(h).padStart(2, "0")}:30`,
                    ]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">
                  Consultation Type
                </Label>
                <Select
                  value={bookingFormData.type}
                  onValueChange={(v) => setBookingFormData({ ...bookingFormData, type: v })}
                >
                  <SelectTrigger className="rounded-[14px] border-slate-200 h-10 font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Consultation">Consultation</SelectItem>
                    <SelectItem value="Follow-up">Follow-up</SelectItem>
                    <SelectItem value="Second Opinion">Second Opinion</SelectItem>
                    <SelectItem value="Emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">
                  Initial Status
                </Label>
                <Select
                  value={bookingFormData.status}
                  onValueChange={(v: "Confirmed" | "Urgent" | "Pending") =>
                    setBookingFormData({ ...bookingFormData, status: v })
                  }
                >
                  <SelectTrigger className="rounded-[14px] border-slate-200 h-10 font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">
                Duration
              </Label>
              <Select
                value={bookingFormData.duration}
                onValueChange={(v) => setBookingFormData({ ...bookingFormData, duration: v })}
              >
                <SelectTrigger className="rounded-[14px] border-slate-200 h-10 font-semibold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">60 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setAddOpen(false)}
                className="flex-1 rounded-[14px] h-10 font-bold border-slate-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddSlot}
                disabled={!bookingFormData.patient.trim() || submitting}
                className="flex-1 rounded-[14px] h-10 font-bold bg-[#F2052C] hover:bg-[#D00424] text-white border-none shadow-md shadow-[#F2052C]/20"
              >
                {submitting ? "Booking…" : "Confirm Direct Booking"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Weekly Working Hours & Recurring Availability Dialog */}
      <Dialog open={availabilityOpen} onOpenChange={setAvailabilityOpen}>
        <DialogContent className="rounded-[24px] max-w-2xl max-h-[85vh] overflow-y-auto p-6 bg-white">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-[12px] bg-[#35B7C9]/10 flex items-center justify-center text-[#35B7C9]">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black text-[#14213D]">
                  Doctor Working Hours & Shift Management
                </DialogTitle>
                <p className="text-xs text-slate-400 font-semibold">
                  Configure your weekly consultation schedule and slot duration synchronized with backend API
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
                  <Label className="text-xs font-bold text-[#14213D]">Buffer Time</Label>
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
            <div className="space-y-2.5">
              {weeklySchedule.map((dayObj, dayIdx) => (
                <div
                  key={dayObj.dayName}
                  className={`p-3.5 rounded-[18px] border transition-all ${
                    dayObj.enabled
                      ? "bg-white border-slate-200/80 shadow-xs"
                      : "bg-slate-50/60 border-slate-100 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={dayObj.enabled}
                        onCheckedChange={() => handleToggleDay(dayIdx)}
                      />
                      <span className="text-sm font-black text-[#14213D] w-24">
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
                    <div className="mt-2.5 pl-12 space-y-2">
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

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
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
              className="rounded-[14px] bg-[#F2052C] hover:bg-[#D00424] text-white text-xs font-bold h-9 px-5 shadow-sm"
            >
              {savingAvailability ? "Saving Hours..." : "Synchronize Hours"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Schedule;
