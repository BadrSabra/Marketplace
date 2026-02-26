import { EventEmitter } from "events";
import { type Role } from "@shared/schema";

export type NotificationEvent = {
  type: "ORDER_STATUS_UPDATE" | "NEW_ASSIGNMENT" | "WALLET_UPDATE" | "EARNINGS_UPDATE" | "SYSTEM_ALERT";
  userId: string;
  role: Role;
  payload: any;
  timestamp: Date;
};

class NotificationEmitter extends EventEmitter {
  emitEvent(event: NotificationEvent) {
    this.emit("notification", event);
    // In a real implementation, this could also trigger an audit log entry
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
