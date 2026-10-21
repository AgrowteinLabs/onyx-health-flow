import { useState, useEffect } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Stethoscope,
  Building2,
  Award,
  ShieldCheck,
  Clock,
  Phone,
  Mail,
  MapPin,
  FileCheck2,
  Edit,
  Save,
  CheckCircle2,
  AlertCircle,
  Eye,
  CreditCard,
  Languages,
} from "lucide-react";
import { viewUser, updateUser } from "@/services/user.service";
import { getOnboardingStatus } from "@/services/doctor.service";

const DoctorProfile = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    phone: "",
    specialization: "Cardiology",
    subSpecialization: "Interventional Cardiology",
    qualification: "MBBS, MD (Cardiology)",
    experienceYears: "10",
    languages: "English, Hindi, Malayalam",
    bio: "Experienced cardiologist specializing in preventive cardiology, hypertension management, and teleconsultation diagnostics.",
    registrationNumber: "KMC-48291-A",
    registrationCouncilState: "Kerala Medical Council",
    clinicAddress: "Suite 402, Maryqueens Telehealth Center, Kottayam",
    city: "Kottayam",
    state: "Kerala",
    country: "India",
    currentWorkplace: "Maryqueens Hospital",
    consultationFee: "500",
    status: "Active",
    onboardingStatus: "approved",
  });

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const [userRes, statusRes] = await Promise.all([
          viewUser().catch(() => null),
          getOnboardingStatus().catch(() => null),
        ]);

        if (userRes) {
          const user = userRes.user || userRes.data || userRes;
          setProfile((prev) => ({
            ...prev,
            name: user.name || prev.name,
            email: user.email || prev.email,
            phone: Array.isArray(user.phone_number)
              ? `+${user.phone_number[0]} ${user.phone_number[1]}`
              : user.phone || prev.phone,
          }));
        }

        if (statusRes && statusRes.status === "success") {
          const s1 = statusRes.stepData?.step1;
          const s2 = statusRes.stepData?.step2;
          const s4 = statusRes.stepData?.step4;

          setProfile((prev) => ({
            ...prev,
            specialization: s1?.specialty || prev.specialization,
            qualification: s1?.qualification || prev.qualification,
            experienceYears: String(s1?.experience || prev.experienceYears),
            bio: s1?.summary || prev.bio,
            registrationNumber: s2?.registrationNumber || prev.registrationNumber,
            registrationCouncilState: s2?.issuingBoard || prev.registrationCouncilState,
            currentWorkplace: s2?.hospitalName || prev.currentWorkplace,
            clinicAddress: s2?.streetAddress || prev.clinicAddress,
            city: s2?.city || prev.city,
            state: s2?.state || prev.state,
            consultationFee: String(s4?.consultationFee || prev.consultationFee),
            onboardingStatus: statusRes.onboardingStatus || prev.onboardingStatus,
          }));
        }
      } catch (err) {
        console.warn("Could not load full profile data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const userId = localStorage.getItem("userId");
      if (userId) {
        await updateUser(userId, {
          name: profile.name,
          specialty: profile.specialization,
        }).catch(() => null);
      }
      localStorage.setItem("userName", profile.name);
      toast({
        title: "Profile Updated",
        description: "Your medical practice details have been saved successfully.",
      });
      setIsEditing(false);
    } catch {
      toast({
        title: "Update Failed",
        description: "Could not persist profile changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <PageHeader />

      {/* Header Profile Hero Card */}
      <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-r from-[#14213D] via-[#1A2E56] to-[#14213D] p-6 text-white shadow-xl border border-white/10">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-[#F2052C]/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-64 h-64 rounded-full bg-[#35B7C9]/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="h-20 w-20 rounded-[22px] bg-gradient-to-br from-[#F2052C] via-[#FF4B66] to-[#35B7C9] p-0.5 shadow-lg shrink-0">
              <div className="h-full w-full rounded-[20px] bg-[#14213D] flex items-center justify-center text-white font-extrabold text-2xl">
                {profile.name
                  ? profile.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()
                  : "DR"}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-black tracking-tight">{profile.name || "Dr. Medical Practitioner"}</h1>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 text-[10px] font-extrabold uppercase px-2.5 py-0.5">
                  <ShieldCheck className="h-3 w-3 mr-1" /> Verified Practitioner
                </Badge>
              </div>

              <p className="text-sm text-slate-300 font-semibold mt-1 flex items-center gap-2">
                <span>{profile.specialization}</span>
                <span className="text-slate-500">•</span>
                <span>{profile.qualification}</span>
                <span className="text-slate-500">•</span>
                <span>{profile.experienceYears} Years Exp.</span>
              </p>

              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-[#35B7C9]" />
                {profile.currentWorkplace} · {profile.city}, {profile.state}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(!previewOpen)}
              className="rounded-[14px] border-white/20 bg-white/10 text-white hover:bg-white/20 text-xs font-bold h-9 gap-1.5"
            >
              <Eye className="h-3.5 w-3.5 text-[#35B7C9]" />
              {previewOpen ? "Hide Patient Preview" : "Patient Preview"}
            </Button>

            <Button
              onClick={() => setIsEditing(!isEditing)}
              className="rounded-[14px] bg-[#F2052C] hover:bg-[#c90424] text-white text-xs font-bold h-9 px-4 shadow-md gap-1.5"
            >
              <Edit className="h-3.5 w-3.5" />
              {isEditing ? "Cancel" : "Edit Profile"}
            </Button>
          </div>
        </div>
      </div>

      {/* Patient View Preview Modal / Expandable Card */}
      {previewOpen && (
        <Card className="rounded-[22px] border-2 border-[#35B7C9]/40 bg-gradient-to-br from-cyan-50/50 via-white to-sky-50/30 p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#35B7C9] uppercase tracking-wider mb-2">
              <Eye className="h-4 w-4" /> Live Patient Search Preview
            </div>
            <span className="text-xs text-slate-400 font-semibold">How patients see you when booking</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-[18px] bg-white border border-slate-200/70 shadow-sm gap-4 mt-2">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-[16px] bg-gradient-to-br from-[#14213D] to-[#35B7C9] flex items-center justify-center text-white font-extrabold text-lg shadow-sm shrink-0">
                {profile.name ? profile.name.slice(0, 2).toUpperCase() : "DR"}
              </div>
              <div>
                <p className="text-base font-extrabold text-[#14213D]">{profile.name}</p>
                <p className="text-xs text-[#F2052C] font-bold">{profile.specialization}</p>
                <p className="text-xs text-slate-500 font-medium">{profile.qualification} · {profile.currentWorkplace}</p>
                <p className="text-[11px] text-slate-400 font-semibold mt-0.5 flex items-center gap-1">
                  <Languages className="h-3 w-3" /> {profile.languages}
                </p>
              </div>
            </div>
            <div className="text-right sm:border-l sm:border-slate-100 sm:pl-6 shrink-0">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Consultation Fee</span>
              <span className="text-lg font-black text-[#14213D]">₹{profile.consultationFee}</span>
              <span className="text-[11px] text-slate-400 font-semibold block">per 30-min video slot</span>
              <Button size="sm" className="bg-[#F2052C] hover:bg-[#c90424] text-white text-xs font-bold rounded-[12px] h-8 mt-2 w-full">
                Book Video Call
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Profile Details Form */}
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Personal & Contact */}
        <Card className="rounded-[24px] border-slate-100 shadow-sm bg-white/80 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-extrabold text-[#14213D] flex items-center gap-2">
              <User className="h-4 w-4 text-[#F2052C]" /> Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs font-bold text-slate-600">Full Name</Label>
              <Input
                disabled={!isEditing}
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="mt-1 rounded-[12px] h-9 text-xs font-medium"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600">Official Email</Label>
              <Input
                disabled={!isEditing}
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="mt-1 rounded-[12px] h-9 text-xs font-medium"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600">Phone Number</Label>
              <Input
                disabled={!isEditing}
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                className="mt-1 rounded-[12px] h-9 text-xs font-medium"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600">Languages Spoken</Label>
              <Input
                disabled={!isEditing}
                value={profile.languages}
                onChange={(e) => setProfile({ ...profile, languages: e.target.value })}
                className="mt-1 rounded-[12px] h-9 text-xs font-medium"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600">Professional Bio</Label>
              <Textarea
                disabled={!isEditing}
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                rows={3}
                className="mt-1 rounded-[12px] text-xs font-medium resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Center Column: Credentials & Legal */}
        <Card className="rounded-[24px] border-slate-100 shadow-sm bg-white/80 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-extrabold text-[#14213D] flex items-center gap-2">
              <Award className="h-4 w-4 text-[#35B7C9]" /> Medical Credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs font-bold text-slate-600">Medical Registration Number</Label>
              <Input
                disabled={!isEditing}
                value={profile.registrationNumber}
                onChange={(e) => setProfile({ ...profile, registrationNumber: e.target.value })}
                className="mt-1 rounded-[12px] h-9 text-xs font-medium font-mono"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600">Registration Council State</Label>
              <Input
                disabled={!isEditing}
                value={profile.registrationCouncilState}
                onChange={(e) => setProfile({ ...profile, registrationCouncilState: e.target.value })}
                className="mt-1 rounded-[12px] h-9 text-xs font-medium"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600">Primary Specialization</Label>
              <Input
                disabled={!isEditing}
                value={profile.specialization}
                onChange={(e) => setProfile({ ...profile, specialization: e.target.value })}
                className="mt-1 rounded-[12px] h-9 text-xs font-medium"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600">Qualifications</Label>
              <Input
                disabled={!isEditing}
                value={profile.qualification}
                onChange={(e) => setProfile({ ...profile, qualification: e.target.value })}
                className="mt-1 rounded-[12px] h-9 text-xs font-medium"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600">Years of Clinical Experience</Label>
              <Input
                disabled={!isEditing}
                value={profile.experienceYears}
                onChange={(e) => setProfile({ ...profile, experienceYears: e.target.value })}
                className="mt-1 rounded-[12px] h-9 text-xs font-medium"
              />
            </div>
          </CardContent>
        </Card>

        {/* Right Column: Practice & Telehealth Fee */}
        <Card className="rounded-[24px] border-slate-100 shadow-sm bg-white/80 backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-extrabold text-[#14213D] flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-500" /> Practice & Workplace
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs font-bold text-slate-600">Hospital / Clinic Affiliation</Label>
              <Input
                disabled={!isEditing}
                value={profile.currentWorkplace}
                onChange={(e) => setProfile({ ...profile, currentWorkplace: e.target.value })}
                className="mt-1 rounded-[12px] h-9 text-xs font-medium"
              />
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600">Clinic Address</Label>
              <Input
                disabled={!isEditing}
                value={profile.clinicAddress}
                onChange={(e) => setProfile({ ...profile, clinicAddress: e.target.value })}
                className="mt-1 rounded-[12px] h-9 text-xs font-medium"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-600">City</Label>
                <Input
                  disabled={!isEditing}
                  value={profile.city}
                  onChange={(e) => setProfile({ ...profile, city: e.target.value })}
                  className="mt-1 rounded-[12px] h-9 text-xs font-medium"
                />
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-600">State</Label>
                <Input
                  disabled={!isEditing}
                  value={profile.state}
                  onChange={(e) => setProfile({ ...profile, state: e.target.value })}
                  className="mt-1 rounded-[12px] h-9 text-xs font-medium"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-600">Consultation Fee (₹)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-2 text-xs font-extrabold text-slate-400">₹</span>
                <Input
                  disabled={!isEditing}
                  value={profile.consultationFee}
                  onChange={(e) => setProfile({ ...profile, consultationFee: e.target.value })}
                  className="pl-7 rounded-[12px] h-9 text-xs font-extrabold text-[#14213D]"
                />
              </div>
            </div>

            {isEditing && (
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-[#14213D] hover:bg-[#1A2E56] text-white rounded-[12px] h-9 text-xs font-bold shadow-md"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  {saving ? "Saving Changes..." : "Save Profile Details"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default DoctorProfile;
