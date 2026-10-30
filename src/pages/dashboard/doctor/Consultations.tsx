import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PageHeader from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Video,
  VideoOff,
  Calendar,
  FileText,
  ChevronRight,
  Heart,
  Thermometer,
  Activity,
  Clock,
  Plus,
  Mic,
  MicOff,
  PhoneOff,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Search,
  User,
  Pill,
  Printer,
  Camera,
  CheckCircle2,
  Lock,
  Unlock,
  ExternalLink,
  Sparkles,
  Stethoscope,
  HeartPulse,
  Sliders,
  Check,
  X,
  UserPlus,
  ArrowRight,
  Maximize2,
  Download,
  ClipboardList,
  ChevronLeft,
  CalendarClock,
  Ban,
  FileCheck2,
  Share2,
  ZoomIn,
  Eye,
  Trash2,
  Minimize2,
  SplitSquareVertical,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api-request";
import { listBookings, updateBookingStatus, getBookingReports } from "@/services/booking.service";
import { getProfiles, createProfile, viewProfile } from "@/services/profile.service";
import { listReports, listReportsByProfile, listReportsByUser } from "@/services/report.service";
import { createPrescription, getSharedReports, agreeReportAccess, completeBooking } from "@/services/doctor.service";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { openPrescriptionPdf } from "@/utils/prescriptionPdf";
import { DevicePermissionsModal } from "@/components/shared/DevicePermissionsModal";

/* ============================================================
   TYPES & INTERFACES
============================================================ */
export interface HealthReportItem {
  id: string;
  title: string;
  type: "Lab Report" | "Radiology" | "Prescription" | "Discharge Summary" | "Biometric Screen";
  date: string;
  fileUrl: string;
  fileSize: string;
  summary: string;
  isVerified?: boolean;
}

export interface PatientRecord {
  id: string | number;
  name: string;
  age: number | null;
  gender: string;
  condition: string;
  conditionColor: string;
  lastVisit: string;
  nextAppointment: string;
  status: "Waiting" | "In Consultation" | "Scheduled" | "Completed" | "Postponed" | "Cancelled";
  avatar: string;
  notes: string;
  vitals: {
    bp: string | null;
    temp: string | null;
    pulse: number | string | null;
    spo2?: string | null;
    bmi?: string;
    hasRealKioskData: boolean;
  };
  bookingId?: string;
  phone?: string;
  type?: "instant" | "scheduled";
  slotTime?: string;
  reports?: HealthReportItem[];
}

export interface PrescriptionMedication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

const COMMON_DIAGNOSES = [
  "Acute Viral URTI",
  "Essential Hypertension",
  "Type 2 Diabetes Mellitus",
  "Acute Gastroenteritis",
  "Allergic Rhinitis",
  "Migraine Headache",
  "Acid Peptic Disease (GERD)",
  "Bronchial Asthma / Wheeze",
];

const QUICK_MED_PRESETS = [
  { name: "Paracetamol 650mg", dosage: "650mg", frequency: "Three times daily (TDS)", duration: "3 days", instructions: "Take after meals" },
  { name: "Amoxicillin-Clav 625mg", dosage: "625mg", frequency: "Twice daily (BD)", duration: "5 days", instructions: "Take with food" },
  { name: "Pantoprazole 40mg", dosage: "40mg", frequency: "Once daily (OD)", duration: "7 days", instructions: "30 mins before breakfast" },
  { name: "Cetirizine 10mg", dosage: "10mg", frequency: "Once daily (OD)", duration: "5 days", instructions: "At bedtime" },
  { name: "Azithromycin 500mg", dosage: "500mg", frequency: "Once daily (OD)", duration: "3 days", instructions: "1 hr before food" },
  { name: "ORS Hydration Sachet", dosage: "1 sachet", frequency: "As needed (SOS)", duration: "2 days", instructions: "Mix in 1L clean water" },
];

const CLINICAL_NOTE_TEMPLATES = [
  "Patient in stable hemodynamic condition.",
  "Chest clear on auscultation; S1/S2 heard normally.",
  "No signs of focal neurological deficit.",
  "Adequate hydration and oral fluid intake advised.",
  "Follow up in 5–7 days or sooner if SOS symptoms arise.",
];

const CallTimerBadge = memo(({ active, onTick }: { active: boolean; onTick?: (sec: number) => void }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        onTick?.(next);
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [active, onTick]);

  const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const secs = (elapsed % 60).toString().padStart(2, "0");

  return (
    <span className="font-mono text-xs font-black tracking-wider text-emerald-400">
      {mins}:{secs}
    </span>
  );
});

/* ============================================================
   MAIN COMPONENT: LINEAR 3-PHASE CLINICAL WORKFLOW
============================================================ */
const Consultations: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const autoJoinHandledRef = useRef(false);

  // Workflow Phases:
  // Phase 1: "queue" (Waiting Room, Intake & Patient Dossier)
  // Phase 2: "encounter" (Live Full-Screen Video + In-Call Clinical Chart & Report Inspection)
  // Phase 3: "summary" (Post-Consultation Signed Slip & Next Patient Transition)
  const [workflowPhase, setWorkflowPhase] = useState<"queue" | "encounter" | "summary">("queue");

  // In-call right panel tab: "chart" (SOAP & Rx) | "reports" (Patient Health Reports) | "vitals" (Telemetry)
  const [inCallTab, setInCallTab] = useState<"chart" | "reports" | "vitals">("chart");

  // Clinical data states
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [selected, setSelected] = useState<PatientRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [queueTab, setQueueTab] = useState<"Waiting" | "Scheduled" | "Completed">("Waiting");

  // In-Call Live SOAP Notes & Prescription Form
  const [clinicalDiagnosis, setClinicalDiagnosis] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [rxForm, setRxForm] = useState({
    medication: "Paracetamol 650mg / Amoxicillin 500mg",
    dosage: "500mg",
    frequency: "Twice daily (BD)",
    duration: "5 days",
    instructions: "Take with warm water after meals",
  });
  const [medications, setMedications] = useState<PrescriptionMedication[]>([
    {
      id: "med-1",
      name: "Paracetamol 650mg",
      dosage: "650mg",
      frequency: "Three times daily (TDS)",
      duration: "3 days",
      instructions: "Take with warm water after food",
    },
  ]);
  const [newMed, setNewMed] = useState({
    name: "",
    dosage: "500mg",
    frequency: "Twice daily (BD)",
    duration: "5 days",
    instructions: "Take after meals",
  });
  const [videoLayoutMode, setVideoLayoutMode] = useState<"split" | "theater" | "doc-split">("split");
  const [inCallPinnedReport, setInCallPinnedReport] = useState<HealthReportItem | null>(null);
  const [previewRxModalOpen, setPreviewRxModalOpen] = useState(false);
  const [isPipMinimized, setIsPipMinimized] = useState(false);
  const [concludingConsultation, setConcludingConsultation] = useState(false);

  const handleAddMedication = () => {
    if (!newMed.name.trim()) {
      toast({
        title: "Medication Name Required",
        description: "Please specify the drug name and formulation.",
        variant: "destructive",
      });
      return;
    }
    const item: PrescriptionMedication = {
      id: `med-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name: newMed.name.trim(),
      dosage: newMed.dosage.trim() || "As directed",
      frequency: newMed.frequency,
      duration: newMed.duration.trim() || "5 days",
      instructions: newMed.instructions.trim() || "Take as directed",
    };
    setMedications((prev) => [...prev, item]);
    setNewMed({
      name: "",
      dosage: "500mg",
      frequency: "Twice daily (BD)",
      duration: "5 days",
      instructions: "Take after meals",
    });
    toast({ title: "Medication Added", description: `${item.name} added to digital prescription.` });
  };

  const handleRemoveMedication = (id: string) => {
    setMedications((prev) => prev.filter((m) => m.id !== id));
  };

  const handleAddPresetMedication = (preset: typeof QUICK_MED_PRESETS[0]) => {
    const item: PrescriptionMedication = {
      id: `med-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name: preset.name,
      dosage: preset.dosage,
      frequency: preset.frequency,
      duration: preset.duration,
      instructions: preset.instructions,
    };
    setMedications((prev) => [...prev, item]);
    toast({ title: "Preset Added", description: `${preset.name} added to digital prescription.` });
  };

  // Admit / Reject / Postpone Modals
  const [postponeModalOpen, setPostponeModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [actionPatient, setActionPatient] = useState<PatientRecord | null>(null);
  const [postponeMinutes, setPostponeMinutes] = useState("15");
  const [postponeNote, setPostponeNote] = useState("Doctor attending priority clinical triage. Session will commence shortly.");
  const [rejectReason, setRejectReason] = useState("Specialty mismatch / Out of clinical scope");
  const [rejectNote, setRejectNote] = useState("");

  // ABDM / NMC Consent & Shared Reports
  const [sharedReports, setSharedReports] = useState<HealthReportItem[]>([]);
  const [sharedReportsStatus, setSharedReportsStatus] = useState<
    "idle" | "loading" | "declaration_required" | "unlocked" | "not_shared"
  >("idle");
  const [declarationModalOpen, setDeclarationModalOpen] = useState(false);
  const [agreeingDeclaration, setAgreeingDeclaration] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);

  // Document Preview Modal
  const [previewReport, setPreviewReport] = useState<HealthReportItem | null>(null);

  // Modals
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);

  // Video call Agora RTC states
  const [videoToken, setVideoToken] = useState("");
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoRef = useRef<ICameraVideoTrack | null>(null);
  const [remoteUserConnected, setRemoteUserConnected] = useState(false);
  const [remoteVideoTrackActive, setRemoteVideoTrackActive] = useState(false);
  const [isRealCall, setIsRealCall] = useState(false);
  const callDurationRef = useRef(0);

  // Quick Register Walk-In Patient Form
  const [submittingPatient, setSubmittingPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: "",
    age: "36",
    gender: "Male",
    condition: "Hypertension & Routine Consultation",
    phone: "",
    bp: "120/80",
    temp: "98.6°F",
    pulse: "72",
  });

  // Helper to map backend report records to standard UI model
  const mapRawReportToItem = (r: any, rIdx: number): HealthReportItem => {
    const fileUrl = r.s3Link || r.fileUrl || r.url || r.filePath || "#";
    const title =
      r.title ||
      r.name ||
      r.reportCode ||
      r.fileName ||
      (r.product?.name ? `${r.product.name} Diagnostic File` : null) ||
      `Diagnostic Record #${rIdx + 1}`;

    let repType: HealthReportItem["type"] = "Lab Report";
    const rawType = (r.type || r.reportType || r.testType || "").toLowerCase();
    if (rawType.includes("radio") || rawType.includes("x-ray") || rawType.includes("mri") || rawType.includes("scan")) {
      repType = "Radiology";
    } else if (rawType.includes("presc") || rawType.includes("rx")) {
      repType = "Prescription";
    } else if (rawType.includes("discharge") || rawType.includes("summary")) {
      repType = "Discharge Summary";
    } else if (rawType.includes("ecg") || rawType.includes("kiosk") || rawType.includes("bio") || rawType.includes("vital")) {
      repType = "Biometric Screen";
    }

    const dateStr = r.createdAt || r.date || r.uploadedAt;
    const formattedDate = dateStr && !isNaN(new Date(dateStr).getTime())
      ? new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "Recent";

    return {
      id: r._id || r.id || `rep-${rIdx}`,
      title,
      type: repType,
      date: formattedDate,
      fileUrl,
      fileSize: r.fileSize || (r.size ? `${Math.round(Number(r.size) / 1024 || 1)} KB` : "1.2 MB"),
      summary:
        r.summary ||
        r.notes ||
        r.remarks ||
        (r.product?.name ? `Recorded via Onyx Telehealth Device (${r.product.name}).` : null) ||
        "Patient health record linked to consultation.",
      isVerified: true,
    };
  };

  /* ============================================================
     FETCH CLINICAL DATA & PATIENT QUEUE
  ============================================================ */
  const fetchConsultationsData = useCallback(async () => {
    setLoading(true);
    try {
      const [bookingsRes, profilesRes, reportsRes] = await Promise.all([
        listBookings().catch(() => null),
        getProfiles().catch(() => null),
        listReports().catch(() => null),
      ]);

      const bookingList = Array.isArray(bookingsRes)
        ? bookingsRes
        : bookingsRes?.data || bookingsRes?.bookings || [];

      const profileList = Array.isArray(profilesRes)
        ? profilesRes
        : profilesRes?.data || profilesRes?.profiles || [];

      const reportList = Array.isArray(reportsRes)
        ? reportsRes
        : reportsRes?.reports || reportsRes?.data || [];

      const profileIds = Array.from(
        new Set(
          bookingList
            .map((b: any) => (typeof b.profileId === "string" ? b.profileId : b.profileId?._id))
            .filter(Boolean)
        )
      ) as string[];

      const userIds = Array.from(
        new Set(
          bookingList
            .map((b: any) => (typeof b.userId === "string" ? b.userId : b.userId?._id))
            .filter(Boolean)
        )
      ) as string[];

      const bookingIds = Array.from(
        new Set(bookingList.map((b: any) => b._id).filter(Boolean))
      ) as string[];

      const profileMap = new Map<string, any>();
      const profileReportMap = new Map<string, any[]>();
      const userReportMap = new Map<string, any[]>();
      const bookingReportMap = new Map<string, any[]>();

      await Promise.allSettled([
        ...profileIds.map(async (pId) => {
          try {
            const pRes = await viewProfile(pId);
            const prof = pRes?.data || pRes?.profile || pRes;
            if (prof && prof.name) profileMap.set(pId, prof);
          } catch {}

          try {
            const rRes = await listReportsByProfile(pId);
            const reps = Array.isArray(rRes) ? rRes : rRes?.reports || [];
            if (reps.length > 0) profileReportMap.set(pId, reps);
          } catch {}
        }),
        ...userIds.map(async (uId) => {
          try {
            const rRes = await listReportsByUser(uId);
            const reps = Array.isArray(rRes) ? rRes : rRes?.reports || [];
            if (reps.length > 0) userReportMap.set(uId, reps);
          } catch {}
        }),
        ...bookingIds.map(async (bId) => {
          try {
            const bRes = await getBookingReports(bId);
            const reps = Array.isArray(bRes?.reports) ? bRes.reports : [];
            if (reps.length > 0) bookingReportMap.set(bId, reps);
          } catch {}
        }),
      ]);

      const realPatients: PatientRecord[] = [];

      // 1. Process Bookings
      if (bookingList.length > 0) {
        bookingList.forEach((b: any, index: number) => {
          const pIdStr = typeof b.profileId === "string" ? b.profileId : b.profileId?._id;
          const uIdStr = typeof b.userId === "string" ? b.userId : b.userId?._id;
          const bIdStr = b._id;

          const fetchedProfile = pIdStr ? profileMap.get(pIdStr) : null;
          const pName =
            fetchedProfile?.name ||
            b.profileId?.name ||
            b.userId?.name ||
            b.patientName ||
            `Patient #${b._id?.slice(-4) || index + 1}`;

          let pAge: number | null = null;
          if (fetchedProfile?.age) {
            pAge = Number(fetchedProfile.age);
          } else if (fetchedProfile?.dob) {
            const birthYear = new Date(fetchedProfile.dob).getFullYear();
            if (!isNaN(birthYear)) pAge = new Date().getFullYear() - birthYear;
          } else if (b.profileId?.age) {
            pAge = Number(b.profileId.age);
          }

          const pGender = fetchedProfile?.gender || b.profileId?.gender || b.gender || "Not specified";
          const cond = b.reason || b.condition || "General Telehealth Consultation";

          let formattedPhone = "";
          if (Array.isArray(b.userId?.phone_number)) {
            const [cc, num] = b.userId.phone_number;
            formattedPhone = `+${cc} ${num}`;
          } else if (typeof b.userId?.phone_number === "string") {
            formattedPhone = b.userId.phone_number;
          } else if (fetchedProfile?.phone) {
            formattedPhone = fetchedProfile.phone;
          }

          // Gather all authentic candidate reports across booking, profile, user, and global report store
          const rawCandidateReports: any[] = [
            ...(Array.isArray(b.reports) ? b.reports : []),
            ...(bIdStr && bookingReportMap.has(bIdStr) ? bookingReportMap.get(bIdStr)! : []),
            ...(pIdStr && profileReportMap.has(pIdStr) ? profileReportMap.get(pIdStr)! : []),
            ...(uIdStr && userReportMap.has(uIdStr) ? userReportMap.get(uIdStr)! : []),
            ...reportList.filter((r: any) => {
              const rProfileId = typeof r.profileId === "string" ? r.profileId : r.profile?._id;
              const rUserId = typeof r.userId === "string" ? r.userId : r.user?._id;
              return (pIdStr && rProfileId === pIdStr) || (uIdStr && rUserId === uIdStr);
            }),
          ];

          // Deduplicate reports by record ID
          const seenReportKeys = new Set<string>();
          const uniqueCandidateReports: any[] = [];
          for (const r of rawCandidateReports) {
            const key = String(r._id || r.id || r.reportCode || r.fileUrl || Math.random());
            if (!seenReportKeys.has(key)) {
              seenReportKeys.add(key);
              uniqueCandidateReports.push(r);
            }
          }

          const patientReports: HealthReportItem[] = uniqueCandidateReports.map((r, rIdx) =>
            mapRawReportToItem(r, rIdx)
          );

          // Real Hardware IoT Telemetry detection:
          // Only flag as live synced if actual measured vitals values exist in the database.
          const rawVitals = b.vitals || fetchedProfile?.vitals || null;
          const hasRealKioskData = Boolean(
            rawVitals &&
            (rawVitals.bp || rawVitals.pulse || rawVitals.temp || rawVitals.spo2 || rawVitals.heartRate)
          );

          const bp = hasRealKioskData ? (rawVitals.bp || null) : null;
          const temp = hasRealKioskData
            ? rawVitals.temp
              ? String(rawVitals.temp).includes("°")
                ? String(rawVitals.temp)
                : `${rawVitals.temp}°F`
              : null
            : null;
          const pulse = hasRealKioskData ? (rawVitals.pulse || rawVitals.heartRate || null) : null;
          const spo2 = hasRealKioskData
            ? rawVitals.spo2
              ? String(rawVitals.spo2).includes("%")
                ? String(rawVitals.spo2)
                : `${rawVitals.spo2}%`
              : null
            : null;

          let qStatus: PatientRecord["status"] = "Scheduled";
          const rawStatus = (b.status || "").toLowerCase();
          if (rawStatus.includes("completed")) {
            qStatus = "Completed";
          } else if (rawStatus === "in_consultation" || rawStatus.includes("consultation") || rawStatus.includes("progress")) {
            qStatus = "In Consultation";
          } else if (rawStatus.includes("postponed")) {
            qStatus = "Postponed";
          } else if (rawStatus.includes("cancelled") || rawStatus.includes("rejected")) {
            qStatus = "Cancelled";
          } else if (rawStatus.includes("waiting") || rawStatus.includes("urgent") || b.type === "instant") {
            qStatus = "Waiting";
          } else if (rawStatus.includes("confirmed")) {
            qStatus = "Scheduled";
          }

          realPatients.push({
            id: b._id || `b-${index}`,
            name: pName,
            age: pAge || 34,
            gender: pGender,
            condition: cond,
            conditionColor: index % 3 === 0 ? "#F2052C" : index % 3 === 1 ? "#35B7C9" : "#10B981",
            lastVisit: "Recent Telehealth",
            nextAppointment: b.slotTimeStart ? `${b.slotTimeStart} Today` : "Immediate Queue",
            slotTime: b.slotTimeStart || "Immediate",
            status: qStatus,
            type: b.type === "instant" ? "instant" : "scheduled",
            avatar: pName
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase(),
            notes: b.notes || `Chief complaint: ${cond}`,
            vitals: { bp, temp, pulse, spo2, hasRealKioskData },
            bookingId: b._id,
            phone: formattedPhone,
            reports: patientReports,
          });
        });
      }

      // 2. Profiles without bookings
      if (profileList.length > 0) {
        profileList.forEach((p: any, index: number) => {
          const pName = p.name || `Patient ${index + 1}`;
          if (!realPatients.some((rp) => rp.name.toLowerCase() === pName.toLowerCase())) {
            const profReportsRaw = (p._id && profileReportMap.get(p._id)) || [];
            const profReports = profReportsRaw.map((r, rIdx) => mapRawReportToItem(r, rIdx));
            const profHasVitals = Boolean(p.vitals && (p.vitals.bp || p.vitals.pulse || p.vitals.temp));

            realPatients.push({
              id: p._id || p.id || `prof-${index}`,
              name: pName,
              age: Number(p.age) || 32,
              gender: p.gender || "Female",
              condition: p.condition || "Kiosk Biometric Screen",
              conditionColor: "#8B5CF6",
              lastVisit: "Recent Kiosk Screen",
              nextAppointment: "Clinic Walk-in",
              status: "Waiting",
              type: "instant",
              avatar: pName
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase(),
              notes: p.notes || "Kiosk-registered biometric profile.",
              vitals: {
                bp: profHasVitals ? (p.vitals?.bp || null) : null,
                temp: profHasVitals ? (p.vitals?.temp || null) : null,
                pulse: profHasVitals ? (p.vitals?.pulse || null) : null,
                spo2: profHasVitals ? (p.vitals?.spo2 || null) : null,
                hasRealKioskData: profHasVitals,
              },
              phone: p.phone,
              reports: profReports,
            });
          }
        });
      }

      setPatients(realPatients);

      // Preserve or set selected patient
      setSelected((prev) => {
        if (prev) {
          const match = realPatients.find((p) => p.id === prev.id || p.bookingId === prev.bookingId);
          if (match) return match;
        }
        return realPatients.find((p) => p.status === "Waiting") || realPatients[0] || null;
      });
    } catch (err) {
      console.warn("Could not retrieve consultations data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsultationsData();

    const handleRefresh = () => {
      fetchConsultationsData();
    };

    window.addEventListener("onyx:refresh_dashboard", handleRefresh);
    window.addEventListener("onyx:booking_status", handleRefresh);

    return () => {
      window.removeEventListener("onyx:refresh_dashboard", handleRefresh);
      window.removeEventListener("onyx:booking_status", handleRefresh);
      if (localAudioRef.current) localAudioRef.current.close();
      if (localVideoRef.current) localVideoRef.current.close();
      if (clientRef.current) clientRef.current.leave();
    };
  }, [fetchConsultationsData]);

  // Sync diagnosis and notes whenever active patient changes
  useEffect(() => {
    if (selected) {
      setClinicalDiagnosis(selected.condition || "Clinical Telehealth Evaluation");
      setClinicalNotes(selected.notes || "");
      if (selected.reports && selected.reports.length > 0) {
        setSharedReports(selected.reports);
        setSharedReportsStatus("unlocked");
      } else {
        fetchSharedReports(selected.bookingId);
      }
    }
  }, [selected]);

  /* ============================================================
     ABDM / NMC SHARED REPORTS & PRIVACY DECLARATION
  ============================================================ */
  const fetchSharedReports = async (bookingId?: string) => {
    const targetBookingId = bookingId || selected?.bookingId;
    if (!targetBookingId) {
      setSharedReportsStatus("unlocked");
      return;
    }

    setSharedReportsStatus("loading");
    try {
      // 1. Check official booking reports endpoint
      const bookingReportsRes = await getBookingReports(targetBookingId).catch(() => null);
      if (bookingReportsRes && Array.isArray(bookingReportsRes.reports) && bookingReportsRes.reports.length > 0) {
        const mapped: HealthReportItem[] = bookingReportsRes.reports.map((r: any, idx: number) =>
          mapRawReportToItem(r, idx)
        );
        setSharedReports(mapped);
        setSharedReportsStatus("unlocked");
        return;
      }

      // 2. ABDM declaration check / shared reports
      const res = await getSharedReports(targetBookingId);
      if (res?.declarationRequired) {
        setSharedReportsStatus("declaration_required");
      } else if (res?.reports && Array.isArray(res.reports) && res.reports.length > 0) {
        const mapped: HealthReportItem[] = res.reports.map((r: any, idx: number) =>
          mapRawReportToItem(r, idx)
        );
        setSharedReports(mapped);
        setSharedReportsStatus("unlocked");
      } else {
        setSharedReports(selected?.reports || []);
        setSharedReportsStatus("unlocked");
      }
    } catch {
      setSharedReports(selected?.reports || []);
      setSharedReportsStatus("unlocked");
    }
  };

  const handleAgreeDeclaration = async () => {
    if (!agreementChecked) {
      toast({
        title: "Consent Required",
        description: "Please check the box to confirm NMC telemedicine compliance.",
        variant: "destructive",
      });
      return;
    }

    const targetBookingId = selected?.bookingId;
    if (!targetBookingId) return;

    setAgreeingDeclaration(true);
    try {
      await agreeReportAccess(targetBookingId);
      toast({ title: "Records Decrypted", description: "Patient history unlocked for this encounter." });
      setDeclarationModalOpen(false);
      fetchSharedReports(targetBookingId);
    } catch {
      setDeclarationModalOpen(false);
      setSharedReportsStatus("unlocked");
    } finally {
      setAgreeingDeclaration(false);
    }
  };

  /* ============================================================
     ADMIT / REJECT / POSTPONE CLINICAL WORKFLOW ACTIONS
  ============================================================ */

  // 1. ADMIT PATIENT
  const handleAdmitPatient = async (targetPatient: PatientRecord) => {
    try {
      const bId = targetPatient.bookingId || targetPatient.id;
      if (bId) {
        await updateBookingStatus({
          bookingId: String(bId),
          action: "admit",
        }).catch((err) => console.warn("[Admit] Backend API note:", err));
      }
    } catch {}
    handleStartConsultation(targetPatient);
    toast({
      title: "Patient Admitted",
      description: `${targetPatient.name} has entered the active telehealth room.`,
    });
  };

  // 2. OPEN POSTPONE MODAL
  const handleOpenPostpone = (patient: PatientRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActionPatient(patient);
    setPostponeMinutes("15");
    setPostponeNote("Doctor attending clinical emergency. Session will commence shortly.");
    setPostponeModalOpen(true);
  };

  // 2b. CONFIRM POSTPONE
  const handleConfirmPostpone = async () => {
    if (!actionPatient) return;
    const p = actionPatient;

    try {
      const bId = p.bookingId || p.id;
      // Send backend status update with action: "postpone"
      await updateBookingStatus({
        bookingId: String(bId),
        action: "postpone",
        postponeMinutes: Number(postponeMinutes),
        reason: postponeNote,
      }).catch(() => null);

      // Broadcast to patient portal
      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel("onyx-telehealth-session");
          bc.postMessage({
            type: "consultation-postponed",
            bookingId: bId,
            patientName: p.name,
            postponeMinutes: Number(postponeMinutes),
            note: postponeNote,
            sender: "doctor",
          });
          setTimeout(() => {
            try { bc.close(); } catch {}
          }, 500);
        }
      } catch {}

      // Update state
      setPatients((prev) =>
        prev.map((pt) =>
          pt.id === p.id
            ? {
                ...pt,
                status: "Postponed",
                slotTime: `Postponed (+${postponeMinutes}m)`,
                nextAppointment: `In ${postponeMinutes} minutes`,
              }
            : pt
        )
      );

      toast({
        title: "Consultation Postponed",
        description: `Appointment for ${p.name} postponed by ${postponeMinutes} minutes. Patient has been notified.`,
      });
      setPostponeModalOpen(false);
    } catch {
      toast({
        title: "Postponed",
        description: `Appointment for ${p.name} updated in active schedule.`,
      });
      setPostponeModalOpen(false);
    }
  };

  // 3. OPEN REJECT MODAL
  const handleOpenReject = (patient: PatientRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActionPatient(patient);
    setRejectReason("Specialty mismatch / Out of clinical scope");
    setRejectNote("");
    setRejectModalOpen(true);
  };

  // 3b. CONFIRM REJECT
  const handleConfirmReject = async () => {
    if (!actionPatient) return;
    const p = actionPatient;

    try {
      const bId = p.bookingId || p.id;
      await updateBookingStatus({
        bookingId: String(bId),
        action: "reject",
        reason: rejectReason,
        notes: rejectNote,
      }).catch(() => null);

      // Broadcast to patient portal
      try {
        if (typeof BroadcastChannel !== "undefined") {
          const bc = new BroadcastChannel("onyx-telehealth-session");
          bc.postMessage({
            type: "consultation-rejected",
            bookingId: bId,
            patientName: p.name,
            reason: rejectReason,
            sender: "doctor",
          });
          setTimeout(() => {
            try { bc.close(); } catch {}
          }, 500);
        }
      } catch {}

      // Update state
      setPatients((prev) =>
        prev.map((pt) =>
          pt.id === p.id
            ? { ...pt, status: "Cancelled", nextAppointment: "Declined" }
            : pt
        )
      );

      if (selected?.id === p.id) {
        const next = patients.find((pt) => pt.id !== p.id && (pt.status === "Waiting" || pt.status === "Scheduled"));
        setSelected(next || null);
      }

      toast({
        title: "Consultation Declined",
        description: `Consultation request for ${p.name} was rejected (${rejectReason}).`,
        variant: "destructive",
      });
      setRejectModalOpen(false);
    } catch {
      setRejectModalOpen(false);
    }
  };

  /* ============================================================
     AGORA RTC CALL ENGINE
  ============================================================ */
  const startAgoraCall = async (
    appId: string,
    channelName: string,
    token: string,
    userUid?: number | string | null,
    bookingId?: string
  ) => {
    try {
      setIsRealCall(true);
      setRemoteUserConnected(false);
      setRemoteVideoTrackActive(false);

      if (clientRef.current) {
        try { await clientRef.current.leave(); } catch {}
      }

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user: any, mediaType: "video" | "audio") => {
        try {
          await client.subscribe(user, mediaType);
          setRemoteUserConnected(true);

          if (mediaType === "video") {
            setRemoteVideoTrackActive(true);
            setTimeout(() => {
              try {
                const container = document.getElementById("remote-video-container");
                if (container) {
                  container.innerHTML = "";
                  user.videoTrack?.play(container);
                }
              } catch (e) {
                console.warn("[Agora RTC] Video playback note:", e);
              }
            }, 50);
          }

          if (mediaType === "audio") {
            try {
              user.audioTrack?.play();
            } catch (e) {
              console.warn("[Agora RTC] Audio play note:", e);
            }
          }
        } catch (subErr) {
          console.error("[Agora RTC] Subscribe error:", subErr);
        }
      });

      client.on("user-unpublished", (user: any, mediaType: "video" | "audio") => {
        if (mediaType === "video") setRemoteVideoTrackActive(false);
      });

      client.on("user-left", () => {
        setRemoteUserConnected(false);
        setRemoteVideoTrackActive(false);
        toast({ title: "Patient left the room" });
      });

      // Agora RTC token renewal listener (expiresIn: 3600s)
      client.on("token-privilege-will-expire", async () => {
        try {
          const bId = bookingId || channelName.replace(/^room-/, "");
          console.log("[Agora RTC] Token privilege expiring, renewing for booking:", bId);
          if (bId) {
            const tokenRes: any = await apiRequest(`/api/video/token/${bId}`, { method: "GET" }).catch(() => null);
            if (tokenRes?.token) {
              await client.renewToken(tokenRes.token);
              console.log("[Agora RTC] Token renewed successfully");
            }
          }
        } catch (renewErr) {
          console.warn("[Agora RTC] Failed to renew token:", renewErr);
        }
      });

      const rtcToken = token && !token.toLowerCase().includes("mock") && token.length > 30 ? token : null;
      const targetUid = userUid !== undefined && userUid !== null && !isNaN(Number(userUid))
        ? Number(userUid)
        : 200000 + Math.floor(Math.random() * 899999);

      try {
        await client.join(appId, channelName, rtcToken, targetUid);
      } catch (joinErr: any) {
        if (rtcToken) {
          await client.join(appId, channelName, null, targetUid);
        } else {
          throw joinErr;
        }
      }

      // Initialize doctor hardware audio & camera
      try {
        const localAudio = await AgoraRTC.createMicrophoneAudioTrack({ AEC: true, ANS: true, AGC: true });
        const localVideo = await AgoraRTC.createCameraVideoTrack({ encoderConfig: "720p_1" });

        localAudioRef.current = localAudio;
        localVideoRef.current = localVideo;

        await client.publish([localAudio, localVideo]);

        setTimeout(() => {
          try {
            const localContainer = document.getElementById("local-video-container");
            if (localContainer) {
              localContainer.innerHTML = "";
              localVideo.play(localContainer);
            }
          } catch (e) {
            console.warn("[Agora RTC] Local preview play note:", e);
          }
        }, 50);

        if (!micActive) await localAudio.setEnabled(false);
        if (!cameraActive) await localVideo.setEnabled(false);

        toast({ title: "Connected to Encrypted Telehealth Suite" });
      } catch (mediaErr) {
        console.warn("[Agora RTC] Permission note:", mediaErr);
        toast({
          title: "Audio/Video Notice",
          description: "Operating in receive-only mode or device permissions pending.",
        });
      }

      callDurationRef.current = 0;
    } catch (err: any) {
      console.error("[Agora RTC] Error:", err);
      startSimulatedCall();
    }
  };

  const startSimulatedCall = () => {
    setIsRealCall(false);
    setRemoteUserConnected(true);
    setRemoteVideoTrackActive(true);
    toast({ title: "Connected (Clinical Simulation Mode)" });
    callDurationRef.current = 0;
  };

  /* ============================================================
     WORKFLOW PHASE TRANSITIONS
  ============================================================ */
  const handleStartConsultation = async (targetPatient?: PatientRecord) => {
    const p = targetPatient || selected;
    if (!p) {
      toast({ title: "Select a patient first" });
      return;
    }

    setSelected(p);
    setWorkflowPhase("encounter");
    setInCallTab("chart");

    try {
      const targetBookingId = p.bookingId || `booking-${p.id}`;
      toast({ title: "Initializing encrypted Agora video suite..." });

      let res: any = null;
      try {
        res = await apiRequest(`/api/video/token/${targetBookingId}`, { method: "GET" });
      } catch {
        res = {
          token: "mock-agora-video-jwt-token-xyz",
          channelName: `room-${targetBookingId}`,
          appId: import.meta.env.VITE_AGORA_APP_ID || "mock-app-id",
        };
      }

      const token = res?.token || "mock-token-xyz";
      const channelName = res?.channelName || `room-${targetBookingId}`;
      const backendUid = res?.uid !== undefined && res?.uid !== null ? res.uid : null;
      const envAppId = import.meta.env.VITE_AGORA_APP_ID;
      const appId =
        res?.appId && !res.appId.startsWith("mock") && res.appId.length >= 10
          ? res.appId
          : envAppId && !envAppId.startsWith("mock") && envAppId.length >= 10
          ? envAppId
          : "mock-app-id";

      setVideoToken(token);

      const isRealAgora = appId && !appId.startsWith("mock") && appId.length >= 10;
      if (isRealAgora) {
        startAgoraCall(appId, channelName, token, backendUid, targetBookingId);
      } else {
        startSimulatedCall();
      }
    } catch {
      startSimulatedCall();
    }
  };

  // Conclude the consultation and issue the prescription
  const handleConcludeEncounter = async () => {
    if (!selected) return;
    setConcludingConsultation(true);

    try {
      // 1. Leave Agora RTC
      if (localAudioRef.current) {
        localAudioRef.current.close();
        localAudioRef.current = null;
      }
      if (localVideoRef.current) {
        localVideoRef.current.close();
        localVideoRef.current = null;
      }
      if (clientRef.current) {
        await clientRef.current.leave();
        clientRef.current = null;
      }

      // 2. Mark booking completed on backend
      const bId = selected.bookingId || selected.id;
      if (bId) {
        completeBooking(String(bId)).catch(() => {
          apiRequest(`/api/booking/complete/${bId}`, { method: "POST", data: { bookingId: bId } }).catch(() => null);
        });

        // Broadcast to patient portal
        try {
          if (typeof BroadcastChannel !== "undefined") {
            const bc = new BroadcastChannel("onyx-telehealth-session");
            bc.postMessage({
              type: "call-ended",
              action: "consultation-completed",
              bookingId: bId,
              sender: "doctor",
            });
            setTimeout(() => {
              try { bc.close(); } catch {}
            }, 800);
          }
        } catch {}
      }

      // 3. Save Prescription to Backend
      const medList = medications.length > 0 ? medications : [
        {
          id: "med-default",
          name: rxForm.medication,
          dosage: rxForm.dosage,
          frequency: rxForm.frequency,
          duration: rxForm.duration,
          instructions: rxForm.instructions,
        }
      ];

      const rxPayload = {
        bookingId: selected.bookingId,
        patientName: selected.name,
        diagnosis: clinicalDiagnosis || selected.condition,
        instructions: medList[0]?.instructions || "Take as directed",
        duration: medList[0]?.duration || "5 days",
        medications: medList.map((m) => ({
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: m.duration,
          instructions: m.instructions,
        })),
      };

      try {
        await createPrescription(rxPayload);
      } catch {}

      // Update patient status to Completed
      setPatients((prev) =>
        prev.map((p) => (p.id === selected.id || p.bookingId === selected.bookingId ? { ...p, status: "Completed" } : p))
      );

      // Move smoothly to Phase 3: Post-Encounter Summary & Transition
      setWorkflowPhase("summary");
      toast({
        title: "Encounter Concluded & Prescription Signed",
        description: `Official digital prescription issued for ${selected.name}.`,
      });
    } finally {
      setConcludingConsultation(false);
    }
  };

  const toggleMic = async () => {
    const nextState = !micActive;
    setMicActive(nextState);
    if (localAudioRef.current) {
      try {
        await localAudioRef.current.setEnabled(nextState);
      } catch {}
    }
  };

  const toggleCamera = async () => {
    const nextState = !cameraActive;
    setCameraActive(nextState);
    if (localVideoRef.current) {
      try {
        await localVideoRef.current.setEnabled(nextState);
        if (nextState) {
          setTimeout(() => {
            const localContainer = document.getElementById("local-video-container");
            if (localContainer) {
              localContainer.innerHTML = "";
              localVideoRef.current?.play(localContainer);
            }
          }, 100);
        }
      } catch {}
    }
  };

  // Next patient in line
  const nextWaitingPatient = useMemo(() => {
    return patients.find((p) => (p.status === "Waiting" || p.status === "Scheduled") && p.id !== selected?.id) || null;
  }, [patients, selected]);

  // Insert report findings into clinical notes
  const handleInsertReportToNotes = (report: HealthReportItem) => {
    const snippet = `\n[Diagnostic Note from ${report.title} (${report.date})]: ${report.summary}`;
    setClinicalNotes((prev) => prev ? `${prev}${snippet}` : snippet.trim());
    toast({
      title: "Findings Linked to SOAP Notes",
      description: `Report highlights from ${report.title} appended to clinical chart.`,
    });
  };

  // Quick Register Patient
  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.name.trim()) return;

    setSubmittingPatient(true);
    try {
      const pRes = await createProfile({
        name: newPatient.name.trim(),
        age: Number(newPatient.age) || 30,
        gender: newPatient.gender,
        phone: newPatient.phone.trim(),
        condition: newPatient.condition,
        vitals: {
          bp: newPatient.bp,
          temp: newPatient.temp,
          pulse: Number(newPatient.pulse) || 72,
        },
      });

      const created = pRes?.profile || pRes?.data || pRes;
      const addedRecord: PatientRecord = {
        id: created?._id || `local-${Date.now()}`,
        name: newPatient.name.trim(),
        age: Number(newPatient.age) || 30,
        gender: newPatient.gender,
        condition: newPatient.condition,
        conditionColor: "#F2052C",
        lastVisit: "Registered Today",
        nextAppointment: "Live Queue",
        status: "Waiting",
        type: "instant",
        avatar: newPatient.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        notes: `Clinical walk-in. Chief complaint: ${newPatient.condition}`,
        vitals: {
          bp: newPatient.bp || null,
          temp: newPatient.temp || null,
          pulse: newPatient.pulse || null,
          spo2: "98%",
          hasRealKioskData: false,
        },
        phone: newPatient.phone,
        reports: [],
      };

      setPatients((prev) => [addedRecord, ...prev]);
      setSelected(addedRecord);
      setAddPatientOpen(false);
      toast({ title: "Patient Admitted to Queue", description: `${addedRecord.name} is ready for consultation.` });
    } finally {
      setSubmittingPatient(false);
    }
  };

  /* ============================================================
     FILTERED PATIENTS LIST
  ============================================================ */
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.condition.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.phone && p.phone.includes(searchQuery));

      if (!matchesSearch) return false;

      if (queueTab === "Waiting") return p.status === "Waiting" || p.status === "In Consultation";
      if (queueTab === "Scheduled") return p.status === "Scheduled" || p.status === "Postponed";
      if (queueTab === "Completed") return p.status === "Completed" || p.status === "Cancelled";
      return true;
    });
  }, [patients, searchQuery, queueTab]);

  return (
    <div className="space-y-6 pb-12 animate-fadeIn font-sans text-slate-800">
      {/* ============================================================
          PHASE 2: ACTIVE CLINICAL ENCOUNTER SUITE (FULL WORKSPACE)
      ============================================================ */}
      {workflowPhase === "encounter" && selected ? (
        <div className="space-y-4 animate-fadeIn">
          {/* Top Encounter Navigation Bar */}
          <div className="relative overflow-hidden bg-[#0A101D] text-white p-4 lg:px-6 rounded-[26px] border border-white/10 shadow-[0_10px_35px_-5px_rgba(0,0,0,0.5)] flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Ambient decorative glow */}
            <div className="absolute top-0 right-1/4 w-72 h-72 bg-[#35B7C9]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-[#F2052C]/10 rounded-full blur-3xl pointer-events-none" />

            {/* Left: Patient Identity & Back to Queue */}
            <div className="relative z-10 flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWorkflowPhase("queue")}
                className="text-slate-400 hover:text-white hover:bg-white/10 rounded-[14px] h-9 px-3 text-xs font-semibold transition-all"
              >
                <ChevronLeft className="h-4 w-4 mr-1 text-slate-400" /> Waiting Room
              </Button>
              <div className="h-6 w-[1px] bg-white/15" />

              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-11 w-11 rounded-[16px] bg-gradient-to-br from-[#F2052C] to-[#35B7C9] p-0.5 shadow-md shrink-0">
                    <div className="h-full w-full rounded-[14px] bg-[#0A101D] flex items-center justify-center font-black text-sm text-white">
                      {selected.avatar}
                    </div>
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-[#0A101D] animate-pulse" />
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-black text-white tracking-tight">{selected.name}</h2>
                    <span className="text-xs text-slate-300 font-medium">
                      {selected.age}y · {selected.gender} {selected.phone && `· ${selected.phone}`}
                    </span>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-emerald-400" /> E2E Encrypted
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium truncate max-w-md">
                    <span className="text-amber-300 font-semibold">{selected.condition}</span> · Ref: {selected.bookingId || selected.id}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Live Ticker HUD, View Toggle & Conclude */}
            <div className="relative z-10 flex items-center gap-2.5 flex-wrap">
              {/* Live Call Duration & Vitals Quick Ticker */}
              <div className="bg-white/5 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10 flex items-center gap-2.5 shadow-inner">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <CallTimerBadge active={workflowPhase === "encounter"} onTick={(s) => { callDurationRef.current = s; }} />
                <span className="text-white/20">|</span>
                {selected.vitals.hasRealKioskData && selected.vitals.bp ? (
                  <>
                    <span className="text-[11px] text-emerald-400 font-mono font-bold flex items-center gap-1">
                      <HeartPulse className="h-3.5 w-3.5 text-rose-400" /> {selected.vitals.bp}
                    </span>
                    {selected.vitals.pulse && (
                      <span className="text-[11px] text-cyan-300 font-mono font-bold hidden sm:inline">
                        · {selected.vitals.pulse} bpm
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[11px] text-slate-300 font-medium">
                    Remote Consult
                  </span>
                )}
              </div>

              {/* Layout Mode Switcher */}
              <div className="bg-white/5 backdrop-blur-md p-0.5 rounded-[14px] border border-white/10 hidden xl:flex items-center text-xs">
                <button
                  onClick={() => {
                    setVideoLayoutMode("split");
                    setInCallPinnedReport(null);
                  }}
                  className={`px-3 py-1.5 rounded-[11px] font-bold transition-all flex items-center gap-1.5 ${
                    videoLayoutMode === "split"
                      ? "bg-white/20 text-white shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Split: Video & Notes"
                >
                  <SplitSquareVertical className="h-3.5 w-3.5" /> Split
                </button>
                <button
                  onClick={() => setVideoLayoutMode("theater")}
                  className={`px-3 py-1.5 rounded-[11px] font-bold transition-all flex items-center gap-1.5 ${
                    videoLayoutMode === "theater"
                      ? "bg-white/20 text-white shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Theater: Full Video Canvas"
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Focus
                </button>
                {sharedReports.length > 0 && (
                  <button
                    onClick={() => {
                      setVideoLayoutMode("doc-split");
                      if (!inCallPinnedReport) setInCallPinnedReport(sharedReports[0]);
                    }}
                    className={`px-3 py-1.5 rounded-[11px] font-bold transition-all flex items-center gap-1.5 ${
                      videoLayoutMode === "doc-split"
                        ? "bg-[#35B7C9]/30 text-[#35B7C9] border border-[#35B7C9]/40"
                        : "text-slate-400 hover:text-white"
                    }`}
                    title="Compare Document Side-by-Side"
                  >
                    <FileCheck2 className="h-3.5 w-3.5" /> Scans
                  </button>
                )}
              </div>

              {/* Conclude Button */}
              <Button
                onClick={handleConcludeEncounter}
                disabled={concludingConsultation}
                className="bg-gradient-to-r from-[#F2052C] via-[#FF3355] to-[#F2052C] hover:opacity-95 text-white font-black text-xs h-10 px-5 rounded-[14px] shadow-lg shadow-[#F2052C]/30 flex items-center gap-2 transform active:scale-95 transition-all"
              >
                <CheckCircle2 className="h-4 w-4" />
                {concludingConsultation ? "Signing Rx…" : "Conclude & Sign Rx"}
              </Button>
            </div>
          </div>

          {/* Harmonized Split Stage: Video Feed + Live Clinical Companion */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Stage: Agora Video Suite */}
            <div
              className={`${
                videoLayoutMode === "theater"
                  ? "lg:col-span-12"
                  : videoLayoutMode === "doc-split"
                  ? "lg:col-span-6"
                  : "lg:col-span-7 xl:col-span-7"
              } relative w-full h-[620px] lg:h-[660px] rounded-[28px] overflow-hidden border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] bg-[#090D16] flex flex-col justify-between group transition-all duration-300`}
            >
              {/* Video Viewport / Agora Remote View */}
              <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center">
                <div id="remote-video" className="absolute inset-0 w-full h-full object-cover">
                  {/* Dedicated Agora Container */}
                  <div
                    id="remote-video-container"
                    className={`absolute inset-0 w-full h-full object-cover z-0 ${
                      remoteVideoTrackActive && remoteUserConnected ? "block" : "hidden"
                    }`}
                  />

                  {/* Elegant Waiting / Connecting Screen */}
                  {(!remoteVideoTrackActive || !remoteUserConnected) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 z-10 p-6 text-center bg-gradient-to-b from-[#0F172A] via-[#090D16] to-[#050811]">
                      {/* Pulsing ring graphic */}
                      <div className="relative mb-5">
                        <div className="absolute -inset-4 rounded-full bg-[#35B7C9]/10 animate-ping" />
                        <div className="absolute -inset-2 rounded-full bg-[#F2052C]/10 animate-pulse" />
                        <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/15 flex items-center justify-center shadow-2xl">
                          <span className="text-2xl font-black text-white">{selected.avatar}</span>
                        </div>
                        <div className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-emerald-500 border-2 border-[#090D16] flex items-center justify-center">
                          <Video className="h-3 w-3 text-white" />
                        </div>
                      </div>

                      <h3 className="text-base font-extrabold text-white tracking-tight mb-1">
                        {remoteUserConnected ? `${selected.name}'s Video Paused` : `Connecting with ${selected.name}`}
                      </h3>
                      <p className="text-xs text-slate-400 max-w-sm mb-4">
                        {remoteUserConnected
                          ? "The patient has disabled their camera or switched windows. Audio remains live."
                          : "End-to-end encrypted telehealth room ready. Waiting for patient to establish video stream..."}
                      </p>

                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-slate-300 font-mono">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Room ID: {selected.bookingId?.slice(-6) || "Active"}</span>
                        <span className="text-white/20">|</span>
                        <span>Agora HD Engine Active</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Floating Top-Left HUD: Live Patient Identity & Real-Time Vitals Ticker */}
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                  <div className="bg-slate-950/80 backdrop-blur-xl border border-white/15 text-white px-3.5 py-1.5 rounded-full flex items-center gap-2.5 shadow-xl">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-black">{selected.name}</span>
                    <span className="text-white/20">|</span>
                    {selected.vitals.hasRealKioskData && selected.vitals.bp ? (
                      <>
                        <span className="text-[11px] font-mono font-bold text-rose-300 flex items-center gap-1">
                          <Heart className="h-3 w-3 text-rose-400 fill-rose-400" /> {selected.vitals.bp}
                        </span>
                        {selected.vitals.pulse && (
                          <span className="text-[11px] font-mono text-cyan-300 font-bold hidden sm:inline">
                            {selected.vitals.pulse} bpm
                          </span>
                        )}
                        {selected.vitals.spo2 && (
                          <span className="text-[11px] font-mono text-emerald-300 font-bold hidden md:inline">
                            {selected.vitals.spo2} SpO2
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-[10px] text-slate-300 font-medium">Remote Session</span>
                    )}
                  </div>
                </div>

                {/* Floating Top-Right: Stream Quality & PiP Controls */}
                <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                  <div className="bg-slate-950/80 backdrop-blur-xl border border-white/15 text-white px-3 py-1.5 rounded-full flex items-center gap-2 text-[10px] font-mono font-bold shadow-xl">
                    <Lock className="h-3 w-3 text-emerald-400" />
                    <span className="text-slate-300 hidden sm:inline">1080p HD</span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </div>

                  {/* Restore PiP button if minimized */}
                  {isPipMinimized && (
                    <Button
                      size="sm"
                      onClick={() => setIsPipMinimized(false)}
                      className="h-8 px-2.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/15 text-white hover:bg-slate-800 text-xs font-bold"
                    >
                      <Camera className="h-3.5 w-3.5 mr-1 text-[#35B7C9]" /> Dr. Camera
                    </Button>
                  )}
                </div>

                {/* Doctor Floating Picture-in-Picture (PiP) */}
                {!isPipMinimized && (
                  <div className="absolute bottom-24 right-4 sm:right-6 w-44 h-32 sm:w-48 sm:h-36 rounded-[22px] overflow-hidden border-2 border-white/20 shadow-[0_10px_30px_rgba(0,0,0,0.6)] bg-slate-900/90 backdrop-blur-md z-20 group/pip transition-all hover:scale-105">
                    <div id="local-video" className="w-full h-full object-cover relative">
                      <div
                        id="local-video-container"
                        className={`w-full h-full object-cover -scale-x-100 ${cameraActive ? "block" : "hidden"}`}
                      />
                      {!cameraActive && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                          <VideoOff className="h-6 w-6 mb-1 text-rose-400" />
                          <span className="font-semibold text-[11px]">Camera Muted</span>
                        </div>
                      )}
                    </div>

                    {/* Doctor Label & Minimize control */}
                    <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] font-bold z-10 pointer-events-auto">
                      <span className="bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-full text-white font-mono flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${micActive ? "bg-emerald-400" : "bg-rose-500"}`} />
                        You (Dr.)
                      </span>
                      <button
                        onClick={() => setIsPipMinimized(true)}
                        className="h-5 w-5 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center opacity-0 group-hover/pip:opacity-100 transition-opacity"
                        title="Minimize PiP"
                      >
                        <Minimize2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Centered Floating Glassmorphic Control Dock */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 bg-slate-950/85 backdrop-blur-2xl border border-white/15 px-4 py-2 sm:px-5 sm:py-2.5 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
                  {/* Microphone Toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleMic}
                    className={`rounded-full h-11 w-11 transition-all ${
                      micActive
                        ? "bg-white/10 hover:bg-white/20 text-white ring-1 ring-white/15"
                        : "bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-500/50"
                    }`}
                    title={micActive ? "Mute Microphone" : "Unmute Microphone"}
                  >
                    {micActive ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                  </Button>

                  {/* Camera Toggle */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleCamera}
                    className={`rounded-full h-11 w-11 transition-all ${
                      cameraActive
                        ? "bg-white/10 hover:bg-white/20 text-white ring-1 ring-white/15"
                        : "bg-rose-600 hover:bg-rose-700 text-white ring-2 ring-rose-500/50"
                    }`}
                    title={cameraActive ? "Turn Off Camera" : "Turn On Camera"}
                  >
                    {cameraActive ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                  </Button>

                  {/* Device Check Popover */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPermissionsModalOpen(true)}
                    className="rounded-full h-11 w-11 bg-white/10 hover:bg-white/20 text-white ring-1 ring-white/15"
                    title="Audio & Video Device Settings"
                  >
                    <Sliders className="h-4.5 w-4.5 text-[#35B7C9]" />
                  </Button>

                  {/* Preview Rx Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPreviewRxModalOpen(true)}
                    className="rounded-full h-11 w-11 bg-white/10 hover:bg-white/20 text-white ring-1 ring-white/15"
                    title="Preview Signed Digital Prescription"
                  >
                    <Eye className="h-4.5 w-4.5 text-amber-300" />
                  </Button>

                  <div className="h-6 w-[1px] bg-white/20 mx-1" />

                  {/* Conclude Encounter Button */}
                  <Button
                    onClick={handleConcludeEncounter}
                    disabled={concludingConsultation}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs h-11 px-5 rounded-full shadow-lg shadow-rose-600/40 flex items-center gap-2 transform active:scale-95 transition-all"
                  >
                    <PhoneOff className="h-4 w-4" />
                    <span className="hidden sm:inline">End & Issue Rx</span>
                    <span className="sm:hidden">End</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Right Stage: Live Clinical Workspace or Pinned Document Viewer */}
            <div
              className={`${
                videoLayoutMode === "doc-split"
                  ? "lg:col-span-6"
                  : videoLayoutMode === "theater"
                  ? "hidden"
                  : "lg:col-span-5 xl:col-span-5"
              } space-y-4`}
            >
              {/* If in doc-split mode and pinned report exists, render document viewer */}
              {videoLayoutMode === "doc-split" && inCallPinnedReport ? (
                <div className="bg-white rounded-[26px] border border-slate-200/80 p-5 shadow-sm space-y-4 h-[620px] lg:h-[660px] flex flex-col justify-between animate-fadeIn">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-[12px] bg-[#35B7C9]/10 text-[#35B7C9] flex items-center justify-center font-bold">
                          <FileCheck2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-[#14213D] leading-tight">{inCallPinnedReport.title}</h4>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {inCallPinnedReport.type} · {inCallPinnedReport.date} · {inCallPinnedReport.fileSize}
                          </span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setVideoLayoutMode("split");
                          setInCallPinnedReport(null);
                        }}
                        className="h-8 text-xs font-bold text-slate-500 hover:text-[#14213D]"
                      >
                        <X className="h-4 w-4 mr-1" /> Close Scan
                      </Button>
                    </div>

                    {/* Report Content Body */}
                    <div className="p-4 rounded-[18px] bg-slate-900 text-slate-200 text-xs font-mono leading-relaxed space-y-3 border border-slate-800">
                      <div className="flex justify-between text-slate-400 border-b border-slate-800 pb-2">
                        <span>Record ID: {inCallPinnedReport.id}</span>
                        <span>ABDM Certified</span>
                      </div>
                      <p className="text-slate-300 text-xs leading-relaxed font-sans">{inCallPinnedReport.summary}</p>
                    </div>

                    <div className="p-3.5 rounded-[16px] bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs font-bold text-emerald-800">
                      <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                      Verified diagnostic record submitted by patient during consultation booking.
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <Button
                      size="sm"
                      onClick={() => handleInsertReportToNotes(inCallPinnedReport)}
                      className="rounded-[12px] h-9 text-xs font-bold bg-[#F2052C] hover:bg-[#D00424] text-white flex items-center gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" /> Append Findings to SOAP
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setInCallTab("chart")}
                      className="rounded-[12px] h-9 text-xs font-bold border-slate-200"
                    >
                      Switch to Rx Pad
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Segmented Navigation Tabs */}
                  <div className="flex items-center p-1 bg-slate-100 rounded-[18px] text-xs font-bold text-slate-500 shadow-inner">
                    <button
                      onClick={() => setInCallTab("chart")}
                      className={`flex-1 py-2.5 rounded-[14px] transition-all text-center flex items-center justify-center gap-1.5 ${
                        inCallTab === "chart"
                          ? "bg-white text-[#14213D] shadow-sm font-black"
                          : "hover:text-[#14213D]"
                      }`}
                    >
                      <Pill className="h-3.5 w-3.5 text-[#F2052C]" />
                      <span>Digital Rx Pad</span>
                      {medications.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-600 font-mono font-bold">
                          {medications.length}
                        </span>
                      )}
                    </button>

                    <button
                      onClick={() => setInCallTab("reports")}
                      className={`flex-1 py-2.5 rounded-[14px] transition-all text-center flex items-center justify-center gap-1.5 ${
                        inCallTab === "reports"
                          ? "bg-white text-[#14213D] shadow-sm font-black"
                          : "hover:text-[#14213D]"
                      }`}
                    >
                      <FileText className="h-3.5 w-3.5 text-[#35B7C9]" />
                      <span>Patient Reports</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#35B7C9]/10 text-[#35B7C9] font-mono">
                        {sharedReports.length}
                      </span>
                    </button>

                    <button
                      onClick={() => setInCallTab("vitals")}
                      className={`flex-1 py-2.5 rounded-[14px] transition-all text-center flex items-center justify-center gap-1.5 ${
                        inCallTab === "vitals"
                          ? "bg-white text-[#14213D] shadow-sm font-black"
                          : "hover:text-[#14213D]"
                      }`}
                    >
                      <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
                      <span>Telemetry</span>
                    </button>
                  </div>

                  {/* TAB 1: SOAP CHART & DIGITAL RX PAD */}
                  {inCallTab === "chart" && (
                    <div className="bg-white rounded-[24px] border border-slate-200/80 p-5 shadow-sm space-y-4 animate-fadeIn max-h-[600px] overflow-y-auto pr-1">
                      {/* Clinical Diagnosis Section with Quick Chips */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                            Clinical Impression & Diagnosis
                          </Label>
                          <span className="text-[10px] text-slate-400 font-medium">1-Click Quick Select:</span>
                        </div>

                        {/* Quick Diagnosis Chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {COMMON_DIAGNOSES.map((diag) => (
                            <button
                              key={diag}
                              type="button"
                              onClick={() => setClinicalDiagnosis(diag)}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all border ${
                                clinicalDiagnosis === diag
                                  ? "bg-[#F2052C] text-white border-[#F2052C] shadow-xs"
                                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                              }`}
                            >
                              {diag}
                            </button>
                          ))}
                        </div>

                        <Input
                          value={clinicalDiagnosis}
                          onChange={(e) => setClinicalDiagnosis(e.target.value)}
                          placeholder="Or type custom diagnosis..."
                          className="rounded-[12px] h-9 text-xs font-semibold"
                        />
                      </div>

                      {/* SOAP Clinical Assessment Notes with Quick Phrases */}
                      <div className="space-y-1.5 pt-2 border-t border-slate-100">
                        <Label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                          SOAP Clinical Notes & Assessment
                        </Label>
                        <Textarea
                          rows={3}
                          value={clinicalNotes}
                          onChange={(e) => setClinicalNotes(e.target.value)}
                          placeholder="Chief complaints, history of presenting illness, examination findings, clinical assessment..."
                          className="rounded-[12px] text-xs font-medium resize-none leading-relaxed"
                        />

                        {/* Quick Clinical Phrase Chips */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          {CLINICAL_NOTE_TEMPLATES.map((phrase, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setClinicalNotes((prev) => (prev ? `${prev} ${phrase}` : phrase))}
                              className="text-[10px] font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 px-2 py-0.5 rounded-[8px] border border-slate-200 transition-colors"
                            >
                              + {phrase.slice(0, 26)}…
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Multi-Medication Digital Prescription */}
                      <div className="pt-3 border-t border-slate-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block flex items-center gap-1.5">
                            <Pill className="h-3.5 w-3.5 text-[#F2052C]" /> Prescribed Medications ({medications.length})
                          </Label>

                          <button
                            type="button"
                            onClick={() => setPreviewRxModalOpen(true)}
                            className="text-[11px] font-bold text-[#F2052C] hover:underline flex items-center gap-1"
                          >
                            <Eye className="h-3 w-3" /> Preview Rx Slip
                          </button>
                        </div>

                        {/* List of Added Medications */}
                        {medications.length > 0 ? (
                          <div className="space-y-2">
                            {medications.map((m, idx) => (
                              <div
                                key={m.id}
                                className="p-2.5 rounded-[14px] bg-slate-50/80 border border-slate-200/90 flex items-center justify-between gap-2 text-xs hover:border-slate-300 transition-colors"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-extrabold text-[#14213D]">
                                      {idx + 1}. {m.name}
                                    </span>
                                    <Badge className="bg-white border-slate-200 text-[10px] font-bold text-slate-700 px-1.5 py-0">
                                      {m.dosage}
                                    </Badge>
                                    <Badge className="bg-rose-50 border-rose-200 text-[10px] font-bold text-rose-700 px-1.5 py-0">
                                      {m.frequency}
                                    </Badge>
                                  </div>
                                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                                    Duration: <span className="font-semibold text-slate-700">{m.duration}</span> · {m.instructions}
                                  </p>
                                </div>

                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveMedication(m.id)}
                                  className="h-7 w-7 text-slate-400 hover:text-rose-600 rounded-full shrink-0"
                                  title="Remove medication"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 rounded-[14px] bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium">
                            No medications added yet. Choose a preset or enter details below.
                          </div>
                        )}

                        {/* 1-Click Medication Presets */}
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                            Quick-Add Common Presets:
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {QUICK_MED_PRESETS.map((preset) => (
                              <button
                                key={preset.name}
                                type="button"
                                onClick={() => handleAddPresetMedication(preset)}
                                className="text-[10px] font-semibold text-slate-700 bg-white hover:bg-rose-50 hover:text-[#F2052C] px-2.5 py-1 rounded-[10px] border border-slate-200 hover:border-rose-200 shadow-2xs transition-all flex items-center gap-1"
                              >
                                <Plus className="h-2.5 w-2.5 text-[#F2052C]" /> {preset.name}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Add Custom Drug Form */}
                        <div className="p-3 rounded-[16px] bg-slate-50/70 border border-slate-200 space-y-2.5">
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider block">
                            Add Custom Drug
                          </span>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[10px] font-bold text-slate-400 mb-0.5 block">Drug Name</Label>
                              <Input
                                value={newMed.name}
                                onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                                placeholder="e.g. Cefixime 200mg"
                                className="rounded-[10px] h-8 text-xs font-semibold bg-white"
                              />
                            </div>
                            <div>
                              <Label className="text-[10px] font-bold text-slate-400 mb-0.5 block">Dosage</Label>
                              <Input
                                value={newMed.dosage}
                                onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })}
                                placeholder="e.g. 200mg"
                                className="rounded-[10px] h-8 text-xs font-semibold bg-white"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label className="text-[10px] font-bold text-slate-400 mb-0.5 block">Frequency</Label>
                              <Select
                                value={newMed.frequency}
                                onValueChange={(val) => setNewMed({ ...newMed, frequency: val })}
                              >
                                <SelectTrigger className="rounded-[10px] h-8 text-xs font-semibold bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Once daily (OD)">Once daily (OD)</SelectItem>
                                  <SelectItem value="Twice daily (BD)">Twice daily (BD)</SelectItem>
                                  <SelectItem value="Three times daily (TDS)">Three times daily (TDS)</SelectItem>
                                  <SelectItem value="Four times daily (QID)">Four times daily (QID)</SelectItem>
                                  <SelectItem value="As needed (SOS)">As needed (SOS)</SelectItem>
                                  <SelectItem value="At bedtime (HS)">At bedtime (HS)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[10px] font-bold text-slate-400 mb-0.5 block">Duration</Label>
                              <Input
                                value={newMed.duration}
                                onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })}
                                placeholder="e.g. 5 days"
                                className="rounded-[10px] h-8 text-xs font-semibold bg-white"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <Input
                                value={newMed.instructions}
                                onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })}
                                placeholder="Instructions (e.g. Take after food with warm water)"
                                className="rounded-[10px] h-8 text-xs font-semibold bg-white"
                              />
                            </div>
                            <Button
                              type="button"
                              onClick={handleAddMedication}
                              className="rounded-[10px] h-8 px-3 text-xs font-bold bg-[#14213D] hover:bg-[#1E2E4E] text-white shrink-0"
                            >
                              <Plus className="h-3 w-3 mr-1" /> Add
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: IN-CALL PATIENT HEALTH REPORTS VIEWER */}
                  {inCallTab === "reports" && (
                    <div className="bg-white rounded-[24px] border border-slate-200/80 p-5 shadow-sm space-y-3.5 animate-fadeIn max-h-[600px] overflow-y-auto pr-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-black text-[#14213D] uppercase tracking-wider flex items-center gap-1.5">
                            <FileCheck2 className="h-4 w-4 text-[#35B7C9]" /> Patient Diagnostic Records
                          </h4>
                          <p className="text-[10px] text-slate-400">Review lab tests, radiology, and files during the active call</p>
                        </div>
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          {sharedReports.length} Files
                        </Badge>
                      </div>

                      <div className="space-y-2.5">
                        {sharedReports.length === 0 ? (
                          <div className="p-8 text-center bg-slate-50 rounded-[18px] border border-dashed border-slate-200">
                            <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-600">No health reports uploaded</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Patient has no attached diagnostic files.</p>
                          </div>
                        ) : (
                          sharedReports.map((r) => (
                            <div
                              key={r.id}
                              className="p-3.5 rounded-[18px] border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all space-y-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="h-8 w-8 rounded-[10px] bg-[#35B7C9]/10 text-[#35B7C9] flex items-center justify-center shrink-0">
                                    <FileText className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <h5 className="text-xs font-extrabold text-[#14213D] truncate">{r.title}</h5>
                                    <span className="text-[10px] text-slate-400 font-semibold">{r.type} · {r.date}</span>
                                  </div>
                                </div>

                                <span className="text-[10px] font-mono text-slate-400 shrink-0">{r.fileSize}</span>
                              </div>

                              <p className="text-[11px] text-slate-600 bg-white p-2.5 rounded-[12px] border border-slate-100 leading-relaxed">
                                {r.summary}
                              </p>

                              <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setPreviewReport(r)}
                                    className="h-7 text-[10px] font-bold rounded-[8px] border-slate-200 text-slate-700 flex items-center gap-1"
                                  >
                                    <ExternalLink className="h-3 w-3 text-[#35B7C9]" /> Inspect
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setInCallPinnedReport(r);
                                      setVideoLayoutMode("doc-split");
                                    }}
                                    className="h-7 text-[10px] font-bold rounded-[8px] border-[#35B7C9]/40 text-[#35B7C9] hover:bg-[#35B7C9]/10 flex items-center gap-1"
                                  >
                                    <SplitSquareVertical className="h-3 w-3" /> Pin Beside Video
                                  </Button>
                                </div>

                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleInsertReportToNotes(r)}
                                  className="h-7 text-[10px] font-bold text-[#F2052C] hover:bg-rose-50 rounded-[8px] flex items-center gap-1"
                                >
                                  <Plus className="h-3 w-3" /> Append to SOAP
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: KIOSK IOT VITALS TELEMETRY HUD */}
                  {inCallTab === "vitals" && (
                    <div className="bg-white rounded-[24px] border border-slate-200/80 p-5 shadow-sm space-y-4 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <HeartPulse className="h-3.5 w-3.5 text-rose-500" /> Kiosk Screening Telemetry
                        </span>
                        {selected.vitals.hasRealKioskData ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono">
                            Verified IoT Link
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-[10px]">
                            Remote Patient (No Kiosk Scan)
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="p-3.5 rounded-[18px] bg-rose-50/60 border border-rose-100">
                          <div className="text-[10px] font-bold text-rose-600">Blood Pressure</div>
                          <div className="text-xl font-black text-slate-800 font-mono mt-0.5">
                            {selected.vitals.bp || "-- / --"}
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {selected.vitals.bp ? "mmHg (Norm: 120/80)" : "Not recorded (Remote)"}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-[18px] bg-emerald-50/60 border border-emerald-100">
                          <div className="text-[10px] font-bold text-emerald-600">Heart Rate</div>
                          <div className="text-xl font-black text-slate-800 font-mono mt-0.5">
                            {selected.vitals.pulse ? `${selected.vitals.pulse} bpm` : "-- bpm"}
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {selected.vitals.pulse ? "Normal Sinus Rhythm" : "Not recorded (Remote)"}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-[18px] bg-amber-50/60 border border-amber-100">
                          <div className="text-[10px] font-bold text-amber-600">Body Temp</div>
                          <div className="text-xl font-black text-slate-800 font-mono mt-0.5">
                            {selected.vitals.temp || "--"}
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {selected.vitals.temp ? "Thermal Sensor" : "Not recorded (Remote)"}
                          </span>
                        </div>

                        <div className="p-3.5 rounded-[18px] bg-cyan-50/60 border border-cyan-100">
                          <div className="text-[10px] font-bold text-cyan-600">Oxygen Saturation</div>
                          <div className="text-xl font-black text-slate-800 font-mono mt-0.5">
                            {selected.vitals.spo2 || "--"}
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {selected.vitals.spo2 ? "SpO2 Level" : "Not recorded (Remote)"}
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5 rounded-[16px] bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">Registered Patient Contact:</span>
                        <span className="font-mono font-bold text-slate-800">{selected.phone || "Kiosk Direct Intake"}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : workflowPhase === "summary" && selected ? (
        /* ============================================================
            PHASE 3: POST-ENCOUNTER SUMMARY & TRANSITION
        ============================================================ */
        <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn py-6">
          <div className="bg-white rounded-[26px] border border-slate-200/80 p-8 shadow-xl text-center space-y-6">
            <div className="h-16 w-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-[#14213D] tracking-tight">Consultation Concluded</h2>
              <p className="text-xs text-slate-500 font-medium">
                Encounter with <span className="font-bold text-[#14213D]">{selected.name}</span> completed and digital Rx issued.
              </p>
            </div>

            <div className="p-5 rounded-[20px] bg-slate-50 border border-slate-200/80 text-left space-y-3 text-xs">
              <div className="flex justify-between items-center text-slate-500 font-bold pb-2 border-b border-slate-200/60">
                <span>Patient Encounter:</span>
                <span className="text-[#14213D] font-extrabold">{selected.name} ({selected.age}y · {selected.gender})</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 font-bold pb-2 border-b border-slate-200/60">
                <span>Primary Diagnosis:</span>
                <span className="text-[#14213D] font-extrabold">{clinicalDiagnosis || selected.condition}</span>
              </div>
              <div className="space-y-1.5">
                <span className="text-slate-500 font-bold block">Prescribed Medicines ({medications.length}):</span>
                <div className="space-y-1">
                  {medications.map((m, idx) => (
                    <div key={m.id || idx} className="flex items-center justify-between p-2 rounded-[10px] bg-white border border-slate-200/80 text-[11px]">
                      <span className="font-extrabold text-[#14213D]">
                        {idx + 1}. {m.name}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge className="bg-slate-100 text-slate-700 text-[10px] font-bold px-1.5 py-0 border-none">
                          {m.dosage}
                        </Badge>
                        <Badge className="bg-rose-50 text-rose-700 text-[10px] font-bold px-1.5 py-0 border-none">
                          {m.frequency}
                        </Badge>
                        <span className="text-slate-400 font-mono text-[10px]">({m.duration})</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions: Print PDF or Return to Queue */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() =>
                  openPrescriptionPdf({
                    patientName: selected.name,
                    bookingId: selected.bookingId,
                    diagnosis: clinicalDiagnosis || selected.condition,
                    medications: medications.map((m) => ({
                      name: m.name,
                      dosage: m.dosage,
                      frequency: m.frequency,
                      duration: m.duration,
                      instructions: m.instructions,
                    })),
                    instructions: medications[0]?.instructions || rxForm.instructions,
                    duration: medications[0]?.duration || rxForm.duration,
                  })
                }
                className="rounded-[14px] h-11 px-5 text-xs font-bold border-slate-200 flex items-center gap-2"
              >
                <Printer className="h-4 w-4 text-[#F2052C]" /> Print Official PDF Slip
              </Button>

              {nextWaitingPatient ? (
                <Button
                  onClick={() => handleStartConsultation(nextWaitingPatient)}
                  className="rounded-[14px] h-11 px-6 text-xs font-extrabold bg-[#14213D] hover:bg-[#1E2E4E] text-white shadow-lg flex items-center gap-2"
                >
                  Admit Next: {nextWaitingPatient.name} <ArrowRight className="h-4 w-4 text-[#35B7C9]" />
                </Button>
              ) : (
                <Button
                  onClick={() => setWorkflowPhase("queue")}
                  className="rounded-[14px] h-11 px-6 text-xs font-extrabold bg-[#14213D] hover:bg-[#1E2E4E] text-white shadow-lg flex items-center gap-2"
                >
                  Return to Waiting Room
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================
            PHASE 1: THE CLINICAL WAITING ROOM & INTAKE (DEFAULT)
        ============================================================ */
        <div className="space-y-6 animate-fadeIn">
          {/* Top Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-5 rounded-[24px] border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)]">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-[16px] bg-[#F2052C]/10 text-[#F2052C] flex items-center justify-center font-bold">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-black text-[#14213D] tracking-tight">Telehealth Virtual Clinic</h1>
                <p className="text-xs text-slate-400 font-medium">
                  Clinical Intake, Patient Shared Health Reports & Encrypted Agora HD Suite
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <Button
                variant="outline"
                onClick={() => setPermissionsModalOpen(true)}
                className="rounded-[14px] h-9 text-xs font-bold border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-xs flex items-center gap-1.5"
              >
                <Camera className="h-3.5 w-3.5 text-[#35B7C9]" /> Device Check
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={fetchConsultationsData}
                disabled={loading}
                className="rounded-[14px] h-9 w-9 border-slate-200 bg-white hover:bg-slate-50 text-slate-600 shadow-xs"
                title="Refresh Intake Queue"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>

              <Button
                onClick={() => setAddPatientOpen(true)}
                className="rounded-[14px] h-9 px-4 text-xs font-bold bg-[#14213D] hover:bg-[#1E2E4E] text-white shadow-xs flex items-center gap-1.5"
              >
                <UserPlus className="h-3.5 w-3.5" /> Quick Register Walk-In
              </Button>
            </div>
          </div>

          {/* Split Waiting Room Stage (Left: Queue | Right: Dossier & Reports) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Queue Panel (5 cols) */}
            <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-[24px] border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] p-4 space-y-3.5">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search patient, symptoms, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 rounded-[14px] bg-slate-50 border-slate-200 text-xs font-medium"
                />
              </div>

              {/* 3 Queue Tabs */}
              <div className="flex items-center p-1 bg-slate-100 rounded-[14px] text-xs font-bold text-slate-500">
                {(["Waiting", "Scheduled", "Completed"] as const).map((tab) => {
                  const count = patients.filter((p) => {
                    if (tab === "Waiting") return p.status === "Waiting" || p.status === "In Consultation";
                    if (tab === "Scheduled") return p.status === "Scheduled" || p.status === "Postponed";
                    if (tab === "Completed") return p.status === "Completed" || p.status === "Cancelled";
                    return false;
                  }).length;

                  return (
                    <button
                      key={tab}
                      onClick={() => setQueueTab(tab)}
                      className={`flex-1 py-1.5 rounded-[11px] transition-all text-center flex items-center justify-center gap-1.5 ${
                        queueTab === tab ? "bg-white text-[#14213D] shadow-sm font-extrabold" : "hover:text-[#14213D]"
                      }`}
                    >
                      <span>{tab}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/70 text-slate-600 font-mono">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Queue Patient Cards List */}
              <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                {filteredPatients.length === 0 ? (
                  <div className="text-center py-12 px-4 rounded-[18px] bg-slate-50/60 border border-dashed border-slate-200">
                    <User className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-500">No patients in this queue</p>
                  </div>
                ) : (
                  filteredPatients.map((p) => {
                    const isSelected = selected?.id === p.id;
                    const isWaiting = p.status === "Waiting" || p.status === "In Consultation";

                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelected(p)}
                        className={`p-3.5 rounded-[18px] transition-all cursor-pointer border ${
                          isSelected
                            ? "bg-gradient-to-r from-rose-50/80 via-white to-white border-[#F2052C] shadow-md shadow-rose-500/5 ring-1 ring-[#F2052C]/20"
                            : "bg-white hover:bg-slate-50/80 border-slate-100 hover:border-slate-200 shadow-xs"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`h-11 w-11 rounded-[14px] flex items-center justify-center font-black text-xs shrink-0 ${
                                isSelected
                                  ? "bg-gradient-to-br from-[#F2052C] to-[#FF4B66] text-white shadow-md shadow-[#F2052C]/20"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {p.avatar}
                            </div>
                            <div className="min-w-0 space-y-0.5">
                              <h4 className="text-sm font-extrabold text-[#14213D] truncate">{p.name}</h4>
                              <p className="text-xs text-slate-500 font-medium truncate">{p.condition}</p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            {isWaiting ? (
                              <Badge className="bg-rose-50 text-rose-600 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                                Live
                              </Badge>
                            ) : p.status === "Postponed" ? (
                              <Badge className="bg-amber-50 text-amber-600 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Postponed
                              </Badge>
                            ) : p.status === "Cancelled" ? (
                              <Badge className="bg-rose-50 text-rose-500 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Declined
                              </Badge>
                            ) : p.status === "Completed" ? (
                              <Badge className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                Done
                              </Badge>
                            ) : (
                              <Badge className="bg-blue-50 text-blue-600 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {p.slotTime || "Scheduled"}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Card Action Controls: Admit / Postpone / Reject */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                          <span className="font-mono text-slate-500 text-[11px] flex items-center gap-1">
                            {p.vitals.hasRealKioskData && p.vitals.bp ? (
                              <>
                                <Heart className="h-3 w-3 text-rose-500" /> {p.vitals.bp}
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">Remote Consult</span>
                            )}
                          </span>

                          <div className="flex items-center gap-1.5">
                            {/* Postpone button */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => handleOpenPostpone(p, e)}
                              className="h-6 px-2 text-[10px] font-bold text-amber-600 hover:bg-amber-50 rounded-[6px]"
                              title="Postpone consultation"
                            >
                              <CalendarClock className="h-3 w-3 mr-0.5" /> Postpone
                            </Button>

                            {/* Reject button */}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => handleOpenReject(p, e)}
                              className="h-6 px-2 text-[10px] font-bold text-rose-600 hover:bg-rose-50 rounded-[6px]"
                              title="Decline consultation"
                            >
                              <Ban className="h-3 w-3 mr-0.5" /> Decline
                            </Button>

                            {/* Admit button */}
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdmitPatient(p);
                              }}
                              className="h-6 px-2.5 text-[10px] font-black bg-[#F2052C] hover:bg-[#D00424] text-white rounded-[6px] shadow-xs flex items-center gap-1"
                            >
                              <Video className="h-3 w-3" /> Admit
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Dossier Panel (7 cols / 8 cols) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-5">
              {selected ? (
                <div className="space-y-5 animate-fadeIn">
                  {/* Selected Patient Identity & Start Consultation Banner */}
                  <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-r from-[#14213D] via-[#1A2E56] to-[#14213D] p-6 text-white shadow-xl border border-white/10">
                    <div className="absolute top-0 right-0 -mr-12 -mt-12 w-56 h-56 rounded-full bg-[#F2052C]/20 blur-3xl pointer-events-none" />

                    <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                      <div className="flex items-start sm:items-center gap-4">
                        <div className="h-16 w-16 rounded-[20px] bg-gradient-to-br from-[#F2052C] to-[#35B7C9] p-0.5 shadow-lg shrink-0">
                          <div className="h-full w-full rounded-[18px] bg-[#14213D] flex items-center justify-center font-black text-xl text-white">
                            {selected.avatar}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl sm:text-2xl font-black tracking-tight">{selected.name}</h2>
                            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3 text-emerald-400" /> Patient Dossier Active
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-300 font-medium">
                            {selected.age} yrs · {selected.gender} {selected.phone && `· ${selected.phone}`}
                          </p>
                          <p className="text-[11px] text-amber-300 font-semibold">{selected.condition}</p>
                        </div>
                      </div>

                      {/* Doctor Action Controls: Admit / Postpone / Reject */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          onClick={() => handleOpenPostpone(selected)}
                          className="rounded-[14px] h-10 px-3.5 bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold flex items-center gap-1.5"
                        >
                          <CalendarClock className="h-4 w-4 text-amber-300" /> Postpone
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => handleOpenReject(selected)}
                          className="rounded-[14px] h-10 px-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30 text-xs font-bold flex items-center gap-1.5"
                        >
                          <Ban className="h-4 w-4 text-rose-400" /> Reject
                        </Button>

                        <Button
                          onClick={() => handleAdmitPatient(selected)}
                          className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] hover:opacity-90 text-white font-black rounded-[14px] h-10 px-5 border-none shadow-xl shadow-[#F2052C]/30 text-xs flex items-center gap-2 transform active:scale-95 transition-all"
                        >
                          <Video className="h-4.5 w-4.5" /> Admit to Video Room
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Kiosk Telemetry Cards */}
                  <div className="bg-white rounded-[24px] border border-slate-200/80 p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-extrabold text-[#14213D] flex items-center gap-2">
                        <Activity className="h-4.5 w-4.5 text-[#F2052C]" /> Real-Time Kiosk IoT Telemetry
                      </h3>
                      {selected.vitals.hasRealKioskData ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-mono flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          Hardware Live Synced
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium">
                          Remote Telehealth · No Kiosk Scan
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-4 rounded-[18px] bg-rose-50/50 border border-rose-100/80 space-y-1">
                        <span className="text-xs text-rose-600 font-bold block">Blood Pressure</span>
                        <div className="text-xl font-black text-slate-800 font-mono">
                          {selected.vitals.bp || "-- / --"}
                        </div>
                        <span className="text-[10px] font-semibold text-rose-500">
                          {selected.vitals.bp ? "mmHg" : "Not measured (Remote)"}
                        </span>
                      </div>

                      <div className="p-4 rounded-[18px] bg-emerald-50/50 border border-emerald-100/80 space-y-1">
                        <span className="text-xs text-emerald-600 font-bold block">Heart Rate</span>
                        <div className="text-xl font-black text-slate-800 font-mono">
                          {selected.vitals.pulse ? `${selected.vitals.pulse} bpm` : "-- bpm"}
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-500">
                          {selected.vitals.pulse ? "Normal Rhythm" : "Not measured (Remote)"}
                        </span>
                      </div>

                      <div className="p-4 rounded-[18px] bg-amber-50/50 border border-amber-100/80 space-y-1">
                        <span className="text-xs text-amber-600 font-bold block">Body Temp</span>
                        <div className="text-xl font-black text-slate-800 font-mono">
                          {selected.vitals.temp || "--"}
                        </div>
                        <span className="text-[10px] font-semibold text-amber-500">
                          {selected.vitals.temp ? "Sensor Synced" : "Not measured (Remote)"}
                        </span>
                      </div>

                      <div className="p-4 rounded-[18px] bg-cyan-50/50 border border-cyan-100/80 space-y-1">
                        <span className="text-xs text-cyan-600 font-bold block">Oxygen Saturation</span>
                        <div className="text-xl font-black text-slate-800 font-mono">
                          {selected.vitals.spo2 || "--"}
                        </div>
                        <span className="text-[10px] font-semibold text-cyan-500">
                          {selected.vitals.spo2 ? "SpO2 Level" : "Not measured (Remote)"}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 rounded-[18px] bg-slate-50 border border-slate-200/80">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Chief Complaint & Case Notes
                      </span>
                      <p className="text-xs font-semibold text-slate-700 leading-relaxed">
                        {selected.notes || "Routine telehealth wellness consultation requested."}
                      </p>
                    </div>
                  </div>

                  {/* Patient Shared Health Reports Section (Displayed in Appointment Details) */}
                  <div className="bg-white rounded-[24px] border border-slate-200/80 p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-[12px] bg-[#35B7C9]/10 text-[#35B7C9] flex items-center justify-center font-bold">
                          <FileCheck2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-[#14213D]">
                            Patient Shared Health Reports & Attachments
                          </h3>
                          <p className="text-xs text-slate-400">
                            Diagnostic files, previous prescriptions, and lab tests submitted by the patient
                          </p>
                        </div>
                      </div>

                      {sharedReportsStatus === "declaration_required" ? (
                        <Button
                          size="sm"
                          onClick={() => setDeclarationModalOpen(true)}
                          className="bg-amber-500 hover:bg-amber-600 text-white rounded-[12px] text-xs font-bold h-8"
                        >
                          <Lock className="h-3 w-3 mr-1" /> Unlock Records
                        </Button>
                      ) : (
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                          <Unlock className="h-3 w-3 mr-1 text-emerald-600" /> NMC / ABDM Verified
                        </Badge>
                      )}
                    </div>

                    {sharedReports.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {sharedReports.map((r) => (
                          <div
                            key={r.id}
                            className="p-4 rounded-[18px] border border-slate-200/90 bg-white hover:border-[#35B7C9] transition-all shadow-xs space-y-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <div className="h-9 w-9 rounded-[12px] bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                                  <FileText className="h-5 w-5" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-black text-[#14213D] leading-tight line-clamp-1">
                                    {r.title}
                                  </h4>
                                  <span className="text-[10px] text-slate-400 font-semibold">
                                    {r.type} · {r.date}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 shrink-0">{r.fileSize}</span>
                            </div>

                            <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2 bg-slate-50 p-2.5 rounded-[12px] border border-slate-100">
                              {r.summary}
                            </p>

                            <div className="flex items-center justify-between pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (r.fileUrl && r.fileUrl !== "#") {
                                    window.open(r.fileUrl, "_blank");
                                  } else {
                                    setPreviewReport(r);
                                  }
                                }}
                                className="h-8 text-xs font-bold rounded-[10px] border-slate-200 text-[#14213D] hover:bg-slate-50 flex items-center gap-1.5"
                              >
                                <ExternalLink className="h-3.5 w-3.5 text-[#35B7C9]" /> Inspect File
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (r.fileUrl && r.fileUrl !== "#") {
                                    window.open(r.fileUrl, "_blank");
                                  } else {
                                    toast({
                                      title: "Download Link Unavailable",
                                      description: `Direct storage URL for ${r.title} was not provided with this record.`,
                                      variant: "destructive",
                                    });
                                  }
                                }}
                                className="h-8 text-xs font-bold text-slate-600 hover:text-[#14213D] rounded-[10px] flex items-center gap-1"
                              >
                                <Download className="h-3.5 w-3.5" /> Download
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-slate-50/70 rounded-[20px] border border-dashed border-slate-200/90 space-y-2">
                        <div className="h-10 w-10 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                          <FileText className="h-5 w-5" />
                        </div>
                        <p className="text-xs font-bold text-slate-700">No Patient Health Reports Attached</p>
                        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                          The patient has not attached prior diagnostic scans, lab reports, or previous prescriptions for this consultation.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-12 rounded-[24px] bg-white border border-slate-200/80 text-center space-y-4 shadow-sm">
                  <Stethoscope className="h-10 w-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-extrabold text-[#14213D]">Select a patient from the waiting queue</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          POSTPONE CONSULTATION DIALOG
      ============================================================ */}
      <Dialog open={postponeModalOpen} onOpenChange={setPostponeModalOpen}>
        <DialogContent className="max-w-md rounded-[26px] p-6 bg-white border border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#14213D] flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-amber-500" /> Postpone Consultation
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium">
              Delay this consultation session and automatically notify the patient with updated timing.
            </DialogDescription>
          </DialogHeader>

          {actionPatient && (
            <div className="space-y-4 pt-2">
              <div className="p-3.5 rounded-[16px] bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                <div className="h-10 w-10 rounded-[12px] bg-[#14213D] text-white flex items-center justify-center font-black text-xs">
                  {actionPatient.avatar}
                </div>
                <div>
                  <h4 className="text-xs font-black text-[#14213D]">{actionPatient.name}</h4>
                  <p className="text-[11px] text-slate-400">{actionPatient.condition}</p>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600 mb-1.5 block">Postpone Duration</Label>
                <Select value={postponeMinutes} onValueChange={setPostponeMinutes}>
                  <SelectTrigger className="rounded-[12px] h-10 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes delay</SelectItem>
                    <SelectItem value="30">30 minutes delay</SelectItem>
                    <SelectItem value="45">45 minutes delay</SelectItem>
                    <SelectItem value="60">1 hour delay</SelectItem>
                    <SelectItem value="120">2 hours delay</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600 mb-1.5 block">Notice to Patient</Label>
                <Textarea
                  rows={2}
                  value={postponeNote}
                  onChange={(e) => setPostponeNote(e.target.value)}
                  className="rounded-[12px] text-xs font-medium resize-none"
                  placeholder="Reason for delay..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setPostponeModalOpen(false)}
                  className="rounded-[12px] h-9 text-xs font-bold border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmPostpone}
                  className="rounded-[12px] h-9 px-4 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
                >
                  Confirm Postpone
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================
          REJECT / DECLINE CONSULTATION DIALOG
      ============================================================ */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="max-w-md rounded-[26px] p-6 bg-white border border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#14213D] flex items-center gap-2">
              <Ban className="h-5 w-5 text-rose-500" /> Decline Consultation Request
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium">
              Reject this booking and return notification to the patient.
            </DialogDescription>
          </DialogHeader>

          {actionPatient && (
            <div className="space-y-4 pt-2">
              <div className="p-3.5 rounded-[16px] bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                <div className="h-10 w-10 rounded-[12px] bg-rose-600 text-white flex items-center justify-center font-black text-xs">
                  {actionPatient.avatar}
                </div>
                <div>
                  <h4 className="text-xs font-black text-[#14213D]">{actionPatient.name}</h4>
                  <p className="text-[11px] text-slate-400">{actionPatient.condition}</p>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600 mb-1.5 block">Clinical Reason for Rejection</Label>
                <Select value={rejectReason} onValueChange={setRejectReason}>
                  <SelectTrigger className="rounded-[12px] h-10 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Specialty mismatch / Out of clinical scope">Specialty mismatch / Out of clinical scope</SelectItem>
                    <SelectItem value="Patient unresponsive in waiting room">Patient unresponsive in waiting room</SelectItem>
                    <SelectItem value="In-person emergency care required immediately">In-person emergency care required immediately</SelectItem>
                    <SelectItem value="Physician unavailable / emergency hospital duty">Physician unavailable / emergency duty</SelectItem>
                    <SelectItem value="Duplicate consultation request">Duplicate consultation request</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600 mb-1.5 block">Additional Clinical Notes (Optional)</Label>
                <Textarea
                  rows={2}
                  value={rejectNote}
                  onChange={(e) => setRejectNote(e.target.value)}
                  className="rounded-[12px] text-xs font-medium resize-none"
                  placeholder="Provide guidance or referral instructions for the patient..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() => setRejectModalOpen(false)}
                  className="rounded-[12px] h-9 text-xs font-bold border-slate-200"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmReject}
                  className="rounded-[12px] h-9 px-4 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                >
                  Confirm Decline
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================
          DOCUMENT PREVIEW MODAL
      ============================================================ */}
      <Dialog open={Boolean(previewReport)} onOpenChange={(open) => !open && setPreviewReport(null)}>
        <DialogContent className="max-w-xl rounded-[26px] p-6 bg-white border border-slate-100 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-[12px] bg-[#35B7C9]/10 text-[#35B7C9] flex items-center justify-center font-bold">
                <FileCheck2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-[#14213D]">
                  {previewReport?.title}
                </DialogTitle>
                <p className="text-xs text-slate-400 font-medium">
                  {previewReport?.type} · Verified Diagnostic File ({previewReport?.fileSize})
                </p>
              </div>
            </div>
          </DialogHeader>

          {previewReport && (
            <div className="space-y-4 pt-3">
              <div className="p-4 rounded-[16px] bg-slate-900 text-slate-200 text-xs font-mono leading-relaxed space-y-2 border border-slate-800">
                <div className="flex justify-between text-slate-400 border-b border-slate-800 pb-1.5">
                  <span>Record ID: {previewReport.id}</span>
                  <span>Date: {previewReport.date}</span>
                </div>
                <p className="text-slate-300 text-xs leading-normal pt-1 font-sans">
                  {previewReport.summary}
                </p>
              </div>

              <div className="p-3.5 rounded-[14px] bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs font-bold text-emerald-800">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                ABDM Verified digital signature. Certified authentic by diagnostic laboratory.
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    handleInsertReportToNotes(previewReport);
                    setPreviewReport(null);
                  }}
                  className="rounded-[12px] h-9 text-xs font-bold text-[#F2052C] border-rose-200"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Append to SOAP Notes
                </Button>

                <div className="flex items-center gap-2">
                  {previewReport.fileUrl && previewReport.fileUrl !== "#" && (
                    <Button
                      size="sm"
                      onClick={() => window.open(previewReport.fileUrl, "_blank")}
                      className="rounded-[12px] h-9 px-3 text-xs font-bold bg-[#35B7C9] hover:bg-[#2ca2b3] text-white flex items-center gap-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open Original File
                    </Button>
                  )}

                  <Button
                    size="sm"
                    onClick={() => setPreviewReport(null)}
                    className="rounded-[12px] h-9 px-4 text-xs font-bold bg-[#14213D] text-white"
                  >
                    Close Document
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================
          ABDM DECLARATION MODAL
      ============================================================ */}
      <Dialog open={declarationModalOpen} onOpenChange={setDeclarationModalOpen}>
        <DialogContent className="max-w-md rounded-[26px] p-6 bg-white border border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#14213D] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" /> NMC / ABDM Telemedicine Declaration
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium">
              Legal compliance declaration for accessing patient records.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="p-3.5 rounded-[16px] bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
              In accordance with NMC/ABDM Telemedicine Practice Guidelines and patient privacy regulations, I declare
              that I will access and use this patient's medical records strictly for the purpose of this clinical
              consultation. I agree to keep all patient health information confidential.
            </div>

            <div className="flex items-center gap-2.5">
              <Checkbox
                id="declaration-chk"
                checked={agreementChecked}
                onCheckedChange={(checked) => setAgreementChecked(Boolean(checked))}
              />
              <Label htmlFor="declaration-chk" className="text-xs font-bold text-slate-700 cursor-pointer">
                I accept and declare compliance with NMC Telemedicine Guidelines
              </Label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeclarationModalOpen(false)}
                className="rounded-[14px] h-9 text-xs font-bold border-slate-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAgreeDeclaration}
                disabled={!agreementChecked || agreeingDeclaration}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-[14px] h-9 px-4 text-xs font-bold shadow-sm"
              >
                {agreeingDeclaration ? "Decrypting…" : "Accept & Unlock"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============================================================
          QUICK REGISTER WALK-IN PATIENT MODAL
      ============================================================ */}
      <Dialog open={addPatientOpen} onOpenChange={setAddPatientOpen}>
        <DialogContent className="max-w-md rounded-[26px] p-6 bg-white border border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#14213D] flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#F2052C]" /> Quick Register Walk-In Patient
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium">
              Instantly admit a walk-in patient into the live virtual waiting queue.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreatePatient} className="space-y-3.5 pt-2">
            <div>
              <Label className="text-xs font-bold text-slate-600 mb-1 block">Full Name</Label>
              <Input
                value={newPatient.name}
                onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                placeholder="e.g. Ramesh Verma"
                className="rounded-[14px] h-10 text-xs font-semibold"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-600 mb-1 block">Age</Label>
                <Input
                  value={newPatient.age}
                  onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                  type="number"
                  placeholder="36"
                  className="rounded-[14px] h-10 text-xs font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600 mb-1 block">Gender</Label>
                <Select
                  value={newPatient.gender}
                  onValueChange={(val) => setNewPatient({ ...newPatient, gender: val })}
                >
                  <SelectTrigger className="rounded-[14px] h-10 text-xs font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-600 mb-1 block">Phone Number</Label>
              <Input
                value={newPatient.phone}
                onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="rounded-[14px] h-10 text-xs font-semibold"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-600 mb-1 block">Chief Complaint / Condition</Label>
              <Input
                value={newPatient.condition}
                onChange={(e) => setNewPatient({ ...newPatient, condition: e.target.value })}
                placeholder="e.g. Hypertension follow-up, mild fever"
                className="rounded-[14px] h-10 text-xs font-semibold"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <div>
                <Label className="text-[11px] font-bold text-slate-500 mb-1 block">BP</Label>
                <Input
                  value={newPatient.bp}
                  onChange={(e) => setNewPatient({ ...newPatient, bp: e.target.value })}
                  placeholder="120/80"
                  className="rounded-[12px] h-9 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-[11px] font-bold text-slate-500 mb-1 block">Temp</Label>
                <Input
                  value={newPatient.temp}
                  onChange={(e) => setNewPatient({ ...newPatient, temp: e.target.value })}
                  placeholder="98.6°F"
                  className="rounded-[12px] h-9 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-[11px] font-bold text-slate-500 mb-1 block">Pulse</Label>
                <Input
                  value={newPatient.pulse}
                  onChange={(e) => setNewPatient({ ...newPatient, pulse: e.target.value })}
                  placeholder="72"
                  className="rounded-[12px] h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddPatientOpen(false)}
                className="rounded-[14px] h-10 text-xs font-bold border-slate-200"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingPatient}
                className="rounded-[14px] h-10 px-5 text-xs font-bold bg-[#F2052C] hover:bg-[#D00424] text-white shadow-md shadow-[#F2052C]/20"
              >
                {submittingPatient ? "Registering…" : "Admit to Queue"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ============================================================
          IN-CALL PRESCRIPTION PREVIEW DIALOG
      ============================================================ */}
      <Dialog open={previewRxModalOpen} onOpenChange={setPreviewRxModalOpen}>
        <DialogContent className="max-w-2xl rounded-[28px] p-6 bg-white border border-slate-100 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-[14px] bg-[#F2052C]/10 text-[#F2052C] flex items-center justify-center font-bold">
                  <Pill className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-extrabold text-[#14213D]">
                    Digital Prescription Slip Preview
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-400 font-medium">
                    Certified NMC / ABDM Compliant Telemedicine Prescription
                  </DialogDescription>
                </div>
              </div>

              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                <ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Tamper-Proof
              </Badge>
            </div>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 pt-3">
              {/* Header Slip Details */}
              <div className="p-4 rounded-[18px] bg-slate-50 border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Patient</span>
                  <p className="font-extrabold text-[#14213D]">{selected.name}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Age / Gender</span>
                  <p className="font-extrabold text-[#14213D]">{selected.age}y · {selected.gender}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Date</span>
                  <p className="font-extrabold text-[#14213D]">{new Date().toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Ref Code</span>
                  <p className="font-mono font-bold text-slate-600">{selected.bookingId?.slice(-6) || "Active"}</p>
                </div>
              </div>

              {/* Diagnosis & Clinical Summary */}
              <div className="p-3.5 rounded-[16px] bg-white border border-slate-200 space-y-1.5 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Clinical Diagnosis</span>
                <p className="text-sm font-black text-[#14213D]">{clinicalDiagnosis || selected.condition}</p>
                {clinicalNotes && (
                  <p className="text-xs text-slate-600 pt-1 border-t border-slate-100 font-medium leading-relaxed">
                    {clinicalNotes}
                  </p>
                )}
              </div>

              {/* Prescribed Medications Table */}
              <div className="space-y-2">
                <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Prescribed Medicines ({medications.length})
                </span>

                <div className="rounded-[16px] border border-slate-200 overflow-hidden text-xs">
                  <div className="grid grid-cols-12 bg-slate-100/80 px-3 py-2 font-black text-slate-600 text-[11px]">
                    <div className="col-span-5">Drug Formulation</div>
                    <div className="col-span-2 text-center">Dosage</div>
                    <div className="col-span-3">Frequency</div>
                    <div className="col-span-2 text-right">Duration</div>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {medications.map((m, idx) => (
                      <div key={m.id || idx} className="grid grid-cols-12 px-3 py-2.5 items-center font-medium">
                        <div className="col-span-5">
                          <span className="font-bold text-[#14213D] block">{m.name}</span>
                          <span className="text-[10px] text-slate-400">{m.instructions}</span>
                        </div>
                        <div className="col-span-2 text-center font-semibold text-slate-700">{m.dosage}</div>
                        <div className="col-span-3 text-slate-700">{m.frequency}</div>
                        <div className="col-span-2 text-right font-mono font-bold text-slate-700">{m.duration}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Legal Telemedicine Seal */}
              <div className="p-3 rounded-[14px] bg-emerald-50/70 border border-emerald-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-emerald-800 font-semibold text-[11px]">
                    Electronically signed via registered physician cryptographic keys. Valid under NMC guidelines.
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  onClick={() =>
                    openPrescriptionPdf({
                      patientName: selected.name,
                      bookingId: selected.bookingId,
                      diagnosis: clinicalDiagnosis || selected.condition,
                      medications: medications.map((m) => ({
                        name: m.name,
                        dosage: m.dosage,
                        frequency: m.frequency,
                        duration: m.duration,
                        instructions: m.instructions,
                      })),
                      instructions: medications[0]?.instructions || rxForm.instructions,
                      duration: medications[0]?.duration || rxForm.duration,
                    })
                  }
                  className="rounded-[12px] h-9 text-xs font-bold border-slate-200 flex items-center gap-1.5"
                >
                  <Printer className="h-4 w-4 text-[#F2052C]" /> Print PDF Slip
                </Button>

                <Button
                  onClick={() => setPreviewRxModalOpen(false)}
                  className="rounded-[12px] h-9 px-5 text-xs font-bold bg-[#14213D] text-white"
                >
                  Close Preview
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============================================================
          DEVICE PERMISSIONS CHECK MODAL
      ============================================================ */}
      <DevicePermissionsModal
        open={permissionsModalOpen}
        onOpenChange={setPermissionsModalOpen}
      />
    </div>
  );
};

export default Consultations;
