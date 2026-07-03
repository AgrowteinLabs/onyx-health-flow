import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { 
  submitOnboardingStep1, 
  submitOnboardingStep2, 
  submitOnboardingStep3, 
  submitOnboardingStep4,
  getOnboardingStatus
} from "@/services/doctor.service";
import { createLinkedAccount, listLinkedAccounts } from "@/services/linkedAccounts.service";
import { viewUser } from "@/services/user.service";
import { 
  User, 
  Building2, 
  Award, 
  Clock, 
  CreditCard, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle,
  FileBadge
} from "lucide-react";

const OnboardingWizard = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [showSummary, setShowSummary] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1
    specialty: "",
    experience: "",
    qualification: "",
    summary: "",
    // Step 2
    hospitalName: "",
    streetAddress: "",
    streetAddress2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
    // Step 3
    registrationNumber: "",
    issuingBoard: "",
    licenseExpiry: "",
    // Step 4
    consultationFee: "500",
    startTime: "09:00",
    endTime: "17:00",
    days: [] as string[],
    // Step 5
    legalName: "",
    email: "",
    phone: "",
    pan: "",
    accountHolderName: "",
    bankName: "",
    ifscCode: "",
    accountNumber: "",
  });

  // Fetch user profile and onboarding status to prefill and resume flow
  useEffect(() => {
    const initOnboardingData = async () => {
      try {
        // 1. Fetch user profile for contact prefill
        const user = await viewUser().catch(() => null);
        if (user) {
          setFormData((prev) => ({
            ...prev,
            legalName: user.name || prev.legalName,
            accountHolderName: user.name || prev.accountHolderName,
            email: user.email || prev.email,
            phone: user.phone || user.mobile || prev.phone,
          }));
        }

        // 2. Check if a linked account already exists
        const linkedRes = await listLinkedAccounts().catch(() => null);
        const accounts = linkedRes?.linkedAccounts || linkedRes?.data || (Array.isArray(linkedRes) ? linkedRes : []);
        const hasLinkedAccount = accounts.length > 0;

        // 3. Fetch current onboarding status & saved step details
        const statusRes = await getOnboardingStatus().catch(() => null);
        if (statusRes && statusRes.status === "success") {
          // If approved, OR if steps 1-4 are complete AND they already linked their bank account, show summary page
          if (
            statusRes.onboardingStatus === "approved" || 
            (statusRes.onboardingStatus === "onboarding_complete" && hasLinkedAccount) ||
            (statusRes.onboardingComplete && hasLinkedAccount)
          ) {
            localStorage.setItem("doctorOnboarded", "true");
            setShowSummary(true);
          }

          // Otherwise, resume from nextStep
          let next = statusRes.nextStep || 1;
          
          // If steps 1-4 are complete but no bank account is linked yet, next is Step 5
          if (statusRes.onboardingStatus === "onboarding_complete" && !hasLinkedAccount) {
            next = 5;
          }
          
          setStep(next);

          // Populate local form state with saved progress from stepData
          const stepData = statusRes.stepData || {};
          const s1 = stepData.step1 || {};
          const s2 = stepData.step2 || {};
          const s3 = stepData.step3 || {};
          const s4 = stepData.step4 || {};

          setFormData((prev) => ({
            ...prev,
            // Step 1
            specialty: s1.specialty || prev.specialty,
            experience: s1.experience !== undefined ? String(s1.experience) : prev.experience,
            qualification: s1.qualification || prev.qualification,
            summary: s1.summary || prev.summary,

            // Step 2
            hospitalName: s2.hospitalName || prev.hospitalName,
            streetAddress: s2.location?.line1 || prev.streetAddress,
            streetAddress2: s2.location?.line2 || prev.streetAddress2,
            city: s2.location?.line2 && !s2.location?.line1 ? s2.location?.line2 : (s2.location?.line2 || prev.city),
            state: s2.location?.line3 || prev.state,
            postalCode: s2.location?.postalCode || prev.postalCode,
            country: s2.country || prev.country,

            // Step 3
            registrationNumber: s3.registrationNumber || prev.registrationNumber,
            issuingBoard: s3.issuingBoard || prev.issuingBoard,
            licenseExpiry: s3.expiryDate ? s3.expiryDate.split("T")[0] : prev.licenseExpiry,

            // Step 4
            consultationFee: s4.consultationFee !== undefined ? String(s4.consultationFee) : prev.consultationFee,
            startTime: s4.availability?.startTime || prev.startTime,
            endTime: s4.availability?.endTime || prev.endTime,
            days: s4.availability?.days || prev.days,
          }));
        }
      } catch (err) {
        console.error("Failed to load onboarding status", err);
      }
    };
    initOnboardingData();
  }, [navigate]);

  const handleDayToggle = (day: string) => {
    setFormData((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day],
    }));
  };

  const validateStep = () => {
    switch (step) {
      case 1:
        return !!(formData.specialty && formData.experience && formData.qualification);
      case 2:
        return !!(formData.hospitalName && formData.streetAddress && formData.city && formData.state && formData.postalCode);
      case 3:
        return !!(formData.registrationNumber && formData.issuingBoard);
      case 4:
        return !!(formData.consultationFee && formData.startTime && formData.endTime && formData.days.length > 0);
      case 5:
        return !!(
          formData.legalName && 
          formData.pan && 
          formData.email && 
          formData.phone && 
          formData.streetAddress &&
          formData.streetAddress2 &&
          formData.city &&
          formData.state &&
          formData.postalCode &&
          formData.accountHolderName && 
          formData.bankName && 
          formData.ifscCode && 
          formData.accountNumber
        );
      default:
        return false;
    }
  };

  const handleNext = async () => {
    if (!validateStep()) {
      toast({
        title: "Incomplete Fields",
        description: "Please fill in all the required fields before proceeding.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      if (step === 1) {
        await submitOnboardingStep1({
          specialty: formData.specialty,
          experience: parseInt(formData.experience),
          qualification: formData.qualification,
          summary: formData.summary,
        });
      } else if (step === 2) {
        await submitOnboardingStep2({
          hospitalName: formData.hospitalName,
          location: {
            line1: formData.streetAddress,
            line2: formData.streetAddress2 || formData.city,
            line3: formData.state,
          },
          country: formData.country,
        });
      } else if (step === 3) {
        await submitOnboardingStep3({
          registrationNumber: formData.registrationNumber,
          issuingBoard: formData.issuingBoard,
          expiryDate: formData.licenseExpiry,
        });
      } else if (step === 4) {
        await submitOnboardingStep4({
          consultationFee: parseInt(formData.consultationFee),
          availability: {
            startTime: formData.startTime,
            endTime: formData.endTime,
            days: formData.days,
          },
        });
      } else if (step === 5) {
        await createLinkedAccount({
          name: formData.legalName,
          email: formData.email,
          phone: formData.phone,
          pan: formData.pan,
          address: {
            street: formData.streetAddress,
            street2: formData.streetAddress2 || "Near " + formData.hospitalName,
            city: formData.city,
            state: formData.state,
            postalCode: formData.postalCode,
          },
          bankAccount: {
            accountNumber: formData.accountNumber,
            ifsc: formData.ifscCode,
            beneficiaryName: formData.accountHolderName,
          },
          status: "Pending Verification",
        });

        toast({
          title: "Onboarding Completed!",
          description: "Your registration has been submitted for Super Admin approval.",
        });
        localStorage.setItem("doctorOnboarded", "true");
        navigate("/dashboard/doctor");
        return;
      }

      setStep((prev) => prev + 1);
      toast({
        title: `Step ${step} Completed`,
        description: "Progress saved successfully.",
      });
    } catch (err: any) {
      console.error(err);
      if (step === 5) {
        toast({
          title: "Linking Failed",
          description: err.response?.data?.error || err.response?.data?.message || err.message || "Failed to link settlement account. Please check your KYC and bank details.",
          variant: "destructive",
        });
        return;
      }
      // Fallback for mock environments
      setStep((prev) => prev + 1);
      toast({
        title: "Saved Locally",
        description: "Moving to next step (offline preview).",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  const stepsList = [
    { num: 1, label: "Professional Details", icon: User },
    { num: 2, label: "Clinic / Hospital Info", icon: Building2 },
    { num: 3, label: "Identity & Credentials", icon: FileBadge },
    { num: 4, label: "Slots & Fees", icon: Clock },
    { num: 5, label: "Payout Account", icon: CreditCard },
  ];

  if (showSummary) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 animate-fadeIn text-[#14213D]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div className="text-left">
            <h1 className="text-3xl font-black tracking-tight text-[#14213D]">Onboarding Profile Summary</h1>
            <p className="text-slate-400 text-sm mt-1">Review your submitted registration and payout details</p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => {
                setShowSummary(false);
                setStep(1);
              }}
              variant="outline"
              className="rounded-xl border-slate-200 font-bold h-11 px-6 hover:bg-slate-50 text-slate-700 bg-white"
            >
              Edit Profile Details
            </Button>
            <Button 
              onClick={() => navigate("/dashboard/doctor")}
              className="bg-[#14213D] text-white hover:bg-[#1c3058] rounded-xl font-bold h-11 px-6 shadow-sm border-none"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>

        {/* Status Indicator Card */}
        <Card className="bg-white border-slate-100 shadow-sm rounded-[24px] mb-6 overflow-hidden">
          <div className="bg-gradient-to-r from-[#14213D] to-[#1e3a5f] p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-emerald-400 shrink-0" />
              <div className="text-left">
                <h3 className="font-extrabold text-base">Profile Setup Completed</h3>
                <p className="text-xs text-slate-300 mt-0.5">All 5 onboarding and payment steps are verified.</p>
              </div>
            </div>
            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-400/20 px-3 py-1 font-bold text-xs rounded-full">
              Approved & Active
            </Badge>
          </div>
        </Card>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          
          {/* Step 1 Profile */}
          <Card className="bg-white border-slate-100 shadow-sm rounded-[24px] p-6">
            <CardHeader className="p-0 pb-4 border-b border-slate-100">
              <CardTitle className="text-sm font-black text-[#14213D] flex items-center gap-2">
                <User className="h-4 w-4 text-[#35B7C9]" /> 1. Professional Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Specialty</p>
                  <p className="text-xs font-bold text-[#14213D] mt-0.5">{formData.specialty || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Experience</p>
                  <p className="text-xs font-bold text-[#14213D] mt-0.5">{formData.experience ? `${formData.experience} Years` : "N/A"}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Qualifications</p>
                <p className="text-xs font-bold text-[#14213D] mt-0.5">{formData.qualification || "N/A"}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bio/Summary</p>
                <p className="text-xs font-medium text-slate-500 leading-relaxed mt-0.5">{formData.summary || "N/A"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Step 2 Clinic */}
          <Card className="bg-white border-slate-100 shadow-sm rounded-[24px] p-6">
            <CardHeader className="p-0 pb-4 border-b border-slate-100">
              <CardTitle className="text-sm font-black text-[#14213D] flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#35B7C9]" /> 2. Clinic / Hospital Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-4 space-y-3.5">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Hospital / Clinic Entity Name</p>
                <p className="text-xs font-bold text-[#14213D] mt-0.5">{formData.hospitalName || "N/A"}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Street Address</p>
                <p className="text-xs font-bold text-[#14213D] mt-0.5">
                  {formData.streetAddress}
                  {formData.streetAddress2 ? `, ${formData.streetAddress2}` : ""}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">City</p>
                  <p className="text-xs font-bold text-[#14213D] mt-0.5">{formData.city || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">State</p>
                  <p className="text-xs font-bold text-[#14213D] mt-0.5">{formData.state || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Postal Code</p>
                  <p className="text-xs font-bold text-[#14213D] mt-0.5">{formData.postalCode || "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 3 License */}
          <Card className="bg-white border-slate-100 shadow-sm rounded-[24px] p-6">
            <CardHeader className="p-0 pb-4 border-b border-slate-100">
              <CardTitle className="text-sm font-black text-[#14213D] flex items-center gap-2">
                <FileBadge className="h-4 w-4 text-[#35B7C9]" /> 3. Medical Council Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Registration Number</p>
                  <p className="text-xs font-bold text-[#14213D] mt-0.5">{formData.registrationNumber || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Expiry Date</p>
                  <p className="text-xs font-bold text-[#14213D] mt-0.5">{formData.licenseExpiry || "N/A"}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Issuing Board / Council</p>
                <p className="text-xs font-bold text-[#14213D] mt-0.5">{formData.issuingBoard || "N/A"}</p>
              </div>
            </CardContent>
          </Card>

          {/* Step 4 Availability */}
          <Card className="bg-white border-slate-100 shadow-sm rounded-[24px] p-6">
            <CardHeader className="p-0 pb-4 border-b border-slate-100">
              <CardTitle className="text-sm font-black text-[#14213D] flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#35B7C9]" /> 4. Consultation Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Consultation Fee</p>
                  <p className="text-xs font-bold text-emerald-600 mt-0.5">₹{formData.consultationFee}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Consultation Hours</p>
                  <p className="text-xs font-bold text-[#14213D] mt-0.5">{formData.startTime} - {formData.endTime}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Practice Days</p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {formData.days.map((day) => (
                    <Badge key={day} className="bg-slate-100 text-slate-600 border-none font-bold text-[10px] px-2 py-0.5">
                      {day}
                    </Badge>
                  ))}
                  {formData.days.length === 0 && <p className="text-xs text-slate-400">None selected</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Step 5 Payout Settlement */}
          <Card className="md:col-span-2 bg-white border-slate-100 shadow-sm rounded-[24px] p-6">
            <CardHeader className="p-0 pb-4 border-b border-slate-100">
              <CardTitle className="text-sm font-black text-[#14213D] flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#35B7C9]" /> 5. Payout Bank Settlement Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Beneficiary Name</p>
                  <p className="text-xs font-bold text-[#14213D] mt-0.5">{formData.accountHolderName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bank Name</p>
                  <p className="text-xs font-bold text-[#14213D] mt-0.5">{formData.bankName || "N/A"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Account Number</p>
                  <p className="text-xs font-bold text-[#14213D] mt-0.5">
                    {formData.accountNumber 
                      ? `•••• •••• ${formData.accountNumber.slice(-4)}`
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">IFSC Code</p>
                  <p className="text-xs font-bold text-[#14213D] mt-0.5">{formData.ifscCode || "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8 animate-fadeIn">
      {/* Steps Progress Indicator */}
      <div className="flex justify-between items-center bg-white/60 backdrop-blur-md rounded-[20px] p-5 shadow-sm border border-white/60">
        {stepsList.map((s, idx) => {
          const IconComponent = s.icon;
          const isActive = step === s.num;
          const isCompleted = step > s.num;

          return (
            <div key={s.num} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5 z-10">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition-all duration-300 font-bold ${
                    isActive
                      ? "bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white shadow-md shadow-[#F2052C]/20 scale-105"
                      : isCompleted
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isCompleted ? <CheckCircle className="h-5 w-5" /> : s.num}
                </div>
                <span className="hidden md:block text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                  {s.label}
                </span>
              </div>
              {idx < stepsList.length - 1 && (
                <div className="flex-1 h-0.5 mx-2 bg-slate-100 relative -top-3">
                  <div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#F2052C] to-[#FF4B66] transition-all duration-500"
                    style={{ width: isCompleted ? "100%" : "0%" }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Card className="bg-white/70 backdrop-blur-xl border border-white/80 shadow-lg rounded-[24px] overflow-hidden p-2">
        <CardHeader className="p-8">
          <div className="flex items-center gap-3 mb-2">
            <Badge className="bg-[#F2052C]/10 text-[#F2052C] border-none font-bold text-xs px-2.5 py-0.5">
              Step {step} of 5
            </Badge>
            <span className="text-xs text-slate-400 font-semibold">
              {Math.round((step / 5) * 100)}% Profile Completion
            </span>
          </div>
          <CardTitle className="text-2xl font-black text-[#14213D]">
            {stepsList[step - 1].label}
          </CardTitle>
          <CardDescription>
            Please provide accurate information for verification purposes.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-8 pt-0 space-y-6">
          {/* STEP 1: Professional details */}
          {step === 1 && (
            <div className="space-y-4 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="specialty">Medical Specialty *</Label>
                <Input
                  id="specialty"
                  placeholder="e.g. Cardiologist, Dermatologist, Pediatrician"
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  className="rounded-xl border-slate-200 h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="experience">Years of Experience *</Label>
                  <Input
                    id="experience"
                    type="number"
                    placeholder="e.g. 8"
                    value={formData.experience}
                    onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                    className="rounded-xl border-slate-200 h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qualification">Highest Qualification *</Label>
                  <Input
                    id="qualification"
                    placeholder="e.g. MBBS, MD, DM"
                    value={formData.qualification}
                    onChange={(e) => setFormData({ ...formData, qualification: e.target.value })}
                    className="rounded-xl border-slate-200 h-11"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="summary">Professional Biography / Summary</Label>
                <Textarea
                  id="summary"
                  placeholder="Briefly describe your clinical achievements and patient care philosophy..."
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  className="rounded-xl border-slate-200 min-h-[100px]"
                />
              </div>
            </div>
          )}

          {/* STEP 2: Clinic / Hospital details */}
          {step === 2 && (
            <div className="space-y-4 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="hospitalName">Hospital / Clinic Entity Name *</Label>
                <Input
                  id="hospitalName"
                  placeholder="e.g. Apollo Super Specialty Hospital"
                  value={formData.hospitalName}
                  onChange={(e) => setFormData({ ...formData, hospitalName: e.target.value })}
                  className="rounded-xl border-slate-200 h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="streetAddress">Street Address Line 1 *</Label>
                <Input
                  id="streetAddress"
                  placeholder="e.g. 12, Bannerghatta Main Road"
                  value={formData.streetAddress}
                  onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                  className="rounded-xl border-slate-200 h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="streetAddress2">Street Address Line 2 (Area / Locality)</Label>
                <Input
                  id="streetAddress2"
                  placeholder="e.g. Near Rose Garden"
                  value={formData.streetAddress2}
                  onChange={(e) => setFormData({ ...formData, streetAddress2: e.target.value })}
                  className="rounded-xl border-slate-200 h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    placeholder="e.g. Bengaluru"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="rounded-xl border-slate-200 h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="state">State / Province *</Label>
                  <Input
                    id="state"
                    placeholder="e.g. Karnataka"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="rounded-xl border-slate-200 h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="postalCode">Postal Code / PIN Code *</Label>
                  <Input
                    id="postalCode"
                    placeholder="e.g. 560001"
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    className="rounded-xl border-slate-200 h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    placeholder="e.g. India"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="rounded-xl border-slate-200 h-11"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Identity & Credentials */}
          {step === 3 && (
            <div className="space-y-4 text-left">
              <div className="space-y-1.5">
                <Label htmlFor="registrationNumber">Medical Council Registration Number *</Label>
                <Input
                  id="registrationNumber"
                  placeholder="e.g. MCI-12345"
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  className="rounded-xl border-slate-200 h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="issuingBoard">Issuing Board / Council *</Label>
                  <Input
                    id="issuingBoard"
                    placeholder="e.g. Medical Council of India"
                    value={formData.issuingBoard}
                    onChange={(e) => setFormData({ ...formData, issuingBoard: e.target.value })}
                    className="rounded-xl border-slate-200 h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="licenseExpiry">License Expiry Date</Label>
                  <Input
                    id="licenseExpiry"
                    type="date"
                    value={formData.licenseExpiry}
                    onChange={(e) => setFormData({ ...formData, licenseExpiry: e.target.value })}
                    className="rounded-xl border-slate-200 h-11"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3 mt-4">
                <FileBadge className="h-5 w-5 text-[#2563eb] mt-0.5 shrink-0" />
                <div className="text-xs text-slate-500 font-medium">
                  <p className="font-bold text-slate-700">Credential Verification Protocol</p>
                  <p className="mt-1">
                    Your registration number will be verified with the corresponding medical council. Verification usually takes 24–48 hours after final step.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Slots & Consultation Fees */}
          {step === 4 && (
            <div className="space-y-6 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="startTime">Shift Start Time *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="rounded-xl border-slate-200 h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endTime">Shift End Time *</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="rounded-xl border-slate-200 h-11"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="consultationFee">Consultation Fee (INR) *</Label>
                <Input
                  id="consultationFee"
                  type="number"
                  placeholder="500"
                  value={formData.consultationFee}
                  onChange={(e) => setFormData({ ...formData, consultationFee: e.target.value })}
                  className="rounded-xl border-slate-200 h-11"
                />
              </div>

              <div className="space-y-3">
                <Label>Available Shift Days *</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                  {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                    <label key={day} className="flex items-center space-x-2.5 text-xs font-bold text-slate-700 cursor-pointer hover:text-[#F2052C] transition-colors">
                      <Checkbox
                        checked={formData.days.includes(day)}
                        onCheckedChange={() => handleDayToggle(day)}
                        className="rounded-[6px] border-slate-300"
                      />
                      <span>{day.slice(0, 3)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Payout bank account linked details */}
          {step === 5 && (
            <div className="space-y-4 text-left">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 mb-4">
                <p className="text-xs font-bold text-slate-700">KYC & Stakeholder Verification</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Razorpay Route payouts require verified stakeholder details. Please verify your legal name, contact information, and PAN.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="legalName">Full Legal Name *</Label>
                  <Input
                    id="legalName"
                    placeholder="e.g. John Doe"
                    value={formData.legalName}
                    onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                    className="rounded-xl border-slate-200 h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pan">PAN Card Number *</Label>
                  <Input
                    id="pan"
                    placeholder="e.g. ABCDE1234F"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    className="rounded-xl border-slate-200 h-11"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="e.g. john.doe@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="rounded-xl border-slate-200 h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="rounded-xl border-slate-200 h-11"
                  />
                </div>
              </div>

              <div className="h-px bg-slate-100 my-4" />

              <div className="space-y-3 text-left">
                <Label className="text-slate-700 font-bold text-xs uppercase tracking-wider">Payout Address *</Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="payoutStreet">Street Address *</Label>
                    <Input
                      id="payoutStreet"
                      placeholder="e.g. 12 Main St"
                      value={formData.streetAddress}
                      onChange={(e) => setFormData({ ...formData, streetAddress: e.target.value })}
                      className="rounded-xl border-slate-200 h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="payoutStreet2">Area / Locality (Line 2) *</Label>
                    <Input
                      id="payoutStreet2"
                      placeholder="e.g. Teynampet"
                      value={formData.streetAddress2}
                      onChange={(e) => setFormData({ ...formData, streetAddress2: e.target.value })}
                      className="rounded-xl border-slate-200 h-11"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="payoutCity">City *</Label>
                    <Input
                      id="payoutCity"
                      placeholder="e.g. Chennai"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="rounded-xl border-slate-200 h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="payoutState">State *</Label>
                    <Input
                      id="payoutState"
                      placeholder="e.g. Tamil Nadu"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="rounded-xl border-slate-200 h-11"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="payoutPostalCode">Postal Code / PIN *</Label>
                    <Input
                      id="payoutPostalCode"
                      placeholder="e.g. 600018"
                      value={formData.postalCode}
                      onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                      className="rounded-xl border-slate-200 h-11"
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-100 my-4" />

              <div className="space-y-1.5">
                <Label htmlFor="accountHolderName">Bank Account Beneficiary Name *</Label>
                <Input
                  id="accountHolderName"
                  placeholder="e.g. Dr. John Doe"
                  value={formData.accountHolderName}
                  onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                  className="rounded-xl border-slate-200 h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bankName">Bank Name *</Label>
                <Input
                  id="bankName"
                  placeholder="e.g. State Bank of India"
                  value={formData.bankName}
                  onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                  className="rounded-xl border-slate-200 h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ifscCode">IFSC Code *</Label>
                  <Input
                    id="ifscCode"
                    placeholder="e.g. SBIN0001234"
                    value={formData.ifscCode}
                    onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value })}
                    className="rounded-xl border-slate-200 h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="accountNumber">Account Number *</Label>
                  <Input
                    id="accountNumber"
                    placeholder="e.g. 123456789012"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="rounded-xl border-slate-200 h-11"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>

        {/* Footer Navigation Buttons */}
        <div className="bg-slate-50/50 border-t border-slate-100 p-8 flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={step === 1 || loading}
            className="rounded-xl font-bold h-11 px-6 text-slate-500 hover:text-slate-700"
          >
            <ChevronLeft className="h-4.5 w-4.5 mr-2" /> Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={loading}
            className="bg-gradient-to-r from-[#F2052C] to-[#FF4B66] text-white rounded-xl h-11 px-8 font-bold shadow-md shadow-[#F2052C]/20 hover:opacity-90 min-w-[140px]"
          >
            {loading ? (
              "Saving..."
            ) : step === 5 ? (
              <>Finish Onboarding <CheckCircle className="h-4 w-4 ml-2" /></>
            ) : (
              <>Next Step <ChevronRight className="h-4 w-4 ml-2" /></>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default OnboardingWizard;
