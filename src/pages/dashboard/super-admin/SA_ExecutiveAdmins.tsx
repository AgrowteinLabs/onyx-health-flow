import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Shield, UserPlus, Eye, EyeOff } from "lucide-react";
import { createExecAdmin, verifyExecAdmin, listExecutives, updateExecAdmin } from "@/services/executiveAdmin.service";
import { Switch } from "@/components/ui/switch";
import PageHeader from "@/components/dashboard/PageHeader";

const SA_ExecutiveAdmins = () => {
  const { toast } = useToast();
  const [executives, setExecutives] = useState<any[]>([]);
  const [filteredExecutives, setFilteredExecutives] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone_country: "91",
    phone_number: "",
    password: "",
    country: "India",
  });

  // =============================
  // Fetch all Executive Admins
  // =============================
  const fetchExecutives = async () => {
    setLoading(true);
    try {
      const data = await listExecutives();
      const list = data.executives || data;
      setExecutives(list);
      setFilteredExecutives(list);
    } catch (err) {
      console.error(err);
      toast({
        title: "Error fetching Executive Admins",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExecutives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =============================
  // Toggle & Status Filter States
  // =============================
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{ id: string; currentStatus: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const handleToggleStatus = (id: string, currentStatus?: string) => {
    setConfirmData({ id, currentStatus: currentStatus || "Active" });
    setConfirmOpen(true);
  };

  const executeToggleStatus = async () => {
    if (!confirmData) return;
    const { id, currentStatus } = confirmData;
    const newStatus = currentStatus === "Inactive" ? "Active" : "Inactive";
    try {
      await updateExecAdmin(id, { status: newStatus });
      toast({ title: `Executive Admin is now ${newStatus}` });
      setConfirmOpen(false);
      fetchExecutives();
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Failed to update status",
        variant: "destructive",
      });
    }
  };

  // =============================
  // Search & Status Filter
  // =============================
  useEffect(() => {
    let list = executives;
    if (search.trim() !== "") {
      list = list.filter((admin) =>
        admin.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((admin) => (admin.status || "Active") === statusFilter);
    }
    setFilteredExecutives(list);
  }, [search, statusFilter, executives]);

  // =============================
  // Create Executive Admin
  // =============================
  const handleCreate = async () => {
    const { name, phone_country, phone_number, password, country } = formData;

    if (!name || !phone_number || !password) {
      toast({
        title: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      await createExecAdmin({
        phone_number: [phone_country, phone_number],
        password,
        name,
        country,
      });

      toast({
        title: "OTP sent to the provided number",
        description: "Enter the OTP to verify new Executive Admin",
      });

      setDialogOpen(false);
      setOtpDialogOpen(true);
    } catch (err) {
      console.error(err);
      toast({
        title: "Failed to create Executive Admin",
        variant: "destructive",
      });
    }
  };

  // =============================
  // Verify OTP
  // =============================
  const handleVerifyOtp = async () => {
    if (!otpCode) {
      toast({ title: "Please enter the OTP", variant: "destructive" });
      return;
    }

    try {
      await verifyExecAdmin({ otp: otpCode });
      toast({ title: "Executive Admin verified successfully" });
      setOtpDialogOpen(false);
      setOtpCode("");

      // Refresh list
      fetchExecutives();
    } catch (err) {
      console.error(err);
      toast({ title: "OTP verification failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#14213D] flex items-center gap-2">
            <Shield className="h-6 w-6 text-[#F2052C]" /> Executive Admins
          </h1>
          <p className="text-sm text-slate-400 font-semibold mt-0.5">
            {executives.filter((e) => e.status === "Active" || !e.status).length} active of {executives.length} total executives
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white rounded-[14px] border-none shadow-md shadow-[#F2052C]/20 hover:opacity-90 h-9">
              <UserPlus className="h-4 w-4 mr-1.5" /> Add Executive Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px] rounded-[24px] border-none shadow-2xl bg-white/95 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold text-[#14213D] flex items-center gap-2">
                <Shield className="h-5 w-5 text-[#F2052C]" />
                Add Executive Admin
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <label htmlFor="exec-name" className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">Full Name</label>
                <Input
                  id="exec-name"
                  placeholder="e.g. Rohan Mehta"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="rounded-[14px] border-slate-200 h-10"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label htmlFor="exec-phone-country" className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">Country Code</label>
                  <Input
                    id="exec-phone-country"
                    placeholder="91"
                    value={formData.phone_country}
                    onChange={(e) => setFormData({ ...formData, phone_country: e.target.value })}
                    className="rounded-[14px] border-slate-200 h-10"
                  />
                </div>
                <div className="col-span-2">
                  <label htmlFor="exec-phone-number" className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">Phone Number</label>
                  <Input
                    id="exec-phone-number"
                    placeholder="9876543210"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="rounded-[14px] border-slate-200 h-10"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="exec-password" className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">Password</label>
                <div className="relative">
                  <Input
                    id="exec-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="rounded-[14px] border-slate-200 h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="exec-country" className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-1.5 block">Country</label>
                <Input
                  id="exec-country"
                  placeholder="India"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="rounded-[14px] border-slate-200 h-10"
                />
              </div>
            </div>
            <DialogFooter className="mt-4 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-[14px] h-10 font-bold border-slate-200 flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                className="flex-1 rounded-[14px] h-10 font-bold bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white border-none shadow-md"
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* OTP Dialog */}
      <Dialog open={otpDialogOpen} onOpenChange={setOtpDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[24px] border-none shadow-2xl bg-white/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-[#14213D]">Verify OTP</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              id="exec-otp"
              placeholder="Enter 6-digit OTP"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              maxLength={6}
              className="rounded-[14px] border-slate-200 h-10"
            />
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOtpDialogOpen(false)} className="rounded-[14px] h-10 font-bold border-slate-200 flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleVerifyOtp}
              className="flex-1 rounded-[14px] h-10 font-bold bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white border-none shadow-md"
            >
              Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search and Filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search Executive Admins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-[14px] border-slate-200 h-9 bg-white/60 backdrop-blur-sm text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val)}>
          <SelectTrigger className="w-[140px] rounded-[14px] border-slate-200 h-9 bg-white/60 text-sm font-semibold">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white/60 backdrop-blur-md rounded-[24px] border border-white/60 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground font-semibold">
            Loading Executive Admins...
          </div>
        ) : filteredExecutives.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground font-semibold">
            No Executive Admins found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="text-left py-4 px-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Name</th>
                  <th className="text-left py-4 px-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Phone</th>
                  <th className="text-left py-4 px-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Country</th>
                  <th className="text-left py-4 px-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left py-4 px-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Created At</th>
                  <th className="text-right py-4 px-6 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredExecutives.map((admin) => (
                  <tr
                    key={admin._id}
                    className="hover:bg-white/40 transition-colors"
                  >
                    <td className="py-4 px-6 font-bold text-[#14213D]">{admin.name}</td>
                    <td className="py-4 px-6 text-slate-500 font-semibold">
                      +{admin.phone_number?.join(" ")}
                    </td>
                    <td className="py-4 px-6 text-slate-500 font-semibold">
                      {admin.country}
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                          admin.status === "Inactive"
                            ? "bg-slate-100 text-slate-500 border-slate-200"
                            : "bg-emerald-50 text-emerald-600 border-emerald-100"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${admin.status === "Inactive" ? "bg-slate-400" : "bg-emerald-500 animate-pulse"}`} />
                        {admin.status || "Active"}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-slate-400 font-semibold">
                      {new Date(admin.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="py-4 px-6 text-right flex items-center justify-end">
                      <Switch
                        checked={admin.status !== "Inactive"}
                        onCheckedChange={() => handleToggleStatus(admin._id, admin.status)}
                        title={admin.status === "Inactive" ? "Activate" : "Deactivate"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Status Change Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[24px] border-none shadow-2xl bg-white/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-[#14213D]">Confirm Status Change</DialogTitle>
            <p className="text-sm text-muted-foreground pt-2 font-semibold">
              Are you sure you want to set this Executive Admin to{" "}
              <span className="font-bold text-[#F2052C]">
                {confirmData?.currentStatus === "Inactive" ? "Active" : "Inactive"}
              </span>
              ?
            </p>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} className="rounded-[14px] h-10 font-bold border-slate-200 flex-1">
              Cancel
            </Button>
            <Button
              onClick={executeToggleStatus}
              className="flex-1 rounded-[14px] h-10 font-bold bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white border-none shadow-md"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SA_ExecutiveAdmins;
