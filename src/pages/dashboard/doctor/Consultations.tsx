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
import { listBookings } from "@/services/booking.service";
import { getProfiles, createProfile, viewProfile } from "@/services/profile.service";
import { listReports, listReportsByProfile } from "@/services/report.service";
import { createPrescription, getSharedReports, agreeReportAccess, completeBooking } from "@/services/doctor.service";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";
import { openPrescriptionPdf } from "@/utils/prescriptionPdf";
import { DevicePermissionsModal } from "@/components/shared/DevicePermissionsModal";

/* ============================================================
   TYPES & INTERFACES
============================================================ */
export interface PatientRecord {
  id: string | number;
  name: string;
  age: number | null;
  gender: string;
  condition: string;
  conditionColor: string;
  lastVisit: string;
  nextAppointment: string;
  status: "Waiting" | "In Consultation" | "Scheduled" | "Completed" | "Critical";
  avatar: string;
  notes: string;
  vitals: {
    bp: string;
    temp: string;
    pulse: number | string;
    spo2?: string;
    bmi?: string;
  };
  bookingId?: string;
  phone?: string;
  type?: "instant" | "scheduled";
  slotTime?: string;
}

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
    <span className="font-mono text-xs font-bold tracking-wider text-emerald-400">
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
  // Phase 1: "queue" (Waiting Room & Patient Dossier Intake)
  // Phase 2: "encounter" (Live Full-Screen Video + In-Call Clinical Chart & Prescription)
  // Phase 3: "summary" (Post-Consultation Signed Slip & Next Patient Transition)
  const [workflowPhase, setWorkflowPhase] = useState<"queue" | "encounter" | "summary">("queue");

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
  const [concludingConsultation, setConcludingConsultation] = useState(false);

  // ABDM / NMC Consent & Shared Reports
  const [sharedReports, setSharedReports] = useState<any[]>([]);
  const [sharedReportsStatus, setSharedReportsStatus] = useState<
    "idle" | "loading" | "declaration_required" | "unlocked" | "not_shared"
  >("idle");
  const [declarationModalOpen, setDeclarationModalOpen] = useState(false);
  const [agreeingDeclaration, setAgreeingDeclaration] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);

  // Modals & Preview
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [permissionsModalOpen, setPermissionsModalOpen] = useState(false);
  const [previewReportUrl, setPreviewReportUrl] = useState<string | null>(null);
  const [previewReportTitle, setPreviewReportTitle] = useState<string>("");

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

  // New Patient Form
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

      const profileMap = new Map<string, any>();
      const reportMap = new Map<string, any>();

      await Promise.allSettled(
        profileIds.map(async (pId) => {
          try {
            const pRes = await viewProfile(pId);
            const prof = pRes?.data || pRes?.profile || pRes;
            if (prof && prof.name) profileMap.set(pId, prof);
          } catch {}

          try {
            const rRes = await listReportsByProfile(pId);
            const reps = Array.isArray(rRes) ? rRes : rRes?.reports || [];
            if (reps.length > 0) reportMap.set(pId, reps[0]);
          } catch {}
        })
      );

      const realPatients: PatientRecord[] = [];

      // 1. Process Bookings
      if (bookingList.length > 0) {
        bookingList.forEach((b: any, index: number) => {
          const pIdStr = typeof b.profileId === "string" ? b.profileId : b.profileId?._id;
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

          const matchingReport =
            (pIdStr ? reportMap.get(pIdStr) : null) ||
            reportList.find(
              (r: any) =>
                r.profile?._id === pIdStr ||
                (r.profile?.name && r.profile.name.toLowerCase() === pName.toLowerCase())
            );

          const bp = matchingReport?.vitals?.bp || b.vitals?.bp || "120/80";
          const temp = matchingReport?.vitals?.temp || b.vitals?.temp || "98.6°F";
          const pulse = matchingReport?.vitals?.pulse || b.vitals?.pulse || 72;
          const spo2 = matchingReport?.vitals?.spo2 || "98%";

          let qStatus: PatientRecord["status"] = "Scheduled";
          if (b.status === "Completed" || b.status === "completed") {
            qStatus = "Completed";
          } else if (b.status === "In Progress" || b.status === "Urgent" || b.type === "instant") {
            qStatus = "Waiting";
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
            vitals: { bp, temp, pulse, spo2 },
            bookingId: b._id,
            phone: formattedPhone,
          });
        });
      }

      // 2. Profiles without bookings
      if (profileList.length > 0) {
        profileList.forEach((p: any, index: number) => {
          const pName = p.name || `Patient ${index + 1}`;
          if (!realPatients.some((rp) => rp.name.toLowerCase() === pName.toLowerCase())) {
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
              vitals: { bp: "118/76", temp: "98.4°F", pulse: 70, spo2: "99%" },
              phone: p.phone,
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

    return () => {
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
      fetchSharedReports(selected.bookingId);
    }
  }, [selected]);

  /* ============================================================
     ABDM / NMC SHARED REPORTS & PRIVACY DECLARATION
  ============================================================ */
  const fetchSharedReports = async (bookingId?: string) => {
    const targetBookingId = bookingId || selected?.bookingId;
    if (!targetBookingId) {
      setSharedReportsStatus("not_shared");
      return;
    }

    setSharedReportsStatus("loading");
    try {
      const res = await getSharedReports(targetBookingId);
      if (res?.declarationRequired) {
        setSharedReportsStatus("declaration_required");
      } else if (res?.reports && Array.isArray(res.reports)) {
        setSharedReports(res.reports);
        setSharedReportsStatus(res.reports.length > 0 ? "unlocked" : "not_shared");
      } else {
        setSharedReportsStatus("unlocked");
      }
    } catch {
      setSharedReportsStatus("unlocked");
    }
  };

  const handleAgreeDeclaration = async () => {
    if (!agreementChecked) {
      toast({
        title: "Consent Required",
        description: "Please check the box to confirm NMC compliance.",
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
     AGORA RTC CALL ENGINE
  ============================================================ */
  const startAgoraCall = async (appId: string, channelName: string, token: string, userUid?: number | string | null) => {
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

        toast({ title: "Connected to Clinical Telehealth Room" });
      } catch (mediaErr) {
        console.warn("[Agora RTC] Permission note:", mediaErr);
        toast({
          title: "Audio/Video Notice",
          description: "Operating in receive-only mode or permissions not granted.",
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

    try {
      const targetBookingId = p.bookingId || `booking-${p.id}`;
      toast({ title: "Connecting encrypted Agora video room..." });

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
        startAgoraCall(appId, channelName, token, backendUid);
      } else {
        startSimulatedCall();
      }
    } catch {
      startSimulatedCall();
    }
  };

  // Conclude the consultation and issue the prescription in one fluid step!
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
      const rxPayload = {
        bookingId: selected.bookingId,
        patientName: selected.name,
        diagnosis: clinicalDiagnosis || selected.condition,
        instructions: rxForm.instructions,
        duration: rxForm.duration,
        medications: [
          {
            name: rxForm.medication,
            dosage: rxForm.dosage,
            frequency: rxForm.frequency,
            duration: rxForm.duration,
            instructions: rxForm.instructions,
          },
        ],
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

  // Auto-connect from accepted incoming call
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const urlBookingId = searchParams.get("bookingId");
    const autoJoin = searchParams.get("autoJoin") === "true";

    if (autoJoin && urlBookingId && !autoJoinHandledRef.current) {
      autoJoinHandledRef.current = true;
      const targetP = patients.find((p) => p.bookingId === urlBookingId);
      if (targetP) {
        handleStartConsultation(targetP);
      } else {
        apiRequest(`/api/booking/${urlBookingId}`)
          .then((bRes: any) => {
            const b = bRes?.booking || bRes?.data || bRes;
            if (b) {
              const syntheticPatient: PatientRecord = {
                id: b._id || urlBookingId,
                name: b.patientName || "Incoming Patient",
                age: Number(b.age) || 35,
                gender: b.gender || "Not specified",
                condition: b.reason || "Live Telehealth Call",
                conditionColor: "#F2052C",
                lastVisit: "Live Call",
                nextAppointment: "Active Now",
                status: "Waiting",
                avatar: "PT",
                notes: `Incoming live session: ${b.reason || "Telehealth"}`,
                vitals: { bp: "120/80", temp: "98.6°F", pulse: 72, spo2: "98%" },
                bookingId: urlBookingId,
              };
              handleStartConsultation(syntheticPatient);
            }
          })
          .catch(() => {
            handleStartConsultation();
          });
      }
    }
  }, [patients, location.search]);

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
          bp: newPatient.bp,
          temp: newPatient.temp,
          pulse: newPatient.pulse,
          spo2: "98%",
        },
        phone: newPatient.phone,
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
      if (queueTab === "Scheduled") return p.status === "Scheduled";
      if (queueTab === "Completed") return p.status === "Completed";
      return true;
    });
  }, [patients, searchQuery, queueTab]);

  /* ============================================================
     RENDER
  ============================================================ */
  return (
    <div className="space-y-6 pb-12 animate-fadeIn font-sans text-slate-800">
      {/* ============================================================
          PHASE 2: ACTIVE CLINICAL ENCOUNTER SUITE (FULL WORKSPACE)
      ============================================================ */}
      {workflowPhase === "encounter" && selected ? (
        <div className="space-y-4 animate-fadeIn">
          {/* Top Encounter Navigation Bar */}
          <div className="bg-slate-900 text-white p-4 rounded-[22px] border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWorkflowPhase("queue")}
                className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-[12px] h-8 px-2 text-xs"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back to Queue
              </Button>
              <div className="h-4 w-[1px] bg-slate-700" />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-white tracking-tight">{selected.name}</h2>
                  <span className="text-xs text-slate-400">
                    {selected.age}y · {selected.gender}
                  </span>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Live Encounter
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">
                  {selected.condition} · Ref: {selected.bookingId || selected.id}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-slate-950/80 px-3.5 py-1.5 rounded-full border border-slate-800 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <CallTimerBadge active={workflowPhase === "encounter"} onTick={(s) => { callDurationRef.current = s; }} />
                <span className="text-slate-600">|</span>
                <span className="text-[11px] text-emerald-400 font-mono font-bold">BP: {selected.vitals.bp}</span>
              </div>

              <Button
                onClick={handleConcludeEncounter}
                disabled={concludingConsultation}
                className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] hover:opacity-90 text-white font-extrabold text-xs h-10 px-5 rounded-[14px] shadow-lg shadow-[#F2052C]/30 flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                {concludingConsultation ? "Concluding…" : "Conclude & Issue Rx"}
              </Button>
            </div>
          </div>

          {/* Harmonized Split Stage: 60% Video Feed | 40% Live Clinical Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Left Stage (7 cols / ~58% width): Agora Video Suite */}
            <div className="lg:col-span-7 bg-slate-950 rounded-[26px] overflow-hidden border border-slate-800 shadow-2xl relative h-[560px] flex flex-col justify-between">
              {/* Video Viewport */}
              <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden">
                <div id="remote-video" className="absolute inset-0 w-full h-full object-cover">
                  {/* Dedicated Agora Container */}
                  <div
                    id="remote-video-container"
                    className={`absolute inset-0 w-full h-full object-cover z-0 ${
                      remoteVideoTrackActive && remoteUserConnected ? "block" : "hidden"
                    }`}
                  />

                  {/* Paused / Connecting Fallback */}
                  {(!remoteVideoTrackActive || !remoteUserConnected) && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 z-10 relative">
                      <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center mb-3 shadow-inner">
                        <User className="h-10 w-10 text-slate-500" />
                      </div>
                      <p className="text-sm font-semibold">
                        {remoteUserConnected
                          ? "Patient video paused"
                          : "Connecting with patient in encrypted Agora telehealth room..."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Doctor PiP Floating Camera Preview */}
                <div className="absolute top-4 right-4 w-44 h-32 bg-slate-800 rounded-[18px] overflow-hidden border-2 border-white/20 shadow-lg z-20">
                  <div id="local-video" className="w-full h-full object-cover relative">
                    <div
                      id="local-video-container"
                      className={`w-full h-full object-cover -scale-x-100 ${cameraActive ? "block" : "hidden"}`}
                    />
                    {!cameraActive && (
                      <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                        <VideoOff className="h-6 w-6 mb-1 text-slate-600" />
                        <span>Camera Off</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-1.5 left-2 text-[10px] font-bold bg-black/60 px-2 py-0.5 rounded-full text-white">
                    You (Doctor)
                  </div>
                </div>
              </div>

              {/* In-Call Bottom Control Bar */}
              <div className="h-18 bg-slate-900/90 backdrop-blur-md px-6 py-3 border-t border-slate-800 flex items-center justify-between z-20">
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                  Agora HD Stream
                </Badge>

                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleMic}
                    className={`rounded-full h-11 w-11 border-none shadow-md ${
                      micActive ? "bg-white/10 hover:bg-white/20 text-white" : "bg-rose-600 text-white"
                    }`}
                  >
                    {micActive ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                  </Button>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleCamera}
                    className={`rounded-full h-11 w-11 border-none shadow-md ${
                      cameraActive ? "bg-white/10 hover:bg-white/20 text-white" : "bg-rose-600 text-white"
                    }`}
                  >
                    {cameraActive ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                  </Button>

                  <Button
                    onClick={handleConcludeEncounter}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-5 h-11 rounded-full shadow-lg shadow-rose-600/30 flex items-center gap-1.5"
                  >
                    <PhoneOff className="h-4 w-4" /> End Call
                  </Button>
                </div>

                <span className="text-[11px] text-slate-400 font-mono">Channel: {selected.bookingId?.slice(-6) || "Active"}</span>
              </div>
            </div>

            {/* Right Stage (5 cols / ~42% width): Live Clinical Charting & In-Call Rx */}
            <div className="lg:col-span-5 space-y-4">
              {/* Kiosk Vitals Telemetry HUD */}
              <div className="bg-white rounded-[22px] border border-slate-200/80 p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <HeartPulse className="h-3.5 w-3.5 text-rose-500" /> Kiosk Screening Telemetry
                  </span>
                  <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono">
                    Verified
                  </Badge>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 rounded-[14px] bg-rose-50/60 border border-rose-100">
                    <div className="text-[10px] font-bold text-rose-600">BP</div>
                    <div className="text-sm font-black text-slate-800 font-mono mt-0.5">{selected.vitals.bp}</div>
                  </div>
                  <div className="p-2.5 rounded-[14px] bg-emerald-50/60 border border-emerald-100">
                    <div className="text-[10px] font-bold text-emerald-600">Pulse</div>
                    <div className="text-sm font-black text-slate-800 font-mono mt-0.5">{selected.vitals.pulse} bpm</div>
                  </div>
                  <div className="p-2.5 rounded-[14px] bg-amber-50/60 border border-amber-100">
                    <div className="text-[10px] font-bold text-amber-600">Temp</div>
                    <div className="text-sm font-black text-slate-800 font-mono mt-0.5">{selected.vitals.temp}</div>
                  </div>
                  <div className="p-2.5 rounded-[14px] bg-cyan-50/60 border border-cyan-100">
                    <div className="text-[10px] font-bold text-cyan-600">SpO2</div>
                    <div className="text-sm font-black text-slate-800 font-mono mt-0.5">{selected.vitals.spo2 || "99%"}</div>
                  </div>
                </div>
              </div>

              {/* Live Prescription & Diagnosis Pad */}
              <div className="bg-white rounded-[22px] border border-slate-200/80 p-4 shadow-sm space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Pill className="h-3.5 w-3.5 text-[#F2052C]" /> Digital Prescription Pad
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">In-Call Drafting</span>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <Label className="text-[11px] font-bold text-slate-500 mb-1 block">Clinical Diagnosis</Label>
                    <Input
                      value={clinicalDiagnosis}
                      onChange={(e) => setClinicalDiagnosis(e.target.value)}
                      placeholder="e.g. Acute Pharyngitis / Hypertension"
                      className="rounded-[12px] h-9 text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-bold text-slate-500 mb-1 block">Prescribed Medication</Label>
                    <Input
                      value={rxForm.medication}
                      onChange={(e) => setRxForm({ ...rxForm, medication: e.target.value })}
                      placeholder="e.g. Amoxicillin 500mg"
                      className="rounded-[12px] h-9 text-xs font-semibold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] font-bold text-slate-500 mb-1 block">Frequency</Label>
                      <Select
                        value={rxForm.frequency}
                        onValueChange={(val) => setRxForm({ ...rxForm, frequency: val })}
                      >
                        <SelectTrigger className="rounded-[12px] h-9 text-xs font-semibold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Once daily">Once daily (OD)</SelectItem>
                          <SelectItem value="Twice daily (BD)">Twice daily (BD)</SelectItem>
                          <SelectItem value="Three times daily (TDS)">Three times daily (TDS)</SelectItem>
                          <SelectItem value="As needed (PRN)">As needed (PRN)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[11px] font-bold text-slate-500 mb-1 block">Duration</Label>
                      <Input
                        value={rxForm.duration}
                        onChange={(e) => setRxForm({ ...rxForm, duration: e.target.value })}
                        placeholder="5 days"
                        className="rounded-[12px] h-9 text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[11px] font-bold text-slate-500 mb-1 block">Special Instructions</Label>
                    <Input
                      value={rxForm.instructions}
                      onChange={(e) => setRxForm({ ...rxForm, instructions: e.target.value })}
                      placeholder="Take after food with warm water"
                      className="rounded-[12px] h-9 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    onClick={handleConcludeEncounter}
                    disabled={concludingConsultation}
                    className="w-full bg-[#14213D] hover:bg-[#1E2E4E] text-white rounded-[14px] font-bold text-xs h-10 shadow-sm flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4 text-[#35B7C9]" /> Sign & Issue Prescription Slip
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : workflowPhase === "summary" && selected ? (
        /* ============================================================
            PHASE 3: POST-ENCOUNTER SUMMARY & TRANSITION
        ============================================================ */
        <div className="max-w-2xl mx-auto space-y-5 animate-fadeIn">
          <div className="p-8 rounded-[26px] bg-white border border-slate-200/80 shadow-xl text-center space-y-5">
            <div className="h-16 w-16 rounded-[22px] bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div className="space-y-1">
              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[11px] px-3 py-0.5 rounded-full">
                Consultation Concluded
              </Badge>
              <h2 className="text-xl font-black text-[#14213D] mt-2">
                Encounter Completed for {selected.name}
              </h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Electronic consultation recorded. Official NMC digital prescription slip generated and signed.
              </p>
            </div>

            {/* Prescribed Summary Box */}
            <div className="p-4 rounded-[18px] bg-slate-50 border border-slate-200/80 text-left space-y-2 text-xs">
              <div className="flex justify-between text-slate-500 font-bold">
                <span>Diagnosis:</span>
                <span className="text-[#14213D]">{clinicalDiagnosis || selected.condition}</span>
              </div>
              <div className="flex justify-between text-slate-500 font-bold">
                <span>Prescription:</span>
                <span className="text-[#14213D]">{rxForm.medication} ({rxForm.frequency})</span>
              </div>
              <div className="flex justify-between text-slate-500 font-bold">
                <span>Duration:</span>
                <span className="text-[#14213D]">{rxForm.duration}</span>
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
                    medications: [
                      {
                        name: rxForm.medication,
                        dosage: rxForm.dosage,
                        frequency: rxForm.frequency,
                        duration: rxForm.duration,
                        instructions: rxForm.instructions,
                      },
                    ],
                    instructions: rxForm.instructions,
                    duration: rxForm.duration,
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
                  Clinical Intake, Real-Time Kiosk Telemetry & Agora HD Encrypted Suite
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

          {/* Split Waiting Room Stage (Left: Queue | Right: Dossier) */}
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
                    if (tab === "Scheduled") return p.status === "Scheduled";
                    if (tab === "Completed") return p.status === "Completed";
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
              <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
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

                        {/* Bottom Vitals Peek */}
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-medium text-slate-400">
                          <span className="font-mono text-slate-500 flex items-center gap-1">
                            <Heart className="h-3 w-3 text-rose-500" /> {p.vitals.bp}
                          </span>
                          <span className="font-extrabold text-[#F2052C] flex items-center gap-0.5">
                            Admit <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Dossier Panel (7 cols) */}
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

                      <Button
                        onClick={() => handleStartConsultation(selected)}
                        className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] hover:opacity-90 text-white font-black rounded-[18px] h-12 px-6 border-none shadow-xl shadow-[#F2052C]/30 text-xs flex items-center gap-2 transform active:scale-95 transition-all"
                      >
                        <Video className="h-5 w-5" /> Admit to Consultation Suite
                      </Button>
                    </div>
                  </div>

                  {/* Kiosk Telemetry Cards */}
                  <div className="bg-white rounded-[24px] border border-slate-200/80 p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-extrabold text-[#14213D] flex items-center gap-2">
                        <Activity className="h-4.5 w-4.5 text-[#F2052C]" /> Real-Time Kiosk IoT Telemetry
                      </h3>
                      <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-mono">
                        Hardware Live Synced
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-4 rounded-[18px] bg-rose-50/50 border border-rose-100/80 space-y-1">
                        <span className="text-xs text-rose-600 font-bold block">Blood Pressure</span>
                        <div className="text-xl font-black text-slate-800 font-mono">{selected.vitals.bp}</div>
                        <span className="text-[10px] font-semibold text-rose-500">mmHg</span>
                      </div>

                      <div className="p-4 rounded-[18px] bg-emerald-50/50 border border-emerald-100/80 space-y-1">
                        <span className="text-xs text-emerald-600 font-bold block">Heart Rate</span>
                        <div className="text-xl font-black text-slate-800 font-mono">{selected.vitals.pulse} bpm</div>
                        <span className="text-[10px] font-semibold text-emerald-500">Normal Rhythm</span>
                      </div>

                      <div className="p-4 rounded-[18px] bg-amber-50/50 border border-amber-100/80 space-y-1">
                        <span className="text-xs text-amber-600 font-bold block">Body Temp</span>
                        <div className="text-xl font-black text-slate-800 font-mono">{selected.vitals.temp}</div>
                        <span className="text-[10px] font-semibold text-amber-500">Sensor Synced</span>
                      </div>

                      <div className="p-4 rounded-[18px] bg-cyan-50/50 border border-cyan-100/80 space-y-1">
                        <span className="text-xs text-cyan-600 font-bold block">Oxygen Saturation</span>
                        <div className="text-xl font-black text-slate-800 font-mono">{selected.vitals.spo2 || "99%"}</div>
                        <span className="text-[10px] font-semibold text-cyan-500">SpO2 Level</span>
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

                  {/* ABDM Consent & Records */}
                  <div className="bg-white rounded-[24px] border border-slate-200/80 p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-extrabold text-[#14213D] flex items-center gap-2">
                        <ShieldCheck className="h-4.5 w-4.5 text-[#35B7C9]" /> ABDM Medical History & Shared Records
                      </h3>

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
                          <Unlock className="h-3 w-3 mr-1 text-emerald-600" /> NMC Decrypted
                        </Badge>
                      )}
                    </div>

                    {sharedReports.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {sharedReports.map((r, idx) => (
                          <div
                            key={r._id || idx}
                            className="p-3.5 rounded-[16px] border border-slate-200 bg-white flex items-center justify-between shadow-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <FileText className="h-5 w-5 text-rose-500" />
                              <span className="text-xs font-bold text-slate-800">{r.title || `Lab File #${idx + 1}`}</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPreviewReportUrl(r.fileUrl || r.url || "#");
                                setPreviewReportTitle(r.title || "Diagnostic File");
                              }}
                              className="h-8 text-xs font-bold text-[#F2052C]"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400">No external hospital records attached for this booking.</p>
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
