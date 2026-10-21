import { useState, useEffect } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Settings,
  Bell,
  Volume2,
  Video,
  Clock,
  ShieldCheck,
  CreditCard,
  Lock,
  Save,
  CheckCircle2,
} from "lucide-react";
import { playRingtoneChime } from "@/utils/ringtone";

const DoctorSettings = () => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Clinical & System Preferences
  const [consultationFee, setConsultationFee] = useState("500");
  const [slotDuration, setSlotDuration] = useState("30");
  const [autoAcceptInstant, setAutoAcceptInstant] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [browserNotifications, setBrowserNotifications] = useState(true);
  const [telemedConsent, setTelemedConsent] = useState(true);
  const [digitalRxConsent, setDigitalRxConsent] = useState(true);

  useEffect(() => {
    const savedFee = localStorage.getItem("doctor_consult_fee");
    if (savedFee) setConsultationFee(savedFee);

    const savedSound = localStorage.getItem("doctor_sound_enabled");
    if (savedSound !== null) setSoundEnabled(savedSound === "true");

    const savedDuration = localStorage.getItem("doctor_slot_duration");
    if (savedDuration) setSlotDuration(savedDuration);
  }, []);

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem("doctor_consult_fee", consultationFee);
    localStorage.setItem("doctor_sound_enabled", String(soundEnabled));
    localStorage.setItem("doctor_slot_duration", slotDuration);

    setTimeout(() => {
      setSaving(false);
      toast({
        title: "Settings Saved",
        description: "Your consultation preferences and notification settings have been updated.",
      });
    }, 400);
  };

  const testChime = () => {
    playRingtoneChime();
    toast({ title: "Playing Telehealth Chime", description: "Synthesizing medical alert chord..." });
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14213D] flex items-center gap-2">
            <Settings className="h-6 w-6 text-[#F2052C]" /> Practice Settings & Preferences
          </h1>
          <p className="text-sm text-slate-400 font-semibold mt-0.5">
            Configure your video consultation parameters, ring alerts, and legal compliance
          </p>
        </div>

        <Button
          onClick={handleSave}
          disabled={saving}
          className="rounded-[14px] bg-[#F2052C] hover:bg-[#c90424] text-white text-xs font-bold h-9 px-5 shadow-md gap-1.5"
        >
          <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Telehealth Consultation Parameters */}
        <Card className="rounded-[24px] border-slate-100 shadow-sm bg-white/80 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-extrabold text-[#14213D] flex items-center gap-2">
              <Video className="h-4 w-4 text-[#F2052C]" /> Consultation Parameters
            </CardTitle>
            <CardDescription className="text-xs">
              Configure session duration and fee structure for patient bookings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <Label className="text-xs font-bold text-slate-600">Standard Consultation Fee (₹)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2 text-xs font-extrabold text-slate-400">₹</span>
                <Input
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(e.target.value)}
                  className="pl-7 rounded-[12px] h-9 text-xs font-black text-[#14213D]"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Displayed to patients during booking and used for automated payout calculations.
              </p>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-600">Default Slot Duration</Label>
              <Select value={slotDuration} onValueChange={setSlotDuration}>
                <SelectTrigger className="mt-1 rounded-[12px] h-9 text-xs font-bold">
                  <SelectValue placeholder="Choose duration" />
                </SelectTrigger>
                <SelectContent className="rounded-[14px]">
                  <SelectItem value="15">15 Minutes (Express Follow-up)</SelectItem>
                  <SelectItem value="30">30 Minutes (Standard Clinical Review)</SelectItem>
                  <SelectItem value="45">45 Minutes (Comprehensive Assessment)</SelectItem>
                  <SelectItem value="60">60 Minutes (Specialist Consultation)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-[16px] bg-slate-50 border border-slate-100">
              <div>
                <p className="text-xs font-bold text-[#14213D]">Auto-Accept Instant Calls</p>
                <p className="text-[11px] text-slate-400">
                  Automatically connect when an instant consultation is initiated while online
                </p>
              </div>
              <Switch checked={autoAcceptInstant} onCheckedChange={setAutoAcceptInstant} />
            </div>
          </CardContent>
        </Card>

        {/* Real-time Alerts & Ringtone */}
        <Card className="rounded-[24px] border-slate-100 shadow-sm bg-white/80 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-extrabold text-[#14213D] flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-[#35B7C9]" /> Incoming Call Ringtone & Audio
            </CardTitle>
            <CardDescription className="text-xs">
              Synthesized medical chime alerts for incoming patient consultations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between p-3 rounded-[16px] bg-slate-50 border border-slate-100">
              <div>
                <p className="text-xs font-bold text-[#14213D]">Telehealth Ringtone Chime</p>
                <p className="text-[11px] text-slate-400">Play continuous medical chord chime when a patient calls</p>
              </div>
              <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-[16px] bg-slate-50 border border-slate-100">
              <div>
                <p className="text-xs font-bold text-[#14213D]">Browser Push Notifications</p>
                <p className="text-[11px] text-slate-400">Alert on patient arrival even when browser tab is inactive</p>
              </div>
              <Switch checked={browserNotifications} onCheckedChange={setBrowserNotifications} />
            </div>

            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={testChime}
                className="w-full rounded-[14px] border-slate-200 text-xs font-bold h-9 gap-2 hover:bg-slate-50"
              >
                <Volume2 className="h-4 w-4 text-[#35B7C9]" /> Test Synthesizer Ringtone
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Telemedicine Compliance & Legal Consent */}
        <Card className="rounded-[24px] border-slate-100 shadow-sm bg-white/80 backdrop-blur-md md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-extrabold text-[#14213D] flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Regulatory Telemedicine Compliance
            </CardTitle>
            <CardDescription className="text-xs">
              Statutory agreements under Medical Council Telemedicine Practice Guidelines
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-[16px] bg-emerald-50/50 border border-emerald-100">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-emerald-950">
                    Telemedicine Practice Guidelines Compliance (NMC/MCI)
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    Active consent to adhere to statutory standards of patient evaluation, prescription protocols, and records retention.
                  </p>
                </div>
              </div>
              <Switch checked={telemedConsent} onCheckedChange={setTelemedConsent} />
            </div>

            <div className="flex items-center justify-between p-3 rounded-[16px] bg-emerald-50/50 border border-emerald-100">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-emerald-950">
                    Digital Prescription Signature & Audit Authorization
                  </p>
                  <p className="text-[11px] text-emerald-800">
                    Consent to generate cryptographically timestamped digital prescriptions bearing your registered medical credentials.
                  </p>
                </div>
              </div>
              <Switch checked={digitalRxConsent} onCheckedChange={setDigitalRxConsent} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DoctorSettings;
