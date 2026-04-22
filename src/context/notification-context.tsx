
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

type NotificationKeys = 'chat' | 'quiz' | 'paper' | 'planner' | 'analyzer';
type NotificationState = Record<NotificationKeys, boolean>;

interface NotificationContextType {
  notifications: NotificationState;
  setNotification: (feature: NotificationKeys, status: boolean) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<NotificationState>({
    chat: false,
    quiz: false,
    paper: false,
    planner: false,
    analyzer: false,
  });

  const setNotification = (feature: NotificationKeys, status: boolean) => {
    setNotifications((prev) => ({
      ...prev,
      [feature]: status,
    }));
  };

  return (
    <NotificationContext.Provider value={{ notifications, setNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
