export const subOrderStatuses = ["PENDING", "ACCEPTED", "READY", "PICKED_UP", "DELIVERED", "CANCELLED"] as const;
export type SubOrderStatus = (typeof subOrderStatuses)[number];

export const allowedTransitions: Record<SubOrderStatus, SubOrderStatus[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["READY", "CANCELLED"],
  READY: ["PICKED_UP"],
  PICKED_UP: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};
