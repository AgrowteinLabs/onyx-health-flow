import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Phone,
  UserCog,
  ShieldCheck,
  Send,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  listTechnicians,
  deleteTechnician,
  sendTechnicianOTP,
  verifyTechnicianOTP,
  updateTechnician,
} from "@/services/technician.service";
import { listPermissions } from "@/services/permission.service";
import { Checkbox } from "@/components/ui/checkbox";

interface Technician {
  _id?: string;
  name: string;
  phone_number: string[];
  country: string;
  status?: string;
  permissions?: string[];
}

const EA_Technicians = () => {
  const { toast } = useToast();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [filtered, setFiltered] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);

  // Two-step process state
  const [step, setStep] = useState<"form" | "otp">("form");
  const [otp, setOtp] = useState("");
  const [sendingOTP, setSendingOTP] = useState(false);
  const [verifyingOTP, setVerifyingOTP] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone_country: "91",
    phone_number: "",
    password: "",
    country: "India",
  });

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone_country: "91",
    phone_number: "",
    country: "India",
    status: "Active",
  });
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  /* ================================
     Fetch All Technicians
  ================================ */
  const fetchTechnicians = async () => {
    setLoading(true);
    try {
      const data = await listTechnicians();

      const techniciansArray: any[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any).technicians)
        ? (data as any).technicians
        : [];

      const normalized = techniciansArray.map((t: any) => ({
        ...t,
        id: t._id || t.id,
        phone_number: Array.isArray(t.phone_number)
          ? t.phone_number
          : t.phone_number
          ? [t.phone_country || "91", String(t.phone_number)]
          : [],
        country: t.country || t.countryCode || "—",
        organizationName:
          t.organization?.organizationName || t.organizationName || undefined,
        organization: t.organization || undefined,
      }));

      setTechnicians(normalized);
      setFiltered(normalized);
    } catch (err) {
      toast({ title: "Failed to load technicians", variant: "destructive" });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /* ================================
     Fetch Permissions
  ================================ */
  const fetchPermissions = async () => {
    try {
      const data = await listPermissions();

      let list: string[] = [];

      if (Array.isArray(data)) list = data;
      else if (Array.isArray(data?.permissions)) list = data.permissions;
      else if (data?.permissions && typeof data.permissions === "object")
        list = Object.keys(data.permissions);
      else list = [];

      console.log("✅ Normalized permissions list:", list);
      setPermissions(list);
    } catch (err) {
      console.error("❌ Error fetching permissions:", err);
      toast({ title: "Error fetching permissions", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchTechnicians();
    fetchPermissions();
  }, []);

  /* ================================
     Search Filter
  ================================ */
  // ================================
  // Search & Status Filter
  // ================================
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let list = technicians;
    if (search.trim() !== "") {
      list = list.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((t) => (t.status || "Active") === statusFilter);
    }
    setFiltered(list);
  }, [search, statusFilter, technicians]);

  /* ================================
     Step 1: Send OTP (with all data)
  ================================ */
  const handleSendOTP = async () => {
    const { name, phone_country, phone_number, password } = formData;

    if (!name || !phone_number || !password) {
      toast({
        title: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    if (phone_number.length < 10) {
      toast({
        title: "Invalid phone number",
        description: "Phone number must be at least 10 digits",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Invalid password",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }

    if (selectedPermissions.length === 0) {
      toast({
        title: "Please select at least one permission",
        variant: "destructive",
      });
      return;
    }

    setSendingOTP(true);
    try {
      const payload = {
        phone_number: [phone_country, phone_number],
        password,
        name,
        country: formData.country,
        permissions: selectedPermissions,
      };

      console.log("📤 Sending OTP with payload:", payload);

      const response = await sendTechnicianOTP(payload);
      console.log("✅ OTP Response:", response);

      toast({
        title: "OTP Sent",
        description:
          response?.message ||
          "Please check the phone for the verification code.",
      });

      setStep("otp");
    } catch (err: any) {
      console.error("❌ Error sending OTP:", err);
      console.error("❌ Error details:", {
        message: err.message,
        response: err.response,
        status: err.status,
      });

      toast({
        title: "Failed to send OTP",
        description:
          err.message ||
          err.error ||
          "Something went wrong. Please check console for details.",
        variant: "destructive",
      });
    } finally {
      setSendingOTP(false);
    }
  };

  /* ================================
     Step 2: Verify OTP & Create Technician (only OTP)
  ================================ */
  const handleVerifyAndCreate = async () => {
    if (!otp || otp.length < 4) {
      toast({
        title: "Please enter a valid OTP",
        variant: "destructive",
      });
      return;
    }

    setVerifyingOTP(true);
    try {
      const payload = {
        otp, // Only send OTP
      };

      console.log("📤 Verifying OTP:", payload);
      await verifyTechnicianOTP(payload);

      toast({
        title: "Technician created successfully",
        description: `${formData.name} has been added to the system.`,
      });

      // Reset everything
      setDialogOpen(false);
      setStep("form");
      setOtp("");
      setFormData({
        name: "",
        phone_country: "91",
        phone_number: "",
        password: "",
        country: "India",
      });
      setSelectedPermissions([]);

      fetchTechnicians();
    } catch (err: any) {
      console.error("❌ Error verifying OTP:", err);
      toast({
        title: "Verification failed",
        description: err.message || "Invalid OTP or something went wrong",
        variant: "destructive",
      });
    } finally {
      setVerifyingOTP(false);
    }
  };

  /* ================================
     Toggle Technician Status
  ================================ */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{ id: string; currentStatus: string } | null>(null);

  const handleToggleStatus = (id?: string, currentStatus?: string) => {
    if (!id) return;
    setConfirmData({ id, currentStatus: currentStatus || "Active" });
    setConfirmOpen(true);
  };

  const executeToggleStatus = async () => {
    if (!confirmData) return;
    const { id, currentStatus } = confirmData;
    const newStatus = currentStatus === "Inactive" ? "Active" : "Inactive";
    try {
      await updateTechnician(id, { status: newStatus });
      toast({ title: `Technician status updated to ${newStatus}` });
      setConfirmOpen(false);
      fetchTechnicians();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Failed to update technician status", variant: "destructive" });
    }
  };

  /* ================================
     Toggle Permission Selection
  ================================ */
  const togglePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setStep("form");
      setOtp("");
      setFormData({
        name: "",
        phone_country: "91",
        phone_number: "",
        password: "",
        country: "India",
      });
      setSelectedPermissions([]);
    }
  };

  /* ================================
     Edit Logic
  ================================ */
  const handleEdit = (tech: any) => {
    setEditingTech(tech);
    setEditForm({
      name: tech.name,
      phone_country: tech.phone_number?.[0] || "91",
      phone_number: tech.phone_number?.[1] || "",
      country: tech.country,
      status: tech.status || "Active",
    });
    setEditPermissions(tech.permissions || []);
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingTech) return;
    setSavingEdit(true);
    try {
      const payload = {
        name: editForm.name,
        phone_number: [editForm.phone_country, editForm.phone_number],
        country: editForm.country,
        status: editForm.status,
        permissions: editPermissions,
      };

      await updateTechnician(editingTech._id || editingTech.id, payload);
      toast({ title: "Technician updated successfully" });
      setEditDialogOpen(false);
      fetchTechnicians();
    } catch (err: any) {
      toast({
        title: "Failed to update technician",
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

  /* ================================
     UI
  ================================ */
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserCog className="h-7 w-7 text-primary" /> Technicians
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage all technicians created under your supervision
          </p>
        </div>

        {/* Add Technician Dialog */}
        <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Technician
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
            <DialogHeader className="p-6 border-b shrink-0">
              <DialogTitle>
                {step === "form" ? "Add Technician" : "Verify OTP"}
              </DialogTitle>
              <DialogDescription>
                {step === "form"
                  ? "Fill in the technician details and assign permissions"
                  : "Enter the OTP sent to the technician's phone number"}
              </DialogDescription>
            </DialogHeader>

            {/* Step 1: Form */}
            {step === "form" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <Label>Full Name *</Label>
                  <Input
                    placeholder="Enter full name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <Label>Phone Number *</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Code"
                      className="w-20"
                      value={formData.phone_country}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          phone_country: e.target.value,
                        })
                      }
                    />
                    <Input
                      placeholder="Phone Number"
                      value={formData.phone_number}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          phone_number: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>Password *</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="pr-10"
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
                  <Label>Country</Label>
                  <Input
                    placeholder="Country"
                    value={formData.country}
                    onChange={(e) =>
                      setFormData({ ...formData, country: e.target.value })
                    }
                  />
                </div>

                {/* Permissions */}
                <div className="border rounded-md p-3 bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <p className="font-medium text-sm">Assign Permissions *</p>
                  </div>

                  {permissions.length === 0 ? (
                    <p className="text-muted-foreground text-xs">
                      Loading permissions...
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto">
                      {permissions.map((perm) => (
                        <label
                          key={perm}
                          className="flex items-center space-x-2 text-sm"
                        >
                          <Checkbox
                            checked={selectedPermissions.includes(perm)}
                            onCheckedChange={() => togglePermission(perm)}
                          />
                          <span>{perm}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: OTP Verification */}
            {step === "otp" && (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="text-center">
                  <Send className="h-12 w-12 mx-auto text-primary mb-2" />
                  <p className="text-sm text-muted-foreground">
                    OTP sent to +{formData.phone_country}{" "}
                    {formData.phone_number}
                  </p>
                </div>

                <div>
                  <Label>Enter OTP *</Label>
                  <Input
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    maxLength={6}
                    className="text-center text-lg tracking-widest"
                  />
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep("form")}
                  className="text-xs"
                >
                  ← Back to form
                </Button>
              </div>
            )}

            <DialogFooter className="p-6 border-t bg-muted/30 shrink-0">
              {step === "form" ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => handleDialogClose(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSendOTP} disabled={sendingOTP}>
                    {sendingOTP ? "Sending..." : "Send OTP"}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setStep("form")}
                    disabled={verifyingOTP}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleVerifyAndCreate}
                    disabled={verifyingOTP}
                  >
                    {verifyingOTP ? "Verifying..." : "Verify & Create"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="flex justify-end">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search technicians..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Technicians</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading technicians...
            </div>
          ) : !Array.isArray(filtered) || filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No technicians found
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Name</th>
                    <th className="text-left py-3 px-4 font-semibold">Phone</th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Country
                    </th>
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
                    <th className="text-left py-3 px-4 font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr
                      key={t._id}
                      className="border-b hover:bg-muted/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium">{t.name}</td>
                      <td className="py-3 px-4 text-muted-foreground flex items-center gap-1">
                        <Phone className="h-4 w-4" /> +
                        {t.phone_number?.join(" ")}
                      </td>
                      <td className="py-3 px-4">{t.country}</td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          t.status === "Inactive"
                            ? "bg-gray-100 text-gray-800 border-gray-200"
                            : "bg-[#e6f4ea] text-[#137333] border-[#ceead6]"
                        )}>
                          {t.status || "Active"}
                        </span>
                      </td>
                      <td className="py-3 px-4 flex items-center gap-3">
                        {t.status !== "Inactive" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(t)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <Switch
                          checked={t.status !== "Inactive"}
                          onCheckedChange={() => handleToggleStatus(t._id, t.status)}
                          title={t.status === "Inactive" ? "Activate" : "Deactivate"}
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

      {/* Edit Technician Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b shrink-0">
            <DialogTitle>Edit Technician</DialogTitle>
            <DialogDescription>
              Update technician profile and permissions
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div>
              <Label>Full Name *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>

            <div>
              <Label>Phone Number *</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Code"
                  className="w-20"
                  value={editForm.phone_country}
                  onChange={(e) => setEditForm({ ...editForm, phone_country: e.target.value })}
                />
                <Input
                  placeholder="Phone Number"
                  value={editForm.phone_number}
                  onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Country</Label>
              <Input
                value={editForm.country}
                onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
              />
            </div>

            <div>
              <Label>Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(v) => setEditForm({ ...editForm, status: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Permissions */}
            <div className="border rounded-md p-3 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="font-medium text-sm">Update Permissions</p>
              </div>

              <div className="grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto">
                {permissions.map((perm) => (
                  <label key={perm} className="flex items-center space-x-2 text-sm">
                    <Checkbox
                      checked={editPermissions.includes(perm)}
                      onCheckedChange={() => toggleEditPermission(perm)}
                    />
                    <span>{perm}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 border-t bg-muted/30 shrink-0">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={savingEdit}>
              {savingEdit ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Confirm Status Change Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirm Status Change</DialogTitle>
            <p className="text-sm text-muted-foreground pt-2">
              Are you sure you want to set this technician to{" "}
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

export default EA_Technicians;
