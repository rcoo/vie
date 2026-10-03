import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { apiFetch } from '../lib/api.ts';
import { ShieldCheck, Lock, User, ArrowLeft, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

interface Props {
  onBackToViewer: () => void;
}

export const AdminLoginGate: React.FC<Props> = ({ onBackToViewer }) => {
  const { loginAdmin, settings } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await loginAdmin(username, password);
    if (!res.success) {
      setError(res.error || 'اسم المستخدم أو كلمة المرور غير صحيحة.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#070709] text-white flex flex-col justify-between p-6">
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between">
        <button
          onClick={async () => {
            try {
              await apiFetch('/api/auth/admin-portal-lock', { method: 'POST' });
            } finally {
              onBackToViewer();
            }
          }}
          className="flex items-center gap-2 text-xs font-semibold text-white/70 hover:text-white px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>الرجوع إلى صفحة الدخول (Viewer Portal)</span>
        </button>
        <span className="text-xs uppercase tracking-widest text-white/40 font-mono">لوحة إدارة المنصة</span>
      </div>

      <div className="w-full max-w-md mx-auto my-auto py-12">
        <div className="backdrop-blur-xl bg-white/[0.03] border border-white/10 rounded-3xl p-8 sm:p-10 shadow-2xl relative">
          <div className="text-center mb-8">
            <div className="inline-flex p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-2 font-mono">
              تسجيل دخول الإدارة (Admin)
            </h1>
            <p className="text-xs text-white/50 leading-relaxed">
              خاص بالمسؤول فقط لإنشاء أكواد المشاهدين وتحديد مدتها وإدارة المسلسلات ومصادر الفيديو وتخصيص الموقع.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            className="space-y-4"
          >
            {/* Hidden dummy honeypot inputs to trap aggressive browser autofill & password suggestions */}
            <input
              type="text"
              name="fake_user_prevent_autofill"
              id="fake_user_prevent_autofill"
              tabIndex={-1}
              aria-hidden="true"
              style={{ display: 'none', position: 'absolute', opacity: 0, pointerEvents: 'none' }}
              readOnly
            />
            <input
              type="password"
              name="fake_pass_prevent_autofill"
              id="fake_pass_prevent_autofill"
              tabIndex={-1}
              aria-hidden="true"
              style={{ display: 'none', position: 'absolute', opacity: 0, pointerEvents: 'none' }}
              readOnly
            />

            <div>
              <label className="block text-xs uppercase tracking-wider text-white/70 font-semibold mb-1.5">
                اسم المستخدم (Username)
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  name="viE_adm_id_auth"
                  id="viE_adm_id_auth"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="أدخل اسم المستخدم..."
                  required
                  className="w-full bg-black/50 border border-white/15 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-white/20 outline-none transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-white/70 font-semibold mb-1.5">
                كلمة المرور (Password)
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  style={{ WebkitTextSecurity: showPassword ? 'none' : 'disc' } as React.CSSProperties}
                  name="viE_adm_code_auth"
                  id="viE_adm_code_auth"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-form-type="other"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور..."
                  required
                  className="w-full bg-black/50 border border-white/15 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl pl-10 pr-10 py-3 text-xs sm:text-sm text-white placeholder-white/20 outline-none transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors p-1 cursor-pointer"
                  tabIndex={-1}
                  title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-2.5 text-red-300 text-xs animate-shake">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 text-black font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 transition-all cursor-pointer mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>جارٍ التحقق...</span>
                </>
              ) : (
                <span>دخول لوحة التحكم</span>
              )}
            </button>
          </form>
        </div>
      </div>

      <div className="text-center text-xs text-white/30">
        {settings.siteName || 'viE'} Security Gateway • Protected by Bcrypt
      </div>
    </div>
  );
};
