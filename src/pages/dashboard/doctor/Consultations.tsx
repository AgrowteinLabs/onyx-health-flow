import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api-request";
import { listBookings } from "@/services/booking.service";
import AgoraRTC, { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";

interface Patient {
  id: number;
  name: string;
  age: number;
  gender: string;
  condition: string;
  conditionColor: string;
  lastVisit: string;
  nextAppointment: string;
  status: "Stable" | "Monitor" | "Critical";
  avatar: string;
  notes: string;
  vitals: { bp: string; temp: string; pulse: number };
}

const PATIENTS: Patient[] = [
  { id: 1, name: "John Smith",    age: 42, gender: "Male",   condition: "Hypertension",   conditionColor: "#F59E0B", lastVisit: "Jun 10", nextAppointment: "Jun 20", status: "Monitor",  avatar: "JS", notes: "Patient responding well to Lisinopril. Monitor BP weekly.", vitals: { bp: "138/88", temp: "98.4°F", pulse: 76 } },
  { id: 2, name: "Sarah Johnson", age: 29, gender: "Female", condition: "Type 2 Diabetes", conditionColor: "#F2052C", lastVisit: "Jun 8",  nextAppointment: "Jun 22", status: "Stable",   avatar: "SJ", notes: "HbA1c improved to 6.8%. Continue Metformin. Encourage diet.", vitals: { bp: "120/80", temp: "98.6°F", pulse: 72 } },
  { id: 3, name: "Michael Chen",  age: 56, gender: "Male",   condition: "Asthma",          conditionColor: "#35B7C9", lastVisit: "Jun 5",  nextAppointment: "Jul 1",  status: "Stable",   avatar: "MC", notes: "Using rescue inhaler less frequently. Good progress.", vitals: { bp: "118/76", temp: "98.2°F", pulse: 68 } },
  { id: 4, name: "Emma Davis",    age: 67, gender: "Female", condition: "Heart Disease",   conditionColor: "#EF4444", lastVisit: "Jun 11", nextAppointment: "Jun 18", status: "Critical", avatar: "ED", notes: "Post-stent placement. Requires close monitoring. ECG weekly.", vitals: { bp: "142/92", temp: "99.1°F", pulse: 88 } },
  { id: 5, name: "Raj Patel",     age: 35, gender: "Male",   condition: "Migraine",        conditionColor: "#8B5CF6", lastVisit: "Jun 7",  nextAppointment: "Jul 5",  status: "Stable",   avatar: "RP", notes: "Preventive medication started. Diary tracking recommended.", vitals: { bp: "116/74", temp: "98.6°F", pulse: 70 } },
  { id: 6, name: "Priya Sharma",  age: 45, gender: "Female", condition: "Osteoarthritis",  conditionColor: "#10B981", lastVisit: "Jun 9",  nextAppointment: "Jun 30", status: "Monitor",  avatar: "PS", notes: "Physical therapy ongoing. Pain management with Naproxen.", vitals: { bp: "124/82", temp: "98.4°F", pulse: 74 } },
];

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  Stable:   { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
  Monitor:  { bg: "bg-amber-50",   text: "text-amber-600",   border: "border-amber-100" },
  Critical: { bg: "bg-rose-50",    text: "text-rose-600",    border: "border-rose-100" },
};

const Consultations = () => {
  const [selected, setSelected] = useState<Patient | null>(null);
  const [notes, setNotes] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");

  const { toast } = useToast();
  const [bookings, setBookings] = useState<any[]>([]);

  // Video call states
  const [inVideoCall, setInVideoCall] = useState(false);
  const [videoToken, setVideoToken] = useState("");
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);

  // Agora states & refs
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoRef = useRef<ICameraVideoTrack | null>(null);
  const [remoteUserConnected, setRemoteUserConnected] = useState(false);
  const [remoteVideoTrackActive, setRemoteVideoTrackActive] = useState(false);
  const [isRealCall, setIsRealCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const durationTimerRef = useRef<any>(null);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const list = await listBookings();
        setBookings(list || []);
      } catch (err) {
        console.error("Failed to load bookings in consultations", err);
      }
    };
    fetchBookings();
    
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
      if (localAudioRef.current) localAudioRef.current.close();
      if (localVideoRef.current) localVideoRef.current.close();
      if (clientRef.current) clientRef.current.leave();
    };
  }, []);

  const handleOpen = (patient: Patient) => {
    setSelected(patient);
    setNotes(patient.notes);
    setDiagnosis("");
    setActiveTab("overview");
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
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
          setTimeout(() => {
            user.videoTrack?.play("remote-video");
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

      const rtcToken = token.startsWith("mock-") ? null : token;
      const uid = Math.floor(Math.random() * 1000000);
      await client.join(appId, channelName, rtcToken, uid);

      try {
        const localAudio = await AgoraRTC.createMicrophoneAudioTrack();
        const localVideo = await AgoraRTC.createCameraVideoTrack();
        localAudioRef.current = localAudio;
        localVideoRef.current = localVideo;

        await client.publish([localAudio, localVideo]);
        
        localVideo.play("local-video");

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
          variant: "destructive"
        });
      }

      setCallDuration(0);
      durationTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Agora join failed:", err);
      toast({
        title: "Agora Connection Failed",
        description: "Failed to connect to Agora. Switching to simulation mode.",
        variant: "destructive"
      });
      startSimulatedCall();
    }
  };

  const handleStartCallDirect = async (patient: Patient) => {
    setSelected(patient);
    setNotes(patient.notes);
    setDiagnosis("");
    setActiveTab("overview");

    try {
      const matchingBooking = bookings.find(
        (b) =>
          b.status === "Confirmed" &&
          (b.profileId?.name?.toLowerCase() === patient.name.toLowerCase() ||
           b.patientName?.toLowerCase() === patient.name.toLowerCase())
      ) || bookings.find(b => b.status === "Confirmed") || bookings[0];

      const targetBookingId = matchingBooking?._id || matchingBooking?.id || `mock-booking-id-${patient.id}`;
      toast({ title: "Requesting video room access..." });

      const res: any = await apiRequest(`/api/video/token/${targetBookingId}`, { method: "GET" })
        .catch(() => ({
          token: "mock-agora-video-jwt-token-xyz",
          channelName: `room-${targetBookingId}`,
          appId: import.meta.env.VITE_AGORA_APP_ID || "mock-app-id"
        }));

      const token = res.token || "mock-token-xyz";
      const channelName = res.channelName || `room-${targetBookingId}`;
      const appId = res.appId || import.meta.env.VITE_AGORA_APP_ID;

      setVideoToken(token);
      setInVideoCall(true);

      if (appId && appId !== "mock-app-id") {
        startAgoraCall(appId, channelName, token);
      } else {
        startSimulatedCall();
      }
    } catch (err) {
      console.error(err);
      startSimulatedCall();
    }
  };

  const handleStartCall = async () => {
    if (!selected) return;
    await handleStartCallDirect(selected);
  };

  const handleEndCall = async () => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (localAudioRef.current) {
      localAudioRef.current.close();
      localAudioRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.close();
      localVideoRef.current = null;
    }

    if (clientRef.current) {
      try {
        await clientRef.current.leave();
      } catch (err) {
        console.error("Error leaving Agora client:", err);
      }
      clientRef.current = null;
    }

    setInVideoCall(false);
    setRemoteUserConnected(false);
    setRemoteVideoTrackActive(false);
    setIsRealCall(false);
    toast({ title: "Consultation ended successfully" });
  };

  const toggleMic = async () => {
    const nextState = !micActive;
    setMicActive(nextState);
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

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14213D] flex items-center gap-2">
            <Users className="h-6 w-6 text-[#F2052C]" /> My Patients
          </h1>
          <p className="text-sm text-slate-400 font-semibold mt-0.5">{PATIENTS.length} active patients</p>
        </div>
        <Button className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white rounded-[14px] border-none shadow-md shadow-[#F2052C]/20 hover:opacity-90 h-9">
          <Plus className="h-4 w-4 mr-1.5" /> Add Patient
        </Button>
      </div>

      {/* Patient Grid */}
      {PATIENTS.length === 0 ? (
        <EmptyState icon={Users} title="No patients yet" description="Your active patients will appear here." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {PATIENTS.map((patient) => {
            const sc = STATUS_STYLE[patient.status];
            return (
              <div
                key={patient.id}
                onClick={() => handleOpen(patient)}
                className="hover-lift bg-white/60 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm p-5 cursor-pointer group"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#F2052C] to-[#35B7C9] flex items-center justify-center text-white font-extrabold text-sm shadow-md">
                      {patient.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-[#14213D]">{patient.name}</p>
                      <p className="text-xs text-slate-400 font-semibold">{patient.age}y · {patient.gender}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${sc.bg} ${sc.text} ${sc.border}`}>
                    {patient.status}
                  </span>
                </div>

                {/* Condition Badge */}
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4"
                  style={{ background: `${patient.conditionColor}12`, color: patient.conditionColor, border: `1px solid ${patient.conditionColor}20` }}
                >
                  <Heart className="h-3 w-3" />
                  {patient.condition}
                </div>

                {/* Vitals Row */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { icon: Activity, label: "BP", value: patient.vitals.bp },
                    { icon: Thermometer, label: "Temp", value: patient.vitals.temp },
                    { icon: Heart, label: "Pulse", value: `${patient.vitals.pulse} bpm` },
                  ].map((v) => (
                    <div key={v.label} className="bg-slate-50/60 rounded-[12px] p-2 text-center">
                      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{v.label}</p>
                      <p className="text-xs font-extrabold text-[#14213D] mt-0.5">{v.value}</p>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                    <Calendar className="h-3 w-3" /> Next: {patient.nextAppointment}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        handleStartCallDirect(patient);
                      }}
                      className="h-7 w-7 rounded-[10px] bg-[#35B7C9]/10 flex items-center justify-center text-[#35B7C9] hover:bg-[#35B7C9]/20 transition-colors"
                    >
                      <Video className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpen(patient); }}
                      className="h-7 w-7 rounded-[10px] bg-[#F2052C]/8 flex items-center justify-center text-[#F2052C] hover:bg-[#F2052C]/15 transition-colors"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
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
                {/* Patient Hero */}
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#F2052C] to-[#35B7C9] flex items-center justify-center text-white font-extrabold text-xl shadow-lg">
                    {selected.avatar}
                  </div>
                  <div>
                    <SheetTitle className="text-xl font-extrabold text-[#14213D]">{selected.name}</SheetTitle>
                    <p className="text-sm text-slate-400 font-semibold">{selected.age} years · {selected.gender}</p>
                    <div
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold mt-1"
                      style={{ background: `${selected.conditionColor}12`, color: selected.conditionColor }}
                    >
                      <Heart className="h-2.5 w-2.5" /> {selected.condition}
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {/* Tab Nav */}
              <div className="flex gap-1 bg-slate-100 p-1 rounded-[14px]">
                {(["overview", "history"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 py-1.5 rounded-[10px] text-xs font-extrabold uppercase tracking-wider transition-all ${
                      activeTab === tab
                        ? "bg-white text-[#14213D] shadow-sm"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === "overview" && (
                <>
                  {/* Vitals */}
                  <div>
                    <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-3">Latest Vitals</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { icon: Activity, label: "Blood Pressure", value: selected.vitals.bp, color: "#F2052C" },
                        { icon: Thermometer, label: "Temperature", value: selected.vitals.temp, color: "#F59E0B" },
                        { icon: Heart, label: "Pulse Rate", value: `${selected.vitals.pulse} bpm`, color: "#35B7C9" },
                      ].map((v) => (
                        <div key={v.label} className="bg-slate-50 rounded-[16px] p-3 text-center">
                          <v.icon className="h-5 w-5 mx-auto mb-1.5" style={{ color: v.color }} />
                          <p className="text-sm font-extrabold text-[#14213D]">{v.value}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{v.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Clinical Notes</p>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="rounded-[14px] border-slate-200 text-sm min-h-[100px] resize-none"
                      placeholder="Add consultation notes..."
                    />
                  </div>

                  {/* Diagnosis */}
                  <div>
                    <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">New Diagnosis</p>
                    <Input
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="Enter diagnosis..."
                      className="rounded-[14px] border-slate-200 h-10"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <Button
                      className="flex-1 bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white rounded-[14px] border-none shadow-md font-bold"
                    >
                      <MessageSquare className="h-4 w-4 mr-1.5" /> Save Notes
                    </Button>
                    <Button 
                      onClick={handleStartCall}
                      variant="outline" 
                      className="flex-1 rounded-[14px] border-slate-200 font-bold"
                    >
                      <Video className="h-4 w-4 mr-1.5 text-[#35B7C9]" /> Start Call
                    </Button>
                  </div>
                </>
              )}

              {activeTab === "history" && (
                <div className="space-y-3">
                  <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Past Visits</p>
                  {[
                    { date: selected.lastVisit, 2026: "2026", notes: selected.notes, type: "Follow-up" },
                    { date: "May 20", 2026: "2026", notes: "Initial consultation. Vitals recorded.", type: "Consultation" },
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
                          <span className="text-[10px] text-slate-400 font-bold">{h.date}, 2026</span>
                        </div>
                        <p className="text-xs text-slate-500 font-semibold leading-relaxed">{h.notes}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Video Call Dialog Overlay */}
      <Dialog open={inVideoCall} onOpenChange={(open) => { if (!open) handleEndCall(); }}>
        <DialogContent className="max-w-[800px] h-[550px] p-0 bg-slate-900 border-none rounded-[24px] overflow-hidden flex flex-col justify-between text-white shadow-2xl">
          
          {/* Main Patient Video (Big background) */}
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center overflow-hidden">
            {(!remoteVideoTrackActive || !isRealCall) && (
              <div className="text-center space-y-3 z-10">
                <div className="h-24 w-24 rounded-full bg-slate-800 border-2 border-slate-700/80 flex items-center justify-center text-slate-300 font-extrabold text-2xl animate-pulse">
                  {selected?.avatar || "PT"}
                </div>
                <h3 className="font-extrabold text-base">{selected?.name || "Patient"}</h3>
                <Badge className="bg-emerald-500 text-white text-[10px] font-bold border-none">
                  {remoteUserConnected ? "Patient is connected" : "Waiting for patient..."}
                </Badge>
              </div>
            )}
            {!isRealCall && remoteUserConnected && (
              <div className="absolute bottom-4 left-4 z-10 bg-black/60 px-3 py-1 rounded-md text-[10px] font-semibold text-emerald-400">
                Simulated Video Stream
              </div>
            )}
            
            {/* The element where patient's remote video plays */}
            <div id="remote-video" className="absolute inset-0 z-0 w-full h-full" />
          </div>

          {/* Doctor Local Video PIP Window */}
          <div 
            id="local-video" 
            className="absolute bottom-20 right-6 h-36 w-28 rounded-2xl border border-slate-700/85 bg-slate-800 overflow-hidden shadow-xl z-10 flex items-center justify-center"
          >
            {!cameraActive && (
              <div className="absolute inset-0 bg-slate-900 flex items-center justify-center z-20">
                <VideoOff className="h-6 w-6 text-slate-600" />
              </div>
            )}
            {cameraActive && !isRealCall && (
              <div className="absolute inset-0 bg-slate-950 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase z-20">
                You (Mock)
              </div>
            )}
          </div>

          {/* Status Header Overlay */}
          <div className="p-5 z-10 bg-gradient-to-b from-black/85 to-transparent flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#35B7C9] animate-ping"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#35B7C9]">Live Telehealth Session</span>
            </div>
            <div className="text-xs font-bold bg-white/10 px-4 py-1.5 rounded-full border border-white/5 backdrop-blur-sm">
              {formatTime(callDuration)}
            </div>
          </div>

          {/* Controls Footer Overlay */}
          <div className="p-6 z-10 bg-gradient-to-t from-black/85 to-transparent flex items-center justify-center gap-4 w-full">
            {/* Mute Mic */}
            <Button 
              onClick={toggleMic}
              variant="outline" 
              size="icon" 
              className={`h-12 w-12 rounded-full border-none shadow-md transition-colors ${
                micActive ? "bg-white/10 hover:bg-white/20 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"
              }`}
            >
              {micActive ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>

            {/* Leave Call */}
            <Button 
              onClick={handleEndCall}
              className="h-12 px-8 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-lg flex items-center gap-2"
            >
              <PhoneOff className="h-5 w-5" /> Leave Consultation
            </Button>

            {/* Toggle Camera */}
            <Button 
              onClick={toggleCamera}
              variant="outline" 
              size="icon" 
              className={`h-12 w-12 rounded-full border-none shadow-md transition-colors ${
                cameraActive ? "bg-white/10 hover:bg-white/20 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"
              }`}
            >
              {cameraActive ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Consultations;
