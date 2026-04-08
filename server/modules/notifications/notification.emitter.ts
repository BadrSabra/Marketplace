import { EventEmitter } from "events";
import { type Role } from "@shared/schema";

export type NotificationEvent = {
  type:
    | "NEW_ORDER"
    | "ORDER_STATUS_UPDATE"
    | "NEW_OFFER"
    | "OFFER_ACCEPTED"
    | "OFFER_REJECTED"
    | "OFFER_COUNTERED"
    | "ACCOUNT_APPROVED"
    | "DEPOSIT_APPROVED"
    | "DEPOSIT_REJECTED"
    | "WITHDRAWAL_APPROVED"
    | "WITHDRAWAL_REJECTED"
    | "WALLET_UPDATE"
    | "SYSTEM_ALERT";
  userId: string;
  role: Role;
  payload: any;
  timestamp: Date;
};

class NotificationEmitter extends EventEmitter {
  emitEvent(event: NotificationEvent) {
    this.emit("notification", event);
    console.log(`[NotificationEvent] ${event.type} for user ${event.userId} (${event.role})`);
  }
}

export const notificationEmitter = new NotificationEmitter();

export const emitNotification = (
  type: NotificationEvent["type"],
  userId: string,
  role: Role,
  payload: any
) => {
  notificationEmitter.emitEvent({
    type,
    userId,
    role,
    payload,
    timestamp: new Date(),
  });
};
