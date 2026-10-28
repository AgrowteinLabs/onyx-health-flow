import { apiRequest } from '@/lib/api-request';
import { API_ENDPOINTS } from '@/lib/api-config';

export const createBooking = async (doctorId: string, slot: string): Promise<any> => {
  return apiRequest(API_ENDPOINTS.BOOKING.CREATE, {
    method: 'POST',
    data: { doctorId, slot },
  });
};

export const confirmBooking = async (bookingId: string): Promise<any> => {
  return apiRequest(API_ENDPOINTS.BOOKING.CONFIRM, {
    method: 'POST',
    data: { bookingId },
  });
};

export const listBookings = async (params?: {
  date?: string;
  rangeStart?: string;
  rangeEnd?: string;
  status?: string;
  doctorId?: string;
}): Promise<any> => {
  if (params) {
    const query = new URLSearchParams(
      Object.entries(params).filter(([_, v]) => Boolean(v)) as any
    ).toString();
    const url = query ? `${API_ENDPOINTS.BOOKING.LIST}?${query}` : API_ENDPOINTS.BOOKING.LIST;
    return apiRequest(url, { method: 'GET' });
  }

  return apiRequest(API_ENDPOINTS.BOOKING.LIST, {
    method: 'GET',
  });
};

/**
 * Direct doctor slot creation without payment gateway dependency
 * Endpoint: POST /api/booking/doctor-create
 */
export const createDoctorBooking = async (payload: {
  patientName: string;
  patientPhone: string;
  slotDate: string; // YYYY-MM-DD
  slotTimeStart: string; // HH:MM
  slotTimeEnd?: string; // HH:MM (optional, computed from duration)
  duration?: number; // default 30
  reason?: string;
}): Promise<any> => {
  return apiRequest('/api/booking/doctor-create', {
    method: 'POST',
    data: payload,
  });
};

/**
 * Update consultation status: admit, postpone, or reject
 * Endpoint: POST /api/booking/status
 */
export const updateBookingStatus = async (
  payload:
    | { bookingId: string; action: 'admit' }
    | { bookingId: string; action: 'postpone'; postponeMinutes: number; reason?: string }
    | { bookingId: string; action: 'reject'; reason: string; notes?: string }
): Promise<any> => {
  return apiRequest('/api/booking/status', {
    method: 'POST',
    data: payload,
  });
};

/**
 * Get reports attached to booking
 * Endpoint: GET /api/booking/:bookingId/reports
 */
export const getBookingReports = async (bookingId: string): Promise<any> => {
  return apiRequest(`/api/booking/${bookingId}/reports`, {
    method: 'GET',
  });
};

/**
 * Attach report to booking
 * Endpoint: POST /api/booking/:bookingId/attach-report
 */
export const attachBookingReport = async (bookingId: string, reportId: string): Promise<any> => {
  return apiRequest(`/api/booking/${bookingId}/attach-report`, {
    method: 'POST',
    data: { reportId },
  });
};
