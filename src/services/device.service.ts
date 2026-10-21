import { apiRequest } from "@/lib/api-request";

export const listDevices = async () => {
  const res = await apiRequest("/api/view/devices");
  return res.devices || res.data || (Array.isArray(res) ? res : []);
};

export const createDevice = (data: any) =>
  apiRequest("/api/auth/create/device", {
    method: "POST",
    data,
  });

export const deleteDevice = (id: string) =>
  apiRequest(`/delete/product/${id}`, { method: "DELETE" });

export const toggleDeviceStatus = (id: string, status: string) =>
  apiRequest("/api/inactive/all/entity/toggle-status", {
    method: "POST",
    data: {
      targetId: id,
      targetType: "product",
      status,
    },
  });

export const toggleDevicePaymentMode = (id: string, paymentMode: boolean) =>
  apiRequest(`/api/product/payment-mode/${id}`, {
    method: "PUT",
    data: { paymentMode },
  });
