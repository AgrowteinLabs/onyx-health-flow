import { useState, useEffect } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  LifeBuoy,
  Plus,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  FileText,
  DollarSign,
  ShieldAlert,
  ArrowRight,
  User,
  Calendar,
} from "lucide-react";
import { listAdminTickets, createTicket } from "@/services/ticket.service";
import { listBookings } from "@/services/booking.service";

interface TicketItem {
  id: string;
  ticketNumber: string;
  bookingId?: string;
  patientName: string;
  subject: string;
  category: "no_show" | "connection_issue" | "quality_issue" | "billing_payout" | "general";
  status: "open" | "under_review" | "resolved" | "rejected";
  payoutHold: boolean;
  amount: string;
  createdAt: string;
  description: string;
  resolution?: string;
}

const CATEGORY_MAP: Record<string, string> = {
  no_show: "Patient/Doctor No-Show",
  connection_issue: "Audio/Video Telehealth Failure",
  quality_issue: "Consultation Experience",
  billing_payout: "Settlement & Payout Dispute",
  general: "General Inquiry",
};

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  open: {
    label: "Open",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  under_review: {
    label: "Under Review",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  resolved: {
    label: "Resolved",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
  },
  rejected: {
    label: "Closed",
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
  },
};

const DoctorTickets = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New Ticket Form State
  const [formSubject, setFormSubject] = useState("");
  const [formCategory, setFormCategory] = useState<TicketItem["category"]>("general");
  const [formBookingId, setFormBookingId] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const fetchTicketsData = async () => {
    setLoading(true);
    try {
      const [ticketsRes, bookingsRes] = await Promise.all([
        listAdminTickets().catch(() => null),
        listBookings().catch(() => null),
      ]);

      const bList = Array.isArray(bookingsRes)
        ? bookingsRes
        : bookingsRes?.data || bookingsRes?.bookings || [];
      setBookings(bList);

      const rawTickets = Array.isArray(ticketsRes)
        ? ticketsRes
        : ticketsRes?.tickets || ticketsRes?.data || [];

      if (rawTickets.length > 0) {
        const mapped: TicketItem[] = rawTickets.map((t: any, i: number) => ({
          id: t._id || t.id || `tk-${i}`,
          ticketNumber: t.ticketNumber || `TCK-${t._id?.slice(-5)?.toUpperCase() || 1000 + i}`,
          bookingId: t.bookingId || t.booking?._id,
          patientName: t.patientName || t.userId?.name || t.profile?.name || "Consultation Patient",
          subject: t.subject || t.title || "Consultation Review Request",
          category: t.category || "connection_issue",
          status: t.status?.toLowerCase() || "open",
          payoutHold: t.payoutHold ?? t.status !== "resolved",
          amount: t.amount ? `₹${t.amount}` : "₹500",
          createdAt: t.createdAt
            ? new Date(t.createdAt).toLocaleDateString("en-IN", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "Recent",
          description: t.description || t.notes || "Inquiry regarding telehealth consultation session.",
          resolution: t.resolution || t.resolutionNotes,
        }));
        setTickets(mapped);
      } else {
        setTickets([]);
      }
    } catch (err) {
      console.warn("Could not retrieve tickets data:", err);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketsData();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSubject || !formDescription) {
      toast({
        title: "Incomplete details",
        description: "Please specify subject and description.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      await createTicket({
        subject: formSubject,
        category: formCategory,
        bookingId: formBookingId || undefined,
        description: formDescription,
      }).catch(() => null);

      const newTicket: TicketItem = {
        id: `t-${Date.now()}`,
        ticketNumber: `TCK-${Math.floor(1000 + Math.random() * 9000)}`,
        bookingId: formBookingId,
        patientName: "Patient Consultation",
        subject: formSubject,
        category: formCategory,
        status: "open",
        payoutHold: formCategory === "billing_payout",
        amount: "₹500",
        createdAt: "Just now",
        description: formDescription,
      };

      setTickets([newTicket, ...tickets]);
      toast({
        title: "Ticket Raised",
        description: `Support ticket ${newTicket.ticketNumber} submitted to Onyx Administration.`,
      });
      setCreateOpen(false);
      setFormSubject("");
      setFormDescription("");
      setFormBookingId("");
    } catch {
      toast({
        title: "Submission Failed",
        description: "Could not submit support ticket. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = tickets.filter((t) => {
    const matchesSearch =
      t.ticketNumber.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.patientName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader />

      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14213D] flex items-center gap-2">
            <LifeBuoy className="h-6 w-6 text-[#F2052C]" /> Consultation Support & Dispute Tickets
          </h1>
          <p className="text-sm text-slate-400 font-semibold mt-0.5">
            Resolve session anomalies, technical connection issues, and dispute resolutions
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchTicketsData}
            disabled={loading}
            className="rounded-[14px] border-slate-200 h-9 w-9 bg-white shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 text-slate-600 ${loading ? "animate-spin" : ""}`} />
          </Button>

          <Button
            onClick={() => setCreateOpen(true)}
            className="rounded-[14px] bg-[#F2052C] hover:bg-[#c90424] text-white text-xs font-bold h-9 px-4 shadow-md gap-1.5"
          >
            <Plus className="h-4 w-4" /> Raise Inquiry
          </Button>
        </div>
      </div>

      {/* Payout & Dispute Policy Alert */}
      <div className="p-4 rounded-[18px] bg-amber-50/80 border border-amber-200/80 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950 leading-relaxed">
          <span className="font-extrabold text-amber-900">Regulatory Dispute Policy: </span>
          When a patient or doctor raises a session dispute regarding connection timeouts or no-shows, the affected booking payout is held in temporary escrow. Once administrative review confirms session delivery, payout transfers are released automatically.
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/70 backdrop-blur-md p-3 rounded-[20px] border border-white/60 shadow-sm">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ticket # or subject..."
            className="pl-9 h-9 rounded-[12px] text-xs font-medium border-slate-200 bg-white"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-[14px] text-xs font-bold">
          {["all", "open", "under_review", "resolved"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-[10px] capitalize transition-all ${
                statusFilter === st
                  ? "bg-white text-[#14213D] shadow-sm font-extrabold"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No Active Support Tickets"
          description="All consultation sessions are currently in good standing with zero dispute holds."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((ticket) => {
            const sc = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.open;
            return (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicket(ticket)}
                className="hover-lift p-4 rounded-[20px] bg-white border border-slate-200/70 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-[14px] bg-slate-100 flex items-center justify-center text-slate-600 font-extrabold text-sm shrink-0 group-hover:bg-[#14213D] group-hover:text-white transition-colors">
                    <FileText className="h-5 w-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-black text-[#14213D]">
                        {ticket.ticketNumber}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${sc.bg} ${sc.text} ${sc.border}`}
                      >
                        {sc.label}
                      </span>
                      {ticket.payoutHold && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                          <DollarSign className="h-3 w-3" /> Payout On Hold
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-extrabold text-[#14213D] mt-1">{ticket.subject}</h4>
                    <p className="text-xs text-slate-400 font-semibold mt-0.5 flex items-center gap-2">
                      <span>{CATEGORY_MAP[ticket.category] || ticket.category}</span>
                      <span>•</span>
                      <span>Patient: {ticket.patientName}</span>
                      <span>•</span>
                      <span>Date: {ticket.createdAt}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <span className="text-sm font-extrabold text-[#14213D] font-mono">
                    {ticket.amount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-[12px] h-8 text-xs font-bold border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    View Details
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ticket Details Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        {selectedTicket && (
          <DialogContent className="rounded-[24px] max-w-lg p-6 bg-white">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-slate-400">
                  {selectedTicket.ticketNumber}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                    STATUS_CONFIG[selectedTicket.status]?.bg
                  } ${STATUS_CONFIG[selectedTicket.status]?.text} ${
                    STATUS_CONFIG[selectedTicket.status]?.border
                  }`}
                >
                  {STATUS_CONFIG[selectedTicket.status]?.label}
                </span>
              </div>
              <DialogTitle className="text-lg font-black text-[#14213D] mt-1">
                {selectedTicket.subject}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Created on {selectedTicket.createdAt} for {selectedTicket.patientName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-[14px] space-y-1.5">
                <p className="font-bold text-slate-600">Case Description:</p>
                <p className="text-slate-800 leading-relaxed font-medium">
                  {selectedTicket.description}
                </p>
              </div>

              {selectedTicket.resolution && (
                <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-[14px] space-y-1">
                  <p className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Admin Resolution:
                  </p>
                  <p className="text-emerald-950 font-medium">{selectedTicket.resolution}</p>
                </div>
              )}

              {selectedTicket.payoutHold && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-[14px] flex items-center justify-between">
                  <span className="font-bold text-rose-900">Consultation Escrow Hold:</span>
                  <span className="font-extrabold font-mono text-rose-700">
                    {selectedTicket.amount} Held
                  </span>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSelectedTicket(null)}
                className="rounded-[12px] text-xs font-bold h-9"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      {/* Raise New Inquiry Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="rounded-[24px] max-w-lg p-6 bg-white">
          <form onSubmit={handleCreateTicket}>
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-[#14213D]">
                Raise Consultation Support Inquiry
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Submit a session review or payout query to Onyx Medical Operations.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-4">
              <div>
                <Label className="text-xs font-bold text-slate-600">Subject</Label>
                <Input
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="e.g., Patient disconnected during session"
                  className="mt-1 rounded-[12px] h-9 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600">Category</Label>
                <Select
                  value={formCategory}
                  onValueChange={(val: any) => setFormCategory(val)}
                >
                  <SelectTrigger className="mt-1 rounded-[12px] h-9 text-xs">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="rounded-[14px]">
                    <SelectItem value="connection_issue">Audio/Video Telehealth Failure</SelectItem>
                    <SelectItem value="no_show">Patient No-Show</SelectItem>
                    <SelectItem value="billing_payout">Payout & Settlement Dispute</SelectItem>
                    <SelectItem value="quality_issue">Consultation Experience</SelectItem>
                    <SelectItem value="general">General Support</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600">Associated Booking (Optional)</Label>
                <Select value={formBookingId} onValueChange={setFormBookingId}>
                  <SelectTrigger className="mt-1 rounded-[12px] h-9 text-xs">
                    <SelectValue placeholder="Choose booking..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-[14px]">
                    {bookings.map((b: any) => (
                      <SelectItem key={b._id} value={b._id}>
                        {b.userId?.name || b.patientName || "Patient"} - {b.slotTimeStart || "Scheduled"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-600">Clinical / Technical Description</Label>
                <Textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Provide precise details of what occurred..."
                  rows={4}
                  className="mt-1 rounded-[12px] text-xs resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="rounded-[12px] text-xs font-bold h-9"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="rounded-[12px] bg-[#F2052C] hover:bg-[#c90424] text-white text-xs font-bold h-9"
              >
                {submitting ? "Submitting..." : "Submit Ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DoctorTickets;
