import { apiRequest } from "@/lib/api-request";
import { API_ENDPOINTS } from "@/lib/api-config";

export const uploadReport = async (formData: FormData) => {
  return apiRequest(API_ENDPOINTS.REPORT.ADD, {
    method: "POST",
    data: formData,
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

export const listReports = async () => {
  const res = await apiRequest(API_ENDPOINTS.REPORT.GET_ALL, { method: "GET" });
  return res.reports || [];
};

export const listReportsByProfile = async (id: string) => {
  const res = await apiRequest(API_ENDPOINTS.REPORT.BY_PROFILE(id), { method: "GET" });
  return res.reports || [];
};

export const listReportsBySession = async (id: string) => {
  const res = await apiRequest(API_ENDPOINTS.REPORT.BY_SESSION(id), { method: "GET" });
  return res.reports || [];
};

export const listReportsByUser = async (id: string) => {
  const res = await apiRequest(API_ENDPOINTS.REPORT.BY_USER(id), { method: "GET" });
  return res.reports || [];
};

export const listReportsByOrganization = async (orgId: string) => {
  const res = await apiRequest(API_ENDPOINTS.REPORT.BY_ORGANIZATION(orgId), { method: "GET" });
  return res.reports || [];
};

export const listReportsForClusterHead = async (id: string) => {
  const res = await apiRequest(API_ENDPOINTS.REPORT.CLUSTER_HEAD(id), { method: "GET" });
  return res.reports || [];
};

export const listConsultationsReport = async (): Promise<any[]> => {
  const res = await apiRequest("/api/reports/consultations", { method: "GET" });
  return res.bookings || res.data || (Array.isArray(res) ? res : []);
};
