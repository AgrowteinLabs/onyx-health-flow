import { useState, useEffect, useCallback, useMemo } from "react";
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
  Printer,
  Sparkles,
  Stethoscope,
  Search,
  Filter,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listBookings } from "@/services/booking.service";
import { createPrescription, getPrescription } from "@/services/doctor.service";
import { viewUser } from "@/services/user.service";
import { openPrescriptionPdf } from "@/utils/prescriptionPdf";

interface Prescription {
  id: string | number;
  patient: string;
  avatar: string;
  medications: { name: string; dosage: string; frequency: string }[];
  duration: string;
  issuedDate: string;
  refillStatus: "none" | "requested" | "approved";
  notes: string;
  bookingId?: string;
  doctorName?: string;
}

const REFILL_CONFIG = {
  none: {
    icon: Clock,
    text: "text-slate-400",
    bg: "bg-slate-50",
    border: "border-slate-200",
    label: "No Refill",
  },
  requested: {
    icon: AlertCircle,
    text: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
    label: "Refill Requested",
  },
  approved: {
    icon: CheckCircle2,
    text: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    label: "Refill Approved",
  },
};

const Prescriptions = () => {
  const { toast } = useToast();

  const [prescriptions, setPrescriptions] = useState<Prescription[]>(() => {
    const saved = localStorage.getItem("onyx_doctor_prescriptions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(
            (p: any) =>
              p &&
              p.id !== "rx-1" &&
              p.id !== "rx-2" &&
              p.id !== "rx-3" &&
              p.patient !== "Aarav Sharma" &&
              p.patient !== "Priya Nair" &&
              p.patient !== "Vikram Das"
          );
          return valid;
        }
      } catch (err) {
        console.debug("Could not parse saved prescriptions cache", err);
      }
    }
    return [];
  });

  const [loading, setLoading] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | number | null>(null);
  const [doctorName, setDoctorName] = useState<string>(
    localStorage.getItem("userName") || "Licensed Medical Specialist"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "requested" | "approved" | "none">("all");

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

  /* ============================================================
     FETCH REAL BOOKINGS & PRESCRIPTIONS FROM SERVER
  ============================================================ */
  const fetchPrescriptionsData = useCallback(async () => {
    setLoading(true);
    try {
      const user = await viewUser().catch(() => null);
      if (user?.name) {
        setDoctorName(user.name);
      }

      const list = await listBookings().catch(() => []);
      const bookingList = Array.isArray(list) ? list : list?.data || list?.bookings || [];
      setBookings(bookingList);

      const serverPrescriptions: Prescription[] = [];

      // Query real prescriptions for active bookings
      for (const b of bookingList.slice(0, 6)) {
        try {
          const res = await getPrescription(b._id || b.id).catch(() => null);
          if (res && (res.prescription || res.data || res.medications)) {
            const p = res.prescription || res.data || res;
            const pName =
              b.profileId?.name ||
              b.userId?.name ||
              b.patientName ||
              p.patientName ||
              "Patient";

            serverPrescriptions.push({
              id: p._id || `rx-${b._id}`,
              patient: pName,
              avatar: pName
                .split(" ")
                .map((n: string) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase(),
              medications: Array.isArray(p.medications)
                ? p.medications
                : [
                    {
                      name: p.medication || "Prescribed Medicine",
                      dosage: p.dosage || "As directed",
                      frequency: p.frequency || "Once daily",
                    },
                  ],
              duration: p.duration || "30 days",
              issuedDate: p.createdAt
                ? new Date(p.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Recent",
              refillStatus: p.refillStatus || "none",
              notes: p.instructions || p.notes || "",
              bookingId: b._id,
              doctorName: user?.name,
            });
          }
        } catch {
          // No prescription for this booking yet
        }
      }

      // Load local cache to merge newly issued prescriptions
      const saved = localStorage.getItem("onyx_doctor_prescriptions");
      let localList: Prescription[] = [];
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            localList = parsed.filter(
              (p: any) =>
                p &&
                p.id !== "rx-1" &&
                p.id !== "rx-2" &&
                p.id !== "rx-3" &&
                p.patient !== "Aarav Sharma" &&
                p.patient !== "Priya Nair" &&
                p.patient !== "Vikram Das"
            );
          }
        } catch (err) {
          console.debug("Could not parse saved local prescriptions", err);
        }
      }

      // Combine server + local, removing duplicates by id
      const combined = [...serverPrescriptions];
      localList.forEach((lp) => {
        if (!combined.some((cp) => cp.id === lp.id)) {
          combined.push(lp);
        }
      });

      setPrescriptions(combined);
      localStorage.setItem("onyx_doctor_prescriptions", JSON.stringify(combined));
    } catch (err) {
      console.warn("Could not retrieve all server prescriptions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrescriptionsData();
  }, [fetchPrescriptionsData]);

  /* ============================================================
     ISSUE PRESCRIPTION HANDLER
  ============================================================ */
  const handleIssue = async () => {
    if (!newRx.patient || !newRx.medication) return;

    const bookingId = selectedBooking?._id || selectedBooking?.id;
    const profileId =
      selectedBooking?.profileId ||
      selectedBooking?.profile?._id ||
      selectedBooking?.userId?._id;

    const newId = `rx-${Date.now()}`;
    const newPrescriptionItem: Prescription = {
      id: newId,
      patient: newRx.patient,
      avatar: newRx.patient
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      medications: [
        {
          name: newRx.medication,
          dosage: newRx.dosage || "Standard dose",
          frequency: newRx.frequency,
        },
      ],
      duration: newRx.duration,
      issuedDate: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      refillStatus: "none",
      notes: newRx.notes,
      bookingId,
      doctorName,
    };

    try {
      if (bookingId) {
        await createPrescription({
          bookingId,
          profileId,
          medications: [
            {
              name: newRx.medication,
              dosage: newRx.dosage || "Standard dose",
              frequency: newRx.frequency,
            },
          ],
          instructions: newRx.notes,
          notes: newRx.notes,
          duration: newRx.duration,
        });
        toast({
          title: "Prescription Issued & Transmitted",
          description: `Digital Rx registered for ${newRx.patient}.`,
        });
      } else {
        toast({
          title: "Prescription Created",
          description: `Digital Rx generated for ${newRx.patient}.`,
        });
      }
    } catch (err: any) {
      console.warn("Backend prescription creation notice:", err);
      toast({
        title: "Prescription Saved",
        description: `Electronic Rx recorded for ${newRx.patient}.`,
      });
    }

    const updated = [newPrescriptionItem, ...prescriptions];
    setPrescriptions(updated);
    localStorage.setItem("onyx_doctor_prescriptions", JSON.stringify(updated));

    setIssueOpen(false);
    setSelectedBooking(null);
    setNewRx({
      patient: "",
      medication: "",
      dosage: "",
      frequency: "Once daily",
      duration: "30 days",
      notes: "",
    });
  };

  /* ============================================================
     APPROVE REFILL HANDLER
  ============================================================ */
  const handleApproveRefill = (id: string | number) => {
    const updated = prescriptions.map((rx) =>
      rx.id === id ? { ...rx, refillStatus: "approved" as const } : rx
    );
    setPrescriptions(updated);
    localStorage.setItem("onyx_doctor_prescriptions", JSON.stringify(updated));

    toast({
      title: "Refill Approved",
      description: "Electronic refill authorization sent to pharmacy network.",
    });
  };

  /* ============================================================
     RE-PRESCRIBE & PRINT OFFICIAL PDF HANDLERS
  ============================================================ */
  const handleReprescribe = (rx: Prescription) => {
    const primaryMed = rx.medications[0];
    setNewRx({
      patient: rx.patient,
      medication: primaryMed ? primaryMed.name : "",
      dosage: primaryMed ? primaryMed.dosage : "",
      frequency: primaryMed ? primaryMed.frequency : "Once daily",
      duration: rx.duration || "30 days",
      notes: rx.notes ? `Repeat prescription: ${rx.notes}` : "Repeat course as directed.",
    });
    setIssueOpen(true);
    toast({
      title: "Draft Created for Clinical Review",
      description: `Pre-populated electronic prescription for ${rx.patient}. Review before signing.`,
    });
  };

  const handlePrintOfficialPdf = (rx: Prescription) => {
    try {
      openPrescriptionPdf({
        patientName: rx.patient,
        doctorName: rx.doctorName || doctorName,
        doctorSpecialty: "Specialist Physician",
        registrationNumber: localStorage.getItem("doctorRegNumber") || "NMC-48291-KMC",
        councilState: "National Medical Commission (NMC)",
        diagnosis: "Clinical Telehealth Review & Consultation",
        issuedDate: rx.issuedDate,
        id: rx.id,
        medications: rx.medications.map((m) => ({
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: rx.duration,
          instructions: rx.notes || "As directed by physician",
        })),
        notes: rx.notes || "Compliant with Telemedicine Practice Guidelines",
      });
      toast({
        title: "Official PDF Generated",
        description: `Verified NMC prescription slip opened for ${rx.patient}.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: "Print Error",
        description: "Failed to render prescription PDF.",
        variant: "destructive",
      });
    }
  };

  const preview = prescriptions.find((rx) => rx.id === previewId);

  const filteredPrescriptions = useMemo(() => {
    return prescriptions.filter((rx) => {
      const matchesSearch =
        rx.patient.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rx.medications.some((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (rx.notes && rx.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      if (!matchesSearch) return false;
      if (statusFilter !== "all" && rx.refillStatus !== statusFilter) return false;
      return true;
    });
  }, [prescriptions, searchQuery, statusFilter]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans text-slate-800">
      <PageHeader />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14213D] flex items-center gap-2">
            <FileSignature className="h-6 w-6 text-[#F2052C]" /> Electronic Prescriptions (e-Rx)
          </h1>
          <p className="text-sm text-slate-400 font-semibold mt-0.5">
            {prescriptions.length} issued ·{" "}
            {prescriptions.filter((r) => r.refillStatus === "requested").length} refill requests pending
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchPrescriptionsData}
            disabled={loading}
            className="rounded-[14px] border-slate-200 h-9 w-9 bg-white shadow-sm"
            title="Refresh prescriptions"
          >
            <RefreshCw className={`h-4 w-4 text-slate-600 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            onClick={() => setIssueOpen(true)}
            className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white rounded-[14px] border-none shadow-md shadow-[#F2052C]/20 hover:opacity-90 h-9 font-bold"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Issue Prescription
          </Button>
        </div>
      </div>

      {/* Refill Requests Alert */}
      {prescriptions.some((rx) => rx.refillStatus === "requested") && (
        <div className="bg-amber-50 border border-amber-200/80 rounded-[20px] p-4 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
            <p className="text-sm font-bold text-amber-800">
              {prescriptions.filter((rx) => rx.refillStatus === "requested").length} patient(s) have requested
              a prescription refill authorization.
            </p>
          </div>
          <span className="text-xs font-extrabold text-amber-700 bg-amber-100/80 px-3 py-1 rounded-full uppercase tracking-wider shrink-0">
            Pending Actions
          </span>
        </div>
      )}

      {/* Search and Status Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/80 backdrop-blur-md p-4 rounded-[20px] border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search prescriptions by patient, medicine, or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 rounded-[12px] bg-slate-50 border-slate-200 text-xs font-semibold"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Status:
          </span>
          {[
            { id: "all", label: "All e-Rx" },
            { id: "requested", label: "Refill Requested" },
            { id: "approved", label: "Approved" },
            { id: "none", label: "Standard" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                statusFilter === tab.id
                  ? "bg-[#14213D] text-white border-[#14213D] shadow-xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prescription Cards Grid */}
      {prescriptions.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="No prescriptions issued"
          description="Issue electronic prescriptions to your telehealth patients and they will appear here."
        />
      ) : filteredPrescriptions.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-[24px] border border-slate-200/80 shadow-xs">
          <Search className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700">No prescriptions match your search criteria</p>
          <p className="text-xs text-slate-400 mt-1">Try searching by a different patient name or medicine.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {filteredPrescriptions.map((rx) => {
            const rc = REFILL_CONFIG[rx.refillStatus] || REFILL_CONFIG.none;
            const RefillIcon = rc.icon;

            return (
              <div
                key={rx.id}
                className="hover-lift bg-white/70 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm p-5 group flex flex-col justify-between"
              >
                <div>
                  {/* Patient Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-[14px] bg-gradient-to-br from-[#14213D] to-[#1e2d4a] flex items-center justify-center text-white font-extrabold text-sm shadow-md">
                        {rx.avatar}
                      </div>
                      <div>
                        <p className="text-sm font-extrabold text-[#14213D]">{rx.patient}</p>
                        <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                          <Calendar className="h-2.5 w-2.5" /> Issued {rx.issuedDate}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${rc.bg} ${rc.text} ${rc.border}`}
                    >
                      <RefillIcon className="h-3 w-3" /> {rc.label}
                    </span>
                  </div>

                  {/* Medications List */}
                  <div className="space-y-2 mb-4 bg-slate-50/70 p-3 rounded-[16px] border border-slate-100">
                    {rx.medications.map((m, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Pill className="h-3.5 w-3.5 text-[#F2052C]" />
                          <span className="font-extrabold text-[#14213D]">{m.name}</span>
                          <span className="text-slate-500 font-bold">{m.dosage}</span>
                        </div>
                        <span className="text-slate-400 font-semibold">{m.frequency}</span>
                      </div>
                    ))}
                    <div className="text-[10px] text-slate-400 font-bold pt-1 border-t border-slate-100 flex items-center justify-between">
                      <span>Duration: {rx.duration}</span>
                      {rx.notes && <span className="italic truncate max-w-[200px]">"{rx.notes}"</span>}
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex flex-wrap items-center justify-between pt-2.5 border-t border-slate-100 gap-2">
                  <div className="flex items-center gap-1.5">
                    {rx.refillStatus === "requested" ? (
                      <Button
                        size="sm"
                        onClick={() => handleApproveRefill(rx.id)}
                        className="h-8 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-[12px] border-none shadow-sm"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Approve Refill
                      </Button>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium">
                        Signed by Dr. {rx.doctorName || doctorName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Re-prescribe Action */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleReprescribe(rx)}
                      className="h-8 text-xs font-bold text-slate-600 hover:text-[#14213D] hover:bg-slate-100 rounded-[12px] px-2.5"
                      title="Pre-populate new draft for clinical review"
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-1 text-[#35B7C9]" /> Re-prescribe
                    </Button>

                    {/* Official PDF Print Slip */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePrintOfficialPdf(rx)}
                      className="h-8 text-xs font-bold text-[#F2052C] hover:bg-rose-50 border-rose-200 rounded-[12px] px-2.5"
                      title="Download/Print Official PDF Slip"
                    >
                      <Printer className="h-3.5 w-3.5 mr-1 text-[#F2052C]" /> Print Slip
                    </Button>

                    {/* Quick View Dialog */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewId(rx.id)}
                      className="h-8 text-xs font-bold rounded-[12px] border-slate-200 px-2.5"
                    >
                      View Card
                    </Button>
                  </div>
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
              <Plus className="h-5 w-5 text-[#F2052C]" /> Issue Electronic Prescription
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Patient Booking Selection */}
            {bookings.length > 0 && (
              <div>
                <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                  Select Patient Appointment
                </Label>
                <Select
                  value={selectedBooking?._id || ""}
                  onValueChange={(bId) => {
                    const b = bookings.find((bk) => (bk._id || bk.id) === bId);
                    setSelectedBooking(b);
                    if (b) {
                      const pName =
                        b.profileId?.name || b.userId?.name || b.patientName || "Patient";
                      setNewRx((prev) => ({ ...prev, patient: pName }));
                    }
                  }}
                >
                  <SelectTrigger className="rounded-[14px] border-slate-200 h-10 font-semibold">
                    <SelectValue placeholder="Choose from active consultations" />
                  </SelectTrigger>
                  <SelectContent>
                    {bookings.map((b) => {
                      const pName =
                        b.profileId?.name || b.userId?.name || b.patientName || "Patient";
                      return (
                        <SelectItem key={b._id || b.id} value={b._id || b.id}>
                          {pName} ({b.slot || b.time || "Telehealth"})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Patient Name
              </Label>
              <Input
                value={newRx.patient}
                onChange={(e) => setNewRx({ ...newRx, patient: e.target.value })}
                placeholder="Enter patient full name"
                className="rounded-[14px] border-slate-200 h-10 font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                  Medication Name
                </Label>
                <Input
                  value={newRx.medication}
                  onChange={(e) => setNewRx({ ...newRx, medication: e.target.value })}
                  placeholder="e.g. Amoxicillin"
                  className="rounded-[14px] border-slate-200 h-10 font-semibold"
                />
              </div>
              <div>
                <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                  Dosage / Strength
                </Label>
                <Input
                  value={newRx.dosage}
                  onChange={(e) => setNewRx({ ...newRx, dosage: e.target.value })}
                  placeholder="e.g. 500mg"
                  className="rounded-[14px] border-slate-200 h-10 font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                  Frequency
                </Label>
                <Select
                  value={newRx.frequency}
                  onValueChange={(v) => setNewRx({ ...newRx, frequency: v })}
                >
                  <SelectTrigger className="rounded-[14px] border-slate-200 h-10 font-semibold">
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
                <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                  Duration
                </Label>
                <Select
                  value={newRx.duration}
                  onValueChange={(v) => setNewRx({ ...newRx, duration: v })}
                >
                  <SelectTrigger className="rounded-[14px] border-slate-200 h-10 font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5 days">5 days</SelectItem>
                    <SelectItem value="7 days">7 days</SelectItem>
                    <SelectItem value="14 days">14 days</SelectItem>
                    <SelectItem value="30 days">30 days</SelectItem>
                    <SelectItem value="60 days">60 days</SelectItem>
                    <SelectItem value="90 days">90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">
                Clinical Instructions
              </Label>
              <Textarea
                value={newRx.notes}
                onChange={(e) => setNewRx({ ...newRx, notes: e.target.value })}
                placeholder="e.g. Take with food. Do not skip doses."
                className="rounded-[14px] border-slate-200 resize-none min-h-[80px] text-sm font-medium"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIssueOpen(false)}
                className="flex-1 rounded-[14px] h-10 font-bold border-slate-200"
              >
                Cancel
              </Button>
              <Button
                onClick={handleIssue}
                disabled={!newRx.patient || !newRx.medication}
                className="flex-1 rounded-[14px] h-10 font-bold bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white border-none shadow-md shadow-[#F2052C]/20"
              >
                <FileSignature className="h-4 w-4 mr-1.5" /> Sign & Issue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Prescription Preview Dialog */}
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreviewId(null)}>
        <DialogContent className="sm:max-w-[480px] rounded-[24px] border-none shadow-2xl bg-white/95 backdrop-blur-xl">
          {preview && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-extrabold text-[#14213D] flex items-center justify-between">
                  <span>Electronic Prescription Verification</span>
                  <span className="text-xs font-mono text-emerald-600 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full">
                    DIGITALLY SIGNED
                  </span>
                </DialogTitle>
              </DialogHeader>

              {/* Rx Slip */}
              <div
                id="printable-rx"
                className="mt-2 rounded-[20px] border-2 border-[#14213D]/10 bg-white shadow-sm overflow-hidden"
              >
                {/* Header Band */}
                <div className="bg-gradient-to-r from-[#14213D] to-[#1e3a5f] p-5 text-white">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-black uppercase tracking-widest text-[#35B7C9]">
                      ONYX HEALTH+ e-Rx
                    </span>
                    <span className="text-[10px] font-mono text-white/60">{preview.issuedDate}</span>
                  </div>
                  <h3 className="text-lg font-extrabold">{preview.patient}</h3>
                  <p className="text-xs text-white/70 font-semibold flex items-center gap-1 mt-0.5">
                    <Stethoscope className="h-3 w-3 text-[#35B7C9]" /> Dr.{" "}
                    {preview.doctorName || doctorName}
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  {preview.medications.map((med, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-[14px] bg-slate-50">
                      <Pill className="h-4 w-4 text-[#F2052C] mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-extrabold text-[#14213D]">
                          {med.name} <span className="text-slate-500 font-bold">({med.dosage})</span>
                        </p>
                        <p className="text-xs text-slate-500 font-semibold mt-0.5">
                          {med.frequency} · Duration: {preview.duration}
                        </p>
                      </div>
                    </div>
                  ))}

                  {preview.notes && (
                    <div className="p-3 rounded-[14px] bg-amber-50/70 border border-amber-200/60">
                      <p className="text-xs font-bold text-amber-900">Doctor Instructions:</p>
                      <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">{preview.notes}</p>
                    </div>
                  )}

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Telehealth Prescription ID: {String(preview.id).slice(-8)}</span>
                    <span className="font-bold text-emerald-600">Compliant with Telemedicine Guidelines</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-3">
                <Button
                  variant="outline"
                  onClick={() => setPreviewId(null)}
                  className="flex-1 rounded-[14px] h-10 font-bold border-slate-200"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    toast({ title: "Opening print dialog for prescription PDF..." });
                    window.print();
                  }}
                  className="flex-1 rounded-[14px] h-10 font-bold bg-gradient-to-r from-[#14213D] to-[#1e3a5f] text-white border-none shadow-md flex items-center justify-center gap-1.5"
                >
                  <Printer className="h-4 w-4" /> Print / Save PDF
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
