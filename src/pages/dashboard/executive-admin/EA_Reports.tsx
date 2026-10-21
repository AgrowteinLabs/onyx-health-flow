import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, FileText, Download, Info, User, Cpu, Calendar, Video, Clock, AlertCircle, ShieldCheck, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api-request";
import { viewUser } from "@/services/user.service";
import { listConsultationsReport } from "@/services/report.service";

interface Report {
  _id: string;
  reportCode: string;
  s3Link: string;
  createdAt: string;
  profile: {
    _id: string;
    name: string;
    gender: string;
    patientCode: string;
    bmi: number;
  };
  product: {
    _id: string;
    name: string;
    modelNo: string;
    deviceCode: string;
  };
  uploadedBy: {
    _id: string;
    name: string;
    role: string;
    country: string;
    phone_number: string[];
  };
}

const EA_Reports = () => {
  const { toast } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [filtered, setFiltered] = useState<Report[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const userRole = localStorage.getItem("userRole") || "";

  const [activeTab, setActiveTab] = useState<"reports" | "consultations">("reports");
  const [consultations, setConsultations] = useState<any[]>([]);
  const [filteredConsultations, setFilteredConsultations] = useState<any[]>([]);
  const [consultationsLoading, setConsultationsLoading] = useState(false);

  // ================================
  // Fetch All Reports
  // ================================
  const fetchReports = async () => {
    setLoading(true);
    try {
      let endpoint = "/api/report/all";
      if (userRole === "user") {
        const user = await viewUser();
        const userId = user.id || user._id;
        endpoint = `/api/report/byUser/${userId}`;
      }
      const res = await apiRequest(endpoint, { method: "GET" });
      const list = Array.isArray(res?.reports) ? res.reports : [];
      setReports(list);
      setFiltered(list);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to load reports", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchConsultations = async () => {
    setConsultationsLoading(true);
    try {
      const list = await listConsultationsReport();
      setConsultations(list);
      setFilteredConsultations(list);
    } catch (err) {
      console.error(err);
    } finally {
      setConsultationsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    fetchConsultations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ================================
  // Search Filter
  // ================================
  useEffect(() => {
    if (!search.trim()) {
      setFiltered(reports);
      setFilteredConsultations(consultations);
    } else {
      const s = search.toLowerCase();
      setFiltered(
        reports.filter(
          (r) =>
            (r?.reportCode || "").toLowerCase().includes(s) ||
            (r?.profile?.name || "").toLowerCase().includes(s) ||
            (r?.product?.name || "").toLowerCase().includes(s)
        )
      );
      setFilteredConsultations(
        consultations.filter(
          (c) =>
            (c?.patient?.name || c?.profile?.name || c?.userId?.name || "Patient").toLowerCase().includes(s) ||
            (c?.doctorId?.name || "Doctor").toLowerCase().includes(s) ||
            (c?._id || c?.id || "").toLowerCase().includes(s)
        )
      );
    }
  }, [search, reports, consultations]);

  // ================================
  // View by Profile ID
  // ================================
  const handleViewByProfile = async (profileId: string) => {
    setLoading(true);
    try {
      const res = await apiRequest(`/api/report/byProfile/${profileId}`, { method: "GET" });
      const list = Array.isArray(res?.reports) ? res.reports : [];
      setFiltered(list);
      toast({ title: "Filtered reports by profile" });
    } catch (err) {
      console.error(err);
      toast({ title: "Error fetching profile reports", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ================================
  // Open Report Detail Modal
  // ================================
  const openDetails = (report: Report) => {
    setSelectedReport(report);
    setDialogOpen(true);
  };

  // ================================
  // Download Report (Presigned S3 URL Fetching)
  // ================================
  const downloadReport = async (report: Report) => {
    if (!report) return;
    setDownloadingId(report._id);
    try {
      let downloadUrl = report.s3Link;
      
      // Attempt to retrieve fresh presigned URL from backend
      try {
        const res = await apiRequest(`/api/report/${report._id}/download`, { method: "GET" });
        if (res?.downloadUrl) {
          downloadUrl = res.downloadUrl;
        }
      } catch {
        console.warn("Using fallback s3Link directly from report object");
      }

      if (!downloadUrl || downloadUrl === "#") {
        toast({
          title: "Report Unavailable",
          description: "Diagnostic PDF report artifact is not yet uploaded or available for this session.",
          variant: "destructive",
        });
        return;
      }

      const win = window.open(downloadUrl, "_blank", "noopener,noreferrer");
      if (!win) {
        toast({
          title: "Popup Blocked",
          description: "Please allow popups in your browser to view the diagnostic PDF report.",
        });
      }
    } catch (err) {
      console.error("Failed to retrieve report document:", err);
      toast({
        title: "Download Failed",
        description: "Could not retrieve report document. Please try again or verify network connectivity.",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  // ================================
  // UI
  // ================================
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" /> Reports & Consultations
          </h1>
          <p className="text-muted-foreground mt-1">
            View generated health reports and platform consultations payout ledgers.
          </p>
        </div>
      </div>

      {/* Clinical Screening Disclaimer Banner */}
      <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-950 leading-relaxed">
          <span className="font-bold uppercase tracking-wider text-amber-900">Clinical Screening Notice: </span>
          ONYX Health+ provides automated physiological telemetry and health screening. Readings are intended solely for triage and screening support and do <strong>NOT</strong> constitute a definitive medical diagnosis. All records must be reviewed and confirmed by a licensed clinician.
        </div>
      </div>

      {/* Tab Switcher */}
      {userRole !== "user" && (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === "reports"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            Diagnostic Reports
          </button>
          <button
            onClick={() => setActiveTab("consultations")}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              activeTab === "consultations"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            Doctor Consultations
          </button>
        </div>
      )}

      {/* Search */}
      <div className="flex justify-between items-center">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={activeTab === "reports" ? "Search by patient or report code..." : "Search by patient, doctor, or code..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => { fetchReports(); fetchConsultations(); }}
          disabled={loading || consultationsLoading}
        >
          Refresh
        </Button>
      </div>

      {/* Reports or Consultations Card */}
      <Card>
        <CardHeader>
          <CardTitle>
            {activeTab === "reports" 
              ? (userRole === "user" ? "Your Health Reports" : "All Generated Reports")
              : "Doctor Consultations History & Route Splits"
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTab === "reports" ? (
            loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading reports...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No reports found
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold">Report Code</th>
                      <th className="text-left py-3 px-4 font-semibold">Patient</th>
                      <th className="text-left py-3 px-4 font-semibold">Device</th>
                      <th className="text-left py-3 px-4 font-semibold">Uploaded By</th>
                      <th className="text-left py-3 px-4 font-semibold">Date</th>
                      <th className="text-left py-3 px-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr
                        key={r._id}
                        className="border-b hover:bg-muted/40 transition-colors"
                      >
                        <td className="py-3 px-4 font-medium">{r?.reportCode || "—"}</td>
                        <td className="py-3 px-4">
                          {r?.profile ? (
                            userRole === "user" ? (
                              <span>
                                {r.profile.name || "—"} {r.profile.patientCode ? `(${r.profile.patientCode})` : ""}
                              </span>
                            ) : (
                              <Button
                                variant="link"
                                className="text-primary px-0"
                                onClick={() => handleViewByProfile(r.profile._id)}
                              >
                                {r.profile.name || "—"} {r.profile.patientCode ? `(${r.profile.patientCode})` : ""}
                              </Button>
                            )
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {r?.product ? (
                            `${r.product.name || "—"} ${r.product.modelNo ? `(${r.product.modelNo})` : ""}`
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {Array.isArray(r?.uploadedBy?.phone_number)
                            ? `+${r.uploadedBy.phone_number.join(" ")}`
                            : r?.uploadedBy?.phone_number
                            ? `+${r.uploadedBy.phone_number}`
                            : "—"}
                        </td>
                        <td className="py-3 px-4">
                          {r?.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                        </td>
                        <td className="py-3 px-4 flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDetails(r)}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => downloadReport(r)}
                            disabled={downloadingId === r._id}
                            title="Download Report PDF"
                          >
                            {downloadingId === r._id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            consultationsLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading consultations ledger...
              </div>
            ) : filteredConsultations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No consultations found
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-semibold">Booking ID</th>
                      <th className="text-left py-3 px-4 font-semibold">Patient</th>
                      <th className="text-left py-3 px-4 font-semibold">Doctor</th>
                      <th className="text-left py-3 px-4 font-semibold">Fee / Amount</th>
                      <th className="text-left py-3 px-4 font-semibold">Date</th>
                      <th className="text-left py-3 px-4 font-semibold">Status</th>
                      <th className="text-left py-3 px-4 font-semibold">Split Transfer ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredConsultations.map((c) => {
                      const patientName = c.profile?.name || c.userId?.name || c.patient?.name || "Patient";
                      const docName = c.doctorId?.name || "Verified Doctor";
                      const dateStr = c.slotDate ? new Date(c.slotDate).toLocaleDateString() : (c.createdAt ? new Date(c.createdAt).toLocaleDateString() : "—");
                      const amountVal = c.consultationFee || c.doctorId?.consultationFee || 500;
                      return (
                        <tr key={c._id || c.id} className="border-b hover:bg-muted/40 transition-colors">
                          <td className="py-3 px-4 font-medium">{c._id || c.id || "—"}</td>
                          <td className="py-3 px-4">{patientName}</td>
                          <td className="py-3 px-4">{docName}</td>
                          <td className="py-3 px-4">₹{amountVal}</td>
                          <td className="py-3 px-4">{dateStr}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              c.status === "Confirmed" || c.status === "Completed" || c.status === "completed"
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                : "bg-amber-50 text-amber-600 border border-amber-100"
                            }`}>
                              {c.status || "Pending Payment"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground font-mono text-[11px]">
                            {c.splitTransferId || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4 text-sm mt-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span className="font-medium">Patient:</span>
                <span>{selectedReport.profile?.name || "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                <span className="font-medium">Device:</span>
                <span>
                  {selectedReport.product?.name || "—"}{" "}
                  {selectedReport.product?.modelNo ? `(${selectedReport.product.modelNo})` : ""}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium">Uploaded:</span>
                <span>
                  {selectedReport.createdAt ? new Date(selectedReport.createdAt).toLocaleString() : "—"}
                </span>
              </div>
              {/* PHI Confidentiality Notice */}
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-600 leading-relaxed flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-700">Confidential Medical Record:</span> This document contains Protected Health Information (PHI). Authorized clinical personnel only.
                </div>
              </div>

              <div className="mt-4">
                <Button
                  className="w-full font-bold"
                  onClick={() => downloadReport(selectedReport)}
                  disabled={downloadingId === selectedReport._id}
                >
                  {downloadingId === selectedReport._id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Retrieving Presigned PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" /> View / Download Report PDF
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EA_Reports;
