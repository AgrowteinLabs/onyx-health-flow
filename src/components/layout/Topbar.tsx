import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronDown, ShieldCheck, Globe2, Smartphone, Bell, Search, X, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/api-request";
import { listBookings } from "@/services/booking.service";

interface UserData {
  _id: string;
  name: string;
  role: string;
  country: string;
  phone_number: string[];
  status: string;
  userCode: string;
  permissions: string[];
  devices: string | string[];
}

const MOCK_NOTIFICATIONS = [
  { id: 1, title: "New report uploaded", desc: "Nurse Sarah uploaded ECG report", time: "2m ago", read: false, color: "#F2052C" },
  { id: 2, title: "Device connected", desc: "Device ECG-001 is now online", time: "15m ago", read: false, color: "#35B7C9" },
  { id: 3, title: "Report reviewed", desc: "Dr. Sharma reviewed patient report", time: "1h ago", read: true, color: "#10B981" },
  { id: 4, title: "New cluster head", desc: "Ravi Kumar was added as cluster head", time: "3h ago", read: true, color: "#F59E0B" },
];

const Topbar = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const searchRef = useRef<HTMLInputElement>(null);

  const orgName = localStorage.getItem("organizationName");
  const userRole = localStorage.getItem("userRole") || "";
  const showOrg = ["cluster-head", "user-head", "nurse", "technician"].includes(userRole);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchUser = async () => {
    try {
      const res = await apiRequest("/view/user", { method: "GET" });
      setUser(res);
    } catch (err) {
      console.error("❌ Failed to fetch user:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorNotifications = useCallback(async () => {
    if (userRole === "doctor") {
      try {
        const bookingsRes = await listBookings().catch(() => null);
        const list = Array.isArray(bookingsRes)
          ? bookingsRes
          : bookingsRes?.bookings || bookingsRes?.data || [];

        if (list.length > 0) {
          const mapped = list.slice(0, 4).map((b: any, index: number) => {
            const pName =
              b.profileId?.name ||
              b.userId?.name ||
              b.patientName ||
              `Patient #${b._id?.slice(-4) || index + 1}`;
            const isCalling =
              (b.status || "").toLowerCase() === "in_progress" ||
              (b.status || "").toLowerCase() === "active";

            return {
              id: b._id || index + 1,
              title: isCalling ? "Incoming Consultation Call" : "Telehealth Booking",
              desc: `${pName} · ${b.slot || "Today"} (${b.type || "General Consult"})`,
              time: isCalling ? "Calling Now" : "Scheduled",
              read: false,
              color: isCalling ? "#F2052C" : "#35B7C9",
            };
          });
          setNotifications(mapped);
        }
      } catch {
        // Fallback to defaults
      }
    }
  }, [userRole]);

  useEffect(() => {
    fetchUser();
    fetchDoctorNotifications();
  }, [fetchDoctorNotifications]);

  useEffect(() => {
    if (searchOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchOpen]);

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // Role color logic
  const roleColors: Record<string, string> = {
    super_admin: "bg-[#F2052C]/8 text-[#F2052C] border border-[#F2052C]/15 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide shadow-none hover:bg-[#F2052C]/8",
    executive_admin: "bg-blue-50/60 text-blue-600 border border-blue-100 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide shadow-none hover:bg-blue-50/60",
    cluster_head: "bg-emerald-50/60 text-emerald-600 border border-emerald-100 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide shadow-none hover:bg-emerald-50/60",
    user_head: "bg-violet-50/60 text-violet-600 border border-violet-100 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide shadow-none hover:bg-violet-50/60",
    nurse: "bg-pink-50/60 text-pink-600 border border-pink-100 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide shadow-none hover:bg-pink-50/60",
    technician: "bg-amber-50/60 text-amber-600 border border-amber-100 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide shadow-none hover:bg-amber-50/60",
  };

  const roleBadge = (
    <Badge className={`${roleColors[user?.role || ""] || "bg-muted text-foreground"} capitalize`}>
      {user?.role?.replace(/_/g, " ")}
    </Badge>
  );

  return (
    <header className="flex items-center justify-between px-6 mx-2 mb-4 glass-panel rounded-[24px] shadow-sm z-10 relative" style={{ minHeight: 72 }}>
      {/* Left: Title + Org */}
      <div className="flex flex-col gap-0.5">
        <h1 className="text-lg font-extrabold tracking-tight text-[#14213D] leading-tight">
          Onyx Health+ Dashboard
        </h1>
        {showOrg && orgName ? (
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3 w-3 text-[#35B7C9]" />
            <span className="text-[10px] font-bold text-[#35B7C9] uppercase tracking-wider">{orgName}</span>
          </div>
        ) : (
          <p className="text-[10px] font-bold text-[#35B7C9] uppercase tracking-wider">
            Smart Health Administration
          </p>
        )}
      </div>

      {/* Right: Search + Notif + User */}
      <div className="flex items-center gap-3">

        {/* Search Bar */}
        <div className="relative flex items-center">
          {searchOpen ? (
            <div className="flex items-center gap-2 bg-white/80 border border-white/60 rounded-full px-3 py-2 shadow-sm animate-fadeIn">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="bg-transparent text-sm outline-none w-40 text-[#14213D] placeholder:text-slate-400 font-medium"
                onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
              />
              <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }}>
                <X className="h-4 w-4 text-slate-400 hover:text-slate-700 transition-colors" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              className="h-10 w-10 flex items-center justify-center rounded-full bg-white/60 border border-white/60 hover:bg-white/90 transition-all text-slate-400 hover:text-[#14213D]"
            >
              <Search className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen((o) => !o)}
            className="h-10 w-10 flex items-center justify-center rounded-full bg-white/60 border border-white/60 hover:bg-white/90 transition-all relative"
          >
            <Bell className="h-4 w-4 text-slate-500" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-[#F2052C] rounded-full text-white text-[9px] font-extrabold flex items-center justify-center border border-white">
                {unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div
              className="absolute right-0 top-12 w-80 bg-white/90 backdrop-blur-xl border border-white/60 rounded-[20px] shadow-2xl z-50 animate-fadeIn overflow-hidden"
              style={{ boxShadow: "0 20px 60px rgba(242,5,44,0.08)" }}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
                <p className="text-sm font-extrabold text-[#14213D]">Notifications</p>
                <button onClick={markAllRead} className="text-[10px] font-bold text-[#F2052C] hover:opacity-70 uppercase tracking-wider">
                  Mark all read
                </button>
              </div>
              <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto custom-scrollbar">
                {notifications.map((n) => (
                  <div key={n.id} className={`flex items-start gap-3 px-5 py-3 hover:bg-slate-50/60 transition-colors ${n.read ? "opacity-60" : ""}`}>
                    <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center mt-0.5" style={{ background: `${n.color}15`, color: n.color }}>
                      <Bell className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#14213D] leading-snug">{n.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{n.desc}</p>
                    </div>
                    <span className="text-[10px] text-slate-300 font-semibold shrink-0 mt-0.5">{n.time}</span>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 border-t border-slate-100 text-center">
                <button className="text-xs font-bold text-[#35B7C9] hover:text-[#35B7C9]/70 transition-colors">
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Click-outside close for notification panel */}
        {notifOpen && (
          <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
        )}

        {/* User Info + Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-3 pl-2 pr-3 h-12 rounded-full hover:bg-white/60 border border-white/50 backdrop-blur-md transition-colors"
            >
              {/* Avatar */}
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[#F2052C] to-[#35B7C9] flex items-center justify-center text-white font-extrabold text-sm uppercase shadow-md shrink-0">
                {user?.name ? user.name[0] : "U"}
              </div>

              {/* Info */}
              {loading ? (
                <Skeleton className="h-10 w-40 rounded-full" />
              ) : (
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-bold text-[#14213D] leading-none">
                    {user?.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {roleBadge}
                    {user?.status === "Active" && (
                      <span className="text-[10px] font-extrabold text-[#137333] flex items-center gap-1 uppercase tracking-wider bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                        <ShieldCheck className="h-3 w-3" /> Active
                      </span>
                    )}
                  </div>
                </div>
              )}

              <ChevronDown className="h-4 w-4 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-72 shadow-lg rounded-[20px] border-none" style={{ boxShadow: "0 20px 50px rgba(242,5,44,0.07)" }}>
            <DropdownMenuLabel>Account Overview</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {loading ? (
              <div className="p-4 text-sm text-muted-foreground">
                Loading user info...
              </div>
            ) : (
              <div className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{user?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Role:</span>
                  <span className="font-medium capitalize">{user?.role?.replace(/_/g, " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">User Code:</span>
                  <span className="font-medium">{user?.userCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Globe2 className="h-3 w-3" /> Country:
                  </span>
                  <span className="font-medium">{user?.country}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Smartphone className="h-3 w-3" /> Phone:
                  </span>
                  <span className="font-medium">
                    +{user?.phone_number?.join(" ")}
                  </span>
                </div>
              </div>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile Settings</DropdownMenuItem>
            <DropdownMenuItem>Notification Preferences</DropdownMenuItem>
            <DropdownMenuItem>Help & Support</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive font-semibold">
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Topbar;
