import { Outlet, useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StatCard from "@/components/dashboard/StatCard";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import QuickActions from "@/components/dashboard/QuickActions";
import PageHeader from "@/components/dashboard/PageHeader";
import { Calendar, Video, FileText, CreditCard, Clock, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const APPOINTMENTS = [
  { patient: "John Doe", time: "09:00 AM", type: "Video Call", status: "Upcoming" },
  { patient: "Jane Smith", time: "10:30 AM", type: "Video Call", status: "In Progress" },
  { patient: "Bob Johnson", time: "11:45 AM", type: "Follow-up", status: "Upcoming" },
  { patient: "Alice Williams", time: "02:00 PM", type: "Video Call", status: "Upcoming" },
  { patient: "Charlie Brown", time: "03:30 PM", type: "Consultation", status: "Completed" },
];

const PRESCRIPTIONS = [
  { patient: "John Doe", medication: "Amoxicillin 500mg", date: "Jun 12, 2026", icon: "J" },
  { patient: "Jane Smith", medication: "Lisinopril 10mg", date: "Jun 11, 2026", icon: "J" },
  { patient: "Bob Johnson", medication: "Metformin 850mg", date: "Jun 10, 2026", icon: "B" },
];

const REPORTS = [
  { patient: "Alice Williams", report: "Blood Test Results", status: "Pending Review" },
  { patient: "Charlie Brown", report: "ECG Report", status: "Reviewed" },
  { patient: "David Lee", report: "X-Ray Scan", status: "Pending Review" },
];

const statusConfig: Record<string, { bg: string; text: string; border: string }> = {
  "Upcoming": { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
  "In Progress": { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" },
  "Completed": { bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-200" },
};

const DoctorDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMainDashboard = location.pathname === "/dashboard/doctor";
  const userName = localStorage.getItem("userName") || "";

  return (
    <DashboardLayout>
      {isMainDashboard ? (
        <div className="space-y-6 animate-fadeIn">
          <PageHeader />

          <WelcomeBanner name={userName} role="doctor" />

          {/* Onboarding Alert Banner */}
          {!localStorage.getItem("doctorOnboarded") && (
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-200 rounded-[20px] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-left">
                  <h4 className="font-extrabold text-[#14213D] text-sm">Onboarding Profile Incomplete</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Please complete your 5-step professional profile setup to enable booking and receive payouts.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate("/dashboard/doctor/onboarding")}
                className="bg-amber-500 hover:bg-amber-600 text-white rounded-[12px] font-bold text-xs h-9 px-4 shrink-0 border-none shadow-sm"
              >
                Complete Setup <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Header row with availability toggle */}
          <div className="flex items-center justify-between">
            <QuickActions role="doctor" />
            <div className="flex items-center gap-3 bg-white/60 backdrop-blur-md border border-white/60 rounded-full px-4 py-2.5 shadow-sm">
              <Label htmlFor="availability" className="text-xs font-bold text-[#14213D] cursor-pointer">
                Available for Consult
              </Label>
              <Switch id="availability" defaultChecked />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard title="Today's Appointments" value={8} icon={Calendar} variant="primary" />
            <StatCard title="Pending Consultations" value={3} icon={Video} variant="secondary" />
            <StatCard title="Reports to Review" value={12} icon={FileText} variant="warning" />
            <StatCard title="This Month Earnings" value="$12,450" icon={CreditCard} variant="success" />
          </div>

          {/* Today's Schedule */}
          <div className="bg-white/60 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-[#F2052C]" />
                <h3 className="text-base font-extrabold text-[#14213D]">Today's Schedule</h3>
              </div>
              <Button
                size="sm"
                className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white border-none rounded-[14px] shadow-md shadow-[#F2052C]/20 hover:opacity-90 h-8"
              >
                <Video className="h-3.5 w-3.5 mr-1.5" />
                Quick Consult
              </Button>
            </div>
            <div className="space-y-3">
              {APPOINTMENTS.map((apt, i) => {
                const sc = statusConfig[apt.status] || statusConfig["Upcoming"];
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 rounded-[18px] bg-slate-50/60 hover:bg-white/80 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#F2052C] to-[#35B7C9] flex items-center justify-center text-white font-extrabold text-sm shadow-sm">
                        {apt.patient.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#14213D]">{apt.patient}</p>
                        <p className="text-xs text-slate-400 font-semibold">{apt.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-extrabold text-[#F2052C]">{apt.time}</span>
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${sc.bg} ${sc.text} ${sc.border}`}
                      >
                        {apt.status}
                      </span>
                      {apt.status === "In Progress" && (
                        <Button
                          size="sm"
                          className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white rounded-[12px] h-7 text-xs font-bold border-none shadow-sm"
                        >
                          <Video className="h-3 w-3 mr-1" /> Join
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Prescriptions + Reports */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Recent Prescriptions */}
            <div className="bg-white/60 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm p-6">
              <h3 className="text-base font-extrabold text-[#14213D] mb-5">Recent Prescriptions</h3>
              <div className="space-y-3">
                {PRESCRIPTIONS.map((rx, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-[16px] bg-slate-50/60 hover:bg-white/80 transition-all">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#14213D] to-[#1e2d4a] flex items-center justify-center text-white font-extrabold text-sm shadow-sm">
                      {rx.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#14213D] truncate">{rx.patient}</p>
                      <p className="text-xs text-slate-400 font-semibold">{rx.medication}</p>
                    </div>
                    <p className="text-[10px] text-slate-300 font-bold shrink-0">{rx.date}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Patient Reports */}
            <div className="bg-white/60 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm p-6">
              <h3 className="text-base font-extrabold text-[#14213D] mb-5">Patient Reports</h3>
              <div className="space-y-3">
                {REPORTS.map((rpt, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-[16px] bg-slate-50/60 hover:bg-white/80 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-9 w-9 rounded-[12px] flex items-center justify-center shrink-0 ${
                          rpt.status === "Reviewed"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-amber-50 text-amber-600"
                        }`}
                      >
                        {rpt.status === "Reviewed" ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#14213D]">{rpt.patient}</p>
                        <p className="text-xs text-slate-400 font-semibold">{rpt.report}</p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shrink-0 ${
                        rpt.status === "Reviewed"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : "bg-amber-50 text-amber-600 border-amber-100"
                      }`}
                    >
                      {rpt.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <Outlet />
        </div>
      )}
    </DashboardLayout>
  );
};

export default DoctorDashboard;
