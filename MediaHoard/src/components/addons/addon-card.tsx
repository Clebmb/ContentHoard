import React from "react";

export interface AddonCatalog {
  id: string;
  type: string;
  name?: string;
  extra?: { name: string; isRequired?: boolean; options?: string[] }[];
}

export interface AddonManifestResource {
  name: string;
  types?: string[];
  idPrefixes?: string[];
}

export interface Addon {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  icon?: string;
  isInstalled: boolean;
  type: "stremio" | "nuvio";
  typeLabel?: string;
  manifestUrl?: string;
  catalogs?: AddonCatalog[];
  resources?: Array<string | AddonManifestResource>;
  types?: string[];
  idPrefixes?: string[];
  tags?: string[];
  actionUrl?: string;
  actionLabel?: string;
}

interface AddonCardProps {
  addon: Addon;
  onInstall?: (id: string) => void;
  onUninstall?: (id: string) => void;
}

export function AddonCard({ addon, onInstall, onUninstall }: AddonCardProps) {
  const hasExternalAction = !addon.isInstalled && addon.actionUrl;

  return (
    <div className="group relative flex flex-col justify-between bg-surface-container-low/50 border border-white/10 rounded-2xl p-5 hover:bg-surface-container/80 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(255,255,255,0.04)] overflow-hidden">
      {/* Glossy overlay effect for modern look */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      <div className="flex items-start gap-4 z-10">
        <div className="w-16 h-16 rounded-xl bg-surface-container-high border border-white/5 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
          {addon.icon ? (
            <img src={addon.icon} alt={addon.name} className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-3xl text-white/40">extension</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-body-lg font-semibold text-white truncate">{addon.name}</h3>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/70 shrink-0">
              {addon.typeLabel || addon.type}
            </span>
          </div>
          <p className="text-label-sm text-on-surface-variant/80 mt-1">{addon.author} • v{addon.version}</p>
        </div>
      </div>

      <div className="mt-4 z-10 flex-1">
        <p className="text-sm text-on-surface-variant line-clamp-2 leading-relaxed">
          {addon.description}
        </p>
      </div>

      <div className="mt-6 z-10 flex items-center justify-end">
        {addon.isInstalled ? (
          <button 
            onClick={() => onUninstall?.(addon.id)}
            className="px-4 py-2 text-sm font-medium rounded-full bg-surface-container-high text-white hover:bg-error/20 hover:text-error transition-colors duration-200 border border-white/5 hover:border-error/30"
          >
            Uninstall
          </button>
        ) : hasExternalAction ? (
          <a
            href={addon.actionUrl}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 text-sm font-bold rounded-full bg-white text-black hover:bg-white/90 transition-all duration-200 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95"
          >
            {addon.actionLabel || "Open"}
          </a>
        ) : (
          <button 
            onClick={() => onInstall?.(addon.id)}
            className="px-4 py-2 text-sm font-bold rounded-full bg-white text-black hover:bg-white/90 transition-all duration-200 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] hover:scale-105 active:scale-95"
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}
