import React from 'react';
import { Play, Info, Sparkles } from 'lucide-react';
import type { Series } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface Props {
  series: Series;
  onPlay: (seriesId: string) => void;
  onOpenDetails: (series: Series) => void;
}

export const HeroSection: React.FC<Props> = ({ series, onPlay, onOpenDetails }) => {
  const { settings } = useAuth();
  return (
    <div className="relative w-full h-[60vh] sm:h-[68vh] min-h-[420px] rounded-3xl overflow-hidden mb-12 border border-white/10 group shadow-2xl">
      {/* Backdrop Image */}
      <img
        src={series.backdrop || series.poster}
        alt={series.title}
        className="absolute inset-0 w-full h-full object-cover object-center transform scale-100 group-hover:scale-105 transition-transform duration-1000 ease-out"
      />

      {/* Cinematic Vignette & Gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0c] via-[#0a0a0c]/40 to-transparent w-full md:w-3/4" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-12 max-w-3xl flex flex-col items-start gap-4 z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>{settings.heroBadgeText || 'المسلسل المميز • حصري على المنصة'}</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight drop-shadow-md">
          {series.title}
        </h1>

        <p className="text-xs sm:text-sm text-white/80 line-clamp-3 leading-relaxed drop-shadow">
          {series.description}
        </p>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => onPlay(series.id)}
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm flex items-center gap-2.5 transition-all shadow-lg shadow-amber-500/30 active:scale-95 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current ml-0.5" />
            <span>مشاهدة الآن</span>
          </button>

          <button
            onClick={() => onOpenDetails(series)}
            className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/25 text-white font-medium text-sm flex items-center gap-2 backdrop-blur-md transition-all border border-white/15 cursor-pointer"
          >
            <Info className="w-4 h-4" />
            <span>المواسم والحلقات</span>
          </button>
        </div>
      </div>
    </div>
  );
};
