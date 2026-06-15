import { apiRequest } from "@/lib/api-request";

export interface AnalyticsOverview {
  totalPatients: number;
  male: number;
  female: number;
  boys: number;
  girls: number;
  other: number;
  totalTests: number;
  totalAppointments: number;
  booked: number;
  completed: number;
  inProgress: number;
  totalPrescriptions: number;
  dailyPrescriptions: number;
  weeklyPrescriptions: number;
  monthlyPrescriptions: number;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  analytics: {
    patientsDistribution: {
      genderDistribution: {
        male: number;
        female: number;
        boys: number;
        girls: number;
        other: number;
      };
      ageDistribution: {
        children: number;
        teens: number;
        adults: number;
        seniors: number;
      };
      timeline: Record<string, number>;
    };
    appointmentsStatus: {
      booked: number;
      completed: number;
      inProgress: number;
    };
    topFiveSymptoms: { name: string; count: number }[];
    mostCommonSymptoms: string;
    topFiveDiagnosis: { name: string; count: number }[];
    mostCommonDiagnosis: string;
  };
}

export interface GetAnalyticsParams {
  filter?: "today" | "week" | "month" | "custom";
  startDate?: string;
  endDate?: string;
}

export const getAnalyticsDashboard = async (
  params: GetAnalyticsParams = {}
): Promise<AnalyticsData> => {
  const queryParams = new URLSearchParams();
  if (params.filter) {
    queryParams.append("filter", params.filter);
  }
  if (params.filter === "custom") {
    if (params.startDate) queryParams.append("startDate", params.startDate);
    if (params.endDate) queryParams.append("endDate", params.endDate);
  }
  const queryString = queryParams.toString();
  const url = queryString ? `/api/analytics/dashboard?${queryString}` : "/api/analytics/dashboard";
  const response = await apiRequest(url, {
    method: "GET",
  });
  return response.data;
};

export const getSettlements = async (): Promise<any> => {
  return apiRequest("/api/admin/settlements", {
    method: "GET",
  });
};
