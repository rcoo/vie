import React, { useState, useEffect } from 'react';
import {
  Save,
  Check,
  HardDrive,
  Sliders,
  Image as ImageIcon,
  Globe,
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  Sparkles,
  Megaphone,
  MonitorPlay,
  AlertCircle,
  ExternalLink,
  Film
} from 'lucide-react';
import type { AppSettings } from '../../types.ts';
import { apiFetch } from '../../lib/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';

export const SettingsTab: React.FC = () => {
  const { refreshSettings } = useAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Admin credentials update state
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [updatingCreds, setUpdatingCreds] = useState(false);
  const [credsSuccess, setCredsSuccess] = useState(false);
  const [credsError, setCredsError] = useState<string | null>(null);

  // Logo preset suggestions for easy one-click testing
  const sampleLogos = [
    { name: 'افتراضي (بدون صورة)', url: '' },
    { name: 'شعار ذهبي سينمائي', url: 'https://images.unsplash.com/photo-1594909122845-11baa439b7bf?w=160&auto=format&fit=crop&q=80' }
  ];

  useEffect(() => {
    apiFetch('/api/admin/settings')
      .then((res) => res.json())
      .then((data) => {
        setSettings({
          siteName: data.siteName || 'viE',
          siteDescription: data.siteDescription || '.gg/8mr',
          logoUrl: data.logoUrl || '',
          faviconUrl: data.faviconUrl || '',
          heroBadgeText: data.heroBadgeText || 'المسلسل المميز • حصري على المنصة',
          footerText: data.footerText || 'viE • Encrypted High-Performance Streaming Platform',
          communityUrl: data.communityUrl || 'https://discord.gg/8mr',
          announcementEnabled: !!data.announcementEnabled,
          announcementText: data.announcementText || '',
          announcementLink: data.announcementLink || '',
          accentColor: data.accentColor || '#f59e0b',
          completionPercentage: data.completionPercentage || 90,
          autoNextEpisodeDelay: data.autoNextEpisodeDelay ?? 5,
          defaultMaxDevices: data.defaultMaxDevices || 1,
          allowPip: data.allowPip !== false,
          allowPlaybackSpeed: data.allowPlaybackSpeed !== false,
          googleClientId: data.googleClientId || '',
          googleClientSecret: data.googleClientSecret || '',
          googleRefreshToken: data.googleRefreshToken || '',
          googleApiKey: data.googleApiKey || ''
        });
      })
      .catch((err) => console.error('Failed to load settings:', err))
      .finally(() => setLoading(false));

    // Also fetch current admin user info
    apiFetch('/api/auth/admin-session')
      .then((res) => res.json())
      .then((data) => {
        if (data.admin?.username) {
          setAdminUsername(data.admin.username);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSavedSuccess(false);

    try {
      const res = await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSavedSuccess(true);
        // Instantly refresh settings across the whole application
        await refreshSettings();
        setTimeout(() => setSavedSuccess(false), 3500);
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setCredsError(null);
    setCredsSuccess(false);

    if (adminPassword && adminPassword !== adminPasswordConfirm) {
      setCredsError('كلمتا المرور غير متطابقتين.');
      return;
    }

    if (!adminUsername.trim() && !adminPassword) {
      setCredsError('يرجى تحديد اسم مستخدم أو كلمة مرور جديدة.');
      return;
    }

    setUpdatingCreds(true);
    try {
      const payload: { username?: string; password?: string } = {};
      if (adminUsername.trim()) payload.username = adminUsername.trim();
      if (adminPassword) payload.password = adminPassword;

      const res = await apiFetch('/api/admin/credentials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setCredsError(data.error || 'فشل تحديث بيانات الإدارة.');
      } else {
        setCredsSuccess(true);
        setAdminPassword('');
        setAdminPasswordConfirm('');
        setTimeout(() => setCredsSuccess(false), 3500);
      }
    } catch (err: any) {
      setCredsError(err.message || 'حدث خطأ أثناء التحديث.');
    } finally {
      setUpdatingCreds(false);
    }
  };

  if (loading || !settings) {
    return <div className="p-8 text-center text-white/40">جارٍ تحميل إعدادات المنصة...</div>;
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2 font-mono">
          <Sliders className="w-5 h-5 text-amber-400" />
          <span>إعدادات وتخصيص المنصة (Platform & Brand Customization)</span>
        </h2>
        <p className="text-xs text-white/50 mt-1">
          تحكم كامل في اسم الموقع، الشعار، نصوص الواجهة، ألوان وهوية المنصة، مشغل الفيديو وبيانات حساب الإدارة.
        </p>
      </div>

      {/* Live Brand Preview Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>معاينة حية لهوية المنصة (Live Header Preview)</span>
          </span>
          <span className="text-[10px] text-white/40">تظهر هذه الهوية في أعلى كل صفحات المنصة</span>
        </div>

        <div className="rounded-2xl bg-[#09090c] border border-white/10 p-4 flex items-center justify-between gap-4 overflow-hidden">
          <div className="flex items-center gap-3">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt={settings.siteName}
                className="h-10 max-w-[150px] object-contain rounded-lg border border-white/10 bg-white/5"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
                <Film className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-wider uppercase text-white font-mono leading-none">
                {settings.siteName || 'viE'}
              </span>
              <span className="text-[11px] text-white/50 tracking-wider">
                {settings.siteDescription || '.gg/8mr'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-white/50 hidden sm:inline">{settings.footerText}</span>
            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20 font-mono">
              PREVIEW
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-8">
        {/* 1. Brand Identity & Name & Logo */}
        <div className="p-6 sm:p-7 rounded-3xl bg-white/[0.02] border border-white/10 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <Globe className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">هوية المنصة، الاسم، والشعار (Brand & Identity)</h3>
              <p className="text-[11px] text-white/50">تعديل اسم الموقع والشعار وأيقونة المتصفح والنصوص الترويجية</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                اسم الموقع (Site Name) <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                placeholder="مثال: viE"
                required
                className="w-full bg-black/60 border border-white/20 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-4 py-2.5 text-xs text-white font-medium"
              />
              <span className="text-[10px] text-white/40 mt-1 block">
                الاسم الذي يظهر في شريط العنوان، شريط التنقل، وصفحات الدخول.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                الوصف المختصر / الرابط الفرعي (Tagline)
              </label>
              <input
                type="text"
                value={settings.siteDescription}
                onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })}
                placeholder="مثال: .gg/8mr أو Private Stream"
                className="w-full bg-black/60 border border-white/20 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-4 py-2.5 text-xs text-white font-medium"
              />
              <span className="text-[10px] text-white/40 mt-1 block">
                يظهر أسفل اسم الموقع في الهيدر والواجهة.
              </span>
            </div>
          </div>

          {/* Logo URL and preview */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-semibold text-white/80 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>رابط صورة الشعار (Logo Image URL)</span>
              </span>
              {settings.logoUrl && (
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, logoUrl: '' })}
                  className="text-[11px] text-red-400 hover:text-red-300 underline cursor-pointer"
                >
                  إزالة صورة الشعار والعودة للأيقونة الافتراضية
                </button>
              )}
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="url"
                value={settings.logoUrl}
                onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                placeholder="https://example.com/logo.png أو رابط صورة الشعار..."
                className="flex-1 w-full bg-black/60 border border-white/20 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-4 py-2.5 text-xs text-white font-mono"
              />
              {settings.logoUrl && (
                <div className="h-10 w-24 bg-black/80 rounded-xl border border-white/10 flex items-center justify-center p-1 overflow-hidden flex-shrink-0">
                  <img
                    src={settings.logoUrl}
                    alt="Logo Preview"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
            </div>
            <span className="text-[10px] text-white/40 block">
              يدعم روابط صور PNG, WebP, SVG الشفافة. عند ترك الحقل فارغاً، سيتم استخدام شارة الاسم النصية الأنيقة تلقائياً.
            </span>
          </div>

          {/* Favicon URL & Community URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                أيقونة المتصفح (Favicon URL)
              </label>
              <input
                type="url"
                value={settings.faviconUrl || ''}
                onChange={(e) => setSettings({ ...settings, faviconUrl: e.target.value })}
                placeholder="https://example.com/favicon.ico"
                className="w-full bg-black/60 border border-white/20 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-4 py-2.5 text-xs text-white font-mono"
              />
              <span className="text-[10px] text-white/40 mt-1 block">
                الأيقونة المصغرة التي تظهر في لسان المتصفح بجانب اسم الموقع.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                رابط المجتمع أو الدعم (Discord / Telegram)
              </label>
              <input
                type="url"
                value={settings.communityUrl || ''}
                onChange={(e) => setSettings({ ...settings, communityUrl: e.target.value })}
                placeholder="https://discord.gg/8mr"
                className="w-full bg-black/60 border border-white/20 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-4 py-2.5 text-xs text-white font-mono"
              />
              <span className="text-[10px] text-white/40 mt-1 block">
                رابط يتم عرضه في أسفل الصفحة للمشاهدين للانضمام لمجتمعك.
              </span>
            </div>
          </div>

          {/* Hero & Footer Text */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                نص الشارة الترويجية (Hero Badge Text)
              </label>
              <input
                type="text"
                value={settings.heroBadgeText || ''}
                onChange={(e) => setSettings({ ...settings, heroBadgeText: e.target.value })}
                placeholder="المسلسل المميز • حصري على المنصة"
                className="w-full bg-black/60 border border-white/20 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-4 py-2.5 text-xs text-white"
              />
              <span className="text-[10px] text-white/40 mt-1 block">
                الشارة البارزة أعلى البانر السينمائي في الواجهة الرئيسية.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                نص أسفل الصفحة (Footer Text)
              </label>
              <input
                type="text"
                value={settings.footerText || ''}
                onChange={(e) => setSettings({ ...settings, footerText: e.target.value })}
                placeholder="viE • Encrypted High-Performance Streaming Platform"
                className="w-full bg-black/60 border border-white/20 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-4 py-2.5 text-xs text-white"
              />
              <span className="text-[10px] text-white/40 mt-1 block">
                نص حقوق الملكية والخصوصية أسفل كل الصفحات.
              </span>
            </div>
          </div>
        </div>

        {/* 2. Announcement Banner Settings */}
        <div className="p-6 sm:p-7 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <Megaphone className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="text-sm font-bold text-white">شريط التنبيهات والإعلانات العلوي (Announcement Banner)</h3>
                <p className="text-[11px] text-white/50">عرض شريط مميز أعلى الموقع لإشعار المشاهدين بجديد الحلقات أو التحديثات</p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={!!settings.announcementEnabled}
                onChange={(e) => setSettings({ ...settings, announcementEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {settings.announcementEnabled && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 animate-fadeIn">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-white/80 mb-1.5">
                  نص الإعلان أو التنبيه (Announcement Text)
                </label>
                <input
                  type="text"
                  value={settings.announcementText || ''}
                  onChange={(e) => setSettings({ ...settings, announcementText: e.target.value })}
                  placeholder="مثال: مرحباً بكم في منصة viE - تم إضافة الحلقات الجديدة بجودة عالية!"
                  className="w-full bg-black/60 border border-white/20 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/80 mb-1.5">
                  رابط إضافي اختياري (Link URL)
                </label>
                <input
                  type="url"
                  value={settings.announcementLink || ''}
                  onChange={(e) => setSettings({ ...settings, announcementLink: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-black/60 border border-white/20 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-4 py-2.5 text-xs text-white font-mono"
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. Video Player Behavior */}
        <div className="p-6 sm:p-7 rounded-3xl bg-white/[0.02] border border-white/10 space-y-5">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <MonitorPlay className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold text-white">مشغل الفيديو وسلوك البث (Player Behavior)</h3>
              <p className="text-[11px] text-white/50">تخصيص سلوك المشغل والعد التنازلي والميزات المتاحة للمشاهد</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                نسبة اعتبار الحلقة مكتملة (%)
              </label>
              <input
                type="number"
                min={50}
                max={100}
                value={settings.completionPercentage}
                onChange={(e) => setSettings({ ...settings, completionPercentage: parseInt(e.target.value, 10) || 90 })}
                className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white font-mono"
              />
              <span className="text-[10px] text-white/40 mt-1 block">افتراضي: 90%</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                عد تنازلي للحلقة التالية (ثوانٍ)
              </label>
              <input
                type="number"
                min={0}
                max={30}
                value={settings.autoNextEpisodeDelay}
                onChange={(e) => setSettings({ ...settings, autoNextEpisodeDelay: parseInt(e.target.value, 10) || 0 })}
                className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white font-mono"
              />
              <span className="text-[10px] text-white/40 mt-1 block">0 = معطل، افتراضي: 5 ثوانٍ</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                الحد الافتراضي للأجهزة لكل كود جديد
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={settings.defaultMaxDevices}
                onChange={(e) => setSettings({ ...settings, defaultMaxDevices: parseInt(e.target.value, 10) || 1 })}
                className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white font-mono"
              />
              <span className="text-[10px] text-white/40 mt-1 block">افتراضي: 1 جهاز</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/5">
            <label className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/10 cursor-pointer hover:bg-white/[0.04] transition-colors">
              <input
                type="checkbox"
                checked={settings.allowPip}
                onChange={(e) => setSettings({ ...settings, allowPip: e.target.checked })}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500/20 bg-black/50 border-white/20"
              />
              <div>
                <span className="text-xs font-semibold text-white block">ميزة صورة داخل صورة (Picture-in-Picture)</span>
                <span className="text-[10px] text-white/40">السماح للمشاهدين بمتابعة الفيديو أثناء تصفح نوافذ أخرى</span>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.02] border border-white/10 cursor-pointer hover:bg-white/[0.04] transition-colors">
              <input
                type="checkbox"
                checked={settings.allowPlaybackSpeed}
                onChange={(e) => setSettings({ ...settings, allowPlaybackSpeed: e.target.checked })}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500/20 bg-black/50 border-white/20"
              />
              <div>
                <span className="text-xs font-semibold text-white block">تغيير سرعة التشغيل (Playback Speed)</span>
                <span className="text-[10px] text-white/40">تفعيل خيارات تسريع وتبطيء الفيديو (0.5x إلى 2x)</span>
              </div>
            </label>
          </div>
        </div>

        {/* 4. Google Drive API Credentials */}
        <div className="p-6 sm:p-7 rounded-3xl bg-white/[0.02] border border-white/10 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
            <HardDrive className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white">إعدادات Google Drive API الموحدة</h3>
              <p className="text-[11px] text-white/50">
                تُستخدم لتحويل ملفات Google Drive الخاصة إلى بث مباشر مع دعم Range بدون كشف أي بيانات للمتصفح.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">GOOGLE_CLIENT_ID</label>
              <input
                type="text"
                value={settings.googleClientId || ''}
                onChange={(e) => setSettings({ ...settings, googleClientId: e.target.value })}
                placeholder="xxxx.apps.googleusercontent.com"
                className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">GOOGLE_CLIENT_SECRET</label>
              <input
                type="text"
                style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
                value={settings.googleClientSecret || ''}
                onChange={(e) => setSettings({ ...settings, googleClientSecret: e.target.value })}
                placeholder="••••••••••••"
                className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1.5">GOOGLE_REFRESH_TOKEN</label>
            <input
              type="text"
              style={{ WebkitTextSecurity: 'disc' } as React.CSSProperties}
              value={settings.googleRefreshToken || ''}
              onChange={(e) => setSettings({ ...settings, googleRefreshToken: e.target.value })}
              placeholder="••••••••••••"
              className="w-full bg-black/60 border border-white/20 rounded-xl px-4 py-2.5 text-xs text-white font-mono"
            />
          </div>
        </div>

        {/* Save Platform Settings Action Bar */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
          <div>
            {savedSuccess ? (
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold animate-fadeIn">
                <Check className="w-4 h-4" />
                <span>تم حفظ وتطبيق جميع إعدادات المنصة بنجاح!</span>
              </div>
            ) : (
              <span className="text-xs text-white/50">سيتم تطبيق التغييرات فوراً على جميع أجهزة المشاهدين.</span>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-7 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'جارٍ الحفظ...' : 'حفظ إعدادات المنصة'}</span>
          </button>
        </div>
      </form>

      {/* 5. Admin Account & Password Management (With Password Suggestions Suppressed) */}
      <div className="p-6 sm:p-7 rounded-3xl bg-white/[0.02] border border-white/10 space-y-5">
        <div className="flex items-center gap-2.5 border-b border-white/10 pb-3">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-bold text-white">تغيير بيانات دخول الأدمن والأمان (Admin Credentials)</h3>
            <p className="text-[11px] text-white/50">
              تحديث اسم المستخدم وكلمة المرور الخاصة بلوحة التحكم (بدون اقتراحات المتصفح المزعجة)
            </p>
          </div>
        </div>

        <form
          onSubmit={handleUpdateCredentials}
          autoComplete="off"
          data-lpignore="true"
          data-form-type="other"
          className="space-y-4"
        >
          {/* Honeypot dummy inputs to suppress browser autofill heuristics */}
          <input
            type="text"
            name="dummy_user_trap"
            id="dummy_user_trap"
            tabIndex={-1}
            aria-hidden="true"
            style={{ display: 'none', position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            readOnly
          />
          <input
            type="password"
            name="dummy_pass_trap"
            id="dummy_pass_trap"
            tabIndex={-1}
            aria-hidden="true"
            style={{ display: 'none', position: 'absolute', opacity: 0, pointerEvents: 'none' }}
            readOnly
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                اسم مستخدم الإدارة
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  name="adm_user_setting_field"
                  id="adm_user_setting_field"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  data-1p-ignore="true"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="اسم الأدمن الحالي..."
                  required
                  className="w-full bg-black/60 border border-white/20 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                كلمة المرور الجديدة (اختياري)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showAdminPass ? 'text' : 'password'}
                  style={{ WebkitTextSecurity: showAdminPass ? 'none' : 'disc' } as React.CSSProperties}
                  name="adm_pass_setting_field"
                  id="adm_pass_setting_field"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  data-1p-ignore="true"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="اتركها فارغة إذا لم ترغب في التغيير"
                  className="w-full bg-black/60 border border-white/20 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPass(!showAdminPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-1 cursor-pointer"
                  tabIndex={-1}
                  title={showAdminPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showAdminPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-white/50" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1.5">
                تأكيد كلمة المرور الجديدة
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showAdminPass ? 'text' : 'password'}
                  style={{ WebkitTextSecurity: showAdminPass ? 'none' : 'disc' } as React.CSSProperties}
                  name="adm_pass_confirm_field"
                  id="adm_pass_confirm_field"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  data-1p-ignore="true"
                  value={adminPasswordConfirm}
                  onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور للتأكيد"
                  className="w-full bg-black/60 border border-white/20 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          {credsError && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
              <span>{credsError}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {credsSuccess ? (
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold animate-fadeIn">
                <Check className="w-4 h-4" />
                <span>تم تحديث بيانات دخول الأدمن بنجاح!</span>
              </div>
            ) : (
              <span className="text-[11px] text-white/40">
                كلمة المرور يتم تشفيرها باستخدام خوارزمية Bcrypt الآمنة.
              </span>
            )}

            <button
              type="submit"
              disabled={updatingCreds}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2 border border-white/15 transition-all cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>{updatingCreds ? 'جارٍ التحديث...' : 'تحديث بيانات الأدمن'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
