import { useEffect, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import EmptyState from "@/components/dashboard/EmptyState";
import { SkeletonStatGrid } from "@/components/dashboard/Skeletons";
import { listDevices, toggleDevicePaymentMode } from "@/services/device.service";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Cpu,
  Wifi,
  WifiOff,
  MapPin,
  CreditCard,
  RefreshCw,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Device = {
  id: string;
  name?: string;
  deviceCode?: string;
  modelNo?: string;
  status?: string;
  location?: string;
  paymentMode: boolean;
  online: boolean;
};

const CH_Devices = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);

  const fetchDevicesData = async () => {
    setLoading(true);
    try {
      const devs = await listDevices();
      const mapped = (devs || []).map((d: any) => {
        const formattedLocation = d?.location
          ? typeof d.location === "string"
            ? d.location
            : `${d.location.line1 || ""}, ${d.location.line2 || ""}, ${d.location.line3 || ""}`.replace(/^,\s*|,\s*$/g, "").trim()
          : `${d?.city || ""} ${d?.country || ""}`.trim();

        const isOnline = d?.status === "Active" || d?.online;
        return {
          id: d?._id || d?.id,
          name: d?.name || d?.deviceName || "Device",
          deviceCode: d?.deviceCode || "—",
          modelNo: d?.modelNo || "—",
          status: isOnline ? "Online" : "Offline",
          location: formattedLocation || "—",
          paymentMode: d?.paymentMode ?? false,
          online: isOnline,
        };
      });
      setDevices(mapped);
    } catch (err: any) {
      toast({ title: "Failed to load devices", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDevicesData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTogglePaymentMode = async (deviceId: string, currentVal: boolean) => {
    try {
      const newVal = !currentVal;
      await toggleDevicePaymentMode(deviceId, newVal);
      setDevices((prev) => prev.map((d) => d.id === deviceId ? { ...d, paymentMode: newVal } : d));
      toast({ title: `Payment mode ${newVal ? "enabled" : "disabled"}` });
    } catch (err: any) {
      toast({ title: "Failed to toggle payment mode", description: err.message, variant: "destructive" });
    }
  };

  const onlineCount = devices.filter((d) => d.online).length;
  const paymentCount = devices.filter((d) => d.paymentMode).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14213D] flex items-center gap-2">
            <Cpu className="h-6 w-6 text-[#F2052C]" /> Devices
          </h1>
          <p className="text-sm text-slate-400 font-semibold mt-0.5">{devices.length} total · {onlineCount} online · {paymentCount} payment-enabled</p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchDevicesData} disabled={loading} className="h-9 rounded-[14px] border border-slate-200 bg-white/60">
          <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Mini Stats */}
      {loading ? (
        <SkeletonStatGrid count={3} />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Devices",   value: devices.length,  color: "#14213D", bg: "from-[#14213D]/5 to-[#14213D]/10" },
            { label: "Online",          value: onlineCount,     color: "#10B981", bg: "from-emerald-50 to-emerald-100/50" },
            { label: "Payment Enabled", value: paymentCount,    color: "#35B7C9", bg: "from-[#35B7C9]/8 to-[#35B7C9]/15" },
          ].map((s) => (
            <div key={s.label} className={`bg-gradient-to-br ${s.bg} rounded-[20px] p-4 border border-white/60`}>
              <p className="text-2xl font-extrabold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Device Grid */}
      {loading ? (
        <div className="text-center py-10 text-slate-400 text-sm font-semibold">Loading devices...</div>
      ) : devices.length === 0 ? (
        <EmptyState icon={Settings} title="No devices found" description="Devices registered to your organization will appear here." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {devices.map((device) => (
            <div key={device.id} className="hover-lift bg-white/60 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm p-5">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className={`h-11 w-11 rounded-[16px] flex items-center justify-center shrink-0 ${device.online ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
                    {device.online ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-[#14213D] truncate">{device.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{device.deviceCode}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider shrink-0 ${device.online ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-100 text-slate-400 border border-slate-200"}`}>
                  {device.status}
                </span>
              </div>

              {/* Details */}
              <div className="space-y-2 mb-4">
                {device.location && device.location !== "—" && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{device.location}</span>
                  </div>
                )}
              </div>

              {/* Payment Mode Toggle */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-3.5 w-3.5 text-[#35B7C9]" />
                  <span className="text-xs font-bold text-slate-500">Payment Mode</span>
                </div>
                <Switch
                  checked={device.paymentMode}
                  onCheckedChange={() => handleTogglePaymentMode(device.id, device.paymentMode)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CH_Devices;
