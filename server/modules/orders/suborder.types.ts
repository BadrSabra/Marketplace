export const subOrderStatuses = ["PENDING", "ACCEPTED", "IN_TRANSIT", "DELIVERED", "CANCELLED"] as const;
export type SubOrderStatus = (typeof subOrderStatuses)[number];

export const allowedTransitions: Record<SubOrderStatus, SubOrderStatus[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};
