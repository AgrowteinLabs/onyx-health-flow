import { useEffect, useState, useMemo } from "react";
import {
  Search,
  Stethoscope,
  RefreshCcw,
  Plus,
  Phone,
  Edit,
  Eye,
  EyeOff,
} from "lucide-react";
import { createDoctor, listDoctors, updateDoctor } from "@/services/doctor.service";
import { viewOrganization } from "@/services/organization.service";
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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * 👨‍⚕️ CH_Doctors Management Page
 * Allows Cluster Heads to manage doctors within their specific organization/clinic branch.
 */
const CHDoctors = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // ====== Add Doctor Dialog ======
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    phone_country: "91",
    phone_number: "",
    password: "",
    specialization: "",
    consultationFee: 500,
    country: "India",
  });

  // ====== Edit Doctor Dialog ======
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone_country: "91",
    phone_number: "",
    country: "India",
    specialty: "",
    status: "Active",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // ====== Confirm Dialog ======
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmData, setConfirmData] = useState<{ id: string; currentStatus: string } | null>(null);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      const orgId = localStorage.getItem("organizationId");
      if (!orgId) {
        throw new Error("Organization ID missing in localStorage");
      }

      // Fetch doctors list
      const allDoctors = await listDoctors();
      
      // Filter doctors associated with this specific organization
      const filteredList = allDoctors.filter(
        (doc: any) => doc.orgId === orgId || doc.organization?._id === orgId || doc.organization?.id === orgId
      );

      setDoctors(filteredList);
    } catch (err: any) {
      console.error("❌ Error fetching doctors:", err);
      toast({
        title: "Failed to load doctors",
        description: err.message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter & Search Logic
  const filteredDoctors = useMemo(() => {
    let list = doctors;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (doc) =>
          doc.name?.toLowerCase().includes(q) ||
          doc.specialization?.toLowerCase().includes(q) ||
          doc.specialty?.toLowerCase().includes(q) ||
          doc.phone_number?.join("").includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((doc) => (doc.status || "Active") === statusFilter);
    }
    return list;
  }, [searchTerm, statusFilter, doctors]);

  const handleAddDoctorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, phone_country, phone_number, password, specialization, consultationFee, country } = addForm;

    if (!name || !phone_number || !password || !specialization || !consultationFee) {
      toast({
        title: "Missing fields",
        description: "Please fill all required fields.",
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
        specialization,
        consultationFee: Number(consultationFee),
        country,
        orgId,
      };

      await createDoctor(payload);
      toast({ title: "Doctor created successfully" });
      setAddDialogOpen(false);
      setAddForm({
        name: "",
        phone_country: "91",
        phone_number: "",
        password: "",
        specialization: "",
        consultationFee: 500,
        country: "India",
      });
      fetchDoctors();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Could not create doctor",
        variant: "destructive",
      });
    }
  };

  const handleEditClick = (doc: any) => {
    setEditingDoctor(doc);
    setEditForm({
      name: doc.name,
      phone_country: doc.phone_number?.[0] || "91",
      phone_number: doc.phone_number?.[1] || "",
      country: doc.country || "India",
      specialty: doc.specialization || doc.specialty || "",
      status: doc.status || "Active",
    });
    setEditDialogOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctor) return;
    if (!editForm.name || !editForm.phone_number || !editForm.specialty) {
      toast({ title: "Please fill all required fields", variant: "destructive" });
      return;
    }

    setSavingEdit(true);
    const orgId = localStorage.getItem("organizationId");
    try {
      const payload = {
        name: editForm.name,
        phone_number: [editForm.phone_country, editForm.phone_number],
        country: editForm.country,
        specialty: editForm.specialty,
        orgId,
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Stethoscope className="h-7 w-7 text-primary" /> Doctors
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage and register medical specialists practicing at your organization
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-white">
                <Plus className="h-4 w-4 mr-2" />
                Add Doctor
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Doctor</DialogTitle>
              </DialogHeader>

              <form onSubmit={handleAddDoctorSubmit} className="space-y-4 py-4 text-left">
                <div className="space-y-1">
                  <Label htmlFor="add-name">Full Name *</Label>
                  <Input
                    id="add-name"
                    placeholder="Dr. John Doe"
                    value={addForm.name}
                    onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="add-spec">Specialty / Specialization *</Label>
                  <Input
                    id="add-spec"
                    placeholder="e.g. Cardiologist"
                    value={addForm.specialization}
                    onChange={(e) => setAddForm({ ...addForm, specialization: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="add-fee">Consultation Fee (INR) *</Label>
                  <Input
                    id="add-fee"
                    type="number"
                    value={addForm.consultationFee}
                    onChange={(e) => setAddForm({ ...addForm, consultationFee: Number(e.target.value) })}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label>Phone Connection *</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="CC"
                      value={addForm.phone_country}
                      onChange={(e) => setAddForm({ ...addForm, phone_country: e.target.value })}
                      className="w-20"
                      required
                    />
                    <Input
                      placeholder="Phone Number"
                      value={addForm.phone_number}
                      onChange={(e) => setAddForm({ ...addForm, phone_number: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="add-pwd">Password *</Label>
                  <div className="relative">
                    <Input
                      id="add-pwd"
                      placeholder="Password"
                      type={showPassword ? "text" : "password"}
                      value={addForm.password}
                      onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                      required
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

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Doctor</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="icon"
            onClick={fetchDoctors}
            title="Refresh"
            disabled={loading}
          >
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <StatCard
            title="Total Doctors"
            value={doctors.length.toString()}
            icon={Stethoscope}
            variant="primary"
            trend={{ value: "Clinic branch panel", isPositive: true }}
          />
          <StatCard
            title="Active Specialists"
            value={doctors.filter((d) => d.status === "Active" || !d.status).length.toString()}
            icon={Stethoscope}
            variant="success"
            trend={{ value: "On service", isPositive: true }}
          />
          <StatCard
            title="Pending Verification"
            value={doctors.filter((d) => d.status === "Pending Verification").length.toString()}
            icon={Stethoscope}
            variant="warning"
            trend={{ value: "Awaiting review", isPositive: false }}
          />
        </div>
      )}

      {/* Table listing */}
      <div className="bg-card rounded-lg shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Specialist Directory</h3>
          <div className="flex gap-2 items-center">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search specialty or doctor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-10 border-gray-200 text-xs font-bold text-gray-700 bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Pending Verification">Pending</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-10">
            <RefreshCcw className="h-8 w-8 animate-spin mx-auto text-primary" />
          </div>
        ) : filteredDoctors.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            No doctors found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Name</th>
                  <th className="text-left py-3 px-4 font-semibold">Specialty</th>
                  <th className="text-left py-3 px-4 font-semibold">Phone Connectivity</th>
                  <th className="text-left py-3 px-4 font-semibold">Consultation Fee</th>
                  <th className="text-left py-3 px-4 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDoctors.map((doc, idx) => (
                  <tr
                    key={doc._id || doc.id || idx}
                    className="border-b hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-800">{doc.name}</td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="capitalize text-slate-600 bg-slate-50 border-slate-200">
                        {doc.specialization || doc.specialty || "—"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {doc.phone_number && Array.isArray(doc.phone_number)
                        ? `+${doc.phone_number.join(" ")}`
                        : "—"}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-slate-700">
                      ₹{doc.consultationFee || 500}
                    </td>
                    <td className="py-3 px-4">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
                        doc.status === "Inactive" && "bg-gray-100 text-gray-800 border-gray-200",
                        doc.status === "Pending Verification" && "bg-amber-50 text-amber-600 border-amber-200",
                        doc.status === "Suspended" && "bg-rose-50 text-rose-600 border-rose-200",
                        (doc.status === "Active" || !doc.status) && "bg-[#e6f4ea] text-[#137333] border-[#ceead6]"
                      )}>
                        {doc.status || "Active"}
                      </span>
                    </td>
                    <td className="py-3 px-4 flex items-center gap-3">
                      {doc.status !== "Inactive" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(doc)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      <Switch
                        checked={doc.status !== "Inactive" && doc.status !== "Suspended"}
                        onCheckedChange={() => handleToggleStatus(doc._id || doc.id || "", doc.status)}
                        title={doc.status === "Inactive" ? "Activate" : "Deactivate"}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Doctor</DialogTitle>
          </DialogHeader>

          {editingDoctor && (
            <form onSubmit={handleEditSubmit} className="space-y-4 py-4 text-left">
              <div className="space-y-1">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-spec">Specialty</Label>
                <Input
                  id="edit-spec"
                  value={editForm.specialty}
                  onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label>Phone Connectivity</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="CC"
                    value={editForm.phone_country}
                    onChange={(e) => setEditForm({ ...editForm, phone_country: e.target.value })}
                    className="w-20"
                    required
                  />
                  <Input
                    placeholder="Phone"
                    value={editForm.phone_number}
                    onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="edit-status">Status</Label>
                <select
                  id="edit-status"
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white h-10 px-3 text-sm focus-visible:outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspended">Suspended</option>
                  <option value="Pending Verification">Pending Verification</option>
                </select>
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog */}
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

export default CHDoctors;
