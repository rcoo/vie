import React, { useState, useEffect } from 'react';
import { RefreshCw, Filter } from 'lucide-react';
import type { AuditLog } from '../../types.ts';
import { apiFetch } from '../../lib/api.ts';

export const AuditLogsTab: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/admin/logs?limit=200');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (levelFilter !== 'ALL' && log.level !== levelFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        log.action.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.ipAddress.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>سجلات الأمان والعمليات (Audit & Streaming Logs)</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white/70">
              {filteredLogs.length} سجل
            </span>
          </h2>
          <p className="text-xs text-white/50">
            تتبع محاولات تسجيل الدخول، أخطاء البث، تغييرات الإدارة بدون تخزين أي كلمات سر أو رموز مشفرة.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          <span>تحديث السجلات</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/10 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs text-white/60">
          <Filter className="w-3.5 h-3.5 text-amber-400" />
          <span>تصفية:</span>
        </div>

        {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((lvl) => (
          <button
            key={lvl}
            onClick={() => setLevelFilter(lvl)}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
              levelFilter === lvl
                ? 'bg-amber-500 text-black shadow-md'
                : 'bg-white/5 hover:bg-white/10 text-white/70'
            }`}
          >
            {lvl}
          </button>
        ))}

        <div className="flex-1 min-w-[160px] sm:min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث في الإجراءات أو الـ IP..."
            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-1 text-xs text-white placeholder-white/30 outline-none"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-white/50 uppercase tracking-wider">
                <th className="py-3 px-4">المستوى</th>
                <th className="py-3 px-4">الإجراء (Action)</th>
                <th className="py-3 px-4">تفاصيل العملية</th>
                <th className="py-3 px-4">عنوان IP</th>
                <th className="py-3 px-4">التاريخ والوقت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-white/40">
                    جارٍ قراءة السجلات...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-white/40">
                    لا توجد سجلات تطابق الفلتر.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          log.level === 'ERROR'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : log.level === 'WARN'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {log.level}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-white/90">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-white/70">
                      {log.details}
                    </td>
                    <td className="py-3 px-4 text-white/40 font-mono text-[11px]">
                      {log.ipAddress}
                    </td>
                    <td className="py-3 px-4 text-white/40 font-mono text-[11px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
