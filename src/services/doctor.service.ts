import { apiRequest } from "@/lib/api-request";

export const listDoctors = async () => {
  const res = await apiRequest("/api/doctor/list", { method: "GET" });
  return res.doctors || res.data || (Array.isArray(res) ? res : []);
};

export const createDoctor = async (payload: any) => {
  return apiRequest("/api/doctor/admin/create", {
    method: "POST",
    data: payload,
  });
};

export const deleteDoctor = async (id: string) => {
  return apiRequest(`/update/user/${id}`, {
    method: "PUT",
    data: { status: "Inactive" },
  });
};

export const updateDoctor = async (id: string, payload: any) => {
  return apiRequest(`/update/user/${id}`, {
    method: "PUT",
    data: payload,
  });
};

export const submitOnboardingStep1 = async (payload: any) => {
  return apiRequest("/api/doctor/onboarding/step1", {
    method: "POST",
    data: payload,
  });
};

export const submitOnboardingStep2 = async (payload: any) => {
  return apiRequest("/api/doctor/onboarding/step2", {
    method: "POST",
    data: payload,
  });
};

export const submitOnboardingStep3 = async (payload: any) => {
  return apiRequest("/api/doctor/onboarding/step3", {
    method: "POST",
    data: payload,
  });
};

export const submitOnboardingStep4 = async (payload: any) => {
  return apiRequest("/api/doctor/onboarding/step4", {
    method: "POST",
    data: payload,
  });
};

export const createPrescription = async (payload: any) => {
  return apiRequest("/api/prescription", {
    method: "POST",
    data: payload,
  });
};

export const getPrescription = async (bookingId: string, options: { silent?: boolean } = { silent: true }) => {
  return apiRequest(`/api/prescription/${bookingId}`, {
    method: "GET",
    silent: options.silent !== false,
  });
};

export const getOnboardingStatus = async () => {
  return apiRequest("/api/doctor/onboarding/status", { method: "GET" });
};

export const listDoctorsAdmin = async () => {
  const res = await apiRequest("/api/doctor/admin/list", { method: "GET" });
  return res.doctors || res.data || (Array.isArray(res) ? res : []);
};

export const approveDoctorAdmin = async (doctorId: string, status: string, rejectionReason?: string) => {
  return apiRequest("/api/doctor/admin/approve", {
    method: "POST",
    data: { doctorId, status, rejectionReason },
  });
};

export const updateDoctorAvailability = async (payload: boolean | any) => {
  const data = typeof payload === "boolean" ? { isAvailable: payload } : payload;
  return apiRequest("/api/doctor/availability", {
    method: "POST",
    data,
  });
};

export const getDoctorAvailability = async () => {
  return apiRequest("/api/doctor/availability", {
    method: "GET",
  });
};

export const getDoctorDocumentPresignedUrl = async (payload: {
  documentType: string;
  fileName: string;
  mimeType: string;
}) => {
  return apiRequest("/api/doctor/documents/presigned-url", {
    method: "POST",
    data: payload,
  });
};

export const uploadDoctorDocumentToS3 = async (presignedUrl: string, file: File) => {
  return fetch(presignedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });
};

export const completeBooking = async (bookingId: string) => {
  return apiRequest(`/api/booking/complete/${bookingId}`, {
    method: "POST",
    data: { bookingId },
  });
};

export const getAgoraVideoToken = async (bookingId: string) => {
  return apiRequest(`/api/video/token/${bookingId}`, {
    method: "GET",
  });
};

/**
 * Fetch patient shared reports for a booking under ABDM / NMC guidelines.
 * If doctor declaration is required, the server returns HTTP 403 with declaration_required.
 */
export const getSharedReports = async (bookingId: string) => {
  try {
    const res = await apiRequest(`/api/booking/shared-reports/${bookingId}`, {
      method: "GET",
      silent: true,
    });
    return res;
  } catch (err: any) {
    if (
      err?.data &&
      (err.data.status === "declaration_required" ||
        err.data.consentRequired ||
        err.data.doctorAgreed === false)
    ) {
      return err.data;
    }
    if (err?.status === 403) {
      return {
        status: "declaration_required",
        consentRequired: true,
        doctorAgreed: false,
        declarationText:
          err?.data?.declarationText ||
          "In accordance with NMC/ABDM Telemedicine Practice Guidelines and patient privacy regulations, I declare that I will access and use this patient's medical records strictly for the purpose of this clinical consultation. I agree to keep all patient health information confidential.",
        message:
          err?.data?.message ||
          "Doctor declaration and agreement required prior to accessing patient medical records.",
      };
    }
    throw err;
  }
};

/**
 * Doctor submits signed declaration to decrypt and access patient reports.
 */
export const agreeReportAccess = async (bookingId: string, declaration?: string) => {
  return apiRequest(`/api/booking/agree-report-access/${bookingId}`, {
    method: "POST",
    data: {
      agreed: true,
      declaration:
        declaration ||
        "I declare that I am accessing this patient's medical records solely for the clinical purpose of this telehealth consultation.",
    },
  });
};
