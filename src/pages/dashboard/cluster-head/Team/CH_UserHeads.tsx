import { useEffect, useState, useMemo } from "react";
import {
  Search,
  User2,
  RefreshCcw,
  Plus,
  Phone,
  Trash2,
  Eye,
  EyeOff,
} from "lucide-react";
import { viewOrganization } from "@/services/organization.service";
import {
  createUserHead,
  deleteUserHead,
  verifyUserHead,
  toggleUserHeadStatus,
} from "@/services/userHead.service";
import { getUserPermissions } from "@/services/permission.service";
import { resendOtp } from "@/services/auth.service";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/dashboard/StatCard";
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
  SelectTrigger,
  SelectContent,
  SelectValue,
  SelectItem,
} from "@/components/ui/select";

/**
 * 👥 User Heads Management Page
 * Lists all User Heads under the Cluster Head's organization.
 */
const CH_UserHeads = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [userHeads, setUserHeads] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const [permissionsNew, setPermissionsNew] = useState<string[]>([]);
  const [selectedPermissionsNew, setSelectedPermissionsNew] = useState<
    string[]
  >([]);

  // ── Add User Head dialog state ──
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addStep, setAddStep] = useState<"form" | "verify">("form");
  const [addOtp, setAddOtp] = useState("");
  const [pendingUserHeadPhone, setPendingUserHeadPhone] = useState<{
    phone_country: string;
    phone_number: string;
  } | null>(null);

  const [addForm, setAddForm] = useState({
    name: "",
    phone_country: "91",
    phone_number: "",
    password: "",
    country: "India",
  });

  const [resendTimer, setResendTimer] = useState(0);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (resendTimer > 0) {
      const interval = setInterval(() => setResendTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [resendTimer]);

  const handleResendOtp = async () => {
    if (resendTimer > 0 || !pendingUserHeadPhone) return;
    try {
      await resendOtp([pendingUserHeadPhone.phone_country, pendingUserHeadPhone.phone_number]);
      setResendTimer(30);
      toast({ title: "OTP Resent" });
    } catch (err: any) {
      toast({ title: "Failed to resend OTP", variant: "destructive" });
    }
  };

  const fetchUserHeads = async () => {
    setLoading(true);
    try {
      const orgId = localStorage.getItem("organizationId");
      if (!orgId) {
        throw new Error("Organization ID missing in localStorage");
      }

      const response = await viewOrganization(orgId);
      const org = response.organization || response;
      const heads = org.userHead || org.userHeads || [];

      setUserHeads(heads);

      const chUserId = org.userId?._id || null;
      if (chUserId) {
        try {
          const perms = await getUserPermissions(chUserId);
          setPermissionsNew(perms);
          setSelectedPermissionsNew([]);
        } catch (e) {
          console.error("Error fetching permissions", e);
        }
      }

      if (heads.length === 0) {
        toast({
          title: "No user heads found",
          description: "This organization has no user heads assigned yet.",
        });
      }
    } catch (err: any) {
      console.error("❌ Error fetching user heads:", err);
      toast({
        title: "Failed to load user heads",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserHeads();
  }, []);

  // Filter logic
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredHeads = useMemo(() => {
    let list = userHeads;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((u) => {
        return (
          u.name?.toLowerCase().includes(q) ||
          u.phone_number?.join("").includes(q) ||
          u.country?.toLowerCase().includes(q)
        );
      });
    }
    if (statusFilter !== "all") {
      list = list.filter((u) => (u.status || "Active") === statusFilter);
    }
    return list;
  }, [searchTerm, statusFilter, userHeads]);

  const handleAddUserHeadSubmit = async () => {
    const { name, phone_country, phone_number, password, country } = addForm;

    if (!name || !phone_number || !password) {
      toast({
        title: "Missing fields",
        description: "Please fill all fields.",
        variant: "destructive",
      });
      return;
    }

    const orgId = localStorage.getItem("organizationId");
    try {
      const payload = {
        name,
        phone_number: [phone_country, phone_number],
        password,
        country,
        orgId,
        permissions: selectedPermissionsNew,
        devices: [],
      };

      await createUserHead(payload);
      setPendingUserHeadPhone({ phone_country, phone_number });
      setAddStep("verify");
      setResendTimer(30);
      toast({ title: "OTP sent to phone number" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Could not create user head",
        variant: "destructive",
      });
    }
  };

  const handleVerifyOtp = async () => {
    try {
      await verifyUserHead({ otp: addOtp });
      toast({ title: "User Head verified successfully" });
      setAddDialogOpen(false);
      fetchUserHeads();
    } catch (err: any) {
      toast({
        title: "Verification failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  // ───────────────────────── Toggle User Head Status ─────────────────────────
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
      await toggleUserHeadStatus(id, newStatus);
      toast({ title: `User Head status updated to ${newStatus}` });
      setConfirmOpen(false);
      fetchUserHeads();
    } catch (err: any) {
      toast({
        title: "Toggle failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">User Heads</h1>
          <p className="text-muted-foreground mt-1">
            Manage and view all User Heads under your organization
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog
            open={addDialogOpen}
            onOpenChange={(open) => {
              setAddDialogOpen(open);
              if (!open) {
                setAddStep("form");
                setAddOtp("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="gradient-primary text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add User Head
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {addStep === "form" ? "Add User Head" : "Verify OTP"}
                </DialogTitle>
              </DialogHeader>

              {addStep === "form" ? (
                <div className="grid gap-4 py-4">
                  <Input
                    placeholder="Name"
                    value={addForm.name}
                    onChange={(e) =>
                      setAddForm({ ...addForm, name: e.target.value })
                    }
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="CC"
                      value={addForm.phone_country}
                      onChange={(e) =>
                        setAddForm({ ...addForm, phone_country: e.target.value })
                      }
                      className="w-20"
                    />
                    <Input
                      placeholder="Phone"
                      value={addForm.phone_number}
                      onChange={(e) =>
                        setAddForm({ ...addForm, phone_number: e.target.value })
                      }
                    />
                  </div>
                  <div className="relative">
                    <Input
                      placeholder="Password"
                      type={showPassword ? "text" : "password"}
                      value={addForm.password}
                      onChange={(e) =>
                        setAddForm({ ...addForm, password: e.target.value })
                      }
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {permissionsNew.length > 0 && (
                    <div className="grid gap-2 max-h-40 overflow-y-auto">
                      {permissionsNew.map((p) => (
                        <label key={p} className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedPermissionsNew.includes(p)}
                            onCheckedChange={(checked) => {
                              setSelectedPermissionsNew(
                                checked
                                  ? [...selectedPermissionsNew, p]
                                  : selectedPermissionsNew.filter((i) => i !== p)
                              );
                            }}
                          />
                          <span className="text-xs">{p}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-4">
                  <p className="text-sm mb-4">
                    Enter OTP sent to +{pendingUserHeadPhone?.phone_country}{" "}
                    {pendingUserHeadPhone?.phone_number}
                  </p>
                  <Input
                    placeholder="OTP"
                    value={addOtp}
                    onChange={(e) => setAddOtp(e.target.value)}
                  />
                  <div className="mt-4 text-center">
                    <button
                      onClick={handleResendOtp}
                      disabled={resendTimer > 0}
                      className={cn(
                        "text-xs font-bold transition-all",
                        resendTimer > 0 ? "text-gray-400 cursor-not-allowed" : "text-primary hover:underline"
                      )}
                    >
                      {resendTimer > 0 ? `Resend OTP in ${resendTimer}s` : "Didn't receive code? Resend OTP"}
                    </button>
                  </div>
                </div>
              )}

              <DialogFooter>
                {addStep === "form" ? (
                  <Button onClick={handleAddUserHeadSubmit}>Next</Button>
                ) : (
                  <Button onClick={handleVerifyOtp}>Verify</Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="icon"
            onClick={fetchUserHeads}
            title="Refresh"
            disabled={loading}
          >
            <RefreshCcw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Summary */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard
            title="Total User Heads"
            value={userHeads.length.toString()}
            icon={User2}
            variant="primary"
            trend={{ value: "All active", isPositive: true }}
          />
          <StatCard
            title="Active"
            value={userHeads
              .filter((u) => u.status === "Active")
              .length.toString()}
            icon={User2}
            variant="success"
            trend={{ value: "Currently working", isPositive: true }}
          />
          <StatCard
            title="Inactive"
            value={userHeads
              .filter((u) => u.status !== "Active")
              .length.toString()}
            icon={User2}
            variant="warning"
            trend={{ value: "Need review", isPositive: false }}
          />
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-lg shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">All User Heads</h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <RefreshCcw className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
        ) : filteredHeads.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            No user heads found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Name</th>
                  <th className="text-left py-3 px-4 font-semibold">Phone</th>

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
                  <th className="text-left py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHeads.map((u, i) => (
                  <tr
                    key={u._id || u.id || i}
                    className="border-b hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium">{u.name || "—"}</td>
                    <td className="py-3 px-4">
                      {u.phone_number && Array.isArray(u.phone_number)
                        ? `+${u.phone_number.join(" ")}`
                        : "—"}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          u.status === "Active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        }`}
                      >
                        {u.status || "Unknown"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Switch
                        checked={u.status !== "Inactive"}
                        onCheckedChange={() => handleToggleStatus(u._id || u.id || "", u.status)}
                        title={u.status === "Inactive" ? "Activate" : "Deactivate"}
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
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
            <p className="text-sm text-muted-foreground pt-2">
              Are you sure you want to set this User Head to{" "}
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

export default CH_UserHeads;

