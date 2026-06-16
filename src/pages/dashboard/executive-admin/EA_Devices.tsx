import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoaderIcon, Search, Cpu, CheckCircle, XCircle, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { listDevices, toggleDeviceStatus } from "@/services/device.service";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Device {
  _id: string;
  name: string;
  deviceCode: string;
  modelNo?: string;
  organization?: string;
  organizationName?: string;
  nurseOnDuty?: string | null;
  status?: string;
}

const EA_Devices = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [filtered, setFiltered] = useState<Device[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  // =======================================
  // 🔄 Fetch Devices
  // =======================================
  const fetchDevices = async () => {
    setLoading(true);
    try {
      const data = await listDevices();
      console.log("📡 Raw devices response:", data);

      const allDevices = Array.isArray(data?.devices)
        ? data.devices
        : Array.isArray(data)
        ? data
        : [];

      setDevices(allDevices);
      setFiltered(allDevices);
      toast({ title: "Devices loaded successfully" });
    } catch (err) {
      console.error(err);
      toast({
        title: "Failed to load devices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =======================================
  // 🔍 Search & Status Filter
  // =======================================
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let list = devices;
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter((d) =>
        d.name.toLowerCase().includes(q) ||
        d.deviceCode?.toLowerCase().includes(q) ||
        d.modelNo?.toLowerCase().includes(q) ||
        (d.organization || d.organizationName || "").toLowerCase().includes(q) ||
        (d.nurseOnDuty || "").toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((d) => (d.status || "Active") === statusFilter);
    }
    setFiltered(list);
  }, [search, statusFilter, devices]);

  // =======================================
  // ⚙️ Toggle Device Status
  // =======================================
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{ id: string; currentStatus: string } | null>(null);

  const handleToggleStatus = (id: string, currentStatus?: string) => {
    setConfirmData({ id, currentStatus: currentStatus || "Active" });
    setConfirmOpen(true);
  };

  const executeToggleStatus = async () => {
    if (!confirmData) return;
    const { id, currentStatus } = confirmData;
    const newStatus = currentStatus === "Inactive" ? "Active" : "Inactive";
    try {
      await toggleDeviceStatus(id, newStatus);
      toast({ title: `Device is now ${newStatus}` });
      setConfirmOpen(false);
      fetchDevices();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Failed to update device status",
        description: err.message || "Higher authority constraint or hierarchy limit reached.",
        variant: "destructive",
      });
    }
  };

  // =======================================
  // 🧩 Render
  // =======================================
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Cpu className="h-7 w-7 text-primary" />
            Devices
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage all registered medical devices.
          </p>
        </div>

        <Button onClick={fetchDevices} variant="outline">
          <LoaderIcon className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Reload
        </Button>
      </div>

      {/* Search */}
      <div className="flex justify-end">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Devices</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading devices...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No devices found
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Name</th>
                    <th className="text-left py-3 px-4 font-semibold">Device Code</th>

                    <th className="text-left py-3 px-4 font-semibold">Organization</th>
                    <th className="text-left py-3 px-4 font-semibold">Nurse on Duty</th>
                    <th className="text-left py-3 px-4 font-semibold">
                      <Select
                        value={statusFilter}
                        onValueChange={(val) => setStatusFilter(val)}
                      >
                        <SelectTrigger className="h-8 border-none bg-transparent hover:bg-muted p-0 pr-2 font-semibold text-sm text-foreground focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 w-auto gap-1">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Status: All</SelectItem>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </th>
                    <th className="text-right py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => (
                    <tr
                      key={d._id}
                      className="border-b hover:bg-muted/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium">{d.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{d.deviceCode}</td>

                      <td className="py-3 px-4">{d.organization || d.organizationName || "—"}</td>
                      <td className="py-3 px-4">
                        {d.nurseOnDuty ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            {d.nurseOnDuty}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {d.status === "Inactive" ? (
                          <span className="flex items-center text-yellow-600">
                            <XCircle className="h-4 w-4 mr-1" /> Inactive
                          </span>
                        ) : (
                          <span className="flex items-center text-green-600">
                            <CheckCircle className="h-4 w-4 mr-1" /> Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right flex items-center justify-end gap-3">
                        <Button
                          onClick={() => navigate(`/dashboard/executive-admin/devices/${d._id}/analytics`)}
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-lg text-primary hover:text-primary hover:bg-primary/10"
                          title="View Analytics"
                        >
                          <TrendingUp className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={(d.status || "Active") !== "Inactive"}
                          onCheckedChange={() => handleToggleStatus(d._id, d.status)}
                          title={(d.status || "Active") === "Inactive" ? "Activate" : "Deactivate"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Confirm Status Change Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
            <p className="text-sm text-muted-foreground pt-2">
              Are you sure you want to set this device to{" "}
              <span className="font-bold text-primary">
                {confirmData?.currentStatus === "Inactive" ? "Active" : "Inactive"}
              </span>
              ?
            </p>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={executeToggleStatus}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EA_Devices;
