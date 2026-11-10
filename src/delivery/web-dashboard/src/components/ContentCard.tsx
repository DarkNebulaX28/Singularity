import React from 'react';
import { Download, Package, Box, Layers, Database, ShieldAlert } from 'lucide-react';
import { isClientOnlyMod } from '../utils/client-mod-filter.js';

export interface CatalogItemData {
  id: string;
  slug: string;
  title: string;
  description: string;
  projectType: 'mod' | 'plugin' | 'modpack' | 'datapack';
  categories: string[];
  downloads: number;
  iconUrl?: string;
  author: string;
  providerId: string;
}

interface ContentCardProps {
  item: CatalogItemData;
  onInstall: (item: CatalogItemData) => void;
  isInstalled?: boolean;
}

export const ContentCard: React.FC<ContentCardProps> = ({
  item,
  onInstall,
  isInstalled = false
}) => {
  const formatDownloads = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
    return String(num);
  };

  const isClientMod = isClientOnlyMod(item.slug) || isClientOnlyMod(item.title);
  const hasPluginSupport =
    item.projectType === 'plugin' ||
    Boolean(item.categories?.some((c) => ['spigot', 'paper', 'purpur', 'bukkit', 'folia'].includes(c.toLowerCase())));
  const hasModSupport =
    item.projectType === 'mod' &&
    Boolean(item.categories?.some((c) => ['fabric', 'forge', 'neoforge', 'quilt'].includes(c.toLowerCase())));
  const isDualPluginAndMod = hasPluginSupport && hasModSupport;
  const isPlugin = item.projectType === 'plugin' || (hasPluginSupport && !hasModSupport);

  const effectiveType = isPlugin ? 'plugin' : item.projectType;

  const typeConfig = isDualPluginAndMod
    ? {
        label: item.projectType === 'plugin' ? 'PLUGIN + MOD' : 'MOD + PLUGIN',
        icon: Package,
        color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40'
      }
    : {
        mod: { label: 'MOD', icon: Box, color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
        plugin: { label: 'PLUGIN', icon: Package, color: 'text-nebula-cyber bg-nebula-cyber/10 border-nebula-cyber/30' },
        modpack: { label: 'MODPACK / PACK', icon: Layers, color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
        datapack: { label: 'DATAPACK', icon: Database, color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' }
      }[effectiveType] ?? {
        label: effectiveType.toUpperCase(),
        icon: Box,
        color: 'text-slate-400 bg-slate-800 border-slate-700'
      };

  const TypeIcon = typeConfig.icon;

  return (
    <div className="bg-nebula-900 border border-nebula-800 hover:border-nebula-700 rounded-xl p-4 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between group">
      <div>
        {/* Header: Icon + Title + Type Badge */}
        <div className="flex items-start gap-3 mb-2.5">
          {item.iconUrl ? (
            <img
              src={item.iconUrl}
              alt={item.title}
              className="w-10 h-10 rounded-lg object-cover bg-nebula-950 border border-nebula-800 shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-nebula-950 border border-nebula-800 flex items-center justify-center text-nebula-purple shrink-0">
              <TypeIcon className="w-5 h-5" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-100 group-hover:text-nebula-accent transition-colors truncate">
                {item.title}
              </h4>
              <div className="flex items-center gap-1 shrink-0">
                {isClientMod && (
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-300 bg-amber-500/10 flex items-center gap-0.5">
                    <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />
                    <span>CLIENTE</span>
                  </span>
                )}
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${typeConfig.color}`}>
                  {typeConfig.label}
                </span>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
              por <span className="text-slate-300 font-semibold">{item.author}</span>
            </span>
          </div>
        </div>

        {/* Summary Description */}
        <p className="text-[11px] text-slate-400 leading-relaxed line-clamp-2 mb-3">
          {item.description}
        </p>

        {/* Categories / Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {item.categories.slice(0, 3).map((cat) => (
            <span
              key={cat}
              className="text-[9px] px-1.5 py-0.5 rounded bg-nebula-950 text-slate-400 border border-nebula-850 font-mono"
            >
              #{cat}
            </span>
          ))}
        </div>
      </div>

      {/* Footer: Downloads Counter + 1-Click Install Button */}
      <div className="pt-3 border-t border-nebula-850 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-mono tabular-nums text-slate-400">
          <Download className="w-3 h-3 text-slate-500" />
          <span>{formatDownloads(item.downloads)}</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-nebula-950 border border-nebula-800 text-slate-500 uppercase">
            {item.providerId}
          </span>
        </div>

        <button
          onClick={() => onInstall(item)}
          disabled={isInstalled}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-[0.98] flex items-center gap-1.5 shadow-sm ${
            isInstalled
              ? 'bg-nebula-850 text-slate-500 border border-nebula-700 cursor-default'
              : item.projectType === 'modpack'
              ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-950/40 border border-purple-400/50'
              : 'bg-nebula-purple/20 hover:bg-nebula-purple/30 text-purple-300 border border-purple-500/40 hover:text-white shadow-purple-950/20'
          }`}
        >
          {item.projectType === 'modpack' ? (
            <>
              <Layers className="w-3.5 h-3.5 text-purple-200" />
              <span>Crear Servidor / Desplegar</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>{isInstalled ? 'Instalado' : '1-Clic Install'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
