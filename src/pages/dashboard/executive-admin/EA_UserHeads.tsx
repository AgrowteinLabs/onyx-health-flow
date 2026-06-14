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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/use-toast";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Building2,
  Phone,
  Shield,
  Cpu,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

import {
  createUserHead,
  deleteUserHead,
  listUserHeads,
  verifyUserHead,
  updateUserHead,
  toggleUserHeadStatus,
} from "@/services/userHead.service";
import { listOrganizations } from "@/services/organization.service";
import { getUserPermissions } from "@/services/permission.service";

interface UserHead {
  id?: string;
  _id?: string;
  name: string;
  phone_number: string[];
  country: string;
  orgId?: string;
  organizationName?: string;
  status: string;
}

interface Organization {
  id?: string;
  _id?: string;
  organizationName: string;
  organizationCode?: string;
  devices?: { _id: string; name: string; deviceCode?: string }[];
  userId?: { _id: string; name: string };
}

const EA_UserHeads = () => {
  const { toast } = useToast();
  const [userHeads, setUserHeads] = useState<UserHead[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<UserHead[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [pendingUser, setPendingUser] = useState<{
    phone_country: string;
    phone_number: string;
  }>({
    phone_country: "",
    phone_number: "",
  });
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone_country: "91",
    phone_number: "",
    password: "",
    country: "India",
    orgId: "",
  });

  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);

  // ====== Edit States ======
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUserHead, setEditingUserHead] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone_country: "91",
    phone_number: "",
    country: "India",
    orgId: "",
    status: "Active",
  });
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editDevices, setEditDevices] = useState<string[]>([]);
  const [availableDevices, setAvailableDevices] = useState<any[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<string[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const handleEdit = async (u: any) => {
    setEditingUserHead(u);
    setEditForm({
      name: u.name,
      phone_country: u.phone_number?.[0] || "91",
      phone_number: u.phone_number?.[1] || "",
      country: u.country || "India",
      orgId: u.orgId || u.organization?._id || u.organization?.id || "",
      status: u.status || "Active",
    });
    setEditPermissions(u.permissions || []);
    setEditDevices(u.devices || []);

    // Load available devices and permissions for the selected organization
    const orgId = u.orgId || u.organization?._id || u.organization?.id || "";
    const selectedOrg = organizations.find(
      (o) => o.id === orgId || o._id === orgId
    );
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
    setEditForm((prev) => ({ ...prev, orgId }));
    setEditDevices([]);
    setEditPermissions([]);
    setAvailableDevices([]);
    setAvailablePermissions([]);

    const selectedOrg = organizations.find(
      (o) => o.id === orgId || o._id === orgId
    );
    setAvailableDevices(selectedOrg?.devices || []);

    if (!selectedOrg?.userId?._id) return;

    try {
      const perms = await getUserPermissions(selectedOrg.userId._id);
      setAvailablePermissions(perms);
      setEditPermissions(perms); // auto-select all
    } catch (err) {
      console.error("Failed to load permissions:", err);
    }
  };

  const handleUpdate = async () => {
    if (!editingUserHead) return;
    setSavingEdit(true);
    try {
      const payload = {
        name: editForm.name,
        phone_number: [editForm.phone_country, editForm.phone_number],
        country: editForm.country,
        orgId: editForm.orgId,
        status: editForm.status,
        permissions: editPermissions,
        devices: editDevices,
      };

      await updateUserHead(editingUserHead._id || editingUserHead.id, payload);
      toast({ title: "User Head updated successfully" });
      setEditDialogOpen(false);
      fetchUserHeads();
    } catch (err: any) {
      toast({
        title: "Failed to update User Head",
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
    setEditDevices((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  // ================================
  // Fetch all user heads
  // ================================
  const fetchUserHeads = async () => {
    setLoading(true);
    try {
      const data = await listUserHeads();

      // Accept multiple response shapes:
      // - an array
      // - an object with { user_heads: [...] }
      const userHeadsArray: any[] = Array.isArray(data)
        ? data
        : Array.isArray((data as any).user_heads)
        ? (data as any).user_heads
        : [];

      const normalized = userHeadsArray.map((u: any) => ({
        ...u,
        id: u._id || u.id,
        // Ensure phone_number is always an array
        phone_number: Array.isArray(u.phone_number)
          ? u.phone_number
          : u.phone_number
          ? [u.phone_country || "91", String(u.phone_number)]
          : [],
        country: u.country || "—",
        // prefer nested organization name if present
        organizationName:
          u.organization?.organizationName || u.organizationName || undefined,
        organization: u.organization || undefined,
      }));

      setUserHeads(normalized);
      setFiltered(normalized);
    } catch (err) {
      toast({ title: "Failed to load user heads", variant: "destructive" });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ================================
  // Fetch organizations (with devices)
  // ================================
  const fetchOrganizations = async () => {
    try {
      const data = await listOrganizations();
      const orgList = Array.isArray(data?.organizations)
        ? data.organizations
        : Array.isArray(data)
        ? data
        : [];
      setOrganizations(orgList);
    } catch (err) {
      console.error(err);
      toast({ title: "Error fetching organizations", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchUserHeads();
    fetchOrganizations();
  }, []);

  // ================================
  // Handle organization selection → fetch devices & permissions
  // ================================
  const handleOrgSelect = async (orgId: string) => {
    setFormData({ ...formData, orgId });
    setSelectedDevices([]);
    setSelectedPermissions([]);
    setDevices([]);

    const selectedOrg = organizations.find(
      (o) => o.id === orgId || o._id === orgId
    );
    setDevices(selectedOrg?.devices || []);

    if (!selectedOrg?.userId?._id) return;

    try {
      const perms = await getUserPermissions(selectedOrg.userId._id);
      setPermissions(perms);
      setSelectedPermissions(perms); // auto-select all
    } catch (err) {
      console.error("Failed to load permissions:", err);
      toast({ title: "Error fetching permissions", variant: "destructive" });
    }
  };

  // ================================
  // Search & Status Filter
  // ================================
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let list = userHeads;
    if (search.trim() !== "") {
      list = list.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((u) => (u.status || "Active") === statusFilter);
    }
    setFiltered(list);
  }, [search, statusFilter, userHeads]);

  // ================================
  // Toggle handlers
  // ================================
  const togglePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const toggleDevice = (id: string) => {
    setSelectedDevices((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  // ================================
  // Create User Head
  // ================================
  const handleSubmit = async () => {
    const { name, phone_country, phone_number, password, orgId, country } =
      formData;

    if (!name || !phone_number || !password || !orgId) {
      toast({
        title: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const selectedOrg = organizations.find(
        (o) => o.id === orgId || o._id === orgId
      );
      const payload = {
        phone_number: [phone_country, phone_number],
        password,
        name,
        country,
        orgId: selectedOrg?.organizationCode || orgId,
        permissions: selectedPermissions,
        devices: selectedDevices,
      };

      await createUserHead(payload);
      toast({ title: "OTP sent", description: "Please verify the user head" });
      setPendingUser({ phone_country, phone_number });
      setOtpDialogOpen(true);
      setDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast({ title: "Error creating User Head", variant: "destructive" });
    }
  };

  // ================================
  // Verify OTP
  // ================================
  const handleVerifyOtp = async () => {
    try {
      await verifyUserHead({ otp });
      toast({ title: "✅ User Head verified successfully" });
      setOtpDialogOpen(false);
      setOtp("");
      fetchUserHeads();
    } catch (err) {
      console.error(err);
      toast({ title: "Invalid or expired OTP", variant: "destructive" });
    }
  };

  // ================================
  // Toggle User Head Status
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
      await toggleUserHeadStatus(id, newStatus);
      toast({ title: `User Head is now ${newStatus}` });
      setConfirmOpen(false);
      fetchUserHeads();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  // ================================
  // UI
  // ================================
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" /> User Heads
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage User Heads under specific organizations
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add User Head
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
            <DialogHeader className="p-6 border-b shrink-0">
              <DialogTitle>Create User Head</DialogTitle>
            </DialogHeader>

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
                    setFormData({ ...formData, phone_country: e.target.value })
                  }
                  className="w-20"
                />
                <Input
                  placeholder="Phone Number"
                  value={formData.phone_number}
                  onChange={(e) =>
                    setFormData({ ...formData, phone_number: e.target.value })
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

              {/* Organization Select */}
              <Select
                onValueChange={(value) => handleOrgSelect(value)}
                value={formData.orgId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem
                      key={org.id || org._id}
                      value={org.id || org._id}
                    >
                      {org.organizationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Permissions */}
              {permissions.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1">
                    <Shield className="h-4 w-4 text-primary" /> Assign
                    Permissions
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto border rounded-md p-2">
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
                </div>
              )}

              {/* Devices */}
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Cpu className="h-4 w-4 text-primary" /> Assign Devices
                </p>
                {devices.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No devices available for this organization
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto border rounded-md p-2">
                    {devices.map((device) => (
                      <label
                        key={device._id}
                        className="flex items-center space-x-2 text-sm"
                      >
                        <Checkbox
                          checked={selectedDevices.includes(device._id)}
                          onCheckedChange={() => toggleDevice(device._id)}
                        />
                        <span>{device.name || device.deviceName}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="p-6 border-t bg-muted/30 shrink-0">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* OTP Dialog */}
      <Dialog open={otpDialogOpen} onOpenChange={setOtpDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Verify OTP</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the OTP sent to +{pendingUser.phone_country}{" "}
              {pendingUser.phone_number}.
            </p>
            <Input
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOtpDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleVerifyOtp}>Verify</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Head Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b shrink-0">
            <DialogTitle>Edit User Head</DialogTitle>
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
                    setEditForm({ ...editForm, phone_country: e.target.value })
                  }
                  className="w-20"
                />
                <Input
                  placeholder="Phone Number"
                  value={editForm.phone_number}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone_number: e.target.value })
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

            {/* Organization Select */}
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
                    <SelectItem
                      key={org.id || org._id}
                      value={org.id || org._id || ""}
                    >
                      {org.organizationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Permissions */}
            {availablePermissions.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Shield className="h-4 w-4 text-primary" /> Update Permissions
                </p>
                <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto border rounded-md p-2">
                  {availablePermissions.map((perm) => (
                    <label
                      key={perm}
                      className="flex items-center space-x-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={editPermissions.includes(perm)}
                        onCheckedChange={() => toggleEditPermission(perm)}
                      />
                      <span>{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Devices */}
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-1">
                <Cpu className="h-4 w-4 text-primary" /> Assign Devices
              </p>
              {availableDevices.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No devices available for this organization
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto border rounded-md p-2">
                  {availableDevices.map((device) => (
                    <label
                      key={device._id}
                      className="flex items-center space-x-2 text-sm cursor-pointer"
                    >
                      <Checkbox
                        checked={editDevices.includes(device._id)}
                        onCheckedChange={() => toggleEditDevice(device._id)}
                      />
                      <span>{device.name || device.deviceName}</span>
                    </label>
                  ))}
                </div>
              )}
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

      {/* Search */}
      <div className="flex justify-end">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search user heads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All User Heads</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading user heads...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No user heads found
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
                  {filtered.map((u) => (
                    <tr
                      key={u.id || u._id}
                      className="border-b hover:bg-muted/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium">{u.name}</td>
                      <td className="py-3 px-4 text-muted-foreground flex items-center gap-1">
                        <Phone className="h-4 w-4" /> +
                        {u.phone_number?.join(" ")}
                      </td>
                      <td className="py-3 px-4">
                        {u.organizationName || "—"}
                      </td>
                      <td className="py-3 px-4">{u.country}</td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          u.status === "Inactive"
                            ? "bg-gray-100 text-gray-800 border-gray-200"
                            : "bg-[#e6f4ea] text-[#137333] border-[#ceead6]"
                        )}>
                          {u.status || "Active"}
                        </span>
                      </td>
                      <td className="py-3 px-4 flex items-center gap-3">
                        {u.status !== "Inactive" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(u)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <Switch
                          checked={u.status !== "Inactive"}
                          onCheckedChange={() => handleToggleStatus(u.id || u._id || "", u.status)}
                          title={u.status === "Inactive" ? "Activate" : "Deactivate"}
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

export default EA_UserHeads;
