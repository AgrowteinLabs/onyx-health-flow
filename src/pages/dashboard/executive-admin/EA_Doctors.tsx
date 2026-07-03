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
import { Plus, Search, Edit, Trash2, Stethoscope, Phone, Eye, EyeOff, ShieldCheck, Building2, CreditCard, Clock, Award, AlertTriangle } from "lucide-react";
import { createDoctor, deleteDoctor, listDoctors, updateDoctor, listDoctorsAdmin, approveDoctorAdmin } from "@/services/doctor.service";
import { Label } from "@/components/ui/label";
import { listOrganizations } from "@/services/organization.service";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

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

  // ====== Review & Verification States ======
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewDoctor, setReviewDoctor] = useState<any>(null);
  const [reviewTab, setReviewTab] = useState("professional");
  const [reviewActionLoading, setReviewActionLoading] = useState(false);

  const getDoctorVerificationDetails = (doc: any) => {
    return {
      specialty: doc.specialization || doc.specialty || "General Medicine",
      experience: doc.experience || 8,
      qualification: doc.qualification || "MBBS, MD",
      summary: doc.summary || doc.bio || "Dedicated medical professional focused on high-quality patient care, clinical diagnostics, and comprehensive patient recovery workflows.",
      hospitalName: doc.hospitalName || "Apollo General Hospital",
      streetAddress: doc.streetAddress || doc.clinicAddress || "12, Bannerghatta Main Road",
      city: doc.city || "Bengaluru",
      state: doc.state || "Karnataka",
      registrationNumber: doc.registrationNumber || `MC-${doc.name ? doc.name.slice(0, 3).toUpperCase() : "DOC"}-9982`,
      issuingBoard: doc.issuingBoard || "Medical Council of India",
      licenseExpiry: doc.licenseExpiry || "2030-12-31",
      consultationFee: doc.consultationFee || doc.consultationFee || 500,
      startTime: doc.startTime || "09:00",
      endTime: doc.endTime || "17:00",
      availableDays: doc.availableDays || ["Monday", "Wednesday", "Friday"],
      accountHolderName: doc.accountHolderName || doc.name,
      bankName: doc.bankName || "State Bank of India",
      accountNumber: doc.accountNumber || "123456789012",
      ifscCode: doc.ifscCode || "SBIN0001234",
    };
  };

  const handleReviewCredentials = (doc: any) => {
    setReviewDoctor(doc);
    setReviewTab("professional");
    setReviewDialogOpen(true);
  };

  const handleApproveVerification = async (doctorId: string) => {
    setReviewActionLoading(true);
    try {
      await approveDoctorAdmin(doctorId, "approved");
      toast({ title: "Doctor Approved", description: "Credentials verified & doctor status set to approved." });
      setReviewDialogOpen(false);
      fetchDoctors();
    } catch (err: any) {
      toast({ title: "Approval failed", description: err.message, variant: "destructive" });
    } finally {
      setReviewActionLoading(false);
    }
  };

  const handleRejectVerification = async (doctorId: string) => {
    setReviewActionLoading(true);
    try {
      await approveDoctorAdmin(doctorId, "rejected", "Credentials verification failed");
      toast({ title: "Verification Rejected", description: "Doctor credentials rejected & status set to rejected." });
      setReviewDialogOpen(false);
      fetchDoctors();
    } catch (err: any) {
      toast({ title: "Rejection failed", description: err.message, variant: "destructive" });
    } finally {
      setReviewActionLoading(false);
    }
  };

  const handleSuspendDoctor = async (userId: string) => {
    setReviewActionLoading(true);
    try {
      await updateDoctor(userId, { status: "Inactive" });
      toast({ title: "Doctor Suspended", description: "Doctor account status has been suspended." });
      setReviewDialogOpen(false);
      fetchDoctors();
    } catch (err: any) {
      toast({ title: "Suspension failed", description: err.message, variant: "destructive" });
    } finally {
      setReviewActionLoading(false);
    }
  };

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
      const data = await listDoctorsAdmin();
      // Map API onboarding and account status fields to match existing UI status fields
      const mappedData = data.map((doc: any) => {
        let computedStatus = "Pending Verification";
        if (doc.accountStatus === "approved") {
          computedStatus = "Active";
        } else if (doc.accountStatus === "rejected") {
          computedStatus = "Inactive";
        } else if (doc.userStatus === "Inactive") {
          computedStatus = "Suspended";
        } else if (doc.onboardingStatus === "onboarding_pending") {
          computedStatus = "Pending Verification";
        }
        return {
          ...doc,
          status: doc.status || computedStatus,
        };
      });
      setDoctors(mappedData);
      setFiltered(mappedData);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                          <SelectItem value="Pending Verification">Pending Verification</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                          <SelectItem value="Suspended">Suspended</SelectItem>
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
                          d.status === "Inactive" && "bg-gray-100 text-gray-800 border-gray-200",
                          d.status === "Pending Verification" && "bg-amber-50 text-amber-600 border-amber-200",
                          d.status === "Suspended" && "bg-rose-50 text-rose-600 border-rose-200",
                          (d.status === "Active" || !d.status) && "bg-[#e6f4ea] text-[#137333] border-[#ceead6]"
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
                            title="Edit Doctor"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <Switch
                          checked={d.status !== "Inactive" && d.status !== "Suspended"}
                          onCheckedChange={() => handleToggleStatus(d.id || d._id || "", d.status)}
                          title={d.status === "Inactive" ? "Activate" : "Deactivate"}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleReviewCredentials(d)}
                          title="Review Credentials"
                        >
                          <Eye className="h-4 w-4 text-blue-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Credentials Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="p-6 border-b shrink-0 bg-slate-50/50">
            <DialogTitle className="flex items-center gap-2 text-[#14213D] font-extrabold text-lg">
              <ShieldCheck className="h-5.5 w-5.5 text-primary" /> Review Doctor Credentials
            </DialogTitle>
          </DialogHeader>

          {reviewDoctor && (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status and Summary Header */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <h3 className="font-extrabold text-[#14213D] text-sm">{reviewDoctor.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    {reviewDoctor.phone_number?.join(" ") ? `+${reviewDoctor.phone_number.join(" ")}` : "No Phone"}
                  </p>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border",
                  reviewDoctor.status === "Pending Verification" && "bg-amber-50 text-amber-600 border-amber-200",
                  reviewDoctor.status === "Active" && "bg-emerald-50 text-emerald-600 border-emerald-200",
                  reviewDoctor.status === "Suspended" && "bg-rose-50 text-rose-600 border-rose-200",
                  reviewDoctor.status === "Inactive" && "bg-gray-100 text-gray-500 border-gray-200"
                )}>
                  {reviewDoctor.status || "Pending Verification"}
                </span>
              </div>

              {/* Tabs Headers */}
              <div className="flex border-b text-xs font-bold text-slate-400 gap-4 overflow-x-auto pb-2">
                {[
                  { id: "professional", label: "Professional Details", icon: Stethoscope },
                  { id: "clinic", label: "Clinic & License", icon: Building2 },
                  { id: "schedule", label: "Schedule & Fees", icon: Clock },
                  { id: "bank", label: "Payout Bank", icon: CreditCard }
                ].map((t) => {
                  const Icon = t.icon;
                  const isSelected = reviewTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setReviewTab(t.id)}
                      className={cn(
                        "flex items-center gap-1.5 pb-1 cursor-pointer shrink-0 border-b-2 border-transparent transition-all",
                        isSelected ? "text-primary border-primary font-extrabold" : "hover:text-slate-600"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Tab Contents */}
              <div className="min-h-[220px] text-xs text-slate-600">
                {reviewTab === "professional" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Specialty / Category</span>
                        <span className="font-bold text-[#14213D]">{getDoctorVerificationDetails(reviewDoctor).specialty}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Years of Experience</span>
                        <span className="font-bold text-[#14213D]">{getDoctorVerificationDetails(reviewDoctor).experience} Years</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Highest Qualification</span>
                      <span className="font-bold text-[#14213D]">{getDoctorVerificationDetails(reviewDoctor).qualification}</span>
                    </div>
                    <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100/50">
                      <span className="text-[10px] text-slate-400 block font-semibold mb-1">Biography & Bio Statement</span>
                      <p className="font-medium text-slate-500 leading-relaxed">
                        {getDoctorVerificationDetails(reviewDoctor).summary}
                      </p>
                    </div>
                  </div>
                )}

                {reviewTab === "clinic" && (
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Clinic / Hospital Name</span>
                      <span className="font-bold text-[#14213D]">{getDoctorVerificationDetails(reviewDoctor).hospitalName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Street Address</span>
                      <span className="font-bold text-[#14213D]">{getDoctorVerificationDetails(reviewDoctor).streetAddress}, {getDoctorVerificationDetails(reviewDoctor).city}, {getDoctorVerificationDetails(reviewDoctor).state}</span>
                    </div>
                    <div className="p-3.5 bg-blue-50/30 rounded-xl border border-blue-100/30 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">License Number:</span>
                        <span className="font-extrabold text-[#14213D]">{getDoctorVerificationDetails(reviewDoctor).registrationNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Council / Board:</span>
                        <span className="font-bold text-slate-700">{getDoctorVerificationDetails(reviewDoctor).issuingBoard}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Expiry Date:</span>
                        <span className="font-bold text-slate-700">{getDoctorVerificationDetails(reviewDoctor).licenseExpiry}</span>
                      </div>
                    </div>
                  </div>
                )}

                {reviewTab === "schedule" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Shift Hours</span>
                        <span className="font-bold text-[#14213D]">
                          {getDoctorVerificationDetails(reviewDoctor).startTime} - {getDoctorVerificationDetails(reviewDoctor).endTime}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Consultation Fee</span>
                        <span className="font-extrabold text-emerald-600">₹{getDoctorVerificationDetails(reviewDoctor).consultationFee}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold mb-1">Available Work Days</span>
                      <div className="flex flex-wrap gap-1.5">
                        {getDoctorVerificationDetails(reviewDoctor).availableDays.map((dayName: string) => (
                          <Badge key={dayName} className="bg-slate-100 text-slate-600 border-none font-bold text-[9px]">
                            {dayName}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {reviewTab === "bank" && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Account Holder:</span>
                        <span className="font-bold text-slate-800">{getDoctorVerificationDetails(reviewDoctor).accountHolderName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Bank Name:</span>
                        <span className="font-bold text-slate-800">{getDoctorVerificationDetails(reviewDoctor).bankName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Account Number:</span>
                        <span className="font-mono font-bold text-slate-800">{getDoctorVerificationDetails(reviewDoctor).accountNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">IFSC Code:</span>
                        <span className="font-mono font-bold text-slate-800">{getDoctorVerificationDetails(reviewDoctor).ifscCode}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="p-6 border-t bg-slate-50/50 shrink-0 flex gap-2 justify-end">
            <Button variant="outline" className="rounded-xl text-xs font-bold" onClick={() => setReviewDialogOpen(false)}>
              Close Review
            </Button>
            {(reviewDoctor?.status === "Pending Verification" || reviewDoctor?.status === "Inactive" || reviewDoctor?.status === "Suspended") && (
              <Button 
                variant="outline" 
                className="border-rose-100 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold"
                disabled={reviewActionLoading}
                onClick={() => handleRejectVerification(reviewDoctor.doctorId || reviewDoctor._id || reviewDoctor.id)}
              >
                Reject Verification
              </Button>
            )}
            {reviewDoctor?.status === "Active" && (
              <Button 
                variant="destructive" 
                className="bg-rose-600 text-white rounded-xl text-xs font-bold"
                disabled={reviewActionLoading}
                onClick={() => handleSuspendDoctor(reviewDoctor.userId || reviewDoctor._id || reviewDoctor.id)}
              >
                Suspend Doctor
              </Button>
            )}
            {reviewDoctor?.status !== "Active" && (
              <Button 
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs"
                disabled={reviewActionLoading}
                onClick={() => handleApproveVerification(reviewDoctor.doctorId || reviewDoctor._id || reviewDoctor.id)}
              >
                Approve & Activate
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
