import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../lib/api.ts';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Smartphone,
  Sparkles,
  Calendar,
  X,
  Edit3,
  Shuffle,
  Clock,
  Download
} from 'lucide-react';
import type { AccessCode, AccessSession } from '../../types.ts';

export const AccessCodesTab: React.FC = () => {
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Single code creator modal
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [durationMode, setDurationMode] = useState<'preset' | 'customDays' | 'exactDate' | 'permanent'>('preset');
  const [presetDays, setPresetDays] = useState<number>(30);
  const [customDaysVal, setCustomDaysVal] = useState<number>(30);
  const [exactDateVal, setExactDateVal] = useState<string>('');
  const [singleMaxDevices, setSingleMaxDevices] = useState<number>(2);
  const [singleNote, setSingleNote] = useState<string>('');

  // Bulk generator modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCount, setBulkCount] = useState<number>(20);
  const [bulkPrefix, setBulkPrefix] = useState<string>('VIP');
  const [bulkDurationMode, setBulkDurationMode] = useState<'preset' | 'permanent'>('preset');
  const [bulkPresetDays, setBulkPresetDays] = useState<number>(30);
  const [bulkMaxDevices, setBulkMaxDevices] = useState<number>(2);
  const [bulkNote, setBulkNote] = useState<string>('حزمة اشتراكات المشاهدين');
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [lastBulkGeneratedCodes, setLastBulkGeneratedCodes] = useState<string[] | null>(null);

  // Edit / Extend code modal
  const [editingCode, setEditingCode] = useState<AccessCode | null>(null);
  const [editDaysToAdd, setEditDaysToAdd] = useState<number>(30);
  const [editExactDate, setEditExactDate] = useState<string>('');
  const [editMaxDevices, setEditMaxDevices] = useState<number>(2);
  const [editNote, setEditNote] = useState<string>('');
  const [editIsPermanent, setEditIsPermanent] = useState<boolean>(false);

  // Sessions viewer modal
  const [activeCodeForSessions, setActiveCodeForSessions] = useState<AccessCode | null>(null);
  const [sessions, setSessions] = useState<AccessSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const fetchCodes = async () => {
    try {
      const res = await apiFetch('/api/admin/access-codes');
      const data = await res.json();
      setCodes(data);
    } catch (err) {
      console.error('Failed to load access codes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const generateRandomCodeString = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let p1 = '';
    let p2 = '';
    for (let i = 0; i < 4; i++) {
      p1 += chars.charAt(Math.floor(Math.random() * chars.length));
      p2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${p1}-${p2}`;
  };

  const handleCopyCode = (code: AccessCode) => {
    navigator.clipboard.writeText(code.code);
    setCopiedId(code.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleStatus = async (code: AccessCode) => {
    const newStatus = code.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await apiFetch(`/api/admin/access-codes/${code.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchCodes();
    } catch (err) {
      console.error('Failed to toggle code status:', err);
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (!confirm('حذف هذا الكود سيؤدي إلى إنهاء جميع الجلسات المرتبطة به فوراً. متابعة؟')) return;
    try {
      await apiFetch(`/api/admin/access-codes/${id}`, { method: 'DELETE' });
      fetchCodes();
    } catch (err) {
      console.error('Failed to delete code:', err);
    }
  };

  // Calculate calculated expiration preview
  const calculateExpirationDate = (): string | null => {
    if (durationMode === 'permanent') return null;
    if (durationMode === 'exactDate') {
      if (!exactDateVal) return null;
      return new Date(exactDateVal).toISOString();
    }
    const days = durationMode === 'preset' ? presetDays : customDaysVal;
    return new Date(Date.now() + days * 86400000).toISOString();
  };

  const handleCreateSingleCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalExpiresAt = calculateExpirationDate();

    try {
      const res = await apiFetch('/api/admin/access-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: customCode.trim() || generateRandomCodeString(),
          expiresAt: finalExpiresAt,
          maxDevices: Number(singleMaxDevices) || 2,
          note: singleNote.trim() || null
        })
      });

      if (res.ok) {
        setShowSingleModal(false);
        setCustomCode('');
        setSingleNote('');
        fetchCodes();
      }
    } catch (err) {
      console.error('Failed to create code:', err);
    }
  };

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBulkGenerating(true);
    const finalExpiresAt =
      bulkDurationMode === 'permanent'
        ? null
        : new Date(Date.now() + bulkPresetDays * 86400000).toISOString();

    try {
      const res = await apiFetch('/api/admin/access-codes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: Number(bulkCount) || 20,
          prefix: bulkPrefix.trim() || undefined,
          expiresAt: finalExpiresAt,
          maxDevices: Number(bulkMaxDevices) || 2,
          note: bulkNote.trim() || undefined
        })
      });

      const data = await res.json();
      if (res.ok && data.codes) {
        setLastBulkGeneratedCodes(data.codes.map((c: any) => c.code));
        fetchCodes();
      }
    } catch (err) {
      console.error('Failed to bulk generate:', err);
    } finally {
      setBulkGenerating(false);
    }
  };

  const handleOpenEdit = (code: AccessCode) => {
    setEditingCode(code);
    setEditMaxDevices(code.maxDevices || 2);
    setEditNote(code.note || '');
    setEditIsPermanent(!code.expiresAt);
    if (code.expiresAt) {
      setEditExactDate(new Date(code.expiresAt).toISOString().split('T')[0]);
    } else {
      setEditExactDate('');
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCode) return;

    let updatedExpiresAt: string | null = null;
    if (!editIsPermanent) {
      if (editExactDate) {
        updatedExpiresAt = new Date(editExactDate).toISOString();
      } else {
        // If extension by days
        const base = editingCode.expiresAt ? new Date(editingCode.expiresAt).getTime() : Date.now();
        updatedExpiresAt = new Date(Math.max(Date.now(), base) + editDaysToAdd * 86400000).toISOString();
      }
    }

    try {
      await apiFetch(`/api/admin/access-codes/${editingCode.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiresAt: updatedExpiresAt,
          maxDevices: Number(editMaxDevices) || 2,
          note: editNote.trim() || null,
          status: 'ACTIVE' // Reactivate if was expired
        })
      });
      setEditingCode(null);
      fetchCodes();
    } catch (err) {
      console.error('Failed to update code:', err);
    }
  };

  const openSessionsModal = async (code: AccessCode) => {
    setActiveCodeForSessions(code);
    setLoadingSessions(true);
    try {
      const res = await apiFetch(`/api/admin/access-codes/${code.id}/sessions`);
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await apiFetch(`/api/admin/sessions/${sessionId}/revoke`, { method: 'POST' });
      if (activeCodeForSessions) {
        openSessionsModal(activeCodeForSessions);
      }
      fetchCodes();
    } catch (err) {
      console.error('Failed to revoke session:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>إدارة أكواد الدخول وصلاحيات المشاهدين</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white/70 font-mono">
              {codes.length} كود مسجل
            </span>
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            أنت وحدك من يستطيع إنشاء الأكواد وتحديد مدتها وعدد أجهزتها من هنا.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Bulk Generate Button */}
          <button
            onClick={() => {
              setLastBulkGeneratedCodes(null);
              setShowBulkModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/20 cursor-pointer transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>توليد مجموعة أكواد (Bulk)</span>
          </button>

          {/* Create Single Code */}
          <button
            onClick={() => {
              setCustomCode('');
              setDurationMode('preset');
              setPresetDays(30);
              setShowSingleModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء كود جديد وتحديد مدته</span>
          </button>
        </div>
      </div>

      {/* Access Codes Table */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-white/50 uppercase tracking-wider">
                <th className="py-3 px-4">رمز الدخول (Access Code)</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4">الأجهزة المتصلة</th>
                <th className="py-3 px-4">مدة الصلاحية / الانتهاء</th>
                <th className="py-3 px-4">ملاحظات / المشترك</th>
                <th className="py-3 px-4 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-white/40">
                    جارٍ قراءة الأكواد...
                  </td>
                </tr>
              ) : codes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-white/40">
                    <Key className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" />
                    <span>لا توجد أكواد حالياً. انقر على &quot;إنشاء كود جديد&quot; للبدء.</span>
                  </td>
                </tr>
              ) : (
                codes.map((code) => {
                  const isExpired = code.expiresAt ? Date.now() > new Date(code.expiresAt).getTime() : false;

                  return (
                    <tr key={code.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Code & Copy */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm text-white tracking-wider bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                            {code.code}
                          </span>
                          <button
                            onClick={() => handleCopyCode(code)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors"
                            title="نسخ الكود للحافظة"
                          >
                            {copiedId === code.id ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleToggleStatus(code)}
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                            code.status === 'ACTIVE' && !isExpired
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : isExpired || code.status === 'EXPIRED'
                              ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                              : 'bg-white/10 text-white/50 border border-white/15'
                          }`}
                        >
                          {code.status === 'ACTIVE' && !isExpired
                            ? 'نشط ✓'
                            : isExpired || code.status === 'EXPIRED'
                            ? 'منتهي ✕'
                            : 'معطل ✕'}
                        </button>
                      </td>

                      {/* Devices */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => openSessionsModal(code)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors border border-white/5"
                          title="عرض الأجهزة المتصلة وفصل أي جهاز"
                        >
                          <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                          <span className="font-mono font-bold">
                            {code.activeDevicesCount || 0} / {code.maxDevices}
                          </span>
                        </button>
                      </td>

                      {/* Expiration */}
                      <td className="py-3.5 px-4 font-mono text-[11px]">
                        {code.expiresAt ? (
                          <div className="flex flex-col">
                            <span className={isExpired ? 'text-red-400 font-bold' : 'text-white/80'}>
                              {new Date(code.expiresAt).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-white/40">
                              {isExpired ? 'انتهت الصلاحية' : `متبقي ${Math.ceil((new Date(code.expiresAt).getTime() - Date.now()) / 86400000)} يوم`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-emerald-400/90 font-semibold">دائم (بدون انتهاء)</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 text-white/60 truncate max-w-xs">
                        {code.note || '-'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit / Extend */}
                          <button
                            onClick={() => handleOpenEdit(code)}
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1 border border-amber-500/20 transition-colors"
                            title="تمديد الصلاحية أو تعديل الكود"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>تمديد / تعديل</span>
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteCode(code.id)}
                            className="p-1.5 rounded-lg text-red-400/70 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                            title="حذف الكود نهائياً"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. Modal: Create Single Access Code with Precise Duration Selector */}
      {showSingleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#111116] border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Key className="w-5 h-5 text-amber-400" />
                <span>إنشاء كود دخول وتحديد مدة الصلاحية</span>
              </h3>
              <button
                onClick={() => setShowSingleModal(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSingleCode} className="space-y-4">
              {/* Code field + Random button */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">
                  رمز الكود (Access Code)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                    placeholder="مثال: VIP-STREAM-2026 أو اتركه فارغاً"
                    className="flex-1 bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono tracking-wider outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setCustomCode(generateRandomCodeString())}
                    className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="توليد كود عشوائي"
                  >
                    <Shuffle className="w-3.5 h-3.5 text-amber-400" />
                    <span>عشوائي</span>
                  </button>
                </div>
              </div>

              {/* DURATION SELECTION (Core user requirement) */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>تحديد مدة الصلاحية (Duration)</span>
                </label>

                {/* Duration Mode Tabs */}
                <div className="grid grid-cols-4 gap-1.5 p-1 bg-black/40 rounded-xl border border-white/10 mb-3 text-center">
                  <button
                    type="button"
                    onClick={() => setDurationMode('preset')}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      durationMode === 'preset' ? 'bg-amber-500 text-black shadow-md' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    خيارات جاهزة
                  </button>
                  <button
                    type="button"
                    onClick={() => setDurationMode('customDays')}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      durationMode === 'customDays' ? 'bg-amber-500 text-black shadow-md' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    عدد أيام مخصص
                  </button>
                  <button
                    type="button"
                    onClick={() => setDurationMode('exactDate')}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      durationMode === 'exactDate' ? 'bg-amber-500 text-black shadow-md' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    تاريخ محدد
                  </button>
                  <button
                    type="button"
                    onClick={() => setDurationMode('permanent')}
                    className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      durationMode === 'permanent' ? 'bg-amber-500 text-black shadow-md' : 'text-white/60 hover:text-white'
                    }`}
                  >
                    دائم
                  </button>
                </div>

                {/* Preset Options Grid */}
                {durationMode === 'preset' && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {[
                      { label: '24 ساعة (يوم)', days: 1 },
                      { label: '3 أيام', days: 3 },
                      { label: '7 أيام (أسبوع)', days: 7 },
                      { label: '15 يوماً', days: 15 },
                      { label: '30 يوماً (شهر)', days: 30 },
                      { label: '60 يوماً (شهران)', days: 60 },
                      { label: '90 يوماً (3 أشهر)', days: 90 },
                      { label: '180 يوماً (6 أشهر)', days: 180 },
                      { label: '365 يوماً (سنة)', days: 365 }
                    ].map((item) => (
                      <button
                        key={item.days}
                        type="button"
                        onClick={() => setPresetDays(item.days)}
                        className={`p-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                          presetDays === item.days
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-white/[0.03] border-white/10 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Custom Days Input */}
                {durationMode === 'customDays' && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={customDaysVal}
                      onChange={(e) => setCustomDaysVal(parseInt(e.target.value, 10))}
                      className="w-32 bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white font-mono text-center"
                    />
                    <span className="text-xs text-white/60">يوماً من تاريخ التفعيل</span>
                  </div>
                )}

                {/* Exact Date Picker */}
                {durationMode === 'exactDate' && (
                  <div>
                    <input
                      type="date"
                      value={exactDateVal}
                      onChange={(e) => setExactDateVal(e.target.value)}
                      className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                )}

                {/* Calculated Expiration Preview Tag */}
                <div className="mt-2.5 p-2 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-[11px] text-white/60">
                  <span>تاريخ انتهاء الكود المحسوب:</span>
                  <span className="font-mono font-bold text-amber-400">
                    {durationMode === 'permanent'
                      ? 'دائم (لا ينتهي أبداً)'
                      : calculateExpirationDate()
                      ? new Date(calculateExpirationDate()!).toLocaleDateString('ar-EG', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'غير محدد'}
                  </span>
                </div>
              </div>

              {/* Devices & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    أقصى عدد أجهزة متصلة (Max Devices)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={singleMaxDevices}
                    onChange={(e) => setSingleMaxDevices(parseInt(e.target.value, 10))}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-white/40 mt-0.5 block">افتراضياً: جهازين</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    ملاحظة / اسم المشترك
                  </label>
                  <input
                    type="text"
                    value={singleNote}
                    onChange={(e) => setSingleNote(e.target.value)}
                    placeholder="مثال: اشتراك فلان..."
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowSingleModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-white/60 hover:text-white"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  حفظ وإنشاء الكود
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Edit & Extend Code (تمديد وتعديل) */}
      {editingCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#111116] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>تمديد وتعديل الكود: {editingCode.code}</span>
              </h3>
              <button onClick={() => setEditingCode(null)} className="text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between text-xs">
                <span className="text-white/50">تاريخ الانتهاء الحالي:</span>
                <span className="font-mono font-bold text-white">
                  {editingCode.expiresAt
                    ? new Date(editingCode.expiresAt).toLocaleDateString()
                    : 'دائم'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/70 mb-2">
                  تمديد الصلاحية السريع (إضافة أيام من الآن):
                </label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[7, 30, 90, 365].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setEditDaysToAdd(d);
                        setEditIsPermanent(false);
                      }}
                      className={`p-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                        editDaysToAdd === d && !editIsPermanent
                          ? 'bg-amber-500 text-black border-amber-500 font-bold'
                          : 'bg-white/5 border-white/10 text-white/70'
                      }`}
                    >
                      +{d} يوم
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <label className="text-xs text-white/70">أو اختيار تاريخ انتهاء محدد:</label>
                  <input
                    type="date"
                    value={editExactDate}
                    onChange={(e) => {
                      setEditExactDate(e.target.value);
                      setEditIsPermanent(false);
                    }}
                    className="flex-1 bg-black/60 border border-white/20 rounded-lg px-2.5 py-1 text-xs text-white font-mono"
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer mt-2">
                  <input
                    type="checkbox"
                    checked={editIsPermanent}
                    onChange={(e) => setEditIsPermanent(e.target.checked)}
                    className="rounded accent-amber-500"
                  />
                  <span className="text-xs text-white/80">جعله كود دائم بدون انتهاء (Lifetime)</span>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/70 mb-1">أقصى أجهزة</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={editMaxDevices}
                    onChange={(e) => setEditMaxDevices(parseInt(e.target.value, 10))}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/70 mb-1">الملاحظة</label>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingCode(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-white/60"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal: Bulk Generate Codes */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#111116] border border-white/15 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <span>توليد مجموعة أكواد وتحديد مدتها لجميع المشتركين</span>
              </h3>
              <button onClick={() => setShowBulkModal(false)} className="text-white/50 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkGenerate} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    عدد الأكواد المطلوبة (Count)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={bulkCount}
                    onChange={(e) => setBulkCount(parseInt(e.target.value, 10))}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    بادئة الكود (Prefix)
                  </label>
                  <input
                    type="text"
                    value={bulkPrefix}
                    onChange={(e) => setBulkPrefix(e.target.value.toUpperCase())}
                    placeholder="VIP أو CINE"
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Bulk Duration */}
              <div>
                <label className="block text-xs font-semibold text-white/70 mb-1.5">
                  مدة الصلاحية لجميع الأكواد المولدة:
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
                  {[
                    { label: 'أسبوع (7 أيام)', days: 7 },
                    { label: 'شهر (30 يوماً)', days: 30 },
                    { label: '3 أشهر (90 يوماً)', days: 90 },
                    { label: 'سنة (365 يوماً)', days: 365 }
                  ].map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => {
                        setBulkPresetDays(p.days);
                        setBulkDurationMode('preset');
                      }}
                      className={`p-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                        bulkDurationMode === 'preset' && bulkPresetDays === p.days
                          ? 'bg-indigo-600 border-indigo-500 text-white font-bold'
                          : 'bg-white/5 border-white/10 text-white/70'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={bulkDurationMode === 'permanent'}
                    onChange={(e) => setBulkDurationMode(e.target.checked ? 'permanent' : 'preset')}
                    className="rounded accent-indigo-500"
                  />
                  <span className="text-xs text-white/80">أكواد دائمة بدون انتهاء</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    أقصى أجهزة لكل كود
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={bulkMaxDevices}
                    onChange={(e) => setBulkMaxDevices(parseInt(e.target.value, 10))}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1">
                    ملاحظة الحزمة
                  </label>
                  <input
                    type="text"
                    value={bulkNote}
                    onChange={(e) => setBulkNote(e.target.value)}
                    className="w-full bg-black/60 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              {/* Show generated codes export */}
              {lastBulkGeneratedCodes && (
                <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                    <span>تم توليد {lastBulkGeneratedCodes.length} كود بنجاح:</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(lastBulkGeneratedCodes.join('\n'));
                        alert('تم نسخ جميع الأكواد للحافظة بنجاح!');
                      }}
                      className="px-2.5 py-1 rounded bg-indigo-600 text-white text-[11px] flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>نسخ كل الأكواد</span>
                    </button>
                  </div>
                  <div className="max-h-24 overflow-y-auto font-mono text-[11px] text-white/80 p-2 bg-black/50 rounded-lg">
                    {lastBulkGeneratedCodes.map((c, i) => (
                      <div key={i}>{c}</div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-white/60 hover:text-white"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  disabled={bulkGenerating}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/30 cursor-pointer"
                >
                  {bulkGenerating ? 'جارٍ التوليد...' : `توليد ${bulkCount} كود الآن`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal: Sessions & Devices Viewer */}
      {activeCodeForSessions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-xl bg-[#111116] border border-white/15 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-400" />
                  <span>الأجهزة المتصلة بالكود: {activeCodeForSessions.code}</span>
                </h3>
                <span className="text-xs text-white/50">
                  الحد الأقصى للأجهزة: {activeCodeForSessions.maxDevices}
                </span>
              </div>
              <button
                onClick={() => setActiveCodeForSessions(null)}
                className="text-white/50 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5">
              {loadingSessions ? (
                <div className="py-8 text-center text-white/40">جارٍ فحص الجلسات...</div>
              ) : sessions.length === 0 ? (
                <div className="py-8 text-center text-white/40">لا توجد أجهزة متصلة مسجلة لهذا الكود حتى الآن.</div>
              ) : (
                sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {sess.deviceInfo || 'جهاز متصفح'}
                        </span>
                        <span
                          className={`text-[9px] px-2 py-0.5 rounded font-mono font-bold ${
                            sess.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {sess.status === 'ACTIVE' ? 'متصل حالياً' : 'مفصول (Revoked)'}
                        </span>
                      </div>
                      <div className="text-[11px] text-white/40 font-mono mt-0.5">
                        آخر نشاط: {new Date(sess.lastActiveAt).toLocaleString()}
                      </div>
                    </div>

                    {sess.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleRevokeSession(sess.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        فصل الجهاز (Revoke)
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
