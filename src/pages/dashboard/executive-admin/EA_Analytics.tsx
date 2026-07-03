import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Activity,
  TrendingUp,
  Users,
  CheckCircle2,
  ClipboardList,
  FileSignature,
  CalendarDays,
  ActivitySquare,
  Sparkles,
  Stethoscope,
  AlertCircle
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { getAnalyticsDashboard, AnalyticsData } from "@/services/analytics.service";
import { listDoctorsAdmin } from "@/services/doctor.service";

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe"];

const MOCK_DATA: AnalyticsData = {
  overview: {
    totalPatients: 125,
    male: 45,
    female: 60,
    boys: 12,
    girls: 8,
    other: 0,
    totalTests: 240,
    totalAppointments: 125,
    booked: 10,
    completed: 105,
    inProgress: 10,
    totalPrescriptions: 115,
    dailyPrescriptions: 2,
    weeklyPrescriptions: 24,
    monthlyPrescriptions: 98,
  },
  analytics: {
    patientsDistribution: {
      genderDistribution: {
        male: 45,
        female: 60,
        boys: 12,
        girls: 8,
        other: 0,
      },
      ageDistribution: {
        children: 20,
        teens: 15,
        adults: 75,
        seniors: 15,
      },
      timeline: {
        "05-10": 5,
        "05-11": 8,
        "05-12": 12,
        "05-13": 14,
        "05-14": 11,
        "05-15": 19,
        "05-16": 16,
      },
    },
    appointmentsStatus: {
      booked: 10,
      completed: 105,
      inProgress: 10,
    },
    topFiveSymptoms: [
      { name: "Fever", count: 48 },
      { name: "Cough", count: 32 },
      { name: "Headache", count: 25 },
      { name: "Body Pain", count: 18 },
      { name: "Chills", count: 15 },
    ],
    mostCommonSymptoms: "Fever",
    topFiveDiagnosis: [
      { name: "Common Cold", count: 36 },
      { name: "Hypertension", count: 28 },
      { name: "Bronchitis", count: 14 },
      { name: "Anemia", count: 9 },
      { name: "Gastroenteritis", count: 7 },
    ],
    mostCommonDiagnosis: "Common Cold",
  },
};

const EA_Analytics = () => {
  const { toast } = useToast();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [filter, setFilter] = useState<"today" | "week" | "month" | "custom">("month");
  
  // Custom date bounds (default to last 30 days)
  const [dates, setDates] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  const [doctorStats, setDoctorStats] = useState({
    total: 0,
    pendingReview: 0,
    approved: 0,
    onboardingPending: 0,
  });

  const fetchDoctorStats = async () => {
    try {
      const doctors = await listDoctorsAdmin();
      const total = doctors.length;
      let pendingReview = 0;
      let approved = 0;
      let onboardingPending = 0;

      doctors.forEach((doc: any) => {
        if (doc.accountStatus === "approved" || doc.status === "Active") {
          approved++;
        } else if (doc.accountStatus === "rejected" || doc.status === "Inactive") {
          // rejected/inactive (not counted as pending or approved)
        } else if (doc.onboardingStatus === "onboarding_pending") {
          onboardingPending++;
        } else if (doc.onboardingStatus === "onboarding_complete" && (doc.accountStatus === "not_approved" || !doc.accountStatus)) {
          pendingReview++;
        } else {
          pendingReview++;
        }
      });

      setDoctorStats({
        total,
        pendingReview,
        approved,
        onboardingPending,
      });
    } catch (err) {
      console.error("Failed to load doctor stats for admin metrics", err);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const response = await getAnalyticsDashboard({
        filter,
        startDate: filter === "custom" ? dates.startDate : undefined,
        endDate: filter === "custom" ? dates.endDate : undefined,
      });
      
      // If we got success status but empty/incomplete response
      if (response && response.overview) {
        setData(response);
        setUsingMock(false);
      } else {
        throw new Error("Invalid metrics format");
      }
    } catch (err) {
      console.warn("⚠️ Analytics API failed or is offline. Using mock telemetry fallback data.");
      setData(MOCK_DATA);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    fetchDoctorStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // Handle custom date filter click
  const handleCustomDateSubmit = () => {
    if (filter === "custom") {
      fetchAnalytics();
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-6 animate-pulse p-4 md:p-8">
        <div className="h-10 w-64 bg-gray-200/50 rounded-xl mb-4" />
        <div className="h-4 w-96 bg-gray-200/50 rounded-lg mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200/50 rounded-[24px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-80 bg-gray-200/50 rounded-[30px] lg:col-span-2" />
          <div className="h-80 bg-gray-200/50 rounded-[30px]" />
        </div>
      </div>
    );
  }

  // Map Recharts timelines
  const timelineData = Object.entries(data.analytics.patientsDistribution.timeline).map(([date, count]) => ({
    date,
    Registrations: count,
  }));

  // Map Recharts Gender Distribution
  const genderPieData = [
    { name: "Male", value: data.analytics.patientsDistribution.genderDistribution.male, color: "#a78bfa" },
    { name: "Female", value: data.analytics.patientsDistribution.genderDistribution.female, color: "#f472b6" },
    { name: "Boys", value: data.analytics.patientsDistribution.genderDistribution.boys, color: "#60a5fa" },
    { name: "Girls", value: data.analytics.patientsDistribution.genderDistribution.girls, color: "#34d399" },
    { name: "Other", value: data.analytics.patientsDistribution.genderDistribution.other, color: "#9ca3af" },
  ].filter(item => item.value > 0);

  // Map Recharts Age Distribution
  const ageBarData = [
    { name: "Children", count: data.analytics.patientsDistribution.ageDistribution.children },
    { name: "Teens", count: data.analytics.patientsDistribution.ageDistribution.teens },
    { name: "Adults", count: data.analytics.patientsDistribution.ageDistribution.adults },
    { name: "Seniors", count: data.analytics.patientsDistribution.ageDistribution.seniors },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8">
      {/* Title Header */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#2d3748] flex items-center gap-3">
            <Activity className="h-10 w-10 text-primary" /> Metrics & Telemetry
          </h1>
          <p className="text-lg text-gray-500 font-medium flex items-center gap-2">
            Real-time clinical and operational business intelligence 
            {usingMock && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#fef7e0] text-[#b06000] border border-[#fce8b2]">
                <Sparkles className="h-3 w-3 animate-spin" /> Sandbox Demo Mode
              </span>
            )}
          </p>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-wrap items-center gap-4 bg-white/40 border border-white/60 p-3 rounded-[24px] shadow-sm">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-bold text-gray-600">Date Range</span>
          </div>

          <Select value={filter} onValueChange={(val: any) => setFilter(val)}>
            <SelectTrigger className="w-[140px] rounded-xl h-10 border-gray-200 font-bold text-gray-700 bg-white">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {filter === "custom" && (
            <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
              <Input
                type="date"
                value={dates.startDate}
                onChange={(e) => setDates({ ...dates, startDate: e.target.value })}
                className="h-10 w-36 rounded-xl border-gray-200 bg-white text-xs font-bold text-gray-600"
              />
              <span className="text-gray-400 text-xs font-extrabold">to</span>
              <Input
                type="date"
                value={dates.endDate}
                onChange={(e) => setDates({ ...dates, endDate: e.target.value })}
                className="h-10 w-36 rounded-xl border-gray-200 bg-white text-xs font-bold text-gray-600"
              />
              <Button onClick={handleCustomDateSubmit} className="h-10 px-4 rounded-xl gradient-primary text-white font-bold text-xs shadow-md">
                Apply
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Primary KPI Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Patients */}
        <Card className="glass-panel border-none shadow-xl rounded-[24px] overflow-hidden hover:scale-[1.02] transition-transform">
          <CardContent className="p-6 relative">
            <div className="absolute right-4 top-4 p-3 rounded-full bg-primary/10 text-primary">
              <Users className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Consolidated Patients</p>
            <h3 className="text-4xl font-extrabold text-[#2d3748] mt-2">{data.overview.totalPatients}</h3>
            
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-[11px] font-bold text-gray-500">
                <span>Male / Female</span>
                <span>{data.overview.male} / {data.overview.female}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div 
                  className="bg-primary h-1.5 rounded-full" 
                  style={{ width: `${(data.overview.male / (data.overview.totalPatients || 1)) * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-medium text-gray-400">
                <span>Youth: {data.overview.boys} Boys, {data.overview.girls} Girls</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total Tests */}
        <Card className="glass-panel border-none shadow-xl rounded-[24px] overflow-hidden hover:scale-[1.02] transition-transform">
          <CardContent className="p-6 relative">
            <div className="absolute right-4 top-4 p-3 rounded-full bg-success/10 text-success">
              <ActivitySquare className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Clinical Tests Run</p>
            <h3 className="text-4xl font-extrabold text-[#2d3748] mt-2">{data.overview.totalTests}</h3>
            <div className="flex items-center gap-1.5 text-xs font-bold text-success mt-4">
              <TrendingUp className="h-4 w-4" />
              <span>Full compliance & diagnostic tracing</span>
            </div>
          </CardContent>
        </Card>

        {/* Appointments Status */}
        <Card className="glass-panel border-none shadow-xl rounded-[24px] overflow-hidden hover:scale-[1.02] transition-transform">
          <CardContent className="p-6 relative">
            <div className="absolute right-4 top-4 p-3 rounded-full bg-[#ffc658]/20 text-[#b06000]">
              <ClipboardList className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Appointments</p>
            <h3 className="text-4xl font-extrabold text-[#2d3748] mt-2">{data.overview.totalAppointments}</h3>
            
            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="bg-white/40 p-1.5 rounded-lg border border-white/50">
                <p className="text-[10px] text-gray-400 font-bold">COMP</p>
                <p className="text-xs font-extrabold text-success">{data.overview.completed}</p>
              </div>
              <div className="bg-white/40 p-1.5 rounded-lg border border-white/50">
                <p className="text-[10px] text-gray-400 font-bold">BOOK</p>
                <p className="text-xs font-extrabold text-blue-500">{data.overview.booked}</p>
              </div>
              <div className="bg-white/40 p-1.5 rounded-lg border border-white/50">
                <p className="text-[10px] text-gray-400 font-bold">PROG</p>
                <p className="text-xs font-extrabold text-orange-500">{data.overview.inProgress}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Prescription Metrics */}
        <Card className="glass-panel border-none shadow-xl rounded-[24px] overflow-hidden hover:scale-[1.02] transition-transform">
          <CardContent className="p-6 relative">
            <div className="absolute right-4 top-4 p-3 rounded-full bg-indigo-500/10 text-indigo-500">
              <FileSignature className="h-6 w-6" />
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Prescriptions</p>
            <h3 className="text-4xl font-extrabold text-[#2d3748] mt-2">{data.overview.totalPrescriptions}</h3>
            
            <div className="flex items-center gap-3 justify-between mt-4">
              <div className="text-center">
                <p className="text-[10px] text-gray-400 font-bold">DAILY</p>
                <p className="text-xs font-extrabold text-gray-700">{data.overview.dailyPrescriptions}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400 font-bold">WEEKLY</p>
                <p className="text-xs font-extrabold text-gray-700">{data.overview.weeklyPrescriptions}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-400 font-bold">MONTHLY</p>
                <p className="text-xs font-extrabold text-gray-700">{data.overview.monthlyPrescriptions}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Doctor Onboarding & Credentials Setup Overview */}
      <div className="space-y-4">
        <h2 className="text-xl font-extrabold text-[#14213D] flex items-center gap-2 text-left">
          <Stethoscope className="h-5 w-5 text-[#35B7C9]" /> Doctor Setup & Onboarding Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Registered Doctors */}
          <Card className="glass-panel border-none shadow-xl rounded-[24px] overflow-hidden hover:scale-[1.02] transition-transform">
            <CardContent className="p-6 relative text-left bg-white">
              <div className="absolute right-4 top-4 p-3 rounded-full bg-[#14213D]/10 text-[#14213D]">
                <Users className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Doctors</p>
              <h3 className="text-4xl font-extrabold text-[#2d3748] mt-2">{doctorStats.total}</h3>
              <p className="text-[11px] font-semibold text-slate-400 mt-4">Total registered on platform</p>
            </CardContent>
          </Card>

          {/* Pending Credentials Verification */}
          <Card className="glass-panel border-none shadow-xl rounded-[24px] overflow-hidden hover:scale-[1.02] transition-transform">
            <CardContent className="p-6 relative text-left bg-white">
              <div className="absolute right-4 top-4 p-3 rounded-full bg-amber-500/10 text-amber-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pending Review</p>
              <h3 className="text-4xl font-extrabold text-amber-600 mt-2">{doctorStats.pendingReview}</h3>
              <p className="text-[11px] font-semibold text-amber-500 mt-4">Completed steps 1–4, awaiting approval</p>
            </CardContent>
          </Card>

          {/* Active / Approved Doctors */}
          <Card className="glass-panel border-none shadow-xl rounded-[24px] overflow-hidden hover:scale-[1.02] transition-transform">
            <CardContent className="p-6 relative text-left bg-white">
              <div className="absolute right-4 top-4 p-3 rounded-full bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Approved & Active</p>
              <h3 className="text-4xl font-extrabold text-emerald-600 mt-2">{doctorStats.approved}</h3>
              <p className="text-[11px] font-semibold text-emerald-500 mt-4">Verification approved and active</p>
            </CardContent>
          </Card>

          {/* Incomplete Onboarding */}
          <Card className="glass-panel border-none shadow-xl rounded-[24px] overflow-hidden hover:scale-[1.02] transition-transform">
            <CardContent className="p-6 relative text-left bg-white">
              <div className="absolute right-4 top-4 p-3 rounded-full bg-rose-500/10 text-rose-600">
                <FileSignature className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Onboarding Incomplete</p>
              <h3 className="text-4xl font-extrabold text-rose-600 mt-2">{doctorStats.onboardingPending}</h3>
              <p className="text-[11px] font-semibold text-rose-500 mt-4">Draft steps 1–4 incomplete</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Analytical Plots Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline Registration Area Chart */}
        <Card className="glass-panel border-none shadow-xl rounded-[30px] lg:col-span-2">
          <CardHeader className="bg-white/30 border-b border-white/50 pb-4">
            <CardTitle className="text-xl font-bold text-[#2d3748] flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Patient Onboarding Velocity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData}>
                  <defs>
                    <linearGradient id="colorRegistrations" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(260 60% 65%)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(260 60% 65%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} fontWeight={600} />
                  <YAxis stroke="#94a3b8" fontSize={11} fontWeight={600} />
                  <Tooltip 
                    contentStyle={{ 
                      background: "rgba(255,255,255,0.8)", 
                      borderRadius: "16px", 
                      border: "none", 
                      boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
                      backdropFilter: "blur(8px)"
                    }} 
                  />
                  <Area type="monotone" dataKey="Registrations" stroke="hsl(260 60% 65%)" strokeWidth={3} fillOpacity={1} fill="url(#colorRegistrations)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Demographics Breakdown (Gender) */}
        <Card className="glass-panel border-none shadow-xl rounded-[30px]">
          <CardHeader className="bg-white/30 border-b border-white/50 pb-4">
            <CardTitle className="text-xl font-bold text-[#2d3748]">Gender Demographics</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-80 w-full flex flex-col items-center justify-between">
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {genderPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        background: "rgba(255,255,255,0.8)", 
                        borderRadius: "16px", 
                        border: "none", 
                        boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.07)",
                        backdropFilter: "blur(8px)"
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legends */}
              <div className="flex flex-wrap justify-center gap-4 text-xs font-bold text-gray-500">
                {genderPieData.map((g, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                    <span>{g.name} ({g.value})</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clinical Observations & Demographics II */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Age Group Distribution (Bar Chart) */}
        <Card className="glass-panel border-none shadow-xl rounded-[30px]">
          <CardHeader className="bg-white/30 border-b border-white/50 pb-4">
            <CardTitle className="text-xl font-bold text-[#2d3748]">Age Segmentations</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ageBarData} barSize={28}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontWeight={600} />
                  <YAxis stroke="#94a3b8" fontSize={11} fontWeight={600} />
                  <Tooltip 
                    contentStyle={{ 
                      background: "rgba(255,255,255,0.8)", 
                      borderRadius: "16px", 
                      border: "none", 
                      boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.07)"
                    }} 
                  />
                  <Bar dataKey="count" fill="hsl(340 80% 65%)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Symptoms Insights */}
        <Card className="glass-panel border-none shadow-xl rounded-[30px]">
          <CardHeader className="bg-white/30 border-b border-white/50 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-bold text-[#2d3748]">Top Observations</CardTitle>
            <span className="text-xs font-extrabold text-[#c5221f] bg-[#fce8e6] px-2.5 py-1 rounded-full uppercase tracking-wider">
              {data.analytics.mostCommonSymptoms}
            </span>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-5 h-80 overflow-y-auto pr-1">
              {data.analytics.topFiveSymptoms.map((symptom, idx) => {
                const totalSymptoms = data.analytics.topFiveSymptoms.reduce((s, sym) => s + sym.count, 0);
                const percent = Math.round((symptom.count / (totalSymptoms || 1)) * 100);
                
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-sm font-bold text-[#2d3748]">
                      <span>{symptom.name}</span>
                      <span>{symptom.count} cases ({percent}%)</span>
                    </div>
                    <div className="w-full bg-gray-100/50 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Diagnoses Insights */}
        <Card className="glass-panel border-none shadow-xl rounded-[30px]">
          <CardHeader className="bg-white/30 border-b border-white/50 pb-4 flex flex-row items-center justify-between">
            <CardTitle className="text-xl font-bold text-[#2d3748]">Top Diagnoses</CardTitle>
            <span className="text-xs font-extrabold text-[#1967d2] bg-[#e8f0fe] px-2.5 py-1 rounded-full uppercase tracking-wider">
              {data.analytics.mostCommonDiagnosis}
            </span>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-5 h-80 overflow-y-auto pr-1">
              {data.analytics.topFiveDiagnosis.map((diag, idx) => {
                const totalDiags = data.analytics.topFiveDiagnosis.reduce((d, dg) => d + dg.count, 0);
                const percent = Math.round((diag.count / (totalDiags || 1)) * 100);
                
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex justify-between text-sm font-bold text-[#2d3748]">
                      <span>{diag.name}</span>
                      <span>{diag.count} instances ({percent}%)</span>
                    </div>
                    <div className="w-full bg-gray-100/50 rounded-full h-2">
                      <div 
                        className="bg-accent h-2 rounded-full" 
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EA_Analytics;
