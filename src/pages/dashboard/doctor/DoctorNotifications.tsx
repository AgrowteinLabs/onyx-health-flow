import { useState, useEffect } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Calendar,
  Video,
  CreditCard,
  ShieldCheck,
  CheckCheck,
  Clock,
  Sparkles,
  ArrowRight,
  Filter,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { listBookings } from "@/services/booking.service";
import { useToast } from "@/hooks/use-toast";

interface NotificationItem {
  id: string;
  type: "booking" | "call" | "payout" | "onboarding" | "system";
  title: string;
  description: string;
  time: string;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

const DoctorNotifications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [filter, setFilter] = useState<"all" | "unread" | "bookings" | "payouts">("all");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const bookingsRes = await listBookings().catch(() => null);
        const bookingList = Array.isArray(bookingsRes)
          ? bookingsRes
          : bookingsRes?.data || bookingsRes?.bookings || [];

        const generated: NotificationItem[] = [
          {
            id: "notif-system-1",
            type: "onboarding",
            title: "Doctor Profile Verified",
            description: "Your medical council credentials have been approved by Onyx Executive Administration.",
            time: "1 hour ago",
            read: false,
            actionUrl: "/dashboard/doctor/profile",
            actionLabel: "View Credentials",
          },
          {
            id: "notif-payout-1",
            type: "payout",
            title: "Direct Payout Account Connected",
            description: "Razorpay linked payout settlement channel is active for automated fee transfers.",
            time: "Yesterday",
            read: true,
            actionUrl: "/dashboard/doctor/payments",
            actionLabel: "View Payouts",
          },
        ];

        if (bookingList.length > 0) {
          bookingList.forEach((b: any, index: number) => {
            const pName = b.userId?.name || b.patientName || "Patient";
            const timeSlot = b.slotTimeStart ? `${b.slotTimeStart} - ${b.slotTimeEnd || ""}` : "10:00 AM";
            generated.unshift({
              id: `notif-bk-${b._id || index}`,
              type: "booking",
              title: `Consultation Booked: ${pName}`,
              description: `Appointment confirmed for slot ${timeSlot} via Telehealth Video.`,
              time: b.createdAt ? new Date(b.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Today",
              read: index > 0,
              actionUrl: "/dashboard/doctor/consultations",
              actionLabel: "Open Queue",
            });
          });
        }

        setNotifications(generated);
      } catch {
        setNotifications([]);
      }
    };

    loadNotifications();
  }, []);

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
    toast({ title: "Notifications Updated", description: "All notifications marked as read." });
  };

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return !n.read;
    if (filter === "bookings") return n.type === "booking";
    if (filter === "payouts") return n.type === "payout";
    return true;
  });

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "booking":
        return <Calendar className="h-4 w-4 text-[#F2052C]" />;
      case "call":
        return <Video className="h-4 w-4 text-[#35B7C9]" />;
      case "payout":
        return <CreditCard className="h-4 w-4 text-emerald-500" />;
      case "onboarding":
        return <ShieldCheck className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14213D] flex items-center gap-2">
            <Bell className="h-6 w-6 text-[#F2052C]" /> Consultation & System Notifications
          </h1>
          <p className="text-sm text-slate-400 font-semibold mt-0.5">
            Real-time telehealth alerts, patient arrivals, and administrative updates
          </p>
        </div>

        <Button
          variant="outline"
          onClick={markAllAsRead}
          className="rounded-[14px] text-xs font-bold border-slate-200 text-slate-600 hover:bg-slate-50 h-9 gap-1.5 shrink-0"
        >
          <CheckCheck className="h-4 w-4 text-emerald-500" /> Mark All as Read
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-[16px] w-fit text-xs font-bold">
        {[
          { key: "all", label: "All Alerts" },
          { key: "unread", label: "Unread" },
          { key: "bookings", label: "Bookings" },
          { key: "payouts", label: "Payouts" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as any)}
            className={`px-3 py-1.5 rounded-[12px] transition-all ${
              filter === tab.key
                ? "bg-white text-[#14213D] shadow-sm font-extrabold"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Notification Cards */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No Notifications Found"
          description="You are completely caught up with all consultations and system alerts."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-[20px] border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                !item.read
                  ? "bg-white border-blue-200/80 shadow-sm"
                  : "bg-slate-50/60 border-slate-100 text-slate-600"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`h-10 w-10 rounded-[14px] flex items-center justify-center shrink-0 ${
                    !item.read ? "bg-[#14213D] text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {getIcon(item.type)}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold text-[#14213D]">{item.title}</h4>
                    {!item.read && (
                      <span className="h-2 w-2 rounded-full bg-[#F2052C]" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{item.description}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">{item.time}</p>
                </div>
              </div>

              {item.actionUrl && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(item.actionUrl!)}
                  className="rounded-[12px] text-xs font-bold h-8 border-slate-200 hover:bg-slate-100 shrink-0 self-end sm:self-center gap-1"
                >
                  {item.actionLabel || "View"} <ArrowRight className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DoctorNotifications;
