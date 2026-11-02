import { useEffect, useState, useMemo, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StatCard from "@/components/dashboard/StatCard";
import PageHeader from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Video,
  FileText,
  CreditCard,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  Stethoscope,
  Activity,
  RefreshCw,
  ArrowUpRight,
  Sparkles,
  FileSignature,
  Building2,
  Camera,
  User,
  HeartPulse,
  Sliders,
  Check,
  Mic,
  ChevronLeft,
} from "lucide-react";

import {
  getOnboardingStatus,
  updateDoctorAvailability,
  getDoctorAvailability,
} from "@/services/doctor.service";
import { listBookings } from "@/services/booking.service";
import { IncomingCallModal } from "@/components/dashboard/IncomingCallModal";
import { useIncomingCallWatcher } from "@/hooks/useIncomingCallWatcher";
import { DevicePermissionsModal } from "@/components/shared/DevicePermissionsModal";

/* ============================================================
   TYPES & CONFIG
============================================================ */
interface AppointmentItem {
  id: string | number;
  patient: string;
  time: string;
  type: string;
  status: "Upcoming" | "In Progress" | "Completed" | "Urgent" | "Expired" | "Cancelled";
  reason?: string;
  avatar?: string;
  bookingId?: string;
  date?: string;
}

const STATUS_CONFIG: Record<
  string,
  { bg: string; text: string; border: string; dot: string }
> = {
  Upcoming: {
    bg: "bg-blue-50/80",
    text: "text-blue-700",
    border: "border-blue-200/60",
    dot: "bg-blue-500",
  },
  "In Progress": {
    bg: "bg-emerald-50/80",
    text: "text-emerald-700",
    border: "border-emerald-200/60",
    dot: "bg-emerald-500 animate-pulse",
  },
  Completed: {
    bg: "bg-slate-100/80",
    text: "text-slate-600",
    border: "border-slate-200/60",
    dot: "bg-slate-400",
  },
  Urgent: {
    bg: "bg-rose-50/80",
    text: "text-rose-700",
    border: "border-rose-200/60",
    dot: "bg-rose-500 animate-ping",
  },
  Expired: {
    bg: "bg-slate-100/90",
    text: "text-slate-500",
    border: "border-slate-200",
    dot: "bg-slate-400",
  },
  Cancelled: {
    bg: "bg-rose-50/80",
    text: "text-rose-600",
    border: "border-rose-200/60",
    dot: "bg-rose-400",
  },
};

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const isMainDashboard =
    location.pathname === "/dashboard/doctor" ||
    location.pathname === "/dashboard/doctor/";

  // Incoming Telehealth Consultation Call Watcher
  const {
    activeCall,
    dismissCall,
    acceptCall,
    isMuted,
    toggleMute,
  } = useIncomingCallWatcher();

  // Profile and Onboarding States
  const [userName, setUserName] = useState<string>(
    localStorage.getItem("userName") || ""
  );
  const [doctorSpecialty, setDoctorSpecialty] = useState<string>("Specialist Physician");
  const [hospitalAffiliation, setHospitalAffiliation] = useState<string>("ONYX Telehealth Network");
  const [regNumber, setRegNumber] = useState<string>("");
  const [consultFee, setConsultFee] = useState<string>("500");
  const [onboardingStatus, setOnboardingStatus] = useState<
    "approved" | "pending" | "in_progress" | "none"
  >("approved");
  const [nextStep, setNextStep] = useState<number>(1);

  // Availability State
  const [isAvailable, setIsAvailable] = useState<boolean>(() => {
    const saved = localStorage.getItem("doctorAvailable");
    return saved !== null ? saved === "true" : true;
  });
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  // Clinical Data States
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<
    "All" | "Upcoming" | "In Progress" | "Completed" | "Expired"
  >("All");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);

  // Dynamic Metrics
  const [stats, setStats] = useState({
    todayAppointments: 0,
    pendingConsultations: 0,
    reportsToReview: 0,
    thisMonthEarnings: "₹0",
  });

  // Real-time Live Consultation Alert (triggers high-priority banner when patient is waiting)
  const liveWaitingConsultation = useMemo(() => {
    if (activeCall) {
      return {
        patient: activeCall.patientName,
        bookingId: activeCall.bookingId,
        reason: activeCall.reason || "Live Incoming Call",
        type: "Instant Telehealth",
        time: activeCall.time || "Now",
      };
    }
    const activeAppointment = appointments.find(
      (a) => a.status === "In Progress" || a.status === "Urgent"
    );
    if (activeAppointment) {
      return {
        patient: activeAppointment.patient,
        bookingId: activeAppointment.bookingId || activeAppointment.id,
        reason: activeAppointment.reason || "Telehealth Consultation",
        type: activeAppointment.type,
        time: activeAppointment.time,
      };
    }
    return null;
  }, [activeCall, appointments]);

  /* ============================================================
     FETCH CLINICAL DASHBOARD DATA
  ============================================================ */
  const fetchDashboardData = useCallback(async () => {
    try {
      // 1. Fetch Onboarding & Availability
      try {
        const [onboardRes, availRes] = await Promise.all([
          getOnboardingStatus().catch(() => null),
          getDoctorAvailability().catch(() => null),
        ]);

        if (onboardRes) {
          const status = onboardRes.status || onboardRes.onboardingStatus;
          if (status) setOnboardingStatus(status);
          if (onboardRes.nextStep) setNextStep(onboardRes.nextStep);
          if (onboardRes.doctor?.specialty) setDoctorSpecialty(onboardRes.doctor.specialty);
          if (onboardRes.doctor?.hospital) setHospitalAffiliation(onboardRes.doctor.hospital);
          if (onboardRes.doctor?.registrationNumber) setRegNumber(onboardRes.doctor.registrationNumber);
          if (onboardRes.doctor?.consultationFee) setConsultFee(String(onboardRes.doctor.consultationFee));
        }

        if (availRes && typeof availRes.isAvailable === "boolean") {
          setIsAvailable(availRes.isAvailable);
          localStorage.setItem("doctorAvailable", String(availRes.isAvailable));
        }
      } catch (e) {
        console.debug("Availability note:", e);
      }

      // 2. Fetch Real Bookings
      const bookingsRes = await listBookings().catch(() => null);

      const bookingList = Array.isArray(bookingsRes)
        ? bookingsRes
        : bookingsRes?.data || bookingsRes?.bookings || [];

      // Calculate Earnings from bookings
      if (bookingList.length > 0) {
        const fee = Number(consultFee) || 500;
        const estTotal = bookingList.filter(
          (b: any) => b.status === "Completed" || b.status === "confirmed"
        ).length * fee;
        setStats((prev) => ({
          ...prev,
          thisMonthEarnings: `₹${(estTotal || 1500).toLocaleString("en-IN")}`,
        }));
      }

      // Count patient reports attached to bookings
      let totalReportsCount = 0;
      bookingList.forEach((b: any) => {
        if (Array.isArray(b.reports)) totalReportsCount += b.reports.length;
      });
      setReports([]);

      // Process Appointments
      const formattedAppointments: AppointmentItem[] = [];
      const profileMap = new Map<string, any>();
      bookingList.forEach((b: any) => {
        if (b.profileId && typeof b.profileId === "object") {
          const id = b.profileId._id || b.profileId.id;
          if (id) profileMap.set(String(id), b.profileId);
        }
      });

      bookingList.forEach((b: any, idx: number) => {
        const pIdStr = typeof b.profileId === "string" ? b.profileId : b.profileId?._id;
        const prof = pIdStr ? profileMap.get(pIdStr) : null;
        const pName =
          prof?.name ||
          b.profileId?.name ||
          b.userId?.name ||
          b.patientName ||
          `Patient #${b._id?.slice(-4) || idx + 1}`;

        const rawStatus = (b.status || "").toLowerCase();
        let statusStr: AppointmentItem["status"] = "Upcoming";
        if (
          rawStatus === "in_consultation" ||
          rawStatus === "in-progress" ||
          rawStatus === "in progress" ||
          rawStatus === "active"
        ) {
          statusStr = "In Progress";
        } else if (rawStatus === "completed") {
          statusStr = "Completed";
        } else if (rawStatus === "cancelled" || rawStatus === "rejected") {
          statusStr = "Cancelled";
        } else if (rawStatus === "expired") {
          statusStr = "Expired";
        } else if (rawStatus === "urgent") {
          statusStr = "Urgent";
        } else {
          statusStr = "Upcoming";
        }

        let timeStr = "Today";
        if (b.slotTimeStart) {
          timeStr = b.slotTimeEnd ? `${b.slotTimeStart} - ${b.slotTimeEnd}` : b.slotTimeStart;
        } else if (b.slot) {
          timeStr = b.slot;
        }

        const bookingDate = b.slotDate
          ? String(b.slotDate).slice(0, 10)
          : b.slot && typeof b.slot === "string" && b.slot.includes("-")
          ? String(b.slot).slice(0, 10)
          : b.createdAt
          ? new Date(b.createdAt).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);

        formattedAppointments.push({
          id: b._id || `apt-${idx}`,
          patient: pName,
          time: timeStr,
          type: b.type === "instant" ? "Instant Telehealth" : "Scheduled Consultation",
          status: statusStr,
          reason: b.reason || b.condition || "General Telehealth Consultation",
          avatar: pName
            .split(" ")
            .map((n: string) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
          bookingId: b._id,
          date: bookingDate,
        });
      });

      setAppointments(formattedAppointments);

      // Set Metric Counts
      setStats((prev) => ({
        ...prev,
        todayAppointments: formattedAppointments.length,
        pendingConsultations: formattedAppointments.filter(
          (a) => a.status === "Upcoming" || a.status === "In Progress"
        ).length,
        reportsToReview: totalReportsCount || 0,
      }));

      // Cache Prescriptions
      const savedRx = localStorage.getItem("onyx_doctor_prescriptions");
      if (savedRx) {
        try {
          const parsed = JSON.parse(savedRx);
          if (Array.isArray(parsed)) setPrescriptions(parsed.slice(0, 4));
        } catch (e) {
          console.debug("Could not parse saved prescriptions cache", e);
        }
      }
    } catch (err) {
      console.warn("Could not retrieve all doctor live metrics:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [consultFee]);

  useEffect(() => {
    fetchDashboardData();

    const handleRefresh = () => {
      fetchDashboardData();
    };

    window.addEventListener("onyx:refresh_dashboard", handleRefresh);
    window.addEventListener("onyx:booking_status", handleRefresh);

    return () => {
      window.removeEventListener("onyx:refresh_dashboard", handleRefresh);
      window.removeEventListener("onyx:booking_status", handleRefresh);
    };
  }, [fetchDashboardData]);

  /* ============================================================
     AVAILABILITY TOGGLE HANDLER
  ============================================================ */
  const handleToggleAvailability = async (checked: boolean) => {
    setTogglingAvailability(true);
    setIsAvailable(checked);
    localStorage.setItem("doctorAvailable", String(checked));

    try {
      await updateDoctorAvailability(checked);
      toast({
        title: checked
          ? "Online — Accepting Patient Consultations"
          : "Offline — In-Clinic / Break Mode",
        description: checked
          ? "Patients can now book and start live video consultations with you."
          : "Your queue is paused. You will not receive new instant calls.",
      });
    } catch {
      toast({
        title: checked ? "Status set to Online (Local)" : "Status set to Offline (Local)",
        description: "Status saved locally.",
      });
    } finally {
      setTogglingAvailability(false);
    }
  };

  /* ============================================================
     APPOINTMENT FILTERING & NEXT PATIENT (BY SELECTED DATE)
  ============================================================ */
  const filteredAppointments = useMemo(() => {
    const selectedDateStr = selectedDate.toISOString().slice(0, 10);
    return appointments.filter((apt) => {
      // Date match
      const aptDate = apt.date || new Date().toISOString().slice(0, 10);
      const isDateMatch = aptDate === selectedDateStr;
      if (!isDateMatch) return false;

      // Status match
      if (selectedFilter === "All") return true;
      return apt.status === selectedFilter;
    });
  }, [appointments, selectedDate, selectedFilter]);

  const nextPatient = useMemo(() => {
    return (
      appointments.find((a) => a.status === "In Progress") ||
      appointments.find((a) => a.status === "Upcoming") ||
      null
    );
  }, [appointments]);

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <DashboardLayout>
      {isMainDashboard ? (
        <div className="space-y-6 pb-12 animate-fadeIn font-sans text-slate-800">
          {/* Top Page Header with Prominent Device Check */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <PageHeader />
            <div className="flex items-center gap-2 -mt-2 sm:mt-0 mb-3 sm:mb-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPermissionsModalOpen(true)}
                className="rounded-[14px] border-slate-200 bg-white hover:bg-slate-50 text-[#14213D] h-9 px-3.5 text-xs font-extrabold flex items-center gap-2 shadow-xs"
              >
                <Camera className="h-4 w-4 text-[#35B7C9]" />
                <Mic className="h-4 w-4 text-[#F2052C]" />
                <span>Device Check</span>
              </Button>
            </div>
          </div>

          {/* ============================================================
              1. DOCTOR IDENTITY & AVAILABILITY COMMAND HERO
          ============================================================ */}
          <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-r from-[#14213D] via-[#1A2E56] to-[#14213D] p-6 text-white shadow-xl border border-white/10">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-[#F2052C]/15 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 -mb-16 w-64 h-64 rounded-full bg-[#35B7C9]/15 blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              {/* Doctor Identity Block */}
              <div className="flex items-start sm:items-center gap-4">
                <div className="relative">
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-[22px] bg-gradient-to-br from-[#F2052C] via-[#FF4B66] to-[#35B7C9] p-0.5 shadow-lg">
                    <div className="h-full w-full rounded-[20px] bg-[#14213D] flex items-center justify-center text-white font-extrabold text-xl sm:text-2xl">
                      {userName
                        ? userName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()
                        : "DR"}
                    </div>
                  </div>
                  {/* Real-time Online Indicator */}
                  <div
                    className={`absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-[#14213D] flex items-center justify-center ${
                      isAvailable ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full bg-white ${isAvailable ? "animate-pulse" : ""}`}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                      {userName ? (userName.toLowerCase().startsWith("dr") ? userName : `Dr. ${userName}`) : "Doctor Portal"}
                    </h2>
                    {onboardingStatus === "approved" ? (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3 text-emerald-400" /> NMC Verified Practitioner
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 text-amber-400" /> Setup Incomplete
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="flex items-center gap-1 text-[#35B7C9]">
                      <Stethoscope className="h-3.5 w-3.5" /> {doctorSpecialty}
                    </span>
                    <span className="text-white/30">•</span>
                    <span className="flex items-center gap-1 text-slate-300">
                      <Building2 className="h-3.5 w-3.5 text-slate-400" /> {hospitalAffiliation}
                    </span>
                    {regNumber && (
                      <>
                        <span className="text-white/30">•</span>
                        <span className="text-xs text-slate-400 font-mono">Reg: {regNumber}</span>
                      </>
                    )}
                  </p>

                  <p className="text-xs text-slate-400 font-medium">
                    Consultation Fee: <span className="font-extrabold text-white">₹{consultFee}</span> / consult · Razorpay Route Linked
                  </p>
                </div>
              </div>

              {/* Right Controls: Availability Switch + Launch Room */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Availability Switch Pill */}
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/15 rounded-[20px] px-4 py-2.5 shadow-inner">
                  <div className="text-right">
                    <Label
                      htmlFor="doctor-availability-toggle"
                      className="text-xs font-bold text-white cursor-pointer block leading-tight"
                    >
                      {isAvailable ? "Online — Accepting Calls" : "In-Clinic / Busy"}
                    </Label>
                    <span className="text-[10px] font-semibold text-slate-300">
                      {isAvailable ? "Live queue active" : "Queue paused"}
                    </span>
                  </div>
                  <Switch
                    id="doctor-availability-toggle"
                    checked={isAvailable}
                    disabled={togglingAvailability}
                    onCheckedChange={handleToggleAvailability}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                </div>

                {/* Device Check Button */}
                <Button
                  variant="outline"
                  onClick={() => setPermissionsModalOpen(true)}
                  className="rounded-[16px] bg-white/10 hover:bg-white/20 border-white/20 text-white h-11 px-3 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Camera className="h-4 w-4 text-[#35B7C9]" /> Device Check
                </Button>

                {/* Refresh Dashboard Button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setRefreshing(true);
                    fetchDashboardData();
                    toast({ title: "Refreshed live clinic metrics" });
                  }}
                  disabled={refreshing}
                  className="rounded-[16px] bg-white/10 hover:bg-white/20 border-white/20 text-white h-11 w-11 shadow-sm"
                  title="Refresh clinical data"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>

          {/* ============================================================
              2. HIGH-PRIORITY LIVE CALL ALERT BANNER
          ============================================================ */}
          {liveWaitingConsultation && (
            <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-r from-rose-600 via-red-500 to-amber-500 p-1 shadow-2xl shadow-rose-500/20 animate-pulse">
              <div className="rounded-[22px] bg-[#14213D] p-5 sm:p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#F2052C] to-[#FF4B66] flex items-center justify-center text-white font-extrabold text-xl shadow-lg shrink-0">
                    <Video className="h-7 w-7 animate-bounce" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-rose-500 text-white font-black text-[10px] uppercase tracking-wider px-2.5 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
                        <span className="h-2 w-2 rounded-full bg-white" /> LIVE PATIENT WAITING NOW
                      </span>
                      <span className="text-xs text-amber-300 font-bold">Immediate Telehealth Consultation</span>
                    </div>
                    <h3 className="text-lg font-black text-white mt-1">
                      {liveWaitingConsultation.patient}
                    </h3>
                    <p className="text-xs text-slate-300 font-medium">
                      {liveWaitingConsultation.type} • {liveWaitingConsultation.reason || "Telehealth Consultation"} · Scheduled:{" "}
                      <span className="text-white font-bold">{liveWaitingConsultation.time}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={() =>
                      navigate(
                        `/dashboard/doctor/consultations?bookingId=${liveWaitingConsultation.bookingId}&autoJoin=true`,
                        {
                          state: {
                            bookingId: liveWaitingConsultation.bookingId,
                            patient: liveWaitingConsultation.patient,
                            autoJoin: true,
                          },
                        }
                      )
                    }
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black rounded-[16px] h-12 px-6 text-xs shadow-xl flex items-center gap-2 border-none transform hover:scale-105 transition-all"
                  >
                    <Video className="h-4.5 w-4.5" /> JOIN VIDEO ROOM NOW
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================
              3. CLINICAL STATUS CARDS (Refined & Clinical-Centric)
          ============================================================ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div
              onClick={() => navigate("/dashboard/doctor/consultations")}
              className="cursor-pointer transition-transform hover:scale-[1.02]"
            >
              <StatCard
                title="Active in Queue"
                value={stats.pendingConsultations}
                icon={Video}
                variant="primary"
                trend={{ value: "Live Triage", isPositive: true }}
              />
            </div>

            <div
              onClick={() => navigate("/dashboard/doctor/reports")}
              className="cursor-pointer transition-transform hover:scale-[1.02]"
            >
              <StatCard
                title="Reports to Review"
                value={stats.reportsToReview}
                icon={FileText}
                variant="warning"
                trend={{ value: "Kiosk Vitals & Labs", isPositive: true }}
              />
            </div>

            <div
              onClick={() => navigate("/dashboard/doctor/schedule")}
              className="cursor-pointer transition-transform hover:scale-[1.02]"
            >
              <StatCard
                title="Working Hours & Shifts"
                value="Active Shifts"
                icon={Clock}
                variant="secondary"
                trend={{ value: "Manage Availability", isPositive: true }}
              />
            </div>
          </div>

          {/* ============================================================
              4. SPLIT CLINICAL WORKSPACE: Left (Agenda) | Right (Tools & Rx)
          ============================================================ */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Today's Consultation Schedule (8 cols) */}
            <div className="lg:col-span-8 bg-white/90 backdrop-blur-md rounded-[24px] border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-[12px] bg-rose-50 flex items-center justify-center text-[#F2052C]">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#14213D]">
                      Consultation Schedule
                    </h3>
                    <p className="text-xs text-slate-400 font-semibold">
                      {filteredAppointments.length} appointment(s) on selected date
                    </p>
                  </div>
                </div>

                {/* Date Navigator Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-[14px] p-1 shadow-xs">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const prev = new Date(selectedDate);
                        prev.setDate(prev.getDate() - 1);
                        setSelectedDate(prev);
                      }}
                      className="h-7 w-7 rounded-[10px]"
                      title="Previous Day"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
                    </Button>
                    <span className="text-xs font-bold text-[#14213D] px-2 flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-[#35B7C9]" />
                      {selectedDate.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const next = new Date(selectedDate);
                        next.setDate(next.getDate() + 1);
                        setSelectedDate(next);
                      }}
                      className="h-7 w-7 rounded-[10px]"
                      title="Next Day"
                    >
                      <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                    </Button>
                  </div>

                  {selectedDate.toDateString() !== new Date().toDateString() && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDate(new Date())}
                      className="h-8 text-xs font-bold text-[#F2052C] hover:bg-rose-50 px-2.5 rounded-[10px]"
                    >
                      Today
                    </Button>
                  )}
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-[14px] text-xs font-bold text-slate-500 overflow-x-auto">
                  {(["All", "Upcoming", "In Progress", "Completed", "Expired"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setSelectedFilter(filter)}
                      className={`px-3 py-1 rounded-[10px] transition-all whitespace-nowrap ${
                        selectedFilter === filter
                          ? "bg-white text-[#14213D] shadow-sm font-extrabold"
                          : "hover:text-[#14213D]"
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule List */}
              {filteredAppointments.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/50 rounded-[20px] border border-dashed border-slate-200">
                  <Calendar className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-extrabold text-[#14213D]">No appointments in this view</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Select another filter or launch the Virtual Clinic to intake walk-in patients.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAppointments.map((apt) => {
                    const sc = STATUS_CONFIG[apt.status] || STATUS_CONFIG.Upcoming;
                    const isLive = apt.status === "In Progress" || apt.status === "Urgent";

                    return (
                      <div
                        key={apt.id}
                        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-[18px] border transition-all ${
                          isLive
                            ? "bg-gradient-to-r from-rose-50/70 via-white to-white border-[#F2052C]/30 shadow-sm ring-1 ring-[#F2052C]/10"
                            : "bg-white hover:bg-slate-50/60 border-slate-100 hover:border-slate-200 shadow-xs"
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="h-11 w-11 rounded-[14px] bg-gradient-to-br from-[#14213D] to-[#35B7C9] flex items-center justify-center text-white font-black text-xs shadow-sm shrink-0">
                            {apt.avatar || "PT"}
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <h4 className="text-sm font-extrabold text-[#14213D] truncate">
                              {apt.patient}
                            </h4>
                            <p className="text-xs text-slate-500 font-medium truncate">
                              {apt.reason || apt.type}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 justify-between sm:justify-end shrink-0">
                          <span className="text-xs font-mono font-bold text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {apt.time}
                          </span>

                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${sc.bg} ${sc.text} ${sc.border}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                            {apt.status}
                          </span>

                          {isLive || apt.status === "Upcoming" ? (
                            <Button
                              size="sm"
                              onClick={() =>
                                navigate(
                                  `/dashboard/doctor/consultations?bookingId=${apt.bookingId}&autoJoin=true`,
                                  {
                                    state: {
                                      bookingId: apt.bookingId,
                                      patient: apt.patient,
                                      autoJoin: true,
                                    },
                                  }
                                )
                              }
                              className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white rounded-[12px] h-8 px-3.5 text-xs font-bold border-none shadow-sm hover:opacity-90 flex items-center gap-1.5"
                            >
                              <Video className="h-3.5 w-3.5" />
                              {isLive ? "Join Call" : "Connect"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                navigate("/dashboard/doctor/consultations", {
                                  state: {
                                    bookingId: apt.bookingId,
                                    patient: apt.patient,
                                  },
                                })
                              }
                              className="rounded-[12px] h-8 text-xs font-bold border-slate-200 text-slate-600 hover:bg-slate-50"
                            >
                              Dossier
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Quick Clinical Tools & Next Patient Highlight (4 cols) */}
            <div className="lg:col-span-4 space-y-5">
              {/* Highlight Card: Next Patient In Queue */}
              {nextPatient && (
                <div className="rounded-[24px] bg-gradient-to-br from-blue-50/70 via-indigo-50/50 to-white border border-blue-200/80 p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white px-2.5 py-0.5 rounded-full">
                      {nextPatient.status === "In Progress" ? "Live in Call" : "Next in Queue"}
                    </span>
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-slate-400" /> {nextPatient.time}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-[14px] bg-gradient-to-br from-[#14213D] to-[#35B7C9] flex items-center justify-center text-white font-extrabold text-xs shadow-sm shrink-0">
                      {nextPatient.avatar || "PT"}
                    </div>
                    <div className="space-y-0.5 min-w-0">
                      <h4 className="text-sm font-extrabold text-[#14213D] truncate">{nextPatient.patient}</h4>
                      <p className="text-xs text-slate-500 font-medium truncate">{nextPatient.reason}</p>
                    </div>
                  </div>

                  <Button
                    onClick={() =>
                      navigate(
                        `/dashboard/doctor/consultations?bookingId=${nextPatient.bookingId}&autoJoin=true`,
                        {
                          state: {
                            bookingId: nextPatient.bookingId,
                            patient: nextPatient.patient,
                            autoJoin: true,
                          },
                        }
                      )
                    }
                    className="w-full bg-[#14213D] hover:bg-[#1E2E4E] text-white rounded-[14px] font-bold text-xs h-10 shadow-sm flex items-center justify-center gap-2"
                  >
                    <Video className="h-4 w-4 text-[#35B7C9]" /> Start Telehealth Session
                  </Button>
                </div>
              )}

              {/* Quick Clinical Launch Tools */}
              <div className="bg-white/90 backdrop-blur-md rounded-[24px] border border-slate-200/80 shadow-sm p-5 space-y-3">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#F2052C]" /> Doctor Command Shortcuts
                </h4>

                <div className="grid grid-cols-1 gap-2">
                  {[
                    { label: "Telehealth Virtual Clinic", desc: "Split-screen command center", path: "/dashboard/doctor/consultations", icon: Video, color: "text-[#F2052C]" },
                    { label: "Manage Slot Schedule", desc: "Weekly hours & break times", path: "/dashboard/doctor/schedule", icon: Calendar, color: "text-[#35B7C9]" },
                    { label: "Electronic Prescriptions", desc: "NMC digital signed slips", path: "/dashboard/doctor/prescriptions", icon: FileSignature, color: "text-emerald-600" },
                    { label: "Kiosk Vitals & Reports", desc: "Diagnostic lab analytics", path: "/dashboard/doctor/reports", icon: FileText, color: "text-amber-600" },
                  ].map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.path}
                        onClick={() => navigate(tool.path)}
                        className="flex items-center justify-between p-3 rounded-[16px] bg-slate-50 hover:bg-slate-100/80 transition-all border border-slate-100 text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-[12px] bg-white flex items-center justify-center shadow-xs">
                            <Icon className={`h-4.5 w-4.5 ${tool.color}`} />
                          </div>
                          <div>
                            <div className="text-xs font-extrabold text-[#14213D] group-hover:text-[#F2052C] transition-colors">
                              {tool.label}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">{tool.desc}</div>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <Outlet />
        </div>
      )}

      {/* Global Incoming Consultation Ringing Alert Modal */}
      <IncomingCallModal
        call={activeCall}
        onAccept={acceptCall}
        onDismiss={dismissCall}
        isMuted={isMuted}
        onToggleMute={toggleMute}
      />

      {/* Device Permissions Check Modal */}
      <DevicePermissionsModal
        open={permissionsModalOpen}
        onOpenChange={setPermissionsModalOpen}
      />
    </DashboardLayout>
  );
};

export default DoctorDashboard;
