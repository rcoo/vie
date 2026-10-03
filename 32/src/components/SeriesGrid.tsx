import React from 'react';
import { Film, Play } from 'lucide-react';
import type { Series } from '../types.ts';

interface Props {
  seriesList: Series[];
  title?: string;
  onSelectSeries: (series: Series) => void;
}

export const SeriesGrid: React.FC<Props> = ({ seriesList, title = 'المسلسلات المتاحة', onSelectSeries }) => {
  if (seriesList.length === 0) {
    return (
      <div className="py-16 text-center text-white/40">
        <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">لا توجد مسلسلات تطابق بحثك حالياً.</p>
      </div>
    );
  }

  return (
    <section className="mb-14">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-5 rounded-full bg-amber-500" />
        <h2 className="text-xl font-bold text-white tracking-wide">{title}</h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
        {seriesList.map((series) => (
          <div
            key={series.id}
            onClick={() => onSelectSeries(series)}
            className="group relative flex flex-col bg-white/[0.02] border border-white/10 hover:border-amber-500/50 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-black/80"
          >
            {/* Poster with 2:3 ratio */}
            <div className="relative aspect-[2/3] w-full overflow-hidden bg-black/60">
              <img
                src={series.poster || series.backdrop}
                alt={series.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />

              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-60 transition-opacity" />

              {/* Hover quick play icon */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-12 h-12 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-xl transform scale-90 group-hover:scale-100 transition-transform">
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
              </div>

              {/* Top Season/Episode Badge */}
              <div className="absolute top-2.5 right-2.5">
                <span className="px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-medium text-white/90">
                  {series.seasonCount ? `${series.seasonCount} مواسم` : 'مكتمل'}
                </span>
              </div>
            </div>

            {/* Title & Meta */}
            <div className="p-3 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors line-clamp-1 mb-1">
                  {series.title}
                </h3>
                <p className="text-[11px] text-white/50 line-clamp-2 leading-relaxed">
                  {series.description}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-white/40">
                <span>{series.episodeCount ? `${series.episodeCount} حلقة` : ''}</span>
                <span className="text-amber-500/80 font-medium">عرض التفاصيل ←</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
