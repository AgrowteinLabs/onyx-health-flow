import { useState, useEffect } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSignature,
  Plus,
  Download,
  RefreshCw,
  Pill,
  Calendar,
  User,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listBookings } from "@/services/booking.service";
import { createPrescription } from "@/services/doctor.service";

interface Prescription {
  id: number;
  patient: string;
  avatar: string;
  medications: { name: string; dosage: string; frequency: string }[];
  duration: string;
  issuedDate: string;
  refillStatus: "none" | "requested" | "approved";
  notes: string;
}

const PRESCRIPTIONS: Prescription[] = [
  {
    id: 1,
    patient: "John Smith",
    avatar: "JS",
    medications: [
      { name: "Lisinopril", dosage: "10mg", frequency: "Once daily" },
      { name: "Amlodipine", dosage: "5mg", frequency: "Once daily" },
    ],
    duration: "30 days",
    issuedDate: "Jun 10, 2026",
    refillStatus: "requested",
    notes: "Take with food. Monitor BP daily.",
  },
  {
    id: 2,
    patient: "Sarah Johnson",
    avatar: "SJ",
    medications: [{ name: "Metformin", dosage: "850mg", frequency: "Twice daily" }],
    duration: "90 days",
    issuedDate: "Jun 8, 2026",
    refillStatus: "none",
    notes: "Take with meals to reduce GI side effects.",
  },
  {
    id: 3,
    patient: "Michael Chen",
    avatar: "MC",
    medications: [
      { name: "Salbutamol", dosage: "100mcg", frequency: "As needed" },
      { name: "Fluticasone", dosage: "250mcg", frequency: "Twice daily" },
    ],
    duration: "60 days",
    issuedDate: "Jun 5, 2026",
    refillStatus: "approved",
    notes: "Rinse mouth after Fluticasone. Carry rescue inhaler.",
  },
  {
    id: 4,
    patient: "Emma Davis",
    avatar: "ED",
    medications: [
      { name: "Aspirin", dosage: "75mg", frequency: "Once daily" },
      { name: "Atorvastatin", dosage: "40mg", frequency: "Once at night" },
      { name: "Clopidogrel", dosage: "75mg", frequency: "Once daily" },
    ],
    duration: "180 days",
    issuedDate: "Jun 11, 2026",
    refillStatus: "none",
    notes: "Critical: Do not skip doses. Report any bleeding immediately.",
  },
];

const REFILL_CONFIG = {
  none:      { icon: Clock,        text: "text-slate-400",  bg: "bg-slate-50",   border: "border-slate-200", label: "No Refill" },
  requested: { icon: AlertCircle,  text: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-100", label: "Refill Requested" },
  approved:  { icon: CheckCircle2, text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", label: "Refill Approved" },
};

const Prescriptions = () => {
  const { toast } = useToast();
  const [prescriptions, setPrescriptions] = useState(PRESCRIPTIONS);
  const [issueOpen, setIssueOpen] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [newRx, setNewRx] = useState({
    patient: "",
    medication: "",
    dosage: "",
    frequency: "Once daily",
    duration: "30 days",
    notes: "",
  });

  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);

  const fetchBookings = async () => {
    try {
      const list = await listBookings();
      setBookings(list || []);
    } catch (err) {
      console.error("Failed to load bookings", err);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleIssue = async () => {
    if (!newRx.patient || !newRx.medication) return;

    try {
      const bookingId = selectedBooking?._id || selectedBooking?.id;
      const profileId = selectedBooking?.profileId || selectedBooking?.profile?._id || selectedBooking?.userId?._id;
      
      if (bookingId) {
        await createPrescription({
          bookingId,
          profileId,
          medications: [{ name: newRx.medication, dosage: newRx.dosage, frequency: newRx.frequency }],
          instructions: newRx.notes,
          notes: newRx.notes
        });
        toast({ title: "Prescription issued successfully!" });
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: "Saved locally (offline mode)", description: err.message });
    }

    const id = Date.now();
    setPrescriptions((prev) => [
      {
        id,
        patient: newRx.patient,
        avatar: newRx.patient.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase(),
        medications: [{ name: newRx.medication, dosage: newRx.dosage, frequency: newRx.frequency }],
        duration: newRx.duration,
        issuedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        refillStatus: "none",
        notes: newRx.notes,
      },
      ...prev,
    ]);
    setIssueOpen(false);
    setSelectedBooking(null);
    setNewRx({ patient: "", medication: "", dosage: "", frequency: "Once daily", duration: "30 days", notes: "" });
  };

  const handleApproveRefill = (id: number) => {
    setPrescriptions((prev) =>
      prev.map((rx) => (rx.id === id ? { ...rx, refillStatus: "approved" } : rx))
    );
  };

  const preview = prescriptions.find((rx) => rx.id === previewId);

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14213D] flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-[#F2052C]" /> Prescriptions
          </h1>
          <p className="text-sm text-slate-400 font-semibold mt-0.5">
            {prescriptions.length} issued · {prescriptions.filter((r) => r.refillStatus === "requested").length} refill requests pending
          </p>
        </div>
        <Button
          onClick={() => setIssueOpen(true)}
          className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white rounded-[14px] border-none shadow-md shadow-[#F2052C]/20 hover:opacity-90 h-9"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Issue Prescription
        </Button>
      </div>

      {/* Refill Requests Alert */}
      {prescriptions.some((rx) => rx.refillStatus === "requested") && (
        <div className="bg-amber-50 border border-amber-100 rounded-[20px] p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm font-bold text-amber-700 flex-1">
            {prescriptions.filter((rx) => rx.refillStatus === "requested").length} patient(s) have requested a prescription refill.
          </p>
          <button className="text-xs font-extrabold text-amber-600 hover:opacity-70 underline">Review All</button>
        </div>
      )}

      {/* Prescription Cards */}
      {prescriptions.length === 0 ? (
        <EmptyState icon={FileSignature} title="No prescriptions issued" description="Issue prescriptions to your patients and they will appear here." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {prescriptions.map((rx) => {
            const rc = REFILL_CONFIG[rx.refillStatus];
            const RefillIcon = rc.icon;
            return (
              <div
                key={rx.id}
                className="hover-lift bg-white/60 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm p-5 group"
              >
                {/* Patient Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-gradient-to-br from-[#14213D] to-[#1e2d4a] flex items-center justify-center text-white font-extrabold text-sm shadow-md">
                      {rx.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-extrabold text-[#14213D]">{rx.patient}</p>
                      <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <Calendar className="h-2.5 w-2.5" /> Issued {rx.issuedDate}
                      </p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${rc.bg} ${rc.text} ${rc.border}`}>
                    <RefillIcon className="h-3 w-3" /> {rc.label}
                  </span>
                </div>

                {/* Medications */}
                <div className="space-y-2 mb-4">
                  {rx.medications.map((med, i) => (
                    <div key={i} className="flex items-center gap-3 bg-slate-50/60 rounded-[14px] px-3 py-2">
                      <div className="h-7 w-7 rounded-[10px] bg-[#F2052C]/8 flex items-center justify-center shrink-0">
                        <Pill className="h-3.5 w-3.5 text-[#F2052C]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-extrabold text-[#14213D] truncate">{med.name}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{med.dosage} · {med.frequency}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Duration + Notes */}
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-500">Duration: {rx.duration}</span>
                </div>
                {rx.notes && (
                  <p className="text-xs text-slate-400 font-semibold bg-slate-50/60 rounded-[12px] px-3 py-2 mb-4 leading-relaxed">
                    📝 {rx.notes}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewId(rx.id)}
                    className="flex-1 h-8 text-xs font-bold rounded-[12px] text-[#14213D] hover:bg-slate-100"
                  >
                    <FileSignature className="h-3.5 w-3.5 mr-1" /> View Rx
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 h-8 text-xs font-bold rounded-[12px] text-[#35B7C9] hover:bg-[#35B7C9]/8"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" /> Download
                  </Button>
                  {rx.refillStatus === "requested" && (
                    <Button
                      size="sm"
                      onClick={() => handleApproveRefill(rx.id)}
                      className="flex-1 h-8 text-xs font-bold rounded-[12px] bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200"
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" /> Approve
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Issue Prescription Dialog */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-[24px] border-none shadow-2xl bg-white/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-[#14213D] flex items-center gap-2">
              <Pill className="h-5 w-5 text-[#F2052C]" /> Issue New Prescription
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">Patient Appointment *</Label>
              {bookings.length > 0 ? (
                <select
                  onChange={(e) => {
                    const bId = e.target.value;
                    const b = bookings.find((bk) => (bk._id || bk.id) === bId);
                    if (b) {
                      setSelectedBooking(b);
                      setNewRx({
                        ...newRx,
                        patient: b.patient?.name || b.profile?.name || b.userId?.name || "Patient"
                      });
                    } else {
                      setSelectedBooking(null);
                      setNewRx({ ...newRx, patient: "" });
                    }
                  }}
                  value={selectedBooking ? (selectedBooking._id || selectedBooking.id) : ""}
                  className="w-full rounded-xl border border-slate-200 bg-white h-10 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-semibold text-slate-800"
                >
                  <option value="">-- Select Patient Booking --</option>
                  {bookings.map((b) => {
                    const pName = b.patient?.name || b.profile?.name || b.userId?.name || "Patient";
                    const dateStr = b.slotDate ? new Date(b.slotDate).toLocaleDateString() : "—";
                    return (
                      <option key={b._id || b.id} value={b._id || b.id}>
                        {pName} ({b.status || "Confirmed"} - {dateStr})
                      </option>
                    );
                  })}
                </select>
              ) : (
                <Input
                  value={newRx.patient}
                  onChange={(e) => setNewRx({ ...newRx, patient: e.target.value })}
                  placeholder="Patient full name"
                  className="rounded-[14px] border-slate-200 h-10"
                />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">Medication</Label>
                <Input
                  value={newRx.medication}
                  onChange={(e) => setNewRx({ ...newRx, medication: e.target.value })}
                  placeholder="Drug name"
                  className="rounded-[14px] border-slate-200 h-10"
                />
              </div>
              <div>
                <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">Dosage</Label>
                <Input
                  value={newRx.dosage}
                  onChange={(e) => setNewRx({ ...newRx, dosage: e.target.value })}
                  placeholder="e.g. 500mg"
                  className="rounded-[14px] border-slate-200 h-10"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">Frequency</Label>
                <Select value={newRx.frequency} onValueChange={(v) => setNewRx({ ...newRx, frequency: v })}>
                  <SelectTrigger className="rounded-[14px] border-slate-200 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Once daily">Once daily</SelectItem>
                    <SelectItem value="Twice daily">Twice daily</SelectItem>
                    <SelectItem value="Three times daily">Three times daily</SelectItem>
                    <SelectItem value="As needed">As needed</SelectItem>
                    <SelectItem value="Once at night">Once at night</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">Duration</Label>
                <Select value={newRx.duration} onValueChange={(v) => setNewRx({ ...newRx, duration: v })}>
                  <SelectTrigger className="rounded-[14px] border-slate-200 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7 days">7 days</SelectItem>
                    <SelectItem value="14 days">14 days</SelectItem>
                    <SelectItem value="30 days">30 days</SelectItem>
                    <SelectItem value="60 days">60 days</SelectItem>
                    <SelectItem value="90 days">90 days</SelectItem>
                    <SelectItem value="180 days">180 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">Instructions / Notes</Label>
              <Textarea
                value={newRx.notes}
                onChange={(e) => setNewRx({ ...newRx, notes: e.target.value })}
                placeholder="Additional instructions for patient..."
                className="rounded-[14px] border-slate-200 resize-none min-h-[80px] text-sm"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setIssueOpen(false)} className="flex-1 rounded-[14px] h-10 font-bold border-slate-200">
                Cancel
              </Button>
              <Button
                onClick={handleIssue}
                disabled={!newRx.patient || !newRx.medication}
                className="flex-1 rounded-[14px] h-10 font-bold bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white border-none shadow-md"
              >
                <FileSignature className="h-4 w-4 mr-1.5" /> Issue Rx
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Prescription Preview Dialog */}
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreviewId(null)}>
        <DialogContent className="sm:max-w-[460px] rounded-[24px] border-none shadow-2xl bg-white/95 backdrop-blur-xl">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-extrabold text-[#14213D]">Prescription Preview</DialogTitle>
              </DialogHeader>
              {/* Rx Card styled like a prescription slip */}
              <div className="mt-2 rounded-[20px] border-2 border-[#14213D]/8 bg-[#f9fafb] overflow-hidden">
                {/* Header Band */}
                <div className="bg-gradient-to-r from-[#14213D] to-[#1e3a5f] p-5 text-white">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-white/50">Rx</span>
                    <span className="text-[10px] font-bold text-white/50">{preview.issuedDate}</span>
                  </div>
                  <p className="text-lg font-extrabold">{preview.patient}</p>
                  <p className="text-xs text-white/60 font-semibold">Issued by Dr. {localStorage.getItem("userName") || "Your Name"}</p>
                </div>
                <div className="p-5 space-y-3">
                  {preview.medications.map((med, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Pill className="h-4 w-4 text-[#F2052C] mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-extrabold text-[#14213D]">{med.name} <span className="font-bold text-slate-500">{med.dosage}</span></p>
                        <p className="text-xs text-slate-400 font-semibold">{med.frequency} · {preview.duration}</p>
                      </div>
                    </div>
                  ))}
                  {preview.notes && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500 italic">{preview.notes}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="outline" onClick={() => setPreviewId(null)} className="flex-1 rounded-[14px] h-10 font-bold border-slate-200">
                  Close
                </Button>
                <Button className="flex-1 rounded-[14px] h-10 font-bold bg-gradient-to-r from-[#14213D] to-[#1e3a5f] text-white border-none">
                  <Download className="h-4 w-4 mr-1.5" /> Download PDF
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Prescriptions;
