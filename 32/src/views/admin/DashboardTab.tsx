import React, { useEffect, useState } from 'react';
import { Film, Layers, PlayCircle, Key, Smartphone, Eye, AlertTriangle, ArrowUpRight } from 'lucide-react';
import type { DashboardMetrics } from '../../types.ts';
import { apiFetch } from '../../lib/api.ts';

interface Props {
  onNavigateTab: (tab: string) => void;
}

export const DashboardTab: React.FC<Props> = ({ onNavigateTab }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/admin/metrics')
      .then((res) => res.json())
      .then((data) => setMetrics(data))
      .catch((err) => console.error('Failed to load metrics:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-white/50">جارٍ تحميل بيانات لوحة التحكم...</div>;
  }

  if (!metrics) {
    return <div className="p-8 text-center text-red-400">فشل في تحميل الإحصائيات.</div>;
  }

  const statCards = [
    {
      title: 'إجمالي المسلسلات',
      value: metrics.totalSeries,
      sub: 'في قاعدة البيانات',
      icon: Film,
      color: 'from-amber-500 to-amber-600',
      action: () => onNavigateTab('series')
    },
    {
      title: 'إجمالي المواسم',
      value: metrics.totalSeasons,
      sub: 'موزعة عبر المسلسلات',
      icon: Layers,
      color: 'from-orange-500 to-rose-600',
      action: () => onNavigateTab('series')
    },
    {
      title: 'إجمالي الحلقات',
      value: metrics.totalEpisodes,
      sub: 'جاهزة للبث',
      icon: PlayCircle,
      color: 'from-rose-500 to-pink-600',
      action: () => onNavigateTab('series')
    },
    {
      title: 'أكواد الدخول النشطة',
      value: `${metrics.activeAccessCodes} / ${metrics.totalAccessCodes}`,
      sub: 'أكواد صالحة ومفعلة',
      icon: Key,
      color: 'from-emerald-500 to-teal-600',
      action: () => onNavigateTab('codes')
    },
    {
      title: 'الجلسات والأجهزة النشطة',
      value: metrics.activeSessions,
      sub: 'أجهزة متصلة بالمنصة',
      icon: Smartphone,
      color: 'from-blue-500 to-indigo-600',
      action: () => onNavigateTab('codes')
    },
    {
      title: 'سجلات المشاهدة المحفوظة',
      value: metrics.totalWatchEvents,
      sub: 'نقاط توقف المشاهدين',
      icon: Eye,
      color: 'from-purple-500 to-violet-600'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <div
              key={idx}
              onClick={card.action}
              className={`p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all shadow-lg flex flex-col justify-between ${
                card.action ? 'cursor-pointer hover:-translate-y-1' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs uppercase tracking-wider text-white/50 font-medium">
                    {card.title}
                  </span>
                  <div className="text-3xl font-extrabold text-white mt-1 font-mono tracking-tight">
                    {card.value}
                  </div>
                  <div className="text-xs text-white/40 mt-1">{card.sub}</div>
                </div>

                <div className={`p-3 rounded-xl bg-gradient-to-br ${card.color} text-white shadow-lg`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              {card.action && (
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-amber-400/80 hover:text-amber-300">
                  <span>إدارة القسم</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent Activity & Logs */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-base font-bold text-white">آخر الأنشطة وسجلات النظام</h3>
          </div>
          <button
            onClick={() => onNavigateTab('logs')}
            className="text-xs text-amber-400 hover:underline"
          >
            عرض كافة السجلات ({metrics.recentLogs.length})
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/40 uppercase tracking-wider">
                <th className="py-2.5 px-3">النوع</th>
                <th className="py-2.5 px-3">النشاط</th>
                <th className="py-2.5 px-3">التفاصيل</th>
                <th className="py-2.5 px-3">الوقت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {metrics.recentLogs.map((log) => (
                <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        log.level === 'ERROR'
                          ? 'bg-red-500/20 text-red-300'
                          : log.level === 'WARN'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {log.level}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-semibold text-white/90">
                    {log.action}
                  </td>
                  <td className="py-2.5 px-3 text-white/60 truncate max-w-md">
                    {log.details}
                  </td>
                  <td className="py-2.5 px-3 text-white/40 font-mono text-[11px] whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
