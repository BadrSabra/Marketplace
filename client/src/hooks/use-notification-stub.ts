import { useState, useEffect } from "react";

export type Notification = {
  id: string;
  type: string;
  payload: any;
  timestamp: Date;
  read: boolean;
};

export function useNotificationStub(userId: string | undefined, role: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const pushEvent = (event: any) => {
    const newNotification: Notification = {
      id: Math.random().toString(36).substring(7),
      type: event.type,
      payload: event.payload,
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [newNotification, ...prev]);
  };

  // Mock initial notifications
  useEffect(() => {
    if (userId) {
      setNotifications([
        {
          id: "1",
          type: "SYSTEM_ALERT",
          payload: { message: "Welcome to Mit Gaber!" },
          timestamp: new Date(),
          read: false,
        },
      ]);
    }
  }, [userId]);

  return {
    notifications,
    pushEvent,
    markAsRead: (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    },
    clearNotifications: () => setNotifications([]),
  };
}
