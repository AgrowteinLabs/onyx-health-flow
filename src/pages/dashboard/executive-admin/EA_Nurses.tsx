
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Search, Edit, Trash2, HeartPulse, Phone, Eye, EyeOff } from "lucide-react";
import { createNurse, deleteNurse, listNurses, updateNurse, toggleNurseStatus } from "@/services/nurse.service";
import { listOrganizations } from "@/services/organization.service";
import { getUserPermissions } from "@/services/permission.service";
import { apiRequest } from "@/lib/api-request";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

interface Nurse {
  _id?: string;
  id?: string;
  name: string;
  phone_number: string[];
  country?: string;
  organizationName?: string;
  status: string;
  organization?: {
    _id?: string;
    organizationName?: string;
  };
  devices?: {
    _id: string;
    name: string;
  }[];
}

interface Organization {
  id?: string;
  _id?: string;
  organizationName: string;
  organizationCode?: string;
  devices?: { _id: string; name: string; deviceCode: string }[];
  userId?: { _id: string; name: string };
}

const EA_Nurses = () => {
  const { toast } = useToast();
  const [nurses, setNurses] = useState<Nurse[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [filtered, setFiltered] = useState<Nurse[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // dialog + form states
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingNurse, setPendingNurse] = useState<any>(null);
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"form" | "verify">("form");
  const [showPassword, setShowPassword] = useState(false);

  // permissions
  const [permissions, setPermissions] = useState<string[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: "",
    phone_country: "91",
    phone_number: "",
    password: "",
    country: "India",
    orgId: "",
    devices: [] as string[],
  });

  // ====== Edit States ======
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingNurse, setEditingNurse] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone_country: "91",
    phone_number: "",
    country: "India",
    orgId: "",
    devices: [] as string[],
    status: "Active",
  });
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [availableDevices, setAvailableDevices] = useState<any[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const handleEdit = async (nurse: any) => {
    setEditingNurse(nurse);
    const orgId = nurse.orgId || nurse.organization?._id || nurse.organization?.id || "";
    setEditForm({
      name: nurse.name,
      phone_country: nurse.phone_number?.[0] || "91",
      phone_number: nurse.phone_number?.[1] || "",
      country: nurse.country || "India",
      orgId: orgId,
      devices: nurse.devices || [],
      status: nurse.status || "Active",
    });
    setEditPermissions(nurse.permissions || []);

    const selectedOrg = organizations.find((o) => o.id === orgId || o._id === orgId);
    setAvailableDevices(selectedOrg?.devices || []);

    if (selectedOrg?.userId?._id) {
      try {
        const perms = await getUserPermissions(selectedOrg.userId._id);
        setAvailablePermissions(perms);
      } catch (err) {
        console.error("Failed to load permissions:", err);
      }
    } else {
      setAvailablePermissions([]);
    }

    setEditDialogOpen(true);
  };

  const handleOrgSelectEdit = async (orgId: string) => {
    setEditForm((prev) => ({ ...prev, orgId, devices: [] }));
    setEditPermissions([]);
    setAvailableDevices([]);
    setAvailablePermissions([]);

    const org = organizations.find((o) => o.id === orgId || o._id === orgId);
    setAvailableDevices(org?.devices || []);

    if (!org || !org.userId?._id) return;

    try {
      const perms = await getUserPermissions(org.userId._id);
      setAvailablePermissions(perms);
      setEditPermissions(perms); // auto-select all
    } catch (err) {
      console.error("Failed to load permissions:", err);
    }
  };

  const handleUpdate = async () => {
    if (!editingNurse) return;
    if (!editForm.name) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (!editForm.phone_number) { toast({ title: "Phone number is required", variant: "destructive" }); return; }
    if (!editForm.orgId) { toast({ title: "Please select an organization", variant: "destructive" }); return; }
    if (editForm.devices.length === 0) { toast({ title: "Please select at least one device", variant: "destructive" }); return; }

    setSavingEdit(true);
    try {
      const payload = {
        name: editForm.name,
        phone_number: [editForm.phone_country, editForm.phone_number],
        country: editForm.country,
        orgId: editForm.orgId,
        devices: editForm.devices,
        permissions: editPermissions,
        status: editForm.status,
      };

      await updateNurse(editingNurse._id || editingNurse.id, payload);
      toast({ title: "Nurse updated successfully" });
      setEditDialogOpen(false);
      fetchNurses();
    } catch (err: any) {
      toast({
        title: "Failed to update nurse",
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

  const toggleEditDevice = (id: string) => {
    setEditForm((prev) => {
      const devices = prev.devices.includes(id)
        ? prev.devices.filter((d) => d !== id)
        : [...prev.devices, id];
      return { ...prev, devices };
    });
  };

  // ================================
  // Fetch nurses + organizations
  // ================================
  const fetchNurses = async () => {
    setLoading(true);
    try {
      const data = await listNurses();
      // listNurses may return { nurses: [...] } or an array - normalize both
      const nursesArray: any[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any).nurses)
        ? (data as any).nurses
        : [];

      const normalized = nursesArray.map((n: any) => ({
        ...n,
        // prefer nested organization name if present
        organizationName:
          n.organization?.organizationName || n.organizationName || undefined,
        organization: n.organization || undefined,
      }));

      setNurses(normalized);
      setFiltered(normalized);
    } catch (err) {
      toast({ title: "Failed to load nurses", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const data = await listOrganizations();
      const orgs = Array.isArray(data.organizations)
        ? data.organizations
        : data;
      setOrganizations(orgs);
    } catch (err) {
      toast({ title: "Error fetching organizations", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchNurses();
    fetchOrganizations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ================================
  // Search & Status Filter
  // ================================
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let list = nurses;
    if (search.trim() !== "") {
      list = list.filter((n) =>
        n.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((n) => (n.status || "Active") === statusFilter);
    }
    setFiltered(list);
  }, [search, statusFilter, nurses]);

  // ================================
  // When organization changes → get permissions
  // ================================
  const handleOrgSelect = async (orgId: string) => {
    setFormData({ ...formData, orgId, devices: [] });
    setPermissions([]);
    setSelectedPermissions([]);

    const org = organizations.find((o) => o.id === orgId || o._id === orgId);
    if (!org || !org.userId?._id) return;

    try {
      const perms = await getUserPermissions(org.userId._id);
      setPermissions(perms);
      setSelectedPermissions(perms); // ✅ auto-select all
    } catch (err) {
      console.error("Failed to load permissions:", err);
      toast({ title: "Error loading permissions", variant: "destructive" });
    }
  };

  // ================================
  // Create Nurse (Step 1)
  // ================================
  const handleCreate = async () => {
    const {
      name,
      phone_country,
      phone_number,
      password,
      orgId,
      devices,
      country,
    } = formData;

    if (!name) { toast({ title: "Name is required", variant: "destructive" }); return; }
    if (!phone_number) { toast({ title: "Phone number is required", variant: "destructive" }); return; }
    if (!password) { toast({ title: "Password is required", variant: "destructive" }); return; }
    if (!orgId) { toast({ title: "Please select an organization", variant: "destructive" }); return; }
    if (devices.length === 0) { toast({ title: "Please select at least one device", variant: "destructive" }); return; }

    try {
      const selectedOrgCode = selectedOrg?.organizationCode || orgId;
      const payload = {
        phone_number: [phone_country, phone_number],
        password,
        name,
        country,
        orgId: selectedOrgCode,
        permissions: selectedPermissions,
        devices,
      };

      await createNurse(payload);
      setPendingNurse({ phone_country, phone_number });
      setStep("verify");
      toast({ title: "OTP sent successfully" });
    } catch (err) {
      console.error(err);
      toast({ title: "Error creating nurse", variant: "destructive" });
    }
  };

  // ================================
  // Verify OTP (Step 2)
  // ================================
  const handleVerifyOtp = async () => {
    if (!otp) {
      toast({ title: "Please enter OTP", variant: "destructive" });
      return;
    }

    try {
      await apiRequest("/api/auth/create/verify-nurse", {
        method: "POST",
        data: { otp },
      });

      toast({ title: "Nurse verified & created successfully" });
      setDialogOpen(false);
      setStep("form");
      setOtp("");
      setPendingNurse(null);
      setFormData({
        name: "",
        phone_country: "91",
        phone_number: "",
        password: "",
        country: "India",
        orgId: "",
        devices: [],
      });
      fetchNurses();
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to verify OTP", variant: "destructive" });
    }
  };

  // ================================
  // Toggle Nurse Status
  // ================================
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
      await toggleNurseStatus(id, newStatus);
      toast({ title: `Nurse status updated to ${newStatus}` });
      setConfirmOpen(false);
      fetchNurses();
    } catch (err: any) {
      toast({ title: "Failed to update nurse status", variant: "destructive" });
    }
  };

  const selectedOrg: Organization =
    organizations.find(
      (o) => o.id === formData.orgId || o._id === formData.orgId
    ) || { organizationName: "", devices: [] };

  // ================================
  // UI
  // ================================
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <HeartPulse className="h-7 w-7 text-primary" /> Nurses
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage nurses and assign them to organizations and devices.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Nurse
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
            <DialogHeader className="p-6 border-b shrink-0">
              <DialogTitle>
                {step === "form" ? "Add Nurse" : "Verify OTP"}
              </DialogTitle>
            </DialogHeader>

            {step === "form" ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <Input
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Country Code"
                    value={formData.phone_country}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        phone_country: e.target.value,
                      })
                    }
                    className="w-20"
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
                <div className="relative">
                  <Input
                    placeholder="Password"
                    type={showPassword ? "text" : "password"}
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

                {/* Organization */}
                <Select
                  onValueChange={(value) => handleOrgSelect(value)}
                  value={formData.orgId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org) => (
                      <SelectItem key={org.id || org._id} value={org.id || org._id || ""}>
                        {org.organizationName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Devices */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="justify-between"
                      disabled={!selectedOrg.devices?.length}
                    >
                      {formData.devices.length > 0
                        ? `${formData.devices.length} device(s) selected`
                        : selectedOrg.devices?.length
                        ? "Select Devices"
                        : "No devices available"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64">
                    <div className="grid gap-2">
                      {selectedOrg.devices?.map((device) => (
                        <label
                          key={device._id}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={formData.devices.includes(device._id)}
                            onCheckedChange={(checked) => {
                              const updated = checked
                                ? [...formData.devices, device._id]
                                : formData.devices.filter(
                                    (id) => id !== device._id
                                  );
                              setFormData({ ...formData, devices: updated });
                            }}
                          />
                          <span className="text-sm">
                            {device.name} ({device.deviceCode})
                          </span>
                        </label>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Permissions */}
                {permissions.length > 0 && (
                  <div className="mt-3 border-t pt-3">
                    <h4 className="font-medium mb-2 text-sm">
                      Assign Permissions
                    </h4>
                    <div className="grid gap-2">
                      {permissions.map((perm) => (
                        <label
                          key={perm}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <Checkbox
                            checked={selectedPermissions.includes(perm)}
                            onCheckedChange={(checked) => {
                              const updated = checked
                                ? [...selectedPermissions, perm]
                                : selectedPermissions.filter((p) => p !== perm);
                              setSelectedPermissions(updated);
                            }}
                          />
                          <span className="text-sm">{perm}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <p className="text-muted-foreground text-sm">
                  Enter the OTP sent to +{pendingNurse?.phone_country}{" "}
                  {pendingNurse?.phone_number}
                </p>
                <Input
                  placeholder="Enter OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>
            )}

            <DialogFooter className="p-6 border-t bg-muted/30 shrink-0">
              {step === "form" ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleCreate}>Next</Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep("form");
                      setOtp("");
                    }}
                  >
                    Back
                  </Button>
                  <Button onClick={handleVerifyOtp}>Verify</Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Nurse Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b shrink-0">
            <DialogTitle>Edit Nurse</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input
                placeholder="Full Name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Phone Connectivity</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Country Code"
                  value={editForm.phone_country}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      phone_country: e.target.value,
                    })
                  }
                  className="w-20"
                />
                <Input
                  placeholder="Phone Number"
                  value={editForm.phone_number}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      phone_number: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Country</Label>
              <Input
                placeholder="Country"
                value={editForm.country}
                onChange={(e) =>
                  setEditForm({ ...editForm, country: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
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

            {/* Organization */}
            <div className="space-y-1">
              <Label>Organization</Label>
              <Select
                onValueChange={(value) => handleOrgSelectEdit(value)}
                value={editForm.orgId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id || org._id} value={org.id || org._id || ""}>
                      {org.organizationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Devices */}
            <div>
              <p className="text-sm font-medium mb-2">Assign Devices</p>
              {availableDevices.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No devices available for this organization
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto border rounded-md p-2">
                  {availableDevices.map((device) => (
                    <label
                      key={device._id}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={editForm.devices.includes(device._id)}
                        onCheckedChange={() => toggleEditDevice(device._id)}
                      />
                      <span className="text-sm">
                        {device.name} ({device.deviceCode})
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Permissions */}
            {availablePermissions.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Assign Permissions</p>
                <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto border rounded-md p-2">
                  {availablePermissions.map((perm) => (
                    <label
                      key={perm}
                      className="flex items-center space-x-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={editPermissions.includes(perm)}
                        onCheckedChange={() => toggleEditPermission(perm)}
                      />
                      <span className="text-sm">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
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

      {/* Search */}
      <div className="flex justify-end">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search nurses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Nurses</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading nurses...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No nurses found
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Name</th>
                    <th className="text-left py-3 px-4 font-semibold">Phone</th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Organization
                    </th>
                    <th className="text-left py-3 px-4 font-semibold">
                      Assigned Devices
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
                  {filtered.map((n) => (
                    <tr
                      key={n.id || n._id}
                      className="border-b hover:bg-muted/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium">{n.name}</td>
                      <td className="py-3 px-4 text-muted-foreground flex items-center gap-1">
                        <Phone className="h-4 w-4" /> +
                        {n.phone_number?.join(" ")}
                      </td>
                      <td className="py-3 px-4">
                        {n.organization?.organizationName ||
                          n.organizationName ||
                          "—"}
                      </td>
                      <td className="py-3 px-4">
                        {n.devices && n.devices.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {n.devices.map((d) => (
                              <span
                                key={d._id}
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                              >
                                {d.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          n.status === "Inactive"
                            ? "bg-gray-100 text-gray-800 border-gray-200"
                            : "bg-[#e6f4ea] text-[#137333] border-[#ceead6]"
                        )}>
                          {n.status || "Active"}
                        </span>
                      </td>
                      <td className="py-3 px-4 flex items-center gap-3">
                        {n.status !== "Inactive" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(n)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <Switch
                          checked={n.status !== "Inactive"}
                          onCheckedChange={() => handleToggleStatus(n.id || n._id || "", n.status)}
                          title={n.status === "Inactive" ? "Activate" : "Deactivate"}
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
              Are you sure you want to set this nurse to{" "}
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

export default EA_Nurses;
