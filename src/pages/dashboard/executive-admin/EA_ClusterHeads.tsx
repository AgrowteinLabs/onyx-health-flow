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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Search,
  Plus,
  Edit,
  MapPin,
  Building2,
  Trash2,
  Phone,
  KeyRound,
  RefreshCcw,
  Eye,
  EyeOff,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  listClusterHeads,
  createClusterHead,
  verifyClusterHead,
  deleteClusterHead,
  updateClusterHead,
} from "@/services/clusterHead.service";
import { listOrganizations } from "@/services/organization.service";
import { getPermissions } from "@/services/permission.service";
import { resendOtp } from "@/services/auth.service";
import { cn } from "@/lib/utils";

interface ClusterHead {
  _id: string;
  name: string;
  phone_number: string[];
  status?: string;
  organization?: {
    organizationName: string;
    organizationCode?: string;
    location?: {
      line1?: string;
      line2?: string;
      line3?: string;
    };
    status?: string;
  };
}

const EA_ClusterHeads = () => {
  const { toast } = useToast();

  // ====== States ======
  const [clusterHeads, setClusterHeads] = useState<ClusterHead[]>([]);
  const [filtered, setFiltered] = useState<ClusterHead[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [verifyDialog, setVerifyDialog] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [createdPhone, setCreatedPhone] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone_country: "91",
    phone_number: "",
    password: "",
    country: "India",
    organizationName: "",
    location: { line1: "", line2: "", line3: "" },
  });

  // ====== Edit States ======
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCluster, setEditingCluster] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone_country: "91",
    phone_number: "",
    country: "India",
    organizationName: "",
    location: { line1: "", line2: "", line3: "" },
    status: "Active",
  });
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const handleEdit = (cluster: any) => {
    setEditingCluster(cluster);
    setEditForm({
      name: cluster.name,
      phone_country: cluster.phone_number?.[0] || "91",
      phone_number: cluster.phone_number?.[1] || "",
      country: cluster.country || "India",
      organizationName: cluster.organization?.organizationName || "",
      location: {
        line1: cluster.organization?.location?.line1 || "",
        line2: cluster.organization?.location?.line2 || "",
        line3: cluster.organization?.location?.line3 || "",
      },
      status: cluster.status || "Active",
    });
    setEditPermissions(cluster.permissions || []);
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingCluster) return;
    setSavingEdit(true);
    try {
      const payload = {
        name: editForm.name,
        phone_number: [editForm.phone_country, editForm.phone_number],
        country: editForm.country,
        organizationName: editForm.organizationName,
        location: editForm.location,
        status: editForm.status,
        permissions: editPermissions,
      };

      await updateClusterHead(editingCluster._id || editingCluster.id, payload);
      toast({ title: "Cluster head updated successfully" });
      setEditDialogOpen(false);
      fetchClusterHeads();
    } catch (err: any) {
      toast({
        title: "Failed to update cluster head",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleEditPermission = (perm: string) => {
    setEditPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleResendOtp = async () => {
    if (timer > 0) return;
    try {
      await resendOtp(formData.phone_country && formData.phone_number ? [formData.phone_country, formData.phone_number] : [formData.phone_country || "91", createdPhone.slice(-createdPhone.length + (formData.phone_country?.length || 2))]);
      setTimer(30);
      toast({ title: "OTP Resent", description: "A new code has been sent to your phone." });
    } catch (err) {
      toast({ title: "Failed to resend OTP", variant: "destructive" });
    }
  };

  // ====== Fetch Cluster Heads ======
  const fetchClusterHeads = async () => {
    setLoading(true);
    try {
      const [clusterData, orgData] = await Promise.all([
        listClusterHeads(),
        listOrganizations().catch((err) => {
          console.error("Failed to load organizations for cross-check:", err);
          return [];
        })
      ]);

      const clusterList = clusterData.clusters || [];
      const orgList = Array.isArray(orgData?.organizations)
        ? orgData.organizations
        : Array.isArray(orgData)
        ? orgData
        : [];

      const enrichedClusters = clusterList.map((c: any) => {
        // Find if this cluster head has an organization in the organizations list
        const matchedOrg = orgList.find((org: any) => {
          const orgUserId = org.userId?._id || org.userId;
          return orgUserId === c._id;
        });

        if (matchedOrg) {
          return {
            ...c,
            organization: {
              organizationName: matchedOrg.organizationName,
              organizationCode: matchedOrg.organizationCode,
              location: matchedOrg.location,
              status: matchedOrg.status
            }
          };
        }
        return c;
      });

      setClusterHeads(enrichedClusters);
      setFiltered(enrichedClusters);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to load cluster heads", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ====== Fetch Permissions ======
  const fetchPermissions = async () => {
  try {
    const data = await getPermissions();
    const permissionList =
      Array.isArray(data)
        ? data
        : Array.isArray(data.permissions)
        ? data.permissions
        : Array.isArray(data.data)
        ? data.data
        : [];
    setPermissions(permissionList);
  } catch (err) {
    console.error("Error fetching permissions:", err);
    setPermissions([]); 
  }
};


  useEffect(() => {
    fetchClusterHeads();
    fetchPermissions();
  }, []);

  // ====== Search & Status Filter ======
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let list = clusterHeads;
    if (search.trim() !== "") {
      list = list.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((c) => (c.status || "Active") === statusFilter);
    }
    setFiltered(list);
  }, [search, statusFilter, clusterHeads]);

  // ====== Create Cluster Head ======
  const handleSubmit = async () => {
    const {
      name,
      phone_country,
      phone_number,
      password,
      country,
      organizationName,
      location,
    } = formData;

    if (!name || !phone_number || !password || !organizationName) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        phone_number: [phone_country, phone_number],
        permissions: selectedPermissions.length
          ? selectedPermissions
          : ["view-organizations"],
        password,
        name,
        country,
        organizationName,
        location,
      };

      await createClusterHead(payload);
      setCreatedPhone(`${phone_country}${phone_number}`);
      setVerifyDialog(true);
      setDialogOpen(false);
      setTimer(30);
      toast({
        title: "Cluster Head Created",
        description: "Please verify OTP to activate the account.",
      });
    } catch (err) {
      console.error(err);
      toast({ title: "Error creating cluster head", variant: "destructive" });
    }
  };

  // ====== Verify OTP ======
  const handleVerify = async () => {
    if (!otpCode) {
      toast({ title: "Enter OTP code", variant: "destructive" });
      return;
    }
    try {
      await verifyClusterHead({
        otp: otpCode,
      });
      toast({ title: "Cluster Head verified successfully" });
      setVerifyDialog(false);
      setOtpCode("");
      fetchClusterHeads();
    } catch (err) {
      console.error(err);
      toast({ title: "Invalid or expired OTP", variant: "destructive" });
    }
  };

  // ====== Toggle Status ======
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
      await updateClusterHead(id, { status: newStatus });
      toast({ title: `Cluster head is now ${newStatus}` });
      setConfirmOpen(false);
      fetchClusterHeads();
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight text-[#2d3748] flex items-center gap-3">
            <Building2 className="h-10 w-10 text-primary" /> Cluster Heads
          </h1>
          <p className="text-lg text-gray-500 font-medium">
            Onboard and manage primary stakeholders for clinical networks
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-white rounded-2xl h-12 px-8 font-bold shadow-lg transition-all active:scale-95">
              <Plus className="h-5 w-5 mr-2" /> Add Cluster Head
            </Button>
          </DialogTrigger>
          <DialogContent className="glass-panel border-none shadow-2xl sm:max-w-[600px] rounded-[30px] p-0 max-h-[90vh] flex flex-col gap-0 overflow-hidden">
            <DialogHeader className="p-8 bg-white/40 border-b border-white/50 shrink-0">
              <DialogTitle className="text-2xl font-bold text-[#2d3748]">New Cluster Stakeholder</DialogTitle>
            </DialogHeader>

            <div className="p-8 space-y-6 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Full Name</Label>
                  <Input
                    placeholder="e.g. Dr. Jane Smith"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="rounded-xl border-gray-200 h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Secure Password</Label>
                  <div className="relative">
                    <Input
                      placeholder="••••••••"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="rounded-xl border-gray-200 h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Phone Connectivity</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="+91"
                    value={formData.phone_country}
                    onChange={(e) => setFormData({ ...formData, phone_country: e.target.value })}
                    className="w-24 rounded-xl border-gray-200 h-11 text-center"
                  />
                  <Input
                    placeholder="Primary Mobile Number"
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="flex-1 rounded-xl border-gray-200 h-11"
                  />
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white/40 px-3 text-xs font-extrabold text-gray-400 uppercase tracking-widest">Organization Details</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Clinical Entity Name</Label>
                  <Input
                    placeholder="e.g. Apollo Healthcare"
                    value={formData.organizationName}
                    onChange={(e) => setFormData({ ...formData, organizationName: e.target.value })}
                    className="rounded-xl border-gray-200 h-11"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="Street Address"
                    value={formData.location.line1}
                    onChange={(e) => setFormData({ ...formData, location: { ...formData.location, line1: e.target.value } })}
                    className="rounded-xl border-gray-200 h-11"
                  />
                  <Input
                    placeholder="City / Region"
                    value={formData.location.line2}
                    onChange={(e) => setFormData({ ...formData, location: { ...formData.location, line2: e.target.value } })}
                    className="rounded-xl border-gray-200 h-11"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Assigned Permissions</p>
                <div className="grid grid-cols-2 gap-3 max-h-40 overflow-y-auto border border-gray-100 p-4 rounded-2xl bg-white/30">
                  {permissions.map((perm) => (
                    <label key={perm} className="flex items-center space-x-3 text-sm font-medium text-gray-700 cursor-pointer hover:text-primary transition-colors">
                      <Checkbox
                        checked={selectedPermissions.includes(perm)}
                        onCheckedChange={(checked) => {
                          setSelectedPermissions((prev) =>
                            checked ? [...prev, perm] : prev.filter((p) => p !== perm)
                          );
                        }}
                        className="rounded-md border-gray-300"
                      />
                      <span>{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="p-8 bg-gray-50/50 border-t border-gray-100 shrink-0">
              <Button variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl font-bold h-12 px-6">
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="gradient-primary text-white rounded-xl h-12 px-10 font-bold shadow-lg">
                Finalize & Send OTP
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Cluster Head Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="glass-panel border-none shadow-2xl sm:max-w-[600px] rounded-[30px] p-0 max-h-[90vh] flex flex-col gap-0 overflow-hidden">
          <DialogHeader className="p-8 bg-white/40 border-b border-white/50 shrink-0">
            <DialogTitle className="text-2xl font-bold text-[#2d3748]">Edit Cluster Stakeholder</DialogTitle>
          </DialogHeader>

          <div className="p-8 space-y-6 flex-1 overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Full Name</Label>
                <Input
                  placeholder="e.g. Dr. Jane Smith"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="rounded-xl border-gray-200 h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                >
                  <SelectTrigger className="rounded-xl border-gray-200 h-11">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Phone Connectivity</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="+91"
                  value={editForm.phone_country}
                  onChange={(e) => setEditForm({ ...editForm, phone_country: e.target.value })}
                  className="w-24 rounded-xl border-gray-200 h-11 text-center"
                />
                <Input
                  placeholder="Primary Mobile Number"
                  value={editForm.phone_number}
                  onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                  className="flex-1 rounded-xl border-gray-200 h-11"
                />
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white/40 px-3 text-xs font-extrabold text-gray-400 uppercase tracking-widest">Organization Details</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Clinical Entity Name</Label>
                <Input
                  placeholder="e.g. Apollo Healthcare"
                  value={editForm.organizationName}
                  onChange={(e) => setEditForm({ ...editForm, organizationName: e.target.value })}
                  className="rounded-xl border-gray-200 h-11"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  placeholder="Street Address"
                  value={editForm.location.line1}
                  onChange={(e) => setEditForm({ ...editForm, location: { ...editForm.location, line1: e.target.value } })}
                  className="rounded-xl border-gray-200 h-11"
                />
                <Input
                  placeholder="City / Region"
                  value={editForm.location.line2}
                  onChange={(e) => setEditForm({ ...editForm, location: { ...editForm.location, line2: e.target.value } })}
                  className="rounded-xl border-gray-200 h-11"
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Assigned Permissions</p>
              <div className="grid grid-cols-2 gap-3 max-h-40 overflow-y-auto border border-gray-100 p-4 rounded-2xl bg-white/30">
                {permissions.map((perm) => (
                  <label key={perm} className="flex items-center space-x-3 text-sm font-medium text-gray-700 cursor-pointer hover:text-primary transition-colors">
                    <Checkbox
                      checked={editPermissions.includes(perm)}
                      onCheckedChange={(checked) => {
                        setEditPermissions((prev) =>
                          checked ? [...prev, perm] : prev.filter((p) => p !== perm)
                        );
                      }}
                      className="rounded-md border-gray-300"
                    />
                    <span>{perm}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-gray-50/50 border-t border-gray-100 shrink-0">
            <Button variant="ghost" onClick={() => setEditDialogOpen(false)} className="rounded-xl font-bold h-12 px-6">
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={savingEdit} className="gradient-primary text-white rounded-xl h-12 px-10 font-bold shadow-lg">
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OTP Verification */}
      <Dialog open={verifyDialog} onOpenChange={setVerifyDialog}>
        <DialogContent className="glass-panel border-none shadow-2xl sm:max-w-[400px] rounded-[30px] p-8 text-center">
          <DialogHeader>
            <DialogTitle className="text-3xl font-extrabold text-[#2d3748]">Verify Identity</DialogTitle>
            <p className="text-gray-500 mt-2 font-medium">Enter the secure code sent to {createdPhone}</p>
          </DialogHeader>
          <div className="py-8">
            <Input
              placeholder="0 0 0 0 0 0"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className="text-center text-3xl font-bold tracking-[1em] h-20 rounded-[20px] border-2 border-primary/20 focus:border-primary/50"
              maxLength={6}
            />
          </div>
          <Button onClick={handleVerify} className="w-full gradient-primary text-white rounded-2xl h-14 text-lg font-bold shadow-xl active:scale-95">
            <KeyRound className="h-6 w-6 mr-3" /> Activate Account
          </Button>
          <div className="mt-6">
            <button
              onClick={handleResendOtp}
              disabled={timer > 0}
              className={cn(
                "text-sm font-bold transition-all",
                timer > 0 ? "text-gray-400 cursor-not-allowed" : "text-primary hover:underline"
              )}
            >
              {timer > 0 ? `Resend OTP in ${timer}s` : "Didn't receive code? Resend OTP"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search & Listing */}
      <div className="space-y-4">
        <div className="flex justify-end">
          <div className="relative w-80 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-12 rounded-2xl border-gray-200 h-12 shadow-sm focus:shadow-md transition-all"
            />
          </div>
        </div>

        <Card className="glass-panel border-none shadow-xl overflow-hidden">
          <CardHeader className="bg-white/30 border-b border-white/50 pb-6">
            <CardTitle className="text-2xl font-bold text-[#2d3748]">Network Cluster Leads</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <RefreshCcw className="h-10 w-10 animate-spin text-primary opacity-50" />
                <p className="text-gray-500 font-bold mt-4 animate-pulse">Synchronizing Cluster Data...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-400 font-bold text-lg">
                No cluster heads found matching your criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#f8fafc] text-gray-500 uppercase text-[11px] font-extrabold tracking-widest border-b">
                    <tr>
                      <th className="px-6 py-4">Lead Profile</th>
                      <th className="px-6 py-4">Connectivity</th>
                      <th className="px-6 py-4">Organization</th>
                      <th className="px-6 py-4">Location</th>
                      <th className="px-6 py-4">
                        <Select
                          value={statusFilter}
                          onValueChange={(val) => setStatusFilter(val)}
                        >
                          <SelectTrigger className="h-8 border-none bg-transparent hover:bg-white/20 p-0 pr-2 font-extrabold text-[11px] text-gray-500 uppercase tracking-widest focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 w-auto gap-1">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Status: All</SelectItem>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </th>
                      <th className="px-6 py-4 text-right">Management</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((c) => (
                      <tr key={c._id} className="hover:bg-white/40 transition-colors group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                              {c.name.charAt(0)}
                            </div>
                            <span className="font-bold text-[#2d3748] text-base">{c.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2 text-gray-600 font-bold">
                            <Phone className="h-4 w-4 text-primary/50" /> 
                            <span>+{c.phone_number?.join(" ")}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5 font-bold text-[#2d3748]">
                          {c.organization?.organizationName || "—"}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2 text-gray-500 font-medium max-w-[200px]">
                            <MapPin className="h-4 w-4 shrink-0 text-gray-300" />
                            <span className="truncate">
                              {[
                                c.organization?.location?.line1,
                                c.organization?.location?.line2,
                              ].filter(Boolean).join(", ")}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                            c.status === "Inactive"
                              ? "bg-gray-100 text-gray-800 border-gray-200"
                              : "bg-[#e6f4ea] text-[#137333] border-[#ceead6]"
                          )}>
                            {c.status || "Active"}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                             {c.status !== "Inactive" && (
                               <Button
                                 variant="ghost"
                                 size="icon"
                                 onClick={() => handleEdit(c)}
                                 className="hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                               >
                                 <Edit className="h-5 w-5" />
                               </Button>
                             )}
                             <Switch
                               checked={c.status !== "Inactive"}
                               onCheckedChange={() => handleToggleStatus(c._id, c.status)}
                               title={c.status === "Inactive" ? "Activate" : "Deactivate"}
                             />
                          </div>
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
          <DialogContent className="glass-panel border-none shadow-2xl sm:max-w-[400px] rounded-[30px] p-8 text-center">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-[#2d3748]">Confirm Status Change</DialogTitle>
              <p className="text-gray-500 mt-2 font-medium">
                Are you sure you want to set this cluster head to{" "}
                <span className="font-bold text-primary">
                  {confirmData?.currentStatus === "Inactive" ? "Active" : "Inactive"}
                </span>
                ?
              </p>
            </DialogHeader>
            <DialogFooter className="mt-6 flex justify-center gap-4">
              <Button variant="ghost" onClick={() => setConfirmOpen(false)} className="rounded-xl font-bold px-6">
                Cancel
              </Button>
              <Button onClick={executeToggleStatus} className="gradient-primary text-white rounded-xl px-8 font-bold shadow-lg">
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default EA_ClusterHeads;
