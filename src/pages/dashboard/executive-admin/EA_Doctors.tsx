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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Search, Edit, Trash2, Stethoscope, Phone, Eye, EyeOff } from "lucide-react";
import { createDoctor, deleteDoctor, listDoctors, updateDoctor } from "@/services/doctor.service";
import { Label } from "@/components/ui/label";
import { listOrganizations } from "@/services/organization.service";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";

interface Doctor {
  id: string;
    _id?: string;
  name: string;
  phone_number: string[];
  country: string;
  specialty?: string;
  specialization?: string;
  consultationFee?: number;
  organizationName?: string;
  orgId?: string;
  status: string;
}

interface Organization {
  id: string;
  organizationName: string;
}

const EA_Doctors = () => {
  const { toast } = useToast();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filtered, setFiltered] = useState<Doctor[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone_country: "91",
    phone_number: "",
    password: "",
    specialization: "",
    consultationFee: 500,
    country: "India",
  });

  // ====== Edit States ======
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone_country: "91",
    phone_number: "",
    country: "India",
    specialty: "",
    orgId: "",
    status: "Active",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const handleEdit = (doc: any) => {
    setEditingDoctor(doc);
    setEditForm({
      name: doc.name,
      phone_country: doc.phone_number?.[0] || "91",
      phone_number: doc.phone_number?.[1] || "",
      country: doc.country || "India",
      specialty: doc.specialization || doc.specialty || "",
      orgId: doc.orgId || doc.organization?._id || doc.organization?.id || "",
      status: doc.status || "Active",
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingDoctor) return;
    if (!editForm.name || !editForm.phone_number || !editForm.specialty || !editForm.orgId) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setSavingEdit(true);
    try {
      const payload = {
        name: editForm.name,
        phone_number: [editForm.phone_country, editForm.phone_number],
        country: editForm.country,
        specialty: editForm.specialty,
        orgId: editForm.orgId,
        status: editForm.status,
      };

      await updateDoctor(editingDoctor._id || editingDoctor.id, payload);
      toast({ title: "Doctor updated successfully" });
      setEditDialogOpen(false);
      fetchDoctors();
    } catch (err: any) {
      toast({
        title: "Failed to update doctor",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // ================================
  // Fetch All Doctors
  // ================================
  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const data = await listDoctors();
      setDoctors(data);
      setFiltered(data);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to load doctors", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ================================
  // Fetch Organizations
  // ================================
  const fetchOrganizations = async () => {
    try {
      const data = await listOrganizations();
      const orgList = data.organizations || data;
      setOrganizations(orgList);
    } catch (err) {
      console.error(err);
      toast({ title: "Error fetching organizations", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchDoctors();
    fetchOrganizations();
  }, []);

  // ================================
  // Search Filter
  // ================================
  // ================================
  // Search & Status Filter
  // ================================
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    let list = doctors;
    if (search.trim() !== "") {
      list = list.filter((d) =>
        d.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((d) => (d.status || "Active") === statusFilter);
    }
    setFiltered(list);
  }, [search, statusFilter, doctors]);

  // ================================
  // Create Doctor
  // ================================
  const handleSubmit = async () => {
    const { name, phone_country, phone_number, password, specialization, consultationFee } = formData;

    if (!name || !phone_number || !password || !specialization || !consultationFee) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        name,
        country: formData.country,
        phone_number: [phone_country, phone_number],
        password,
        specialization,
        consultationFee: Number(consultationFee),
      };

      await createDoctor(payload);
      toast({ title: "Doctor created successfully" });
      setDialogOpen(false);
      setFormData({
        name: "",
        phone_country: "91",
        phone_number: "",
        password: "",
        specialization: "",
        consultationFee: 500,
        country: "India",
      });
      fetchDoctors();
    } catch (err) {
      console.error(err);
      toast({ title: "Error creating doctor", variant: "destructive" });
    }
  };

  // ================================
  // Toggle Doctor Status
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
      await updateDoctor(id, { status: newStatus });
      toast({ title: `Doctor status updated to ${newStatus}` });
      setConfirmOpen(false);
      fetchDoctors();
    } catch (err: any) {
      console.error(err);
      toast({ title: "Failed to update doctor status", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Stethoscope className="h-7 w-7 text-primary" /> Doctors
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage doctors assigned to specific organizations
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add Doctor
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
            <DialogHeader className="p-6 border-b shrink-0">
              <DialogTitle>Create Doctor</DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <Input
                placeholder="Full Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              <Input
                placeholder="Specialization"
                value={formData.specialization}
                onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              />
              <Input
                placeholder="Consultation Fee (INR)"
                type="number"
                value={formData.consultationFee || ""}
                onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value ? Number(e.target.value) : 0 })}
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Country Code"
                  value={formData.phone_country}
                  onChange={(e) => setFormData({ ...formData, phone_country: e.target.value })}
                  className="w-20"
                />
                <Input
                  placeholder="Phone Number"
                  value={formData.phone_number}
                  onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                />
              </div>
              <div className="relative">
                <Input
                  placeholder="Password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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

            <DialogFooter className="p-6 border-t bg-muted/30 shrink-0">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Doctor Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b shrink-0">
            <DialogTitle>Edit Doctor</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="space-y-1">
              <Label>Full Name</Label>
              <Input
                placeholder="Full Name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Specialty</Label>
              <Input
                placeholder="Specialty"
                value={editForm.specialty}
                onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Phone Connectivity</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Country Code"
                  value={editForm.phone_country}
                  onChange={(e) => setEditForm({ ...editForm, phone_country: e.target.value })}
                  className="w-20"
                />
                <Input
                  placeholder="Phone Number"
                  value={editForm.phone_number}
                  onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Country</Label>
              <Input
                placeholder="Country"
                value={editForm.country}
                onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
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
            <div className="space-y-1">
              <Label>Organization</Label>
              <Select
                onValueChange={(value) => setEditForm({ ...editForm, orgId: value })}
                value={editForm.orgId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.organizationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            placeholder="Search doctors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Doctors</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading doctors...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No doctors found</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Name</th>
                    <th className="text-left py-3 px-4 font-semibold">Specialty</th>
                    <th className="text-left py-3 px-4 font-semibold">Phone</th>
                    <th className="text-left py-3 px-4 font-semibold">Organization</th>
                    <th className="text-left py-3 px-4 font-semibold">Country</th>
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
                  {filtered.map((d) => (
                    <tr
                      key={d.id || d._id}
                      className="border-b hover:bg-muted/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-medium">{d.name}</td>
                      <td className="py-3 px-4">{d.specialization || d.specialty || "—"}</td>
                      <td className="py-3 px-4 text-muted-foreground flex items-center gap-1">
                        <Phone className="h-4 w-4" /> +{d.phone_number?.join(" ")}
                      </td>
                      <td className="py-3 px-4">{d.organizationName || "—"}</td>
                      <td className="py-3 px-4">{d.country}</td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                          d.status === "Inactive"
                            ? "bg-gray-100 text-gray-800 border-gray-200"
                            : "bg-[#e6f4ea] text-[#137333] border-[#ceead6]"
                        )}>
                          {d.status || "Active"}
                        </span>
                      </td>
                      <td className="py-3 px-4 flex items-center gap-3">
                        {d.status !== "Inactive" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(d)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <Switch
                          checked={d.status !== "Inactive"}
                          onCheckedChange={() => handleToggleStatus(d.id || d._id || "", d.status)}
                          title={d.status === "Inactive" ? "Activate" : "Deactivate"}
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
              Are you sure you want to set this doctor to{" "}
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

export default EA_Doctors;
