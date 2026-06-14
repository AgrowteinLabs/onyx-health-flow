import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StatCard from "@/components/dashboard/StatCard";
import WelcomeBanner from "@/components/dashboard/WelcomeBanner";
import QuickActions from "@/components/dashboard/QuickActions";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import { SkeletonStatGrid, SkeletonTable } from "@/components/dashboard/Skeletons";
import {
  Building2,
  Stethoscope,
  UserCog,
  Settings,
  MapPin,
  FileText,
  CalendarCheck,
  Users,
  Pill,
  Activity,
  Sparkles,
  Thermometer,
  ClipboardList,
  TrendingUp,
  CreditCard,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { listOrganizations } from "@/services/organization.service";
import { listDoctors } from "@/services/doctor.service";
import { listTechnicians } from "@/services/technician.service";
import { getAnalyticsDashboard, type AnalyticsData } from "@/services/analytics.service";

const MetricBar = ({
  label,
  value,
  total,
  color,
  icon: Icon,
  suffix = "%",
}: {
  label: string;
  value: number;
  total?: number;
  color: string;
  icon: any;
  suffix?: string;
}) => {
  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : value;
  return (
    <div className="flex items-center gap-4">
      <div
        className="h-9 w-9 rounded-[12px] flex items-center justify-center shrink-0"
        style={{ background: `${color}12`, color }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1">
        <div className="flex justify-between mb-1.5">
          <span className="text-xs font-bold text-[#14213D]">{label}</span>
          <span className="text-xs font-extrabold" style={{ color }}>
            {total ? `${value} / ${total}` : `${value}${suffix}`}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </div>
    </div>
  );
};

const ExecutiveAdminDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    organizations: 0,
    doctors: 0,
    technicians: 0,
    devices: 0,
  });
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const [orgOverview, setOrgOverview] = useState<
    { name: string; doctors: number; devices: number; status: string; code?: string; location?: string }[]
  >([]);

  const [pendingDoctors, setPendingDoctors] = useState<any[]>([]);

  const isMainDashboard = location.pathname === "/dashboard/executive-admin";

  const isArray = (value: any): value is any[] => Array.isArray(value);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        listOrganizations(),
        listDoctors(),
        listTechnicians(),
      ]);

      let organizations: any[] = [];
      if (results[0].status === "fulfilled") {
        const orgData = results[0].value;
        organizations = isArray(orgData?.organizations)
          ? orgData.organizations
          : isArray(orgData)
            ? orgData
            : [];
      }

      let doctors: any[] = [];
      if (results[1].status === "fulfilled") {
        const docData = results[1].value;
        doctors = isArray(docData?.doctors) ? docData.doctors : isArray(docData) ? docData : [];
      }

      let technicians: any[] = [];
      if (results[2].status === "fulfilled") {
        const techData = results[2].value;
        technicians = isArray(techData?.technicians) ? techData.technicians : isArray(techData) ? techData : [];
      }

      const totalDevices = organizations.reduce(
        (sum: number, org: any) => sum + (org.devices?.length || 0),
        0,
      );

      const overview = organizations.map((org: any) => ({
        name: org.organizationName,
        code: org.organizationCode || "—",
        location: org.city || org.state || "—",
        doctors: doctors.filter(
          (d: any) => d.orgId === org.id || d.orgId === org._id,
        ).length,
        devices: org.devices?.length || 0,
        status: org.status || "Inactive",
      }));

      setStats({
        organizations: organizations.length,
        doctors: doctors.length,
        technicians: technicians.length,
        devices: totalDevices,
      });

      setOrgOverview(overview);

      const pending = doctors.filter(
        (d: any) => d.status === "Pending Verification"
      );
      setPendingDoctors(pending);
    } catch (err) {
      toast({ title: "Error fetching dashboard data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Fetch analytics separately so the main stats don't wait for it
  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const data = await getAnalyticsDashboard({ filter: "month" });
      if (data?.overview) setAnalyticsData(data);
    } catch {
      // Analytics failed silently — widgets will show fallback
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchAnalytics();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const userName = localStorage.getItem("userName") || "";

  return (
    <DashboardLayout>
      {isMainDashboard ? (
        <div className="space-y-6 animate-fadeIn">
          <PageHeader />

          {/* Welcome Banner */}
          <WelcomeBanner
            name={userName}
            role="executive-admin"
          />

          {/* Quick Actions */}
          <QuickActions role="executive-admin" />

          {/* Stat Cards */}
          {loading ? (
            <SkeletonStatGrid count={4} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard
                title="Organizations"
                value={stats.organizations}
                icon={Building2}
                variant="primary"
                trend={{ value: "Live count", isPositive: true }}
              />
              <StatCard
                title="Active Doctors"
                value={stats.doctors}
                icon={Stethoscope}
                variant="secondary"
                trend={{ value: "Live count", isPositive: true }}
              />
              <StatCard
                title="Technicians"
                value={stats.technicians}
                icon={UserCog}
                variant="default"
              />
              <StatCard
                title="Connected Devices"
                value={stats.devices}
                icon={Settings}
                variant="success"
              />
            </div>
          )}

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left Content Area (Organizations + Approvals) */}
            <div className="lg:col-span-2 space-y-5">
              <div className="bg-white/60 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-extrabold text-[#14213D]">
                    Organization Overview
                  </h3>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {orgOverview.length} total
                  </span>
                </div>

                {loading ? (
                  <SkeletonTable rows={4} />
                ) : orgOverview.length === 0 ? (
                  <EmptyState
                    icon={Building2}
                    title="No organizations found"
                    description="Once organizations are added, they will appear here with their stats."
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {orgOverview.map((org, i) => (
                      <div
                        key={i}
                        className="hover-lift rounded-[20px] border border-slate-100 bg-white/70 p-4 cursor-pointer"
                      >
                        {/* Org Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="h-10 w-10 rounded-[14px] bg-gradient-to-br from-[#14213D] to-[#1e2d4a] flex items-center justify-center text-white font-extrabold text-sm shrink-0">
                            {org.name?.[0] || "O"}
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              org.status === "Active"
                                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                : "bg-rose-50 text-rose-500 border border-rose-100"
                            }`}
                          >
                            {org.status}
                          </span>
                        </div>
                        <p className="text-sm font-extrabold text-[#14213D] leading-tight mb-1 truncate">
                          {org.name}
                        </p>
                        <p className="text-[10px] font-bold text-[#35B7C9] mb-3 uppercase tracking-wider">
                          {org.code}
                        </p>
                        {org.location && org.location !== "—" && (
                          <div className="flex items-center gap-1 mb-3">
                            <MapPin className="h-3 w-3 text-slate-400" />
                            <span className="text-xs text-slate-400 font-semibold">{org.location}</span>
                          </div>
                        )}
                        {/* Stats row */}
                        <div className="flex gap-4 pt-3 border-t border-slate-100">
                          <div className="text-center">
                            <p className="text-lg font-extrabold text-[#F2052C] leading-none">{org.doctors}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Doctors</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-extrabold text-[#35B7C9] leading-none">{org.devices}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Devices</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pending Verifications Widget */}
              <div className="bg-white/60 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="h-5 w-5 text-[#F2052C]" />
                    <h3 className="text-base font-extrabold text-[#14213D]">
                      Pending Doctor Verifications
                    </h3>
                  </div>
                  <Badge className="bg-[#F2052C]/10 text-[#F2052C] border-none font-bold text-[10px]">
                    {pendingDoctors.length} Pending
                  </Badge>
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {[...Array(2)].map((_, i) => (
                      <div key={i} className="h-14 rounded-xl bg-slate-100/50 animate-pulse" />
                    ))}
                  </div>
                ) : pendingDoctors.length === 0 ? (
                  <div className="text-center py-6 text-slate-400 font-semibold text-xs border border-dashed border-slate-200 rounded-xl">
                    🎉 All registered doctors have been verified. No pending audits.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingDoctors.slice(0, 3).map((doc, idx) => (
                      <div
                        key={doc._id || doc.id || idx}
                        className="flex items-center justify-between p-4 rounded-[18px] bg-white/70 border border-slate-100 hover:bg-white transition-all cursor-pointer group"
                        onClick={() => navigate("/dashboard/executive-admin/doctors")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#F2052C] to-[#35B7C9] flex items-center justify-center text-white font-extrabold text-sm uppercase">
                            {doc.name?.[0] || "D"}
                          </div>
                          <div>
                            <p className="text-sm font-extrabold text-[#14213D] leading-snug group-hover:text-primary transition-colors">
                              {doc.name}
                            </p>
                            <p className="text-xs text-slate-400 font-semibold mt-0.5">
                              {doc.specialization || doc.specialty || "Specialist"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-extrabold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Pending Approval
                          </span>
                          <span className="text-xs text-primary font-bold hover:underline hidden sm:inline-block">
                            Verify Details →
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Sidebar — Live Clinical Metrics */}
            <div className="space-y-5">
              {/* Clinical Performance Panel */}
              <div className="bg-white/60 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-[#F2052C]" />
                    <h3 className="text-base font-extrabold text-[#14213D]">Clinical Performance</h3>
                  </div>
                  {analyticsLoading && (
                    <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider">Loading…</span>
                  )}
                  {!analyticsLoading && analyticsData && (
                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
                    </span>
                  )}
                </div>

                {analyticsLoading ? (
                  <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="h-9 w-9 rounded-[12px] bg-slate-100 skeleton-block shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-28 rounded bg-slate-100 skeleton-block" />
                          <div className="h-2 rounded-full bg-slate-100 skeleton-block" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : analyticsData ? (
                  <div className="space-y-4">
                    {/* Appointment Completion Rate */}
                    <MetricBar
                      label="Appointment Completion"
                      value={analyticsData.overview.completed}
                      total={analyticsData.overview.totalAppointments}
                      color="#10B981"
                      icon={CalendarCheck}
                    />
                    {/* Reports Generated */}
                    <MetricBar
                      label="Tests Run This Month"
                      value={analyticsData.overview.totalTests}
                      color="#35B7C9"
                      icon={FileText}
                      suffix=" tests"
                    />
                    {/* Patient Coverage */}
                    <MetricBar
                      label="Patients Registered"
                      value={analyticsData.overview.totalPatients}
                      color="#8B5CF6"
                      icon={Users}
                      suffix=" patients"
                    />
                    {/* Prescription Volume */}
                    <MetricBar
                      label="Monthly Prescriptions"
                      value={analyticsData.overview.monthlyPrescriptions}
                      total={analyticsData.overview.totalPrescriptions}
                      color="#F59E0B"
                      icon={Pill}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-400 font-semibold text-center py-4">Analytics data unavailable</p>
                  </div>
                )}
              </div>

              {/* Live Insights Card */}
              <div
                className="rounded-[24px] p-5 text-white relative overflow-hidden flex-1"
                style={{
                  background: "linear-gradient(135deg, #14213D 0%, #1e3a5f 100%)",
                  boxShadow: "0 8px 32px rgba(20,33,61,0.2)",
                  minHeight: "260px",
                }}
              >
                <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10" style={{ background: "#F2052C", filter: "blur(30px)", transform: "translate(30%, -30%)" }} />
                <div className="flex items-center gap-2 mb-4 relative z-10">
                  <Sparkles className="h-5 w-5 text-[#35B7C9]" />
                  <p className="text-sm font-extrabold">Monthly Insights</p>
                </div>
                {analyticsData ? (
                  <div className="space-y-3 relative z-10">
                    {/* Top Symptom */}
                    <div className="flex items-center gap-3 rounded-[14px] p-3" style={{ background: "rgba(255,255,255,0.07)" }}>
                      <div className="h-8 w-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(242,5,44,0.25)" }}>
                        <Thermometer className="h-4 w-4 text-[#F2052C]" />
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Top Symptom</p>
                        <p className="text-sm font-extrabold text-white leading-tight">{analyticsData.analytics.mostCommonSymptoms}</p>
                        <p className="text-[10px] text-white/40 font-semibold">
                          {analyticsData.analytics.topFiveSymptoms[0]?.count || 0} cases this month
                        </p>
                      </div>
                    </div>
                    {/* Top Diagnosis */}
                    <div className="flex items-center gap-3 rounded-[14px] p-3" style={{ background: "rgba(255,255,255,0.07)" }}>
                      <div className="h-8 w-8 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: "rgba(53,183,201,0.25)" }}>
                        <ClipboardList className="h-4 w-4 text-[#35B7C9]" />
                      </div>
                      <div>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Top Diagnosis</p>
                        <p className="text-sm font-extrabold text-white leading-tight">{analyticsData.analytics.mostCommonDiagnosis}</p>
                        <p className="text-[10px] text-white/40 font-semibold">
                          {analyticsData.analytics.topFiveDiagnosis[0]?.count || 0} instances this month
                        </p>
                      </div>
                    </div>
                    {/* In-Progress */}
                    <div className="flex items-center justify-between px-1 pt-1">
                      <div className="text-center">
                        <p className="text-lg font-extrabold text-white">{analyticsData.overview.booked}</p>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Booked</p>
                      </div>
                      <div className="h-8 w-px bg-white/10" />
                      <div className="text-center">
                        <p className="text-lg font-extrabold text-[#35B7C9]">{analyticsData.overview.inProgress}</p>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">In Progress</p>
                      </div>
                      <div className="h-8 w-px bg-white/10" />
                      <div className="text-center">
                        <p className="text-lg font-extrabold text-emerald-400">{analyticsData.overview.completed}</p>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Completed</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative z-10">
                    <TrendingUp className="h-8 w-8 text-[#35B7C9] mb-3" />
                    <p className="text-3xl font-black">{stats.organizations}</p>
                    <p className="text-xs text-white/50 font-bold mt-1">Organizations active across platform</p>
                  </div>
                )}
              </div>

              {/* Financial Settlements Summary */}
              <div className="bg-white/60 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-emerald-500" />
                    <h3 className="text-base font-extrabold text-[#14213D]">Razorpay Settlements</h3>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-600 border-none font-bold text-[9px]">Active Routing</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                    <span className="text-[10px] text-slate-400 block font-bold">Total Payouts</span>
                    <span className="text-base font-extrabold text-[#14213D]">₹1,85,400</span>
                  </div>
                  <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100/50">
                    <span className="text-[10px] text-slate-400 block font-bold">Pending Review</span>
                    <span className="text-base font-extrabold text-amber-600">₹14,200</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Recent Linked Payouts</span>
                  {[
                    { doctor: "Dr. Sarah Jenkins", amount: "₹45,200", status: "Settled" },
                    { doctor: "Dr. Robert Chen", amount: "₹32,000", status: "Settled" },
                    { doctor: "Dr. Rohan Mehta", amount: "₹12,500", status: "Pending Approval" }
                  ].map((pay, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/40 border border-white/50">
                      <div>
                        <p className="font-bold text-[#14213D]">{pay.doctor}</p>
                        <p className="text-[9px] text-slate-400">Linked Node Payout</p>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-[#14213D]">{pay.amount}</p>
                        <span className={cn(
                          "text-[8px] font-extrabold",
                          pay.status === "Settled" ? "text-emerald-500" : "text-amber-500"
                        )}>{pay.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
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

export default ExecutiveAdminDashboard;
