import { useEffect, useState, useMemo, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StatCard from "@/components/dashboard/StatCard";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
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
  Plus,
  ShieldCheck,
  Stethoscope,
  Activity,
  RefreshCw,
  ArrowUpRight,
  Sparkles,
  FileSignature,
  Building2,
  Award,
  Timer,
  Check,
  User,
  HeartPulse,
} from "lucide-react";

import {
  getOnboardingStatus,
  updateDoctorAvailability,
  getDoctorAvailability,
  getPrescription,
} from "@/services/doctor.service";
import { listBookings } from "@/services/booking.service";
import { viewProfile } from "@/services/profile.service";
import { viewUser } from "@/services/user.service";
import { listReports, listConsultationsReport } from "@/services/report.service";
import { getSettlements } from "@/services/analytics.service";
import { IncomingCallModal } from "@/components/dashboard/IncomingCallModal";
import { useIncomingCallWatcher } from "@/hooks/useIncomingCallWatcher";

/* ============================================================
   FALLBACK / DEFAULT CLINICAL DATA (for offline/demo resiliency)
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

  // Dynamic Metrics
  const [stats, setStats] = useState({
    todayAppointments: 0,
    pendingConsultations: 0,
    reportsToReview: 0,
    thisMonthEarnings: "₹0",
  });

  /* ============================================================
     FETCH DOCTOR DASHBOARD LIVE DATA
  ============================================================ */
  const fetchDashboardData = useCallback(async () => {
    try {
      // 1. Fetch user details
      const user = await viewUser().catch(() => null);
      if (user?.name) {
        setUserName(user.name);
        localStorage.setItem("userName", user.name);
      }

      // 2. Fetch doctor onboarding status and profile details
      const statusRes = await getOnboardingStatus().catch(() => null);
      if (statusRes && statusRes.status === "success") {
        const isApproved =
          statusRes.onboardingStatus === "approved" ||
          statusRes.onboardingComplete ||
          localStorage.getItem("doctorOnboarded") === "true";

        if (isApproved) {
          setOnboardingStatus("approved");
          localStorage.setItem("doctorOnboarded", "true");
        } else if (statusRes.onboardingStatus === "onboarding_complete" || statusRes.onboardingStatus === "pending_approval") {
          setOnboardingStatus("pending");
        } else {
          setOnboardingStatus("in_progress");
          setNextStep(statusRes.nextStep || 1);
        }

        // Extract profile metadata if available
        const s1 = statusRes.stepData?.step1;
        const s2 = statusRes.stepData?.step2;
        const s3 = statusRes.stepData?.step3;
        const s4 = statusRes.stepData?.step4;

        if (s1?.specialty) setDoctorSpecialty(s1.specialty);
        if (s2?.hospitalName) setHospitalAffiliation(s2.hospitalName);
        if (s3?.registrationNumber) setRegNumber(s3.registrationNumber);
        if (s4?.consultationFee) setConsultFee(String(s4.consultationFee));
      } else if (localStorage.getItem("doctorOnboarded") === "true") {
        setOnboardingStatus("approved");
      } else {
        setOnboardingStatus("in_progress");
      }

      // 3. Fetch doctor availability from API
      try {
        const availRes = await getDoctorAvailability().catch(() => null);
        if (availRes && typeof availRes.isAvailable === "boolean") {
          setIsAvailable(availRes.isAvailable);
          localStorage.setItem("doctorAvailable", String(availRes.isAvailable));
        }
      } catch {
        // Fallback to local storage
      }

      // 4. Fetch live bookings & schedule
      const bookingsRes = await listBookings().catch(() => null);
      const bookingsList = Array.isArray(bookingsRes)
        ? bookingsRes
        : bookingsRes?.data || bookingsRes?.bookings || [];

      if (bookingsList.length > 0) {
        const now = new Date();

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

        const format12H = (hhmm: string) => {
          if (!hhmm || !hhmm.includes(":")) return hhmm || "";
          const [h, m] = hhmm.split(":").map(Number);
          const ampm = h >= 12 ? "PM" : "AM";
          const h12 = h % 12 || 12;
          return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
        };

        // Map backend bookings to appointment format
        const mappedAppointments: AppointmentItem[] = bookingsList.map(
          (b: any, index: number) => {
            const pIdStr = typeof b.profileId === "string" ? b.profileId : b.profileId?._id;
            const fetchedProfile = pIdStr ? profileMap.get(pIdStr) : null;
            const patientName =
              fetchedProfile?.name ||
              b.profileId?.name ||
              b.userId?.name ||
              b.patientName ||
              `Patient #${b._id?.slice(-4) || index + 1}`;

            // Parse formatted slot time string
            let timeStr = "10:00 AM";
            if (b.slotTimeStart) {
              timeStr = format12H(b.slotTimeStart);
              if (b.slotTimeEnd) {
                timeStr = `${format12H(b.slotTimeStart)} - ${format12H(b.slotTimeEnd)}`;
              }
            } else if (b.slot) {
              if (typeof b.slot === "string" && b.slot.includes(":")) {
                timeStr = b.slot;
              } else {
                const d = new Date(b.slot);
                if (!isNaN(d.getTime())) {
                  timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
                }
              }
            } else if (b.time) {
              timeStr = b.time;
            }

            // Expiry calculation based on slot date & end time
            let isExpired = false;
            if (b.expiresAt) {
              const exp = new Date(b.expiresAt);
              if (!isNaN(exp.getTime()) && now > exp) {
                isExpired = true;
              }
            }

            if (!isExpired && (b.slotDate || b.slot)) {
              const dateRaw = String(b.slotDate || b.slot || "");
              const dateStr = dateRaw.slice(0, 10);
              const endHHMM = b.slotTimeEnd || b.slotTimeStart;
              if (dateStr.includes("-") && endHHMM && endHHMM.includes(":")) {
                const [y, m, d] = dateStr.split("-").map(Number);
                const [eh, em] = endHHMM.split(":").map(Number);
                const slotEndObj = new Date(y, m - 1, d, eh, em, 0);
                if (now > slotEndObj) {
                  isExpired = true;
                }
              } else {
                const slotDateObj = new Date(dateRaw);
                if (!isNaN(slotDateObj.getTime())) {
                  if (endHHMM && endHHMM.includes(":")) {
                    const [eh, em] = endHHMM.split(":").map(Number);
                    const slotEndObj = new Date(slotDateObj);
                    slotEndObj.setHours(eh, em || 0, 0, 0);
                    if (now > slotEndObj) {
                      isExpired = true;
                    }
                  }
                }
              }
            }

            const bStatus = (b.status || "confirmed").toLowerCase();
            let statusBadge: "Upcoming" | "In Progress" | "Completed" | "Urgent" | "Expired" | "Cancelled" = "Upcoming";

            if (bStatus === "completed" || bStatus === "finished") {
              statusBadge = "Completed";
            } else if (bStatus === "cancelled") {
              statusBadge = "Cancelled";
            } else if (bStatus === "expired") {
              statusBadge = "Expired";
            } else if (bStatus.includes("progress") || bStatus === "active" || bStatus === "calling") {
              statusBadge = "In Progress";
            } else if (bStatus.includes("urgent") || bStatus.includes("emergency")) {
              statusBadge = "Urgent";
            } else if (isExpired) {
              statusBadge = "Expired";
            } else {
              statusBadge = "Upcoming";
            }

            return {
              id: b._id || `b-${index}`,
              patient: patientName,
              time: timeStr,
              type: b.type === "scheduled" ? "Scheduled Video" : b.type || "Telehealth Video",
              status: statusBadge,
              reason: b.reason || "General Consultation",
              avatar: patientName
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase(),
              bookingId: b._id,
            };
          }
        );

        setAppointments(mappedAppointments);

        // Compute dynamic counts (only active calls count as pending)
        const pendingVideo = mappedAppointments.filter(
          (a) => a.status === "Upcoming" || a.status === "In Progress"
        ).length;

        setStats((prev) => ({
          ...prev,
          todayAppointments: mappedAppointments.length,
          pendingConsultations: pendingVideo,
        }));
      }

      // 5. Fetch consultations report / reports count
      const reportRes = await listConsultationsReport().catch(() => null);
      const consultReports = Array.isArray(reportRes)
        ? reportRes
        : reportRes?.reports || reportRes?.data || [];

      if (consultReports.length > 0) {
        const pendingCount = consultReports.filter(
          (r: any) => !r.isReviewed && r.status !== "Completed"
        ).length;
        setStats((prev) => ({
          ...prev,
          reportsToReview: pendingCount || prev.reportsToReview,
        }));
      }

      // 6. Fetch settlements/earnings (in INR ₹)
      const settlementsRes = await getSettlements().catch(() => null);
      const settlementsList = Array.isArray(settlementsRes)
        ? settlementsRes
        : settlementsRes?.settlements || settlementsRes?.data || [];

      if (settlementsList.length > 0) {
        const total = settlementsList.reduce((acc: number, item: any) => {
          const val = Number(item.amount || item.payoutAmount || 0);
          return acc + (isNaN(val) ? 0 : val);
        }, 0);

        if (total > 0) {
          setStats((prev) => ({
            ...prev,
            thisMonthEarnings: `₹${total.toLocaleString("en-IN")}`,
          }));
        }
      }

      // 7. Fetch real diagnostic reports from kiosks
      const realReports = await listReports().catch(() => null);
      const reportsList = Array.isArray(realReports) ? realReports : realReports?.reports || [];
      if (reportsList.length > 0) {
        const mappedReports = reportsList.slice(0, 4).map((r: any) => ({
          id: r._id || r.reportCode,
          patient: r.profile?.name || "Patient",
          report: r.reportCode || "Diagnostic Kiosk Vitals Screen",
          status: r.isReviewed ? "Reviewed" : "Pending Review",
          device: r.product?.deviceCode || "ONYX-Kiosk",
          date: r.createdAt
            ? new Date(r.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
            : "Today",
        }));
        setReports(mappedReports);
        setStats((prev) => ({
          ...prev,
          reportsToReview: reportsList.filter((r: any) => !r.isReviewed).length,
        }));
      } else {
        setReports([]);
        setStats((prev) => ({
          ...prev,
          reportsToReview: 0,
        }));
      }

      // 8. Load real electronic prescriptions from server bookings & cache
      const serverRx: any[] = [];
      if (bookingsList.length > 0) {
        for (const b of bookingsList.slice(0, 4)) {
          try {
            const rxRes = await getPrescription(b._id || b.id).catch(() => null);
            if (rxRes && (rxRes.prescription || rxRes.data || rxRes.medications)) {
              const p = rxRes.prescription || rxRes.data || rxRes;
              const pName =
                b.profileId?.name ||
                b.userId?.name ||
                b.patientName ||
                p.patientName ||
                "Patient";
              serverRx.push({
                id: p._id || `rx-${b._id}`,
                patient: pName,
                medication: Array.isArray(p.medications) && p.medications[0]
                  ? `${p.medications[0].name} ${p.medications[0].dosage || ""}`
                  : p.medication || "Prescribed Medicine",
                date: p.createdAt
                  ? new Date(p.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
                  : "Today",
                icon: pName
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase(),
                refillStatus:
                  p.refillStatus === "approved"
                    ? "Active"
                    : p.refillStatus === "requested"
                    ? "Requested"
                    : "Active",
              });
            }
          } catch {
            // No prescription for this booking
          }
        }
      }

      const savedPrescriptions = localStorage.getItem("onyx_doctor_prescriptions");
      let cachedValid: any[] = [];
      if (savedPrescriptions) {
        try {
          const parsed = JSON.parse(savedPrescriptions);
          if (Array.isArray(parsed) && parsed.length > 0) {
            cachedValid = parsed
              .filter(
                (p: any) =>
                  p &&
                  p.id !== "rx-1" &&
                  p.id !== "rx-2" &&
                  p.id !== "rx-3" &&
                  p.patient !== "Aarav Sharma" &&
                  p.patient !== "Priya Nair" &&
                  p.patient !== "Vikram Das"
              )
              .map((p: any) => ({
                id: p.id,
                patient: p.patient,
                medication: p.medications?.[0]
                  ? `${p.medications[0].name} ${p.medications[0].dosage || ""}`
                  : "Prescribed Medication",
                date: p.issuedDate || "Recent",
                icon: p.avatar || "RX",
                refillStatus:
                  p.refillStatus === "approved"
                    ? "Active"
                    : p.refillStatus === "requested"
                    ? "Requested"
                    : "Active",
              }));
          }
        } catch (err) {
          console.debug("Prescription cache parsing note:", err);
        }
      }

      // Merge server and valid local prescriptions without duplicates
      const mergedRx = [...serverRx];
      cachedValid.forEach((c) => {
        if (!mergedRx.some((x) => x.id === c.id)) {
          mergedRx.push(c);
        }
      });
      setPrescriptions(mergedRx.slice(0, 4));
    } catch (err) {
      console.warn("Could not retrieve all doctor live metrics, using local fallback:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
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
          ? "Online — Accepting Consultations"
          : "Offline — In-Clinic / On Break",
        description: checked
          ? "Patients can now book live video appointments with you."
          : "Your queue is paused. You will not receive new incoming calls.",
      });
    } catch (err) {
      console.warn("Failed to sync availability to server:", err);
      toast({
        title: checked ? "Status set to Online (Local)" : "Status set to Offline (Local)",
        description: "Status saved locally.",
      });
    } finally {
      setTogglingAvailability(false);
    }
  };

  /* ============================================================
     APPOINTMENT FILTERING
  ============================================================ */
  const filteredAppointments = useMemo(() => {
    if (selectedFilter === "All") return appointments;
    return appointments.filter((apt) => apt.status === selectedFilter);
  }, [appointments, selectedFilter]);

  // Next Patient in Queue (top upcoming or in-progress only, never expired)
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
        <div className="space-y-6 animate-fadeIn pb-12">
          {/* Top Header */}
          <PageHeader />

          {/* Clinical Profile Header & Availability Control */}
          <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-r from-[#14213D] via-[#1A2E56] to-[#14213D] p-6 text-white shadow-xl border border-white/10">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-[#F2052C]/15 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 -mb-16 w-64 h-64 rounded-full bg-[#35B7C9]/15 blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              {/* Doctor Details */}
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
                      className={`h-2.5 w-2.5 rounded-full bg-white ${
                        isAvailable ? "animate-pulse" : ""
                      }`}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                      {userName ? (userName.toLowerCase().startsWith("dr") ? userName : `Dr. ${userName}`) : "Doctor Portal"}
                    </h2>
                    {onboardingStatus === "approved" ? (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3 text-emerald-400" /> Verified Practitioner
                      </Badge>
                    ) : onboardingStatus === "pending" ? (
                      <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="h-3 w-3 text-amber-400" /> Verification Pending
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-[11px] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 text-rose-400" /> Setup Incomplete
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
                        <span className="text-xs text-slate-400 font-mono">
                          Reg: {regNumber}
                        </span>
                      </>
                    )}
                  </p>

                  <p className="text-xs text-slate-400 font-medium">
                    Fee: <span className="font-extrabold text-white">₹{consultFee}</span> / consult · Settlement via Razorpay Route
                  </p>
                </div>
              </div>

              {/* Right Controls: Availability Switch + Actions */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Availability Toggle Box */}
                <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/15 rounded-[18px] px-4 py-2.5 shadow-inner">
                  <div className="text-right">
                    <Label
                      htmlFor="doctor-availability"
                      className="text-xs font-bold text-white cursor-pointer block leading-tight"
                    >
                      {isAvailable ? "Available for Calls" : "In-Clinic / Busy"}
                    </Label>
                    <span className="text-[10px] font-semibold text-slate-300">
                      {isAvailable ? "Accepting bookings" : "Queue paused"}
                    </span>
                  </div>
                  <Switch
                    id="doctor-availability"
                    checked={isAvailable}
                    disabled={togglingAvailability}
                    onCheckedChange={handleToggleAvailability}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                </div>

                {/* Refresh Dashboard Button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setRefreshing(true);
                    fetchDashboardData();
                    toast({ title: "Refreshed dashboard metrics" });
                  }}
                  disabled={refreshing}
                  className="rounded-[16px] bg-white/10 hover:bg-white/20 border-white/20 text-white h-10 w-10 shadow-sm"
                  title="Refresh clinical data"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                </Button>

                {/* Quick Consult Launcher */}
                <Button
                  onClick={() => navigate("/dashboard/doctor/consultations")}
                  className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] hover:opacity-90 text-white font-extrabold rounded-[16px] h-10 px-4 border-none shadow-md shadow-[#F2052C]/30 text-xs flex items-center gap-1.5"
                >
                  <Video className="h-4 w-4" /> Start Video Room
                </Button>
              </div>
            </div>
          </div>

          {/* High-Priority Live Consultation Alert Banner (Real-time, No Refresh Needed) */}
          {liveWaitingConsultation && (
            <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-r from-rose-600 via-red-500 to-amber-500 p-1 shadow-2xl shadow-rose-500/30 animate-pulse">
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
                      {liveWaitingConsultation.type} • {liveWaitingConsultation.reason || "Telehealth Consultation"} • Scheduled: <span className="text-white font-bold">{liveWaitingConsultation.time}</span>
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
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black rounded-xl h-12 px-6 text-sm shadow-xl flex items-center gap-2 border-none transform hover:scale-105 transition-all"
                  >
                    <Video className="h-5 w-5" /> JOIN VIDEO ROOM NOW
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Onboarding Alert Banner (if setup incomplete or pending) */}
          {onboardingStatus !== "approved" && (
            <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border border-amber-300/80 rounded-[22px] p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-[14px] bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-[#14213D] text-sm">
                      {onboardingStatus === "pending"
                        ? "Profile Submitted — Regulatory Verification in Progress"
                        : `Onboarding Profile Incomplete (Step ${nextStep} of 5)`}
                    </h4>
                    <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase">
                      Action Required
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    {onboardingStatus === "pending"
                      ? "Your clinical registration and bank details are under review by Executive Administration. You can preview your submitted details anytime."
                      : "Complete your 5-step professional credentials, clinical schedule, and linked payout account to unlock full patient bookings."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={() => navigate("/dashboard/doctor/onboarding")}
                  className="bg-amber-500 hover:bg-amber-600 text-white rounded-[14px] font-bold text-xs h-9 px-4 border-none shadow-sm flex items-center gap-1"
                >
                  {onboardingStatus === "pending" ? "View Submission" : "Continue Setup"}
                  <ChevronRight className="h-4 w-4 ml-0.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Quick Clinical Navigation Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#F2052C]" /> Doctor Command Center
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: "My Schedule", path: "/dashboard/doctor/schedule", icon: Calendar },
                { label: "Telehealth Room", path: "/dashboard/doctor/consultations", icon: Video },
                { label: "Issue Prescription", path: "/dashboard/doctor/prescriptions", icon: FileSignature },
                { label: "Kiosk Reports", path: "/dashboard/doctor/reports", icon: FileText },
                { label: "Payouts & Settlements", path: "/dashboard/doctor/payments", icon: CreditCard },
              ].map((tool) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={tool.path}
                    onClick={() => navigate(tool.path)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-[14px] bg-white/70 hover:bg-white text-xs font-bold text-[#14213D] border border-white/70 shadow-sm transition-all hover:scale-[1.02] active:scale-95"
                  >
                    <Icon className="h-3.5 w-3.5 text-[#F2052C]" />
                    {tool.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4 Clinical Stat Cards (Clickable) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div
              onClick={() => navigate("/dashboard/doctor/schedule")}
              className="cursor-pointer transition-transform hover:scale-[1.02]"
            >
              <StatCard
                title="Today's Appointments"
                value={stats.todayAppointments}
                icon={Calendar}
                variant="primary"
                trend={{ value: "Live Schedule", isPositive: true }}
              />
            </div>

            <div
              onClick={() => navigate("/dashboard/doctor/consultations")}
              className="cursor-pointer transition-transform hover:scale-[1.02]"
            >
              <StatCard
                title="Pending Consultations"
                value={stats.pendingConsultations}
                icon={Video}
                variant="secondary"
                trend={{ value: "Queue Active", isPositive: true }}
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
                trend={{ value: "Kiosk Vitals", isPositive: true }}
              />
            </div>

            <div
              onClick={() => navigate("/dashboard/doctor/payments")}
              className="cursor-pointer transition-transform hover:scale-[1.02]"
            >
              <StatCard
                title="This Month Earnings"
                value={stats.thisMonthEarnings}
                icon={CreditCard}
                variant="success"
                trend={{ value: "Auto-Settled", isPositive: true }}
              />
            </div>
          </div>

          {/* Highlight Card: Next Patient In Queue */}
          {nextPatient && (
            <div className="rounded-[24px] bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-emerald-500/10 border border-blue-200/80 p-5 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div className="h-12 w-12 rounded-[16px] bg-gradient-to-br from-[#14213D] to-[#35B7C9] flex items-center justify-center text-white font-extrabold text-base shadow-md shrink-0">
                    {nextPatient.avatar || "PT"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider bg-rose-500 text-white px-2 py-0.5 rounded-full">
                        {nextPatient.status === "In Progress" ? "In Consultation" : "Next Patient"}
                      </span>
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" /> {nextPatient.time}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-[#14213D] mt-0.5">
                      {nextPatient.patient}
                    </h3>
                    <p className="text-xs text-slate-600 font-medium">
                      {nextPatient.reason || "Scheduled Telehealth Consultation"} ·{" "}
                      <span className="text-[#35B7C9] font-bold">{nextPatient.type}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => navigate("/dashboard/doctor/consultations")}
                    className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] hover:opacity-90 text-white rounded-[14px] font-bold text-xs h-10 px-5 border-none shadow-md shadow-[#F2052C]/30 flex items-center gap-2"
                  >
                    <Video className="h-4 w-4" /> Start Video Consult
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Today's Schedule Feed */}
          <div className="bg-white/70 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-[12px] bg-rose-50 flex items-center justify-center text-[#F2052C]">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#14213D]">
                    Today's Consultation Schedule
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold">
                    {appointments.length} appointment(s) registered for today
                  </p>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-[14px]">
                {(["All", "Upcoming", "In Progress", "Completed", "Expired"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSelectedFilter(filter)}
                    className={`px-3 py-1 rounded-[10px] text-xs font-bold transition-all ${
                      selectedFilter === filter
                        ? "bg-white text-[#14213D] shadow-sm"
                        : "text-slate-500 hover:text-[#14213D]"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            {filteredAppointments.length === 0 ? (
              <div className="text-center py-10 bg-slate-50/50 rounded-[18px]">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-extrabold text-[#14213D]">
                  No appointments found
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  No appointments match the "{selectedFilter}" filter right now.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAppointments.map((apt) => {
                  const sc = STATUS_CONFIG[apt.status] || STATUS_CONFIG["Upcoming"];
                  return (
                    <div
                      key={apt.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-[18px] bg-slate-50/70 hover:bg-white transition-all border border-slate-100 gap-3"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-11 w-11 rounded-[14px] bg-gradient-to-br from-[#14213D] to-[#35B7C9] flex items-center justify-center text-white font-extrabold text-sm shadow-sm shrink-0">
                          {apt.avatar ||
                            apt.patient
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-extrabold text-[#14213D]">
                            {apt.patient}
                          </p>
                          <p className="text-xs text-slate-500 font-semibold flex items-center gap-2">
                            <span>{apt.type}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-slate-400 font-medium">
                              {apt.reason}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <span
                          className={`text-sm font-mono ${
                            apt.status === "Expired" || apt.status === "Completed"
                              ? "font-semibold text-slate-500"
                              : "font-extrabold text-[#F2052C]"
                          }`}
                        >
                          {apt.time}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${sc.bg} ${sc.text} ${sc.border}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                          {apt.status}
                        </span>

                        {apt.status === "In Progress" || apt.status === "Upcoming" ? (
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
                            className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white rounded-[12px] h-8 text-xs font-bold border-none shadow-sm hover:opacity-90 flex items-center gap-1"
                          >
                            <Video className="h-3.5 w-3.5" />
                            {apt.status === "In Progress" ? "Join Call" : "Open"}
                          </Button>
                        ) : apt.status === "Expired" ? (
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
                            className="rounded-[12px] h-8 text-xs font-bold border-slate-200 text-slate-500 hover:bg-slate-100"
                          >
                            Details
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
                            className="rounded-[12px] h-8 text-xs font-bold border-slate-200"
                          >
                            View Notes
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Two-Column Grid: Electronic Prescriptions & Diagnostic Reports */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Recent Prescriptions */}
            <div className="bg-white/70 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-[10px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <FileSignature className="h-4 w-4" />
                    </div>
                    <h3 className="text-base font-extrabold text-[#14213D]">
                      Recent Prescriptions
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/dashboard/doctor/prescriptions")}
                    className="text-xs font-extrabold text-[#F2052C] hover:text-[#FF4B66] hover:bg-rose-50 rounded-[12px] h-8"
                  >
                    View All <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>

                {prescriptions.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50/60 rounded-[18px]">
                    <FileSignature className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-extrabold text-[#14213D]">No prescriptions issued yet</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      You have not issued any electronic prescriptions yet.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => navigate("/dashboard/doctor/prescriptions")}
                      className="mt-3 bg-[#14213D] hover:bg-[#1A2E56] text-white rounded-[12px] text-xs font-bold h-8"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Issue First Rx
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {prescriptions.map((rx) => (
                      <div
                        key={rx.id}
                        onClick={() => navigate("/dashboard/doctor/prescriptions")}
                        className="flex items-center gap-4 p-3.5 rounded-[16px] bg-slate-50/70 hover:bg-white transition-all cursor-pointer border border-transparent hover:border-slate-100"
                      >
                        <div className="h-10 w-10 rounded-[12px] bg-gradient-to-br from-[#14213D] to-[#1e2d4a] flex items-center justify-center text-white font-extrabold text-xs shadow-sm shrink-0">
                          {rx.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-extrabold text-[#14213D] truncate">
                            {rx.patient}
                          </p>
                          <p className="text-xs text-slate-500 font-semibold truncate">
                            {rx.medication}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                              rx.refillStatus === "Requested"
                                ? "bg-amber-50 text-amber-600 border border-amber-200"
                                : "bg-emerald-50 text-emerald-600 border border-emerald-200"
                            }`}
                          >
                            {rx.refillStatus}
                          </span>
                          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                            {rx.date}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs text-slate-400 font-medium">
                  Digital signoff with licensed doctor credentials
                </p>
                <Button
                  size="sm"
                  onClick={() => navigate("/dashboard/doctor/prescriptions")}
                  className="bg-[#14213D] hover:bg-[#1A2E56] text-white rounded-[12px] text-xs font-bold h-8 px-3"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> New Prescription
                </Button>
              </div>
            </div>

            {/* Active Telehealth Consultations & Queue */}
            <div className="bg-white/70 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-[10px] bg-rose-50 text-[#F2052C] flex items-center justify-center">
                      <Video className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-[#14213D]">
                        Active Consultation Queue
                      </h3>
                      <p className="text-[10px] text-slate-400 font-semibold">Live incoming & upcoming patient visits</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/dashboard/doctor/consultations")}
                    className="text-xs font-extrabold text-[#F2052C] hover:text-[#FF4B66] hover:bg-rose-50 rounded-[12px] h-8"
                  >
                    All Consults <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>

                <div className="space-y-3">
                  {appointments.filter((a) => a.status === "Upcoming" || a.status === "In Progress").length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center bg-slate-50/50 rounded-[18px] border border-dashed border-slate-200">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">Queue is Clear</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 max-w-[220px]">
                        Standing by. When patients initiate instant or scheduled calls, they will appear here automatically.
                      </p>
                    </div>
                  ) : (
                    appointments
                      .filter((a) => a.status === "Upcoming" || a.status === "In Progress")
                      .slice(0, 4)
                      .map((apt) => (
                        <div
                          key={apt.id}
                          className="flex items-center justify-between p-3.5 rounded-[16px] bg-slate-50/70 hover:bg-white transition-all border border-slate-100 hover:border-slate-200 shadow-xs"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-[12px] bg-gradient-to-br from-[#14213D] to-[#35B7C9] flex items-center justify-center text-white font-extrabold text-xs shadow-sm shrink-0">
                              {apt.avatar || "PT"}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-extrabold text-[#14213D] truncate">
                                {apt.patient}
                              </p>
                              <p className="text-xs text-slate-500 font-semibold truncate">
                                {apt.type} • {apt.time}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
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
                              className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white rounded-[12px] h-8 px-3 text-xs font-bold border-none shadow-sm hover:opacity-90 flex items-center gap-1"
                            >
                              <Video className="h-3.5 w-3.5" />
                              Join
                            </Button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Ready notice */}
              <div className="mt-5 p-3 rounded-[14px] bg-emerald-50/80 border border-emerald-200/80 text-[11px] text-emerald-950 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="font-semibold text-emerald-900">
                  Real-time synchronization active. New patient bookings update live without refreshing.
                </span>
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
    </DashboardLayout>
  );
};

export default DoctorDashboard;
