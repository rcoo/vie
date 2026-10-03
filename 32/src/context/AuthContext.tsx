import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../lib/api.ts';

export interface PublicSettings {
  siteName: string;
  siteDescription: string;
  logoUrl: string;
  faviconUrl?: string;
  heroBadgeText?: string;
  footerText?: string;
  communityUrl?: string;
  announcementEnabled?: boolean;
  announcementText?: string;
  announcementLink?: string;
  accentColor?: string;
  completionPercentage?: number;
  autoNextEpisodeDelay?: number;
  defaultMaxDevices?: number;
}

interface AuthContextType {
  // Settings & Branding
  settings: PublicSettings;
  refreshSettings: () => Promise<void>;

  // Viewer state
  isAuthenticated: boolean;
  isLoading: boolean;
  accessCode: string | null;
  expiresAt: string | null;
  maxDevices: number | null;
  loginWithCode: (code: string) => Promise<{ success: boolean; error?: string; adminPortal?: boolean }>;
  logoutViewer: () => Promise<void>;
  refreshViewerSession: () => Promise<void>;

  // Admin state
  isAdmin: boolean;
  adminUser: { id: string; username: string } | null;
  loginAdmin: (u: string, p: string) => Promise<{ success: boolean; error?: string }>;
  logoutAdmin: () => Promise<void>;
}

const defaultSettings: PublicSettings = {
  siteName: 'viE',
  siteDescription: '.gg/8mr',
  logoUrl: '',
  faviconUrl: '',
  heroBadgeText: 'المسلسل المميز • حصري على المنصة',
  footerText: 'viE • Encrypted High-Performance Streaming Platform',
  communityUrl: 'https://discord.gg/8mr',
  announcementEnabled: false,
  announcementText: '',
  announcementLink: '',
  accentColor: '#f59e0b',
  completionPercentage: 90,
  autoNextEpisodeDelay: 5,
  defaultMaxDevices: 1
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<PublicSettings>(defaultSettings);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [accessCode, setAccessCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [maxDevices, setMaxDevices] = useState<number | null>(null);

  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminUser, setAdminUser] = useState<{ id: string; username: string } | null>(null);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch('/api/settings/public');
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        if (data.siteName) {
          document.title = data.siteName;
        }
        if (data.faviconUrl) {
          let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'shortcut icon';
            document.getElementsByTagName('head')[0].appendChild(link);
          }
          link.href = data.faviconUrl;
        }
      }
    } catch (err) {
      console.warn('Could not fetch public settings:', err);
    }
  };

  const checkViewerSession = async () => {
    try {
      const res = await apiFetch('/api/auth/session');
      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(true);
        setAccessCode(data.code || null);
        setExpiresAt(data.expiresAt || null);
        setMaxDevices(data.maxDevices || null);
      } else {
        setIsAuthenticated(false);
        setAccessCode(null);
      }
    } catch {
      setIsAuthenticated(false);
      setAccessCode(null);
    }
  };

  useEffect(() => {
    Promise.all([fetchSettings(), checkViewerSession()]).finally(() => {
      setIsLoading(false);
    });
  }, []);

  const loginWithCode = async (code: string) => {
    try {
      const res = await apiFetch('/api/auth/access-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), deviceInfo: navigator.userAgent })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'الكود غير صحيح أو منتهي.' };
      }
      if (data.adminPortal) {
        return { success: true, adminPortal: true };
      }
      setIsAuthenticated(true);
      setAccessCode(data.code);
      setExpiresAt(data.expiresAt || null);
      setMaxDevices(data.maxDevices || null);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'تعذر الاتصال بالخادم.' };
    }
  };

  const logoutViewer = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('cinevault_device_token'); // cleanup from older builds
      setIsAuthenticated(false);
      setAccessCode(null);
      setExpiresAt(null);
      setMaxDevices(null);
    }
  };

  const loginAdmin = async (u: string, p: string) => {
    try {
      const res = await apiFetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }
      setIsAdmin(true);
      setAdminUser(data.admin);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'فشل الاتصال بالخادم' };
    }
  };

  const logoutAdmin = async () => {
    try {
      await apiFetch('/api/auth/admin-logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('cinevault_admin_token'); // cleanup from older builds
      setIsAdmin(false);
      setAdminUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        settings,
        refreshSettings: fetchSettings,
        isAuthenticated,
        isLoading,
        accessCode,
        expiresAt,
        maxDevices,
        loginWithCode,
        logoutViewer,
        refreshViewerSession: checkViewerSession,
        isAdmin,
        adminUser,
        loginAdmin,
        logoutAdmin
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
