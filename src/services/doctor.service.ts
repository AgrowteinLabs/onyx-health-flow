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

export const getPrescription = async (bookingId: string) => {
  return apiRequest(`/api/prescription/${bookingId}`, {
    method: "GET",
  });
};

    