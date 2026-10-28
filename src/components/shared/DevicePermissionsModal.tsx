import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Lock,
  Volume2,
  Sliders,
  HelpCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

interface DevicePermissionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export const DevicePermissionsModal: React.FC<DevicePermissionsModalProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [cameraStatus, setCameraStatus] = useState<"granted" | "denied" | "prompt" | "checking">("prompt");
  const [micStatus, setMicStatus] = useState<"granted" | "denied" | "prompt" | "checking">("prompt");
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState<{ cameras: MediaDeviceInfo[]; mics: MediaDeviceInfo[] }>({
    cameras: [],
    mics: [],
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Stop test media streams
  const stopMedia = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setAudioLevel(0);
  };

  // Inspect navigator.permissions where supported
  const checkInitialPermissions = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const camPerm = await navigator.permissions.query({ name: "camera" as any });
          setCameraStatus(camPerm.state as any);
          camPerm.onchange = () => setCameraStatus(camPerm.state as any);
        } catch (camErr) {
          console.debug("Camera permission check note:", camErr);
        }

        try {
          const micPerm = await navigator.permissions.query({ name: "microphone" as any });
          setMicStatus(micPerm.state as any);
          micPerm.onchange = () => setMicStatus(micPerm.state as any);
        } catch (micErr) {
          console.debug("Microphone permission check note:", micErr);
        }
      }
    } catch (e) {
      console.debug("Permission query notice:", e);
    }
  };

  // Actively test camera and microphone via getUserMedia
  const testDevicesAndRequest = async () => {
    stopMedia();
    setIsTesting(true);
    setErrorMessage(null);
    setCameraStatus("checking");
    setMicStatus("checking");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      streamRef.current = stream;
      setCameraStatus("granted");
      setMicStatus("granted");

      // Attach video preview
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      // Audio volume level analyzer
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioContextRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const normalized = Math.min(100, Math.round((avg / 128) * 100));
            setAudioLevel(normalized);
            animFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        }
      } catch (audioErr) {
        console.debug("Audio analyzer note:", audioErr);
      }

      // Enumerate hardware devices
      try {
        const devList = await navigator.mediaDevices.enumerateDevices();
        const cams = devList.filter((d) => d.kind === "videoinput");
        const mics = devList.filter((d) => d.kind === "audioinput");
        setDevices({ cameras: cams, mics });
      } catch (devErr) {
        console.debug("Device enumeration note:", devErr);
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.warn("Camera/Mic access error:", err);
      const isDenied =
        err.name === "NotAllowedError" ||
        err.name === "PermissionDeniedError" ||
        err.message?.includes("Permission denied") ||
        err.message?.includes("Permission dismissed");

      const isNotFound = err.name === "NotFoundError" || err.name === "DevicesNotFoundError";

      if (isDenied) {
        setCameraStatus("denied");
        setMicStatus("denied");
        setErrorMessage("Permission is blocked by your browser. Please follow the instructions below to enable access.");
      } else if (isNotFound) {
        setErrorMessage("No physical camera or microphone detected. Please plug in your device and re-check.");
      } else {
        setErrorMessage(`Hardware access notice: ${err.message || "Could not start camera/mic stream."}`);
      }
    } finally {
      setIsTesting(false);
    }
  };

  useEffect(() => {
    if (open) {
      checkInitialPermissions();
      testDevicesAndRequest();
    } else {
      stopMedia();
    }
    return () => {
      stopMedia();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const bothGranted = cameraStatus === "granted" && micStatus === "granted";
  const hasDenied = cameraStatus === "denied" || micStatus === "denied";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden rounded-[24px] border-none shadow-2xl bg-white max-h-[92vh] flex flex-col">
        {/* Header accent gradient */}
        <div className={`h-1.5 w-full ${bothGranted ? "bg-emerald-500" : hasDenied ? "bg-rose-500" : "bg-gradient-to-r from-blue-500 to-indigo-600"}`} />

        <div className="p-6 pb-2 border-b border-slate-100">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Sliders className="h-5 w-5 text-[#2563eb]" /> Camera & Microphone Setup
              </DialogTitle>
              {bothGranted ? (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-[10px] px-2.5 py-1 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Devices Ready
                </Badge>
              ) : hasDenied ? (
                <Badge className="bg-rose-50 text-rose-700 border-rose-200 font-bold text-[10px] px-2.5 py-1 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-rose-600" /> Permission Blocked
                </Badge>
              ) : (
                <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-bold text-[10px] px-2.5 py-1">
                  Check Required
                </Badge>
              )}
            </div>
            <DialogDescription className="text-slate-500 text-xs mt-1">
              Test your webcam video and audio input before joining live telemedicine consultations.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto max-h-[calc(92vh-150px)]">
          {/* Status Indicators */}
          <div className="grid grid-cols-2 gap-3">
            {/* Camera Badge */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                cameraStatus === "granted"
                  ? "bg-emerald-50/70 border-emerald-200"
                  : cameraStatus === "denied"
                  ? "bg-rose-50/70 border-rose-200"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                    cameraStatus === "granted"
                      ? "bg-emerald-100 text-emerald-700"
                      : cameraStatus === "denied"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {cameraStatus === "denied" ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Webcam</p>
                  <p className="text-[10px] font-semibold text-slate-500">
                    {cameraStatus === "granted"
                      ? "Allowed & Active"
                      : cameraStatus === "denied"
                      ? "Access Denied"
                      : "Checking..."}
                  </p>
                </div>
              </div>
              {cameraStatus === "granted" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : cameraStatus === "denied" ? (
                <AlertTriangle className="h-4 w-4 text-rose-600" />
              ) : null}
            </div>

            {/* Microphone Badge */}
            <div
              className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                micStatus === "granted"
                  ? "bg-emerald-50/70 border-emerald-200"
                  : micStatus === "denied"
                  ? "bg-rose-50/70 border-rose-200"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                    micStatus === "granted"
                      ? "bg-emerald-100 text-emerald-700"
                      : micStatus === "denied"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {micStatus === "denied" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Microphone</p>
                  <p className="text-[10px] font-semibold text-slate-500">
                    {micStatus === "granted"
                      ? "Allowed & Active"
                      : micStatus === "denied"
                      ? "Access Denied"
                      : "Checking..."}
                  </p>
                </div>
              </div>
              {micStatus === "granted" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : micStatus === "denied" ? (
                <AlertTriangle className="h-4 w-4 text-rose-600" />
              ) : null}
            </div>
          </div>

          {/* Live Video Preview Box */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-900 aspect-video shadow-inner flex items-center justify-center border border-slate-800">
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover -scale-x-100 ${bothGranted ? "block" : "hidden"}`}
            />

            {!bothGranted && (
              <div className="text-center p-6 text-slate-400 space-y-2">
                <div className="h-12 w-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
                  <CameraOff className="h-6 w-6" />
                </div>
                <p className="text-xs font-semibold text-slate-300">
                  {cameraStatus === "denied"
                    ? "Camera permission is blocked in your browser"
                    : "Click 'Test & Re-check' to request camera preview"}
                </p>
              </div>
            )}

            {/* Top Overlay Badge */}
            <div className="absolute top-2.5 left-2.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-white/90 font-medium flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${bothGranted ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
              Self Hardware Preview
            </div>

            {/* Mic Level Bar inside Preview */}
            {bothGranted && (
              <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-black/60 backdrop-blur-md p-2 rounded-xl flex items-center gap-2.5">
                <Volume2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <div className="flex-1 bg-slate-700/80 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-teal-300 transition-all duration-75 rounded-full"
                    style={{ width: `${Math.max(5, audioLevel)}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-emerald-300 font-bold w-7 text-right">
                  {audioLevel}%
                </span>
              </div>
            )}
          </div>

          {/* If Blocked / Denied: Step-by-Step Browser Unblock Guide */}
          {hasDenied && (
            <div className="p-4 bg-amber-50/90 border border-amber-200/90 rounded-2xl space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  <Lock className="h-4 w-4 text-amber-700" />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold text-amber-950">
                    Browser Pop-Up Disappeared or Blocked?
                  </h4>
                  <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5 font-medium">
                    Browsers only show the permission popup once. If dismissed or blocked, follow these 3 quick steps to re-enable:
                  </p>
                </div>
              </div>

              {/* Browser Selector Tabs */}
              <Tabs defaultValue="chrome" className="w-full pt-1">
                <TabsList className="grid grid-cols-4 bg-amber-100/70 p-1 rounded-xl h-8">
                  <TabsTrigger value="chrome" className="text-[10px] font-bold rounded-lg data-[state=active]:bg-white">Chrome</TabsTrigger>
                  <TabsTrigger value="edge" className="text-[10px] font-bold rounded-lg data-[state=active]:bg-white">Edge</TabsTrigger>
                  <TabsTrigger value="safari" className="text-[10px] font-bold rounded-lg data-[state=active]:bg-white">Safari</TabsTrigger>
                  <TabsTrigger value="firefox" className="text-[10px] font-bold rounded-lg data-[state=active]:bg-white">Firefox</TabsTrigger>
                </TabsList>

                <TabsContent value="chrome" className="pt-2 text-[11px] text-amber-950 space-y-1.5 font-semibold">
                  <p>1. Look at the top address bar next to <code>https://...</code></p>
                  <p>2. Click the <strong>Tune / Settings icon (🎛️ or 🔒)</strong>.</p>
                  <p>3. Toggle <strong>Camera</strong> and <strong>Microphone</strong> to <strong>"Allow"</strong>.</p>
                  <p>4. Click the <strong>"Re-check Permissions"</strong> button below.</p>
                </TabsContent>

                <TabsContent value="edge" className="pt-2 text-[11px] text-amber-950 space-y-1.5 font-semibold">
                  <p>1. Click the <strong>Lock icon (🔒)</strong> on the left side of the URL bar.</p>
                  <p>2. In the dropdown, switch <strong>Camera</strong> and <strong>Microphone</strong> to <strong>"Allow"</strong>.</p>
                  <p>3. Click <strong>"Re-check Permissions"</strong> below.</p>
                </TabsContent>

                <TabsContent value="safari" className="pt-2 text-[11px] text-amber-950 space-y-1.5 font-semibold">
                  <p>• <strong>Mac:</strong> Menu <strong>Safari</strong> → <em>Settings for This Website</em> → Set Camera & Mic to <strong>Allow</strong>.</p>
                  <p>• <strong>iPhone / iPad:</strong> Tap the <strong>"AA"</strong> icon in URL bar → <em>Website Settings</em> → Camera & Mic → <strong>Allow</strong>.</p>
                </TabsContent>

                <TabsContent value="firefox" className="pt-2 text-[11px] text-amber-950 space-y-1.5 font-semibold">
                  <p>1. Click the crossed-out camera/mic icon to the left of the address bar.</p>
                  <p>2. Clear the <strong>"Blocked Temporarily"</strong> status.</p>
                  <p>3. Click <strong>"Re-check Permissions"</strong> below.</p>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {errorMessage && !hasDenied && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Detected Hardware Info */}
          {bothGranted && (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-1">
              <p className="font-bold text-slate-700 flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" /> Verified Telehealth Hardware
              </p>
              <p className="text-[11px] text-slate-500">
                Found {devices.cameras.length} camera(s) and {devices.mics.length} audio input device(s). Ready for HD video call.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="p-4 px-6 border-t border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={testDevicesAndRequest}
            disabled={isTesting}
            className="rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-100 h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isTesting ? "animate-spin" : ""}`} />
            {isTesting ? "Testing Devices..." : "Re-check Permissions"}
          </Button>

          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className={`rounded-xl text-xs font-bold text-white shadow-sm h-9 px-5 ${
              bothGranted
                ? "bg-[#2563eb] hover:bg-blue-700"
                : "bg-slate-800 hover:bg-slate-900"
            }`}
          >
            {bothGranted ? "Ready! Close & Join" : "Done"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DevicePermissionsModal;
