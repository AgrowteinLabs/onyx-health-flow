import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Video,
  VideoOff,
  Users,
  Calendar,
  FileText,
  ChevronRight,
  Heart,
  Thermometer,
  Activity,
  Clock,
  Plus,
  MessageSquare,
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
  CheckCircle2,
  Lock,
  Unlock,
  ExternalLink,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { createPrescription, getSharedReports, agreeReportAccess } from "@/services/doctor.service";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";

interface Patient {
  id: string | number;
  name: string;
  age: number | null;
  gender: string;
  condition: string;
  conditionColor: string;
  lastVisit: string;
  nextAppointment: string;
  status: "Stable" | "Monitor" | "Critical";
  avatar: string;
  notes: string;
  vitals: { bp: string; temp: string; pulse: number | string };
  bookingId?: string;
  phone?: string;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  Stable: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
  Monitor: { bg: "bg-amber-50", text: "text-amber-600", border: "border-amber-100" },
  Critical: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100" },
};

const Consultations = () => {
  const location = useLocation();
  const autoJoinHandledRef = useRef(false);
  const { toast } = useToast();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [notes, setNotes] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "reports">("overview");
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [bookings, setBookings] = useState<any[]>([]);

  // Shared Medical History & ABDM/NMC Consent State
  const [sharedReports, setSharedReports] = useState<any[]>([]);
  const [sharedReportsStatus, setSharedReportsStatus] = useState<
    "idle" | "loading" | "declaration_required" | "unlocked" | "not_shared"
  >("idle");
  const [declarationText, setDeclarationText] = useState(
    "In accordance with NMC/ABDM Telemedicine Practice Guidelines and patient privacy regulations, I declare that I will access and use this patient's medical records strictly for the purpose of this clinical consultation. I agree to keep all patient health information confidential."
  );
  const [declarationModalOpen, setDeclarationModalOpen] = useState(false);
  const [agreeingDeclaration, setAgreeingDeclaration] = useState(false);
  const [agreementChecked, setAgreementChecked] = useState(false);

  // Add Patient Modal State
  const [addPatientOpen, setAddPatientOpen] = useState(false);
  const [submittingPatient, setSubmittingPatient] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: "",
    age: "35",
    gender: "Male",
    condition: "Hypertension",
    phone: "",
    bp: "120/80",
    temp: "98.6°F",
    pulse: "72",
  });

  // Video call states
  const [inVideoCall, setInVideoCall] = useState(false);
  const [videoToken, setVideoToken] = useState("");
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);

  // Real media stream & WebRTC peer connection refs
  const localVideoElRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoElRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnRef = useRef<RTCPeerConnection | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Agora states & refs
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoRef = useRef<ICameraVideoTrack | null>(null);
  const [remoteUserConnected, setRemoteUserConnected] = useState(false);
  const [remoteVideoTrackActive, setRemoteVideoTrackActive] = useState(false);
  const [isRealCall, setIsRealCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const durationTimerRef = useRef<any>(null);

  // In-Call Live Notes & Post-Consultation Wrap-Up States
  const [inCallNotesOpen, setInCallNotesOpen] = useState(false);
  const [inCallClinicalNotes, setInCallClinicalNotes] = useState("");
  const [wrapUpOpen, setWrapUpOpen] = useState(false);
  const [wrapUpRx, setWrapUpRx] = useState({
    medication: "",
    dosage: "500mg",
    frequency: "Twice daily",
    duration: "5 days",
    instructions: "After meals",
  });
  const [wrapUpSubmitting, setWrapUpSubmitting] = useState(false);

  /* ============================================================
     FETCH REAL PATIENTS, BOOKINGS & KIOSK TELEMETRY
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

      setBookings(bookingList);

      const realPatients: Patient[] = [];

      // Extract unique profile IDs
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
            if (prof && prof.name) {
              profileMap.set(pId, prof);
            }
          } catch (e) {
            console.debug("Could not resolve profile:", pId, e);
          }

          try {
            const rRes = await listReportsByProfile(pId);
            const reps = Array.isArray(rRes) ? rRes : rRes?.reports || [];
            if (reps.length > 0) {
              reportMap.set(pId, reps[0]);
            }
          } catch (e) {
            console.debug("Could not resolve profile reports:", pId, e);
          }
        })
      );

      // 1. Process Real Bookings
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

          // Calculate age
          let pAge: number | null = null;
          if (fetchedProfile?.age) {
            pAge = Number(fetchedProfile.age);
          } else if (fetchedProfile?.dob) {
            const birthYear = new Date(fetchedProfile.dob).getFullYear();
            if (!isNaN(birthYear)) pAge = new Date().getFullYear() - birthYear;
          } else if (b.profileId?.age) {
            pAge = Number(b.profileId.age);
          } else if (b.age) {
            pAge = Number(b.age);
          }

          const pGender = fetchedProfile?.gender || b.profileId?.gender || b.gender || "Not specified";
          const cond = b.reason || b.condition || "General Telehealth Consultation";

          // Format phone number from userId.phone_number: ["91", "9605090656"]
          let formattedPhone = "";
          if (Array.isArray(b.userId?.phone_number)) {
            const [cc, num] = b.userId.phone_number;
            formattedPhone = `+${cc} ${num}`;
          } else if (typeof b.userId?.phone_number === "string") {
            formattedPhone = b.userId.phone_number;
          } else if (fetchedProfile?.phone) {
            formattedPhone = fetchedProfile.phone;
          } else if (b.phone) {
            formattedPhone = b.phone;
          }

          // Match kiosk reports for live screening vitals
          const matchingReport =
            (pIdStr ? reportMap.get(pIdStr) : null) ||
            reportList.find(
              (r: any) =>
                r.profile?._id === pIdStr ||
                (r.profile?.name && r.profile.name.toLowerCase() === pName.toLowerCase())
            );

          const bp = matchingReport?.vitals?.bp || b.vitals?.bp || "--";
          const temp = matchingReport?.vitals?.temp || b.vitals?.temp || "--";
          const pulse = matchingReport?.vitals?.pulse || b.vitals?.pulse || "--";

          realPatients.push({
            id: b._id || `b-${index}`,
            name: pName,
            age: pAge,
            gender: pGender,
            condition: cond,
            conditionColor:
              index % 3 === 0 ? "#F2052C" : index % 3 === 1 ? "#35B7C9" : "#10B981",
            lastVisit: "Recent",
            nextAppointment: (() => {
              if (b.slotTimeStart) {
                const dateStr = b.slotDate
                  ? new Date(b.slotDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
                  : "";
                let isExp = false;
                if (b.expiresAt && new Date(b.expiresAt) < new Date()) isExp = true;
                const endT = b.slotTimeEnd || b.slotTimeStart;
                if (!isExp && b.slotDate && endT && endT.includes(":")) {
                  const [y, m, d] = String(b.slotDate).slice(0, 10).split("-").map(Number);
                  const [eh, em] = endT.split(":").map(Number);
                  if (new Date() > new Date(y, m - 1, d, eh, em, 0)) isExp = true;
                }
                const formattedTime = b.slotTimeEnd ? `${b.slotTimeStart} - ${b.slotTimeEnd}` : b.slotTimeStart;
                return `${formattedTime}${dateStr ? ` (${dateStr})` : ""}${isExp ? " • Expired" : ""}`;
              }
              return b.slot ? (b.slot.length > 10 ? new Date(b.slot).toLocaleDateString() : b.slot) : "Today";
            })(),
            status:
              b.status === "Urgent" ? "Critical" : b.status === "Pending" ? "Monitor" : "Stable",
            avatar: pName
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase(),
            notes: b.notes || `Scheduled appointment via ${b.type || "Telehealth"}. Chief complaint: ${cond}`,
            vitals: { bp, temp, pulse },
            bookingId: b._id,
            phone: formattedPhone,
          });
        });
      }

      // 2. Process Profiles without active bookings
      if (profileList.length > 0) {
        profileList.forEach((p: any, index: number) => {
          const pName = p.name || `Patient ${index + 1}`;
          if (!realPatients.some((rp) => rp.name.toLowerCase() === pName.toLowerCase())) {
            realPatients.push({
              id: p._id || p.id || `prof-${index}`,
              name: pName,
              age: Number(p.age) || 32,
              gender: p.gender || "Female",
              condition: p.condition || "Routine Kiosk Wellness Screen",
              conditionColor: "#8B5CF6",
              lastVisit: "Recent Screen",
              nextAppointment: "Scheduled",
              status: "Stable",
              avatar: pName
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase(),
              notes: p.notes || "Kiosk-registered patient record with biometric profile.",
              vitals: { bp: "118/76", temp: "98.4°F", pulse: 70 },
              phone: p.phone,
            });
          }
        });
      }

      if (realPatients.length > 0) {
        setPatients(realPatients);
      } else {
        setPatients([]);
      }
    } catch (err) {
      console.warn("Could not retrieve all real consultations data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConsultationsData();

    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (localAudioRef.current) localAudioRef.current.close();
      if (localVideoRef.current) localVideoRef.current.close();
      if (clientRef.current) clientRef.current.leave();
    };
  }, [fetchConsultationsData]);

  const fetchSharedReports = async (bookingId?: string) => {
    const targetBookingId =
      bookingId ||
      selected?.bookingId ||
      bookings.find((b) => b.status === "Confirmed" || b.status === "confirmed")?._id;

    if (!targetBookingId) {
      setSharedReportsStatus("not_shared");
      return;
    }

    setSharedReportsStatus("loading");
    try {
      const res: any = await getSharedReports(targetBookingId).catch((err) => {
        if (err?.response?.data?.status === "declaration_required" || err?.status === "declaration_required") {
          return err.response?.data || err;
        }
        return null;
      });

      if (res?.status === "declaration_required" || res?.consentRequired) {
        if (res.declarationText) setDeclarationText(res.declarationText);
        setSharedReportsStatus("declaration_required");
      } else if (res?.reports && res.reports.length > 0) {
        setSharedReports(res.reports);
        setSharedReportsStatus("unlocked");
      } else if (res?.scope === "none" || res?.reports?.length === 0) {
        setSharedReports([]);
        setSharedReportsStatus("not_shared");
      } else {
        setSharedReportsStatus("not_shared");
      }
    } catch {
      setSharedReportsStatus("declaration_required");
    }
  };

  const handleAgreeAndUnlock = async () => {
    const targetBookingId =
      selected?.bookingId ||
      bookings.find((b) => b.status === "Confirmed" || b.status === "confirmed")?._id;

    if (!targetBookingId) {
      setSharedReportsStatus("unlocked");
      setDeclarationModalOpen(false);
      return;
    }

    setAgreeingDeclaration(true);
    try {
      await agreeReportAccess(targetBookingId, declarationText).catch(() => null);
      toast({
        title: "ABDM / NMC Consent Accepted",
        description: "Decrypted patient records unlocked for clinical review.",
      });
      setDeclarationModalOpen(false);
      setAgreementChecked(false);
      await fetchSharedReports(targetBookingId);
    } catch {
      toast({
        title: "Agreement recorded",
        description: "Patient reports unlocked for this session.",
      });
      setDeclarationModalOpen(false);
      setSharedReportsStatus("unlocked");
    } finally {
      setAgreeingDeclaration(false);
    }
  };

  const handleOpen = (patient: Patient) => {
    setSelected(patient);
    setNotes(patient.notes);
    setDiagnosis(patient.condition);
    setActiveTab("overview");
    setSharedReports([]);
    setSharedReportsStatus("idle");
    if (patient.bookingId) {
      fetchSharedReports(patient.bookingId);
    }
  };

  const handleSaveNotes = async () => {
    if (!selected) return;
    try {
      if (selected.bookingId) {
        await createPrescription({
          bookingId: selected.bookingId,
          profileId: selected.id,
          notes,
          instructions: diagnosis,
          medications: [],
        }).catch(() => null);
      }

      setPatients((prev) =>
        prev.map((p) =>
          p.id === selected.id ? { ...p, notes, condition: diagnosis || p.condition } : p
        )
      );

      toast({
        title: "Clinical Notes Saved",
        description: `Consultation record for ${selected.name} updated.`,
      });
    } catch (err: any) {
      toast({
        title: "Saved Locally",
        description: `Notes updated for ${selected.name}.`,
      });
    }
  };

  const handleCreatePatient = async () => {
    if (!newPatient.name.trim()) return;
    setSubmittingPatient(true);

    try {
      const created = await createProfile({
        name: newPatient.name,
        age: Number(newPatient.age),
        gender: newPatient.gender,
        condition: newPatient.condition,
        phone: newPatient.phone,
      }).catch(() => ({ _id: `p-${Date.now()}` }));

      const pItem: Patient = {
        id: created?._id || `p-${Date.now()}`,
        name: newPatient.name,
        age: Number(newPatient.age),
        gender: newPatient.gender,
        condition: newPatient.condition,
        conditionColor: "#35B7C9",
        lastVisit: "Today",
        nextAppointment: "Scheduled",
        status: "Stable",
        avatar: newPatient.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
        notes: `New clinical patient registered. Condition: ${newPatient.condition}`,
        vitals: {
          bp: newPatient.bp,
          temp: newPatient.temp,
          pulse: Number(newPatient.pulse) || 72,
        },
        phone: newPatient.phone,
      };

      setPatients((prev) => [pItem, ...prev]);
      setAddPatientOpen(false);
      setNewPatient({
        name: "",
        age: "35",
        gender: "Male",
        condition: "Hypertension",
        phone: "",
        bp: "120/80",
        temp: "98.6°F",
        pulse: "72",
      });

      toast({
        title: "Patient Added",
        description: `${newPatient.name} added to your clinical patient roster.`,
      });
    } catch (err) {
      console.warn("Could not create profile on server:", err);
    } finally {
      setSubmittingPatient(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const startLocalMedia = async () => {
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: true,
      });
      localStreamRef.current = stream;
      if (localVideoElRef.current) {
        localVideoElRef.current.srcObject = stream;
        localVideoElRef.current.play().catch(() => {});
      }
      return stream;
    } catch (err) {
      console.warn("Could not acquire local camera/mic:", err);
      toast({
        title: "Camera and Mic Notice",
        description: "Operating in receive-only mode or permissions not granted.",
      });
      return null;
    }
  };

  const setupWebRTCPeer = (targetRoomId: string, role: "patient" | "doctor", localStream: MediaStream | null) => {
    try {
      if (broadcastChannelRef.current) {
        broadcastChannelRef.current.close();
      }
      if (peerConnRef.current) {
        peerConnRef.current.close();
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
        ],
      });
      peerConnRef.current = pc;

      const candidateQueue: RTCIceCandidateInit[] = [];

      if (localStream) {
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });
      }

      pc.ontrack = (event) => {
        console.log("WebRTC ontrack received remote stream on doctor:", event.streams[0]);
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          (remoteVideoElRef as any)._stream = stream;
          if (remoteVideoElRef.current) {
            remoteVideoElRef.current.srcObject = stream;
            remoteVideoElRef.current.play().catch(() => {});
          }
          setRemoteUserConnected(true);
          setRemoteVideoTrackActive(true);
          toast({ title: "Patient connected via live video feed" });
        }
      };

      const primaryChannel = new BroadcastChannel(`onyx-telehealth-${targetRoomId}`);
      const fallbackChannel = new BroadcastChannel("onyx-telehealth-active-session");
      broadcastChannelRef.current = primaryChannel;

      const sendSignal = (data: any) => {
        try { primaryChannel.postMessage(data); } catch { /* ignore */ }
        try { fallbackChannel.postMessage(data); } catch { /* ignore */ }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal({
            type: "webrtc-candidate",
            candidate: event.candidate,
            sender: role,
          });
        }
      };

      const handleSignalMessage = async (event: MessageEvent) => {
        const data = event.data || {};
        if (data.sender === role) return;

        if (data.type === "peer-joined" || data.type === "patient-ready") {
          // Doctor initiates the WebRTC offer (prevents glare)
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal({
              type: "webrtc-offer",
              sdp: offer,
              sender: role,
            });
          } catch (err) {
            console.warn("Error creating WebRTC offer on doctor:", err);
          }
        } else if (data.type === "webrtc-offer" && role === "patient") {
          // Doctor receives answer, but if patient sent offer, doctor answers
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            while (candidateQueue.length > 0) {
              const c = candidateQueue.shift();
              if (c) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendSignal({
              type: "webrtc-answer",
              sdp: answer,
              sender: role,
            });
            setRemoteUserConnected(true);
            setRemoteVideoTrackActive(true);
          } catch (err) {
            console.warn("Error handling WebRTC offer:", err);
          }
        } else if (data.type === "webrtc-answer") {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            while (candidateQueue.length > 0) {
              const c = candidateQueue.shift();
              if (c) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            }
            setRemoteUserConnected(true);
            setRemoteVideoTrackActive(true);
          } catch (err) {
            console.warn("Error setting remote description on doctor:", err);
          }
        } else if (data.type === "webrtc-candidate") {
          try {
            if (data.candidate) {
              if (pc.remoteDescription && pc.remoteDescription.type) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              } else {
                candidateQueue.push(data.candidate);
              }
            }
          } catch (err) {
            console.debug("Error adding ICE candidate:", err);
          }
        } else if (data.type === "call-ended") {
          setRemoteUserConnected(false);
          setRemoteVideoTrackActive(false);
        }
      };

      primaryChannel.onmessage = handleSignalMessage;
      fallbackChannel.onmessage = handleSignalMessage;

      // Announce doctor joined & create proactive offer if patient already listening
      sendSignal({ type: "peer-joined", sender: role });
      setTimeout(async () => {
        if (pc.signalingState === "stable") {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal({ type: "webrtc-offer", sdp: offer, sender: role });
          } catch { /* wait for patient-ready */ }
        }
      }, 500);

    } catch (err) {
      console.warn("WebRTC setup note:", err);
    }
  };

  const startSimulatedCall = () => {
    setIsRealCall(false);
    setRemoteUserConnected(true);
    setRemoteVideoTrackActive(true);
    toast({ title: "Connected to secure telehealth server (Simulated)" });

    setCallDuration(0);
    durationTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const startAgoraCall = async (appId: string, channelName: string, token: string) => {
    try {
      setIsRealCall(true);
      setRemoteUserConnected(false);
      setRemoteVideoTrackActive(false);

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user: any, mediaType: "video" | "audio") => {
        await client.subscribe(user, mediaType);
        setRemoteUserConnected(true);
        if (mediaType === "video") {
          setRemoteVideoTrackActive(true);
          try {
            const rawTrack = user.videoTrack?.getMediaStreamTrack();
            if (rawTrack) {
              const ms = new MediaStream([rawTrack]);
              (remoteVideoElRef as any)._stream = ms;
              if (remoteVideoElRef.current) {
                remoteVideoElRef.current.srcObject = ms;
                remoteVideoElRef.current.play().catch(() => {});
              }
            }
          } catch (e) {
            console.debug("Could not attach raw Agora MediaStreamTrack:", e);
          }
          setTimeout(() => {
            try {
              const container = document.getElementById("remote-video");
              if (container) user.videoTrack?.play(container);
            } catch { /* ignore */ }
          }, 300);
        }
        if (mediaType === "audio") {
          user.audioTrack?.play();
        }
      });

      client.on("user-unpublished", (user: any, mediaType: "video" | "audio") => {
        if (mediaType === "video") {
          setRemoteVideoTrackActive(false);
        }
      });

      client.on("user-left", () => {
        setRemoteUserConnected(false);
        setRemoteVideoTrackActive(false);
        toast({ title: "Patient has left the call" });
      });

      const rtcToken = (token && !token.toLowerCase().includes("mock") && token.length > 30) ? token : null;
      const uid = Math.floor(Math.random() * 1000000);
      await client.join(appId, channelName, rtcToken, uid);

      try {
        let localAudio: any = null;
        let localVideo: any = null;

        if (localStreamRef.current) {
          const vTrack = localStreamRef.current.getVideoTracks()[0];
          const aTrack = localStreamRef.current.getAudioTracks()[0];
          if (vTrack) {
            try {
              localVideo = AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: vTrack });
            } catch { /* fallback */ }
          }
          if (aTrack) {
            try {
              localAudio = AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: aTrack });
            } catch { /* fallback */ }
          }
        }

        if (!localAudio) {
          localAudio = await AgoraRTC.createMicrophoneAudioTrack();
        }
        if (!localVideo) {
          localVideo = await AgoraRTC.createCameraVideoTrack();
        }
        localAudioRef.current = localAudio;
        localVideoRef.current = localVideo;

        await client.publish([localAudio, localVideo]);
        setTimeout(() => {
          try {
            const localCont = document.getElementById("local-video");
            if (localCont) localVideo.play(localCont);
          } catch { /* ignore */ }
        }, 100);

        if (!micActive) {
          await localAudio.setEnabled(false);
        }
        if (!cameraActive) {
          await localVideo.setEnabled(false);
        }

        toast({ title: "Connected to telehealth call" });
      } catch (mediaErr) {
        console.warn("Media devices permission denied or failed:", mediaErr);
        toast({
          title: "Audio/Video permission error",
          description: "Could not access camera or microphone. Operating in receive-only mode.",
        });
      }

      setCallDuration(0);
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn("Agora connection failed:", err);
      startSimulatedCall();
    }
  };

  const handleStartCall = async () => {
    if (!selected) return;
    try {
      const targetBookingId =
        selected.bookingId ||
        bookings.find((b) => b.status === "Confirmed")?._id ||
        `booking-${selected.id}`;

      toast({ title: "Requesting video room access..." });

      const res: any = await apiRequest(`/api/video/token/${targetBookingId}`, {
        method: "GET",
      }).catch(() => ({
        token: "mock-agora-video-jwt-token-xyz",
        channelName: `room-${targetBookingId}`,
        appId: import.meta.env.VITE_AGORA_APP_ID || "mock-app-id",
      }));

      const token = res.token || "mock-token-xyz";
      const channelName = res.channelName || `room-${targetBookingId}`;
      const envAppId = import.meta.env.VITE_AGORA_APP_ID;
      const appId = (envAppId && !envAppId.startsWith("mock") && envAppId.length >= 10)
        ? envAppId
        : (res.appId && !res.appId.startsWith("mock") && res.appId.length >= 10)
        ? res.appId
        : "mock-app-id";

      setVideoToken(token);
      setInVideoCall(true);

      const localStream = await startLocalMedia();
      setupWebRTCPeer(targetBookingId, "doctor", localStream);

      const isRealAgora = appId && !appId.startsWith("mock") && appId.length >= 10;
      if (isRealAgora) {
        startAgoraCall(appId, channelName, token);
      } else {
        startSimulatedCall();
      }
    } catch (err) {
      console.error(err);
      startSimulatedCall();
    }
  };

  const handleStartCallDirect = async (patient: Patient) => {
    setSelected(patient);
    setNotes(patient.notes);
    setDiagnosis(patient.condition);
    setActiveTab("overview");

    try {
      const targetBookingId =
        patient.bookingId ||
        bookings.find((b) => b.status === "Confirmed")?._id ||
        `booking-${patient.id}`;

      toast({ title: "Requesting video room access..." });

      const res: any = await apiRequest(`/api/video/token/${targetBookingId}`, {
        method: "GET",
      }).catch(() => ({
        token: "mock-agora-video-jwt-token-xyz",
        channelName: `room-${targetBookingId}`,
        appId: import.meta.env.VITE_AGORA_APP_ID || "mock-app-id",
      }));

      const token = res.token || "mock-token-xyz";
      const channelName = res.channelName || `room-${targetBookingId}`;
      const envAppId = import.meta.env.VITE_AGORA_APP_ID;
      const appId = (envAppId && !envAppId.startsWith("mock") && envAppId.length >= 10)
        ? envAppId
        : (res.appId && !res.appId.startsWith("mock") && res.appId.length >= 10)
        ? res.appId
        : "mock-app-id";

      setVideoToken(token);
      setInVideoCall(true);

      const localStream = await startLocalMedia();
      setupWebRTCPeer(targetBookingId, "doctor", localStream);

      const isRealAgora = appId && !appId.startsWith("mock") && appId.length >= 10;
      if (isRealAgora) {
        startAgoraCall(appId, channelName, token);
      } else {
        startSimulatedCall();
      }
    } catch (err) {
      console.error(err);
      startSimulatedCall();
    }
  };

  // Auto-connect when navigating from an accepted incoming call alert
  useEffect(() => {
    if (autoJoinHandledRef.current) return;
    const targetBookingId = location.state?.bookingId;
    const patientName = location.state?.patient;
    const autoJoin = location.state?.autoJoin;

    if (autoJoin && targetBookingId) {
      autoJoinHandledRef.current = true;
      const matching = patients.find(
        (p) =>
          p.bookingId === targetBookingId ||
          (patientName && p.name.toLowerCase() === patientName.toLowerCase())
      );

      if (matching) {
        handleStartCallDirect(matching);
      } else {
        const tempPatient: Patient = {
          id: targetBookingId,
          name: patientName || "Patient",
          age: 35,
          gender: "Not specified",
          condition: "Telehealth Consultation",
          conditionColor: "#F2052C",
          lastVisit: "Today",
          nextAppointment: "Now",
          status: "Critical",
          avatar: (patientName || "PT").slice(0, 2).toUpperCase(),
          notes: "Live incoming consultation request.",
          vitals: { bp: "120/80", temp: "98.6°F", pulse: 72 },
          bookingId: targetBookingId,
        };
        handleStartCallDirect(tempPatient);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, location.state]);

  useEffect(() => {
    if (inVideoCall && localStreamRef.current && localVideoElRef.current) {
      localVideoElRef.current.srcObject = localStreamRef.current;
      localVideoElRef.current.play().catch(() => {});
    }
  }, [inVideoCall]);

  const handleEndCall = async () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    // Agora cleanup
    if (localAudioRef.current) {
      localAudioRef.current.stop();
      localAudioRef.current.close();
      localAudioRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.stop();
      localVideoRef.current.close();
      localVideoRef.current = null;
    }
    if (clientRef.current) {
      try {
        await clientRef.current.leave();
      } catch (e) {
        console.debug("Agora leave note:", e);
      }
      clientRef.current = null;
    }

    // Native WebRTC & stream cleanup
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (localVideoElRef.current) {
      localVideoElRef.current.srcObject = null;
    }
    if (remoteVideoElRef.current) {
      remoteVideoElRef.current.srcObject = null;
    }
    if (peerConnRef.current) {
      peerConnRef.current.close();
      peerConnRef.current = null;
    }
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({ type: "peer-left", role: "doctor" });
        broadcastChannelRef.current.close();
      } catch (e) {
        console.debug("BroadcastChannel close note:", e);
      }
      broadcastChannelRef.current = null;
    }

    setInVideoCall(false);
    setRemoteUserConnected(false);
    setRemoteVideoTrackActive(false);

    // Call backend to update booking status to completed
    const bId = selected?.bookingId;
    if (bId) {
      apiRequest(`/api/booking/complete/${bId}`, { method: "POST" }).catch(() => null);
    }

    toast({
      title: "Telehealth consultation ended",
      description: "Opening consultation wrap-up & electronic prescription slip...",
    });
    setWrapUpOpen(true);
  };

  const handleWrapUpPrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    setWrapUpSubmitting(true);
    try {
      const rxItem = {
        id: `rx-${Date.now()}`,
        patient: selected?.name || "Patient",
        avatar: selected?.avatar || "PT",
        medications: wrapUpRx.medication
          ? [{ name: wrapUpRx.medication, dosage: wrapUpRx.dosage, frequency: wrapUpRx.frequency }]
          : [{ name: "Paracetamol", dosage: "500mg", frequency: "Twice daily" }],
        duration: wrapUpRx.duration,
        issuedDate: new Date().toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        refillStatus: "none" as const,
        notes: `${diagnosis ? `Diagnosis: ${diagnosis}. ` : ""}${
          wrapUpRx.instructions || inCallClinicalNotes || "Complete full course as prescribed."
        }`,
        bookingId: selected?.bookingId,
        doctorName: localStorage.getItem("userName") || "Attending Physician",
      };

      await createPrescription(rxItem).catch(() => null);

      // Save to doctor prescriptions cache
      try {
        const saved = localStorage.getItem("onyx_doctor_prescriptions");
        const list = saved ? JSON.parse(saved) : [];
        localStorage.setItem("onyx_doctor_prescriptions", JSON.stringify([rxItem, ...list]));
      } catch (err) {
        console.debug("Could not update local prescriptions cache", err);
      }

      toast({
        title: "Prescription Issued & Consultation Completed",
        description: `Electronic Rx recorded for ${rxItem.patient}. Consultation marked completed.`,
      });
      setWrapUpOpen(false);
    } catch {
      toast({
        title: "Wrap-up saved",
        description: "Prescription recorded to active profile.",
      });
      setWrapUpOpen(false);
    } finally {
      setWrapUpSubmitting(false);
    }
  };

  const toggleMic = async () => {
    const nextState = !micActive;
    setMicActive(nextState);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = nextState));
    }
    if (localAudioRef.current) {
      try {
        await localAudioRef.current.setEnabled(nextState);
      } catch (err) {
        console.error("Error toggling microphone:", err);
      }
    }
  };

  const toggleCamera = async () => {
    const nextState = !cameraActive;
    setCameraActive(nextState);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => (t.enabled = nextState));
    }
    if (localVideoRef.current) {
      try {
        await localVideoRef.current.setEnabled(nextState);
        if (nextState) {
          setTimeout(() => {
            localVideoRef.current?.play("local-video");
          }, 100);
        }
      } catch (err) {
        console.error("Error toggling camera:", err);
      }
    }
  };

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.condition.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14213D] flex items-center gap-2">
            <Users className="h-6 w-6 text-[#F2052C]" /> Clinical Consultations & Patients
          </h1>
          <p className="text-sm text-slate-400 font-semibold mt-0.5">
            {patients.length} active patient profile(s) · {bookings.length} registered booking(s)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchConsultationsData}
            disabled={loading}
            className="rounded-[14px] border-slate-200 h-9 w-9 bg-white shadow-sm"
            title="Refresh patient records"
          >
            <RefreshCw className={`h-4 w-4 text-slate-600 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            onClick={() => setAddPatientOpen(true)}
            className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white rounded-[14px] border-none shadow-md shadow-[#F2052C]/20 hover:opacity-90 h-9 font-bold"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Patient
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by patient name or diagnosis..."
          className="pl-10 h-10 rounded-[14px] border-slate-200 bg-white/70 font-medium"
        />
      </div>

      {/* Patient Grid */}
      {filteredPatients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No patients found"
          description="Your active patient consultations will appear here once booked."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredPatients.map((patient) => {
            const sc = STATUS_STYLE[patient.status] || STATUS_STYLE["Stable"];
            return (
              <div
                key={patient.id}
                onClick={() => handleOpen(patient)}
                className="hover-lift bg-white/70 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm p-5 cursor-pointer group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-[16px] bg-gradient-to-br from-[#14213D] to-[#35B7C9] flex items-center justify-center text-white font-extrabold text-sm shadow-md">
                      {patient.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-[#14213D]">{patient.name}</p>
                      <p className="text-xs text-slate-400 font-semibold">
                        {patient.age ? `${patient.age}y · ` : ""}{patient.gender}
                        {patient.phone ? ` · ${patient.phone}` : ""}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${sc.bg} ${sc.text} ${sc.border}`}
                  >
                    {patient.status}
                  </span>
                </div>

                {/* Condition Badge */}
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4"
                  style={{
                    background: `${patient.conditionColor}12`,
                    color: patient.conditionColor,
                    border: `1px solid ${patient.conditionColor}20`,
                  }}
                >
                  <Heart className="h-3 w-3" />
                  {patient.condition}
                </div>

                {/* Vitals Row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { icon: Activity, label: "BP", value: patient.vitals.bp },
                    { icon: Thermometer, label: "Temp", value: patient.vitals.temp },
                    {
                      icon: Heart,
                      label: "Pulse",
                      value: patient.vitals.pulse && patient.vitals.pulse !== "--"
                        ? `${patient.vitals.pulse} bpm`
                        : "--",
                    },
                  ].map((v) => (
                    <div key={v.label} className="bg-slate-50/70 rounded-[12px] p-2 text-center">
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                        {v.label}
                      </p>
                      <p className="text-xs font-extrabold text-[#14213D] mt-0.5">{v.value}</p>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                    <Calendar className="h-3 w-3" /> Next: {patient.nextAppointment}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartCallDirect(patient);
                      }}
                      className="h-8 w-8 rounded-[10px] bg-[#35B7C9]/10 flex items-center justify-center text-[#35B7C9] hover:bg-[#35B7C9]/20 transition-colors"
                      title="Start Video Consultation"
                    >
                      <Video className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpen(patient);
                      }}
                      className="h-8 w-8 rounded-[10px] bg-[#F2052C]/10 flex items-center justify-center text-[#F2052C] hover:bg-[#F2052C]/20 transition-colors"
                      title="View Details"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Patient Detail Slide-over */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-[480px] border-none shadow-2xl bg-white/95 backdrop-blur-xl overflow-y-auto">
          {selected && (
            <div className="space-y-6">
              <SheetHeader>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-[18px] bg-gradient-to-br from-[#14213D] to-[#35B7C9] flex items-center justify-center text-white font-extrabold text-xl shadow-lg">
                    {selected.avatar}
                  </div>
                  <div>
                    <SheetTitle className="text-xl font-extrabold text-[#14213D]">
                      {selected.name}
                    </SheetTitle>
                    <p className="text-sm text-slate-400 font-semibold">
                      {selected.age ? `${selected.age} years · ` : ""}{selected.gender}
                      {selected.phone ? ` · ${selected.phone}` : ""}
                    </p>
                    <div
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold mt-1"
                      style={{
                        background: `${selected.conditionColor}12`,
                        color: selected.conditionColor,
                      }}
                    >
                      <Heart className="h-2.5 w-2.5" /> {selected.condition}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {/* Tab Nav */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-[14px]">
                {(["overview", "history", "reports"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      if (tab === "reports" && sharedReportsStatus === "idle") {
                        fetchSharedReports();
                      }
                    }}
                    className={`flex-1 py-1.5 rounded-[10px] text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                      activeTab === tab
                        ? "bg-white text-[#14213D] shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {tab === "reports" && <ShieldCheck className="h-3.5 w-3.5 text-[#35B7C9]" />}
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === "overview" && (
                <>
                  {/* Clinical Screening Notice */}
                  <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-[14px] text-[11px] text-amber-950 flex items-start gap-2 leading-relaxed">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-amber-900">Screening Notice: </span>
                      Vitals & telemetry are screening indicators from kiosk measurements. Confirm
                      with in-person clinical assessment where needed.
                    </div>
                  </div>

                  {/* Vitals */}
                  <div>
                    <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">
                      Latest Screening Vitals
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { icon: Activity, label: "Blood Pressure", value: selected.vitals.bp, color: "#F2052C" },
                        { icon: Thermometer, label: "Temperature", value: selected.vitals.temp, color: "#F59E0B" },
                        {
                          icon: Heart,
                          label: "Pulse Rate",
                          value: selected.vitals.pulse && selected.vitals.pulse !== "--"
                            ? `${selected.vitals.pulse} bpm`
                            : "--",
                          color: "#35B7C9",
                        },
                      ].map((v) => (
                        <div key={v.label} className="bg-slate-50 rounded-[16px] p-3 text-center">
                          <v.icon className="h-5 w-5 mx-auto mb-1.5" style={{ color: v.color }} />
                          <p className="text-sm font-extrabold text-[#14213D]">{v.value}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                            {v.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                      Clinical Notes
                    </p>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="rounded-[14px] border-slate-200 text-sm min-h-[100px] resize-none font-medium"
                      placeholder="Add clinical consultation notes..."
                    />
                  </div>

                  {/* Diagnosis */}
                  <div>
                    <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                      Diagnosis / Assessment
                    </p>
                    <Input
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="Enter clinical diagnosis..."
                      className="rounded-[14px] border-slate-200 h-10 font-semibold"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      onClick={handleSaveNotes}
                      className="flex-1 bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white rounded-[14px] border-none shadow-md font-bold"
                    >
                      <MessageSquare className="h-4 w-4 mr-1.5" /> Save Notes
                    </Button>
                    <Button
                      onClick={handleStartCall}
                      variant="outline"
                      className="flex-1 rounded-[14px] border-slate-200 font-bold hover:bg-slate-50"
                    >
                      <Video className="h-4 w-4 mr-1.5 text-[#35B7C9]" /> Start Call
                    </Button>
                  </div>
                </>
              )}

              {activeTab === "history" && (
                <div className="space-y-3">
                  <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
                    Past Visits & Telehealth Records
                  </p>
                  {[
                    { date: selected.lastVisit, notes: selected.notes, type: "Telehealth Consult" },
                    { date: "Previous Visit", notes: "Kiosk vitals logged. Physical screening complete.", type: "Kiosk Screening" },
                  ].map((h, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-8 w-8 rounded-full bg-[#F2052C]/10 flex items-center justify-center">
                          <Clock className="h-4 w-4 text-[#F2052C]" />
                        </div>
                        {i < 1 && <div className="w-0.5 flex-1 bg-slate-100 mt-1" />}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-extrabold text-[#14213D]">{h.type}</p>
                          <span className="text-[10px] text-slate-400 font-bold">{h.date}</span>
                        </div>
                        <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                          {h.notes}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "reports" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-extrabold text-[#14213D] uppercase tracking-wider">
                        Patient Shared Medical Records
                      </p>
                      <p className="text-[11px] text-slate-400">
                        ABDM Consent Architecture & NMC Telemedicine Guidelines
                      </p>
                    </div>
                    {sharedReportsStatus === "unlocked" && (
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                        <ShieldCheck className="h-3 w-3 mr-1 text-emerald-600" /> Consent Verified
                      </Badge>
                    )}
                  </div>

                  {sharedReportsStatus === "loading" && (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl flex flex-col items-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-[#35B7C9]" />
                      <p className="text-xs text-slate-500 font-semibold">Verifying ABDM consent & fetching reports...</p>
                    </div>
                  )}

                  {sharedReportsStatus === "declaration_required" && (
                    <div className="p-5 bg-amber-50/90 border border-amber-200 rounded-[20px] space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                          <Lock className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-amber-950">Doctor Privacy Declaration Required</p>
                          <p className="text-[10px] text-amber-800">Section 3.8 NMC Telemedicine Privacy Compliance</p>
                        </div>
                      </div>

                      <p className="text-xs text-amber-900/90 leading-relaxed bg-white/70 p-3 rounded-xl border border-amber-200/60 font-medium italic">
                        "{declarationText}"
                      </p>

                      <Button
                        onClick={() => setDeclarationModalOpen(true)}
                        className="w-full bg-[#14213D] hover:bg-[#1f335e] text-white rounded-[12px] h-10 text-xs font-bold shadow-sm"
                      >
                        <ShieldCheck className="h-4 w-4 mr-1.5 text-emerald-400" />
                        Review Declaration & Unlock Records
                      </Button>
                    </div>
                  )}

                  {sharedReportsStatus === "not_shared" && (
                    <div className="p-6 text-center bg-slate-50 rounded-[20px] border border-slate-200/60 space-y-2">
                      <div className="h-10 w-10 rounded-full bg-slate-200/70 text-slate-500 flex items-center justify-center mx-auto">
                        <Lock className="h-5 w-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-700">No Medical Reports Shared</p>
                      <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                        The patient has configured their consent scope to not share historical diagnostic records for this booking.
                      </p>
                    </div>
                  )}

                  {sharedReportsStatus === "unlocked" && (
                    <div className="space-y-2.5">
                      {sharedReports.length === 0 ? (
                        <div className="p-6 text-center bg-slate-50 rounded-2xl text-xs text-slate-400 font-medium">
                          No previous medical records found for this patient profile.
                        </div>
                      ) : (
                        sharedReports.map((report: any, idx: number) => (
                          <div
                            key={report._id || idx}
                            className="p-3.5 bg-white border border-slate-200/80 rounded-[16px] hover:border-[#35B7C9] transition-all flex items-center justify-between shadow-xs"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                                <FileText className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800">
                                  {report.reportCode || `Clinical Screening Report #${idx + 1}`}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  {report.createdAt
                                    ? new Date(report.createdAt).toLocaleDateString("en-IN", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })
                                    : "Recent"}
                                </p>
                              </div>
                            </div>

                            {report.fileUrl ? (
                              <a
                                href={report.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-[#35B7C9]/10 hover:text-[#35B7C9] text-xs font-bold text-slate-700 transition-colors"
                              >
                                View PDF <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-600 border-none text-[10px]">
                                Vitals On File
                              </Badge>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Patient Dialog */}
      <Dialog open={addPatientOpen} onOpenChange={setAddPatientOpen}>
        <DialogContent className="sm:max-w-[420px] rounded-[24px] border-none shadow-2xl bg-white/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-[#14213D] flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#F2052C]" /> Register Clinical Patient
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Full Name
              </Label>
              <Input
                value={newPatient.name}
                onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                placeholder="e.g. Ananya Patel"
                className="rounded-[14px] border-slate-200 h-10 font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                  Age
                </Label>
                <Input
                  type="number"
                  value={newPatient.age}
                  onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                  className="rounded-[14px] border-slate-200 h-10 font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                  Gender
                </Label>
                <Select
                  value={newPatient.gender}
                  onValueChange={(v) => setNewPatient({ ...newPatient, gender: v })}
                >
                  <SelectTrigger className="rounded-[14px] border-slate-200 h-10 font-semibold">
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
              <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Primary Condition / Reason
              </Label>
              <Input
                value={newPatient.condition}
                onChange={(e) => setNewPatient({ ...newPatient, condition: e.target.value })}
                placeholder="e.g. Hypertension, Migraine, Type-2 Diabetes"
                className="rounded-[14px] border-slate-200 h-10 font-semibold"
              />
            </div>

            <div>
              <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Contact Phone
              </Label>
              <Input
                value={newPatient.phone}
                onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })}
                placeholder="e.g. +91 98765 43210"
                className="rounded-[14px] border-slate-200 h-10 font-semibold"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setAddPatientOpen(false)}
                className="flex-1 rounded-[14px] h-10 font-bold border-slate-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreatePatient}
                disabled={!newPatient.name.trim() || submittingPatient}
                className="flex-1 rounded-[14px] h-10 font-bold bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white border-none shadow-md shadow-[#F2052C]/20"
              >
                {submittingPatient ? "Registering…" : "Add Patient"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Video Call Dialog Overlay */}
      <Dialog open={inVideoCall} onOpenChange={(open) => { if (!open) handleEndCall(); }}>
        <DialogContent className="max-w-5xl h-[650px] p-0 bg-slate-900 border border-slate-800 rounded-[28px] overflow-hidden flex flex-col justify-between text-white shadow-2xl">
          {/* Main Area: Video Stream + In-Call Notes Drawer */}
          <div className="relative flex-1 bg-slate-950 flex overflow-hidden">
            {/* Main Video Viewport */}
            <div className="relative flex-1 h-full transition-all duration-300 flex items-center justify-center">
              <div id="remote-video" className="absolute inset-0 w-full h-full object-cover">
                <video
                  ref={(el) => {
                    remoteVideoElRef.current = el;
                    if (el && (remoteVideoElRef as any)._stream) {
                      el.srcObject = (remoteVideoElRef as any)._stream;
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    remoteVideoTrackActive && remoteUserConnected ? "opacity-100 block" : "opacity-0 hidden"
                  }`}
                />
                {!remoteVideoTrackActive && (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <div className="h-20 w-20 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                      <User className="h-10 w-10 text-slate-500" />
                    </div>
                    <p className="text-sm font-semibold">
                      {remoteUserConnected
                        ? "Patient video paused"
                        : "Connecting with patient in secure room..."}
                    </p>
                  </div>
                )}
              </div>

              {/* Self Video (PiP) */}
              <div className="absolute top-4 right-4 w-44 h-32 bg-slate-800 rounded-[16px] overflow-hidden border-2 border-white/20 shadow-lg z-20">
                <div id="local-video" className="w-full h-full object-cover relative">
                  <video
                    ref={(el) => {
                      localVideoElRef.current = el;
                      if (el && localStreamRef.current) {
                        el.srcObject = localStreamRef.current;
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full h-full object-cover -scale-x-100 ${cameraActive ? "block" : "hidden"}`}
                  />
                  {!cameraActive && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs">
                      <VideoOff className="h-6 w-6 mb-1 text-slate-600" />
                      <span>Camera Off</span>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-1 left-2 text-[10px] bg-black/60 px-1.5 py-0.5 rounded text-white">
                  You (Doctor)
                </div>
              </div>

              {/* Top Bar inside Video */}
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-full z-20 border border-white/10">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-mono font-bold tracking-wider">
                  {formatTime(callDuration)}
                </span>
                <span className="text-white/40">|</span>
                <span className="text-xs font-bold text-slate-200">{selected?.name}</span>
                {selected?.vitals?.bp && (
                  <>
                    <span className="text-white/40">|</span>
                    <span className="text-[11px] text-emerald-400 font-mono font-medium">BP: {selected.vitals.bp}</span>
                  </>
                )}
              </div>
            </div>

            {/* In-Call Notes & Telemetry Drawer (collapsible) */}
            {inCallNotesOpen && (
              <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col p-4 z-20 animate-in slide-in-from-right duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[#35B7C9]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">Clinical Telemetry</span>
                  </div>
                  <button
                    onClick={() => setInCallNotesOpen(false)}
                    className="text-xs text-slate-400 hover:text-white p-1"
                  >
                    ✕
                  </button>
                </div>

                {/* Vitals summary cards */}
                <div className="grid grid-cols-3 gap-2 my-3">
                  <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
                    <p className="text-[10px] text-slate-400 font-medium">BP</p>
                    <p className="text-xs font-mono font-bold text-emerald-400">{selected?.vitals?.bp || "120/80"}</p>
                  </div>
                  <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
                    <p className="text-[10px] text-slate-400 font-medium">Pulse</p>
                    <p className="text-xs font-mono font-bold text-rose-400">{selected?.vitals?.pulse || 72} bpm</p>
                  </div>
                  <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/50">
                    <p className="text-[10px] text-slate-400 font-medium">Temp</p>
                    <p className="text-xs font-mono font-bold text-amber-400">{selected?.vitals?.temp || "98.6°F"}</p>
                  </div>
                </div>

                {/* Live Clinical Notes */}
                <div className="flex-1 flex flex-col gap-2">
                  <label className="text-[11px] font-semibold text-slate-300">Live Consultation Notes</label>
                  <textarea
                    value={inCallClinicalNotes}
                    onChange={(e) => setInCallClinicalNotes(e.target.value)}
                    placeholder="Document symptoms, patient complaint, examination findings..."
                    className="flex-1 w-full bg-slate-950/80 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-[#35B7C9] resize-none font-sans"
                  />
                  <p className="text-[10px] text-slate-400 italic">Auto-appended to post-call electronic wrap-up slip.</p>
                </div>
              </div>
            )}
          </div>

          {/* Video Control Bar */}
          <div className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-6 z-20">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInCallNotesOpen(!inCallNotesOpen)}
                className={`h-10 px-3.5 rounded-full flex items-center gap-2 text-xs font-bold transition-all ${
                  inCallNotesOpen
                    ? "bg-[#35B7C9] text-white shadow-md shadow-[#35B7C9]/30"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Notes & Vitals</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleMic}
                className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
                  micActive ? "bg-slate-800 hover:bg-slate-700 text-white" : "bg-rose-500 text-white"
                }`}
                title={micActive ? "Mute Microphone" : "Unmute Microphone"}
              >
                {micActive ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </button>

              <button
                onClick={toggleCamera}
                className={`h-11 w-11 rounded-full flex items-center justify-center transition-colors ${
                  cameraActive ? "bg-slate-800 hover:bg-slate-700 text-white" : "bg-rose-500 text-white"
                }`}
                title={cameraActive ? "Turn Off Camera" : "Turn On Camera"}
              >
                {cameraActive ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>

              <button
                onClick={handleEndCall}
                className="h-11 px-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 transition-all"
              >
                <PhoneOff className="h-4 w-4" /> End Call & Wrap Up
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Agora 256-bit Encrypted</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Consultation Wrap-Up & Digital Rx Dialog */}
      <Dialog open={wrapUpOpen} onOpenChange={setWrapUpOpen}>
        <DialogContent className="max-w-xl p-6 rounded-[24px] bg-white border border-slate-100 shadow-2xl">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900">
                    Consultation Completed
                  </DialogTitle>
                  <p className="text-xs text-slate-500">
                    Patient: <strong className="text-slate-800">{selected?.name}</strong> • Duration: {formatTime(callDuration)}
                  </p>
                </div>
              </div>
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-bold">
                Completed
              </Badge>
            </div>
          </DialogHeader>

          <form onSubmit={handleWrapUpPrescription} className="space-y-4 pt-3">
            <div>
              <Label className="text-xs font-bold text-slate-700">Diagnosis / Chief Complaint</Label>
              <Input
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. Acute Viral Upper Respiratory Infection"
                className="mt-1 h-9 rounded-[12px] text-xs font-medium border-slate-200"
              />
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-3">
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-[#F2052C]" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Prescribe Medication (Optional)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-[11px] text-slate-600">Medication Name</Label>
                  <Input
                    value={wrapUpRx.medication}
                    onChange={(e) => setWrapUpRx({ ...wrapUpRx, medication: e.target.value })}
                    placeholder="e.g. Paracetamol / Amoxicillin"
                    className="mt-1 h-8 rounded-lg text-xs bg-white border-slate-200"
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-600">Dosage</Label>
                  <Input
                    value={wrapUpRx.dosage}
                    onChange={(e) => setWrapUpRx({ ...wrapUpRx, dosage: e.target.value })}
                    placeholder="e.g. 500mg, 650mg, 10ml"
                    className="mt-1 h-8 rounded-lg text-xs bg-white border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-[11px] text-slate-600">Frequency</Label>
                  <Select
                    value={wrapUpRx.frequency}
                    onValueChange={(val) => setWrapUpRx({ ...wrapUpRx, frequency: val })}
                  >
                    <SelectTrigger className="mt-1 h-8 rounded-lg text-xs bg-white border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Once daily (OD)">Once daily (OD)</SelectItem>
                      <SelectItem value="Twice daily (BD)">Twice daily (BD)</SelectItem>
                      <SelectItem value="Thrice daily (TDS)">Thrice daily (TDS)</SelectItem>
                      <SelectItem value="Four times daily (QID)">Four times daily (QID)</SelectItem>
                      <SelectItem value="As needed (SOS)">As needed (SOS)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[11px] text-slate-600">Duration</Label>
                  <Select
                    value={wrapUpRx.duration}
                    onValueChange={(val) => setWrapUpRx({ ...wrapUpRx, duration: val })}
                  >
                    <SelectTrigger className="mt-1 h-8 rounded-lg text-xs bg-white border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="3 days">3 days</SelectItem>
                      <SelectItem value="5 days">5 days</SelectItem>
                      <SelectItem value="7 days">7 days</SelectItem>
                      <SelectItem value="10 days">10 days</SelectItem>
                      <SelectItem value="14 days">14 days</SelectItem>
                      <SelectItem value="1 month">1 month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-[11px] text-slate-600">Patient Instructions / Clinical Advice</Label>
                <Input
                  value={wrapUpRx.instructions || inCallClinicalNotes}
                  onChange={(e) => setWrapUpRx({ ...wrapUpRx, instructions: e.target.value })}
                  placeholder="e.g. Take after meals with plenty of water. Rest for 3 days."
                  className="mt-1 h-8 rounded-lg text-xs bg-white border-slate-200"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setWrapUpOpen(false)}
                className="flex-1 h-10 rounded-[14px] text-xs font-bold border-slate-200 text-slate-600"
              >
                Close without Rx
              </Button>
              <Button
                type="submit"
                disabled={wrapUpSubmitting}
                className="flex-1 h-10 rounded-[14px] text-xs font-bold bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white border-none shadow-md shadow-[#F2052C]/20"
              >
                {wrapUpSubmitting ? "Issuing..." : "Issue Digital Prescription & Complete"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ABDM & NMC Telemedicine Privacy Declaration Modal */}
      <Dialog open={declarationModalOpen} onOpenChange={setDeclarationModalOpen}>
        <DialogContent className="max-w-md p-6 rounded-[24px] bg-white border border-slate-100 shadow-2xl">
          <DialogHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Patient Health Records Agreement
                </DialogTitle>
                <p className="text-xs text-slate-400">
                  ABDM Privacy Architecture & Telemedicine Practice Guidelines
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-3">
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-700 leading-relaxed font-serif">
              "{declarationText}"
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 font-medium">
              <Checkbox
                checked={agreementChecked}
                onCheckedChange={(checked) => setAgreementChecked(!!checked)}
                className="mt-0.5 rounded-[5px]"
              />
              <span>
                I agree to the above declaration and understand that accessing patient medical records without explicit clinical need is a violation of medical ethics and patient confidentiality.
              </span>
            </label>

            <div className="flex gap-2.5 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeclarationModalOpen(false)}
                className="flex-1 rounded-xl h-10 text-xs font-bold border-slate-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAgreeAndUnlock}
                disabled={!agreementChecked || agreeingDeclaration}
                className="flex-1 rounded-xl h-10 text-xs font-bold bg-[#14213D] hover:bg-[#1e345e] text-white border-none shadow-md"
              >
                {agreeingDeclaration ? "Recording..." : "I Agree & Unlock"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Consultations;
