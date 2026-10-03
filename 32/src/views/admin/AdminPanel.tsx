import React, { useState } from 'react';
import {
  LayoutDashboard,
  Film,
  Key,
  Sliders,
  FileText,
  LogOut,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { DashboardTab } from './DashboardTab.tsx';
import { SeriesTab } from './SeriesTab.tsx';
import { AccessCodesTab } from './AccessCodesTab.tsx';
import { SettingsTab } from './SettingsTab.tsx';
import { AuditLogsTab } from './AuditLogsTab.tsx';

interface Props {
  onBackToViewer: () => void;
}

export const AdminPanel: React.FC<Props> = ({ onBackToViewer }) => {
  const { adminUser, logoutAdmin, settings } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'series' | 'codes' | 'settings' | 'logs'>('dashboard');

  const navItems = [
    { id: 'dashboard', label: 'لوحة المؤشرات', icon: LayoutDashboard },
    { id: 'series', label: 'المسلسلات والحلقات', icon: Film },
    { id: 'codes', label: 'أكواد الدخول والجلسات', icon: Key },
    { id: 'settings', label: 'إعدادات المنصة والهوية', icon: Sliders },
    { id: 'logs', label: 'سجلات العمليات', icon: FileText }
  ] as const;

  return (
    <div className="min-h-screen bg-[#09090c] text-white flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#0d0d12]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBackToViewer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white/80 hover:text-white transition-all cursor-pointer"
            title="الرجوع إلى منصة المشاهدة"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>عرض المنصة (Viewer)</span>
          </button>

          <div className="h-5 w-[1px] bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-2.5">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.siteName}
                className="h-7 max-w-[100px] object-contain rounded"
              />
            ) : null}
            <span className="text-base font-bold font-mono tracking-wider uppercase text-white">
              {settings.siteName || 'viE'}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
              Admin Control
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {adminUser && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/10 text-xs font-mono text-white/80">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{adminUser.username}</span>
            </div>
          )}

          <button
            onClick={async () => {
              await logoutAdmin();
              onBackToViewer();
            }}
            className="p-2 rounded-xl text-white/60 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
            title="تسجيل خروج الأدمن"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                    : 'bg-white/[0.03] hover:bg-white/[0.08] text-white/70 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <main className="flex-1 pb-16">
          {activeTab === 'dashboard' && (
            <DashboardTab onNavigateTab={(tab) => setActiveTab(tab as any)} />
          )}
          {activeTab === 'series' && <SeriesTab />}
          {activeTab === 'codes' && <AccessCodesTab />}
          {activeTab === 'settings' && <SettingsTab />}
          {activeTab === 'logs' && <AuditLogsTab />}
        </main>
      </div>
    </div>
  );
};
