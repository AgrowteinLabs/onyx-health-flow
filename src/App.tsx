import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  BrowserRouter,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";

/* =======================
   Public Pages
======================= */
import Index from "./pages/Index";
import LoginPage from "./components/auth/LoginPage";
import NotFound from "./pages/NotFound";

/* =======================
   Dashboards (Layouts)
======================= */
import SuperAdminDashboard from "./pages/dashboard/super-admin/SuperAdminDashboard";
import ExecutiveAdminDashboard from "./pages/dashboard/executive-admin/ExecutiveAdminDashboard";
import ClusterHeadDashboard from "./pages/dashboard/cluster-head/ClusterHeadDashboard";
import UserHeadDashboard from "./pages/dashboard/user-head/UserHeadDashboard";
import NurseDashboard from "./pages/dashboard/nurse/NurseDashboard";
import DoctorDashboard from "./pages/dashboard/doctor/DoctorDashboard";
import TechnicianDashboard from "./pages/dashboard/technician/TechnicianDashboard";

/* =======================
   Super Admin Pages
======================= */
import RoleManagement from "./pages/dashboard/super-admin/RoleManagement";
import UserManagement from "./pages/dashboard/super-admin/UserManagement";
import AuditLogs from "./pages/dashboard/super-admin/AuditLogs";
import SA_ExecutiveAdmins from "./pages/dashboard/super-admin/SA_ExecutiveAdmins";

/* =======================
   Executive Admin Pages
======================= */
import EA_ExecutiveAdmins from "./pages/dashboard/executive-admin/EA_ExecutiveAdmins";
import EA_ClusterHeads from "./pages/dashboard/executive-admin/EA_ClusterHeads";
import EA_Organizations from "./pages/dashboard/executive-admin/EA_Organizations";
import EA_OrganisationView from "./pages/dashboard/executive-admin/EA_OrganisationView";
import EA_Technicians from "./pages/dashboard/executive-admin/EA_Technicians";
import EA_Doctors from "./pages/dashboard/executive-admin/EA_Doctors";
import EA_Devices from "./pages/dashboard/executive-admin/EA_Devices";
import EA_Reports from "./pages/dashboard/executive-admin/EA_Reports";
import EA_UserHeads from "./pages/dashboard/executive-admin/EA_UserHeads";
import EA_Nurses from "./pages/dashboard/executive-admin/EA_Nurses";
import EA_Analytics from "./pages/dashboard/executive-admin/EA_Analytics";
import EA_MachineAnalytics from "./pages/dashboard/executive-admin/EA_MachineAnalytics";

/* =======================
   Cluster Head Pages
======================= */
import CH_TeamIndex from "./pages/dashboard/cluster-head/Team/CH_TeamIndex";
import CH_UserHeads from "./pages/dashboard/cluster-head/Team/CH_UserHeads";
import CH_Nurses from "./pages/dashboard/cluster-head/Team/CH_Nurses";
import CH_Technicians from "./pages/dashboard/cluster-head/Team/CH_Technicians";
import CHDoctors from "./pages/dashboard/cluster-head/Team/CH_Doctors";
import CH_Devices from "./pages/dashboard/cluster-head/CH_Devices";
import CH_Reports from "./pages/dashboard/cluster-head/CH_Reports";
import CH_Consultations from "./pages/dashboard/cluster-head/CH_Consultations";
import CH_LinkedAccounts from "./pages/dashboard/cluster-head/CH_LinkedAccounts";

/* =======================
   Shared Components
======================= */
import Payments from "./pages/dashboard/shared/Payments";
import Organization from "./pages/dashboard/shared/Organization";


/* =======================
   Doctor pages
======================= */
import Schedule from "./pages/dashboard/doctor/Schedule";
import Consultations from "./pages/dashboard/doctor/Consultations";
import Prescriptions from "./pages/dashboard/doctor/Prescriptions";
import OnboardingWizard from "./pages/dashboard/doctor/OnboardingWizard";

import ProtectedRoute from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

/* ===============================
   Route Logger (Debug)
=============================== */
const RouteLogger = () => {
  const location = useLocation();
  useEffect(() => {
    console.log("🗺️ Route changed:", location.pathname);
  }, [location]);
  return null;
};

/* ===============================
   Auto Redirect After Login
=============================== */
const AutoRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    let role = localStorage.getItem("userRole");

    if (token && role) {
      role = role.replace(/_/g, "-");
      localStorage.setItem("userRole", role);

      const homeRoutes = ["/", "/login", "/signup"];
      if (homeRoutes.includes(location.pathname)) {
        navigate(`/dashboard/${role}`);
      }
    }
  }, [navigate, location.pathname]);

  return null;
};

/* ===============================
   MAIN APP
=============================== */
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <RouteLogger />
        <AutoRedirect />

        <Routes>
          {/* 🔓 Public Routes */}
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<LoginPage />} />

          {/* =======================
              SUPER ADMIN ROUTES
          ======================== */}
          <Route element={<ProtectedRoute allowedRoles={["super-admin"]} />}>
            <Route path="/dashboard/super-admin" element={<SuperAdminDashboard />}>
              <Route index element={<RoleManagement />} />
              <Route path="roles" element={<RoleManagement />} />
              <Route path="executives" element={<SA_ExecutiveAdmins />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="audit" element={<AuditLogs />} />
            </Route>
          </Route>

          {/* =======================
              EXECUTIVE ADMIN ROUTES
          ======================== */}
          <Route element={<ProtectedRoute allowedRoles={["executive-admin"]} />}>
            <Route
              path="/dashboard/executive-admin"
              element={<ExecutiveAdminDashboard />}
            >
              <Route index element={<EA_Organizations />} />

              <Route path="analytics" element={<EA_Analytics />} />
              <Route path="organizations" element={<EA_Organizations />} />
              <Route path="organizations/:id" element={<EA_OrganisationView />} />

              <Route path="executives" element={<EA_ExecutiveAdmins />} />
              <Route path="cluster-heads" element={<EA_ClusterHeads />} />

              <Route path="doctors" element={<EA_Doctors />} />
              <Route path="user-heads" element={<EA_UserHeads />} />
              <Route path="nurses" element={<EA_Nurses />} />
              <Route path="technicians" element={<EA_Technicians />} />

              <Route path="devices" element={<EA_Devices />} />
              <Route path="devices/:productId/analytics" element={<EA_MachineAnalytics />} />
              <Route path="reports" element={<EA_Reports />} />
            </Route>
          </Route>

          {/* =======================
              CLUSTER HEAD ROUTES
          ======================== */}
          <Route element={<ProtectedRoute allowedRoles={["cluster-head"]} />}>
            <Route
              path="/dashboard/cluster-head"
              element={<ClusterHeadDashboard />}
            >
              <Route index element={<ClusterHeadDashboard />} />

              {/* Team */}
              <Route path="team" element={<CH_TeamIndex />} />
              <Route path="team/user-heads" element={<CH_UserHeads />} />
              <Route path="team/nurses" element={<CH_Nurses />} />
              <Route path="team/technicians" element={<CH_Technicians />} />
              <Route path="team/doctors" element={<CHDoctors />} />

              {/* Others */}
              <Route path="devices" element={<CH_Devices />} />
              <Route path="reports" element={<CH_Reports />} />
              <Route path="consultations" element={<CH_Consultations />} />
              <Route path="linked-accounts" element={<CH_LinkedAccounts />} />
            </Route>
          </Route>

          {/* =======================
              USER HEAD ROUTES
          ======================== */}
          <Route element={<ProtectedRoute allowedRoles={["user-head"]} />}>
            <Route path="/dashboard/user-head" element={<UserHeadDashboard />}>
              <Route index element={<CH_Nurses />} />
              <Route path="nurses" element={<CH_Nurses />} />
              <Route path="organization" element={<Organization />} />
              <Route path="devices" element={<EA_Devices />} />
              <Route path="reports" element={<EA_Reports />} />
            </Route>
          </Route>

          {/* =======================
              NURSE ROUTES
          ======================== */}
          <Route element={<ProtectedRoute allowedRoles={["nurse"]} />}>
            <Route path="/dashboard/nurse" element={<NurseDashboard />}>
              <Route index element={<EA_Devices />} />
              <Route path="devices" element={<EA_Devices />} />
              <Route path="reports" element={<EA_Reports />} />
              <Route path="organization" element={<Organization />} />
            </Route>
          </Route>

          {/* =======================
              TECHNICIAN ROUTES
          ======================== */}
          <Route element={<ProtectedRoute allowedRoles={["technician"]} />}>
            <Route path="/dashboard/technician" element={<TechnicianDashboard />}>
              <Route index element={<EA_Devices />} />
              <Route path="devices" element={<EA_Devices />} />
              <Route path="reports" element={<EA_Reports />} />
            </Route>
          </Route>


          {/* =======================
              DOCTOR ROUTES
          ======================== */}
          <Route element={<ProtectedRoute allowedRoles={["doctor"]} />}>
            <Route path="/dashboard/doctor" element={<DoctorDashboard />}>
              <Route index element={<Schedule />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="consultations" element={<Consultations />} />
              <Route path="prescriptions" element={<Prescriptions />} />
              <Route path="reports" element={<EA_Reports />} />
              <Route path="payments" element={<Payments />} />
              <Route path="onboarding" element={<OnboardingWizard />} />
            </Route>
          </Route>

          {/* ❌ Not Found */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
