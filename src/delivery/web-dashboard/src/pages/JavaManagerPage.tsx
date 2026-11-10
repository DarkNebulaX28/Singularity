import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Cpu,
  Download,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Sparkles,
  Info,
  ShieldCheck,
  FolderOpen,
  Copy,
  Check,
  Terminal
} from 'lucide-react';
import { api } from '../services/api-client.js';
import { useDialog } from '../context/DialogContext.js';

export interface JavaRuntimeInfo {
  id: string;
  majorVersion: number;
  versionString: string;
  path: string;
  vendor: string;
  isPortable: boolean;
}

interface TemurinPreset {
  majorVersion: number;
  label: string;
  badge: string;
  badgeColor: string;
  recommendedFor: string;
  description: string;
}

const TEMURIN_PRESETS: TemurinPreset[] = [
  {
    majorVersion: 25,
    label: 'Java 25 GA',
    badge: 'Requerido 26.1+ (2026+)',
    badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    recommendedFor: 'Minecraft 26.1, 26.2, 26.3+',
    description: 'Obligatorio para la nueva generación de servidores Minecraft 26.x. Ofrece compatibilidad nativa con class file 69.0 y mejoras críticas de recolección de basura.'
  },
  {
    majorVersion: 21,
    label: 'Java 21 LTS',
    badge: 'Estándar 1.20.5 - 1.21.x',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    recommendedFor: 'Minecraft 1.20.5 a 1.21.x',
    description: 'Requerido para las versiones 1.20.5 hasta 1.21.x. Incorpora optimizaciones de Garbage Collection ZGC y mayor rendimiento de ticks.'
  },
  {
    majorVersion: 17,
    label: 'Java 17 LTS',
    badge: 'Estándar 1.18 - 1.20.4',
    badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    recommendedFor: 'Minecraft 1.17 a 1.20.4 & Forge/Fabric',
    description: 'La versión más estable para servidores intermedios de modpacks y plugins de las actualizaciones Caves & Cliffs y Trails & Tales.'
  },
  {
    majorVersion: 8,
    label: 'Java 8 LTS',
    badge: 'Legacy Modpacks',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    recommendedFor: 'Minecraft 1.12.2, 1.7.10 y anteriores',
    description: 'Indispensable para ejecutar el catálogo histórico de mods clásicos de CurseForge (Thaumcraft, IndustrialCraft, BuildCraft, etc.).'
  },
  {
    majorVersion: 11,
    label: 'Java 11 LTS',
    badge: 'Compatibilidad Intermedia',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    recommendedFor: 'Minecraft 1.16.5 & versiones híbridas',
    description: 'Diseñado para entornos que requieren compatibilidad con librerías empresariales heredadas.'
  }
];

export const JavaManagerPage: React.FC = () => {
  const { toast } = useDialog();
  const [runtimes, setRuntimes] = useState<JavaRuntimeInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [downloadingVersion, setDownloadingVersion] = useState<number | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedPathId, setCopiedPathId] = useState<string | null>(null);

  // JVM Flags Optimizer State
  const [flagRamGb, setFlagRamGb] = useState<number>(8);
  const [flagProfile, setFlagProfile] = useState<'aikar' | 'zgc'>('aikar');
  const [copiedFlags, setCopiedFlags] = useState(false);

  const fetchRuntimes = useCallback(async (quiet = false) => {
    if (!quiet) setIsScanning(true);
    setActionError(null);
    try {
      const data = await api.get<JavaRuntimeInfo[]>('/java/detect');
      setRuntimes(data || []);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Error al detectar runtimes Java');
    } finally {
      setIsLoading(false);
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    fetchRuntimes();
  }, [fetchRuntimes]);

  const handleDownloadJava = async (majorVersion: number) => {
    setDownloadingVersion(majorVersion);
    setActionError(null);
    setActionSuccess(null);

    try {
      await api.post('/java/download', { majorVersion });
      const msg = `¡Java ${majorVersion} LTS descargado e instalado correctamente en Singularity!`;
      setActionSuccess(msg);
      toast(msg, 'success');
      await fetchRuntimes(true);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Error al descargar Java ${majorVersion}`;
      setActionError(msg);
      toast(msg, 'error');
    } finally {
      setDownloadingVersion(null);
    }
  };

  const handleCopyPath = (id: string, path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPathId(id);
    toast('Ruta del binario Java copiada al portapapeles', 'info');
    setTimeout(() => setCopiedPathId(null), 2000);
  };

  const generatedFlags = useMemo(() => {
    const mb = flagRamGb * 1024;
    if (flagProfile === 'zgc') {
      return `java -Xms${mb}M -Xmx${mb}M -XX:+UseZGC -XX:+ZGenerational -XX:+AlwaysPreTouch -XX:+DisableExplicitGC -XX:+PerfDisableSharedMem -jar server.jar nogui`;
    }
    const g1NewSize = flagRamGb >= 12 ? 40 : 30;
    const g1MaxNew = flagRamGb >= 12 ? 50 : 40;
    const g1HeapRegion = flagRamGb >= 12 ? '16M' : '8M';
    const g1Reserve = flagRamGb >= 12 ? 15 : 20;
    return `java -Xms${mb}M -Xmx${mb}M -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=${g1NewSize} -XX:G1MaxNewSizePercent=${g1MaxNew} -XX:G1HeapRegionSize=${g1HeapRegion} -XX:G1ReservePercent=${g1Reserve} -XX:G1HeapWastePercent=5 -XX:G1MixedGCCountTarget=4 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -Dusing.aikars.flags=https://mcflags.emc.gs -Daikars.new.flags=true -jar server.jar nogui`;
  }, [flagRamGb, flagProfile]);

  const handleCopyFlags = () => {
    navigator.clipboard.writeText(generatedFlags);
    setCopiedFlags(true);
    toast('Flags JVM optimizados copiados al portapapeles', 'success');
    setTimeout(() => setCopiedFlags(false), 2000);
  };

  const hasJavaVersion = (v: number) => runtimes.some((r) => r.majorVersion === v);

  return (
    <div className="space-y-6 animate-fade-in select-none">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-nebula-cyber" />
            <span>Gestor de Runtimes Java & Optimizador JVM</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Detección automática de JVM en tu sistema, descargas portables Eclipse Temurin (Adoptium) y generador de flags anti-lag.
          </p>
        </div>

        <button
          onClick={() => fetchRuntimes()}
          disabled={isScanning}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-nebula-900 border border-nebula-800 text-slate-300 hover:text-white rounded-xl hover:bg-nebula-850 transition-colors shadow-sm disabled:opacity-50"
        >
          <RotateCw className={`w-4 h-4 ${isScanning ? 'animate-spin text-nebula-cyber' : ''}`} />
          <span>{isScanning ? 'Escaneando Host...' : 'Re-escanear Host'}</span>
        </button>
      </div>

      {/* Action Messages */}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-nebula-900 border border-nebula-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Runtimes Detectados</span>
            <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
              {runtimes.length} <span className="text-xs text-slate-500 font-sans font-normal">instalados</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
              Disponibles para servidores
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-nebula-cyber/10 border border-nebula-cyber/20 flex items-center justify-center text-nebula-cyber">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-nebula-900 border border-nebula-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Java Moderno (21 / 25 LTS)</span>
            <div className="text-base font-bold font-mono mt-1 flex items-center gap-2">
              {hasJavaVersion(21) || hasJavaVersion(25) ? (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Listo (1.20.5 - 26.3+)
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> No instalado
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
              {hasJavaVersion(21) || hasJavaVersion(25) ? 'Excelente para servidores modernos' : 'Recomendado para Paper/Purpur'}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-nebula-900 border border-nebula-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 font-medium">Java Legacy (8 LTS)</span>
            <div className="text-base font-bold font-mono mt-1 flex items-center gap-2">
              {hasJavaVersion(8) ? (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Listo (1.12.2 / Mods)
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-1.5">
                  Opcional
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
              Para modpacks clásicos de Forge
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Section 1: Detected Host Runtimes Table/Cards */}
      <div className="bg-nebula-900 border border-nebula-800 rounded-2xl p-5 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-nebula-800/80 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-nebula-accent" />
            <h2 className="text-sm font-bold text-white">Runtimes Java Detectados en el Host</h2>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Directorio portable: <code className="text-slate-300">data/java/</code>
          </span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500 font-mono flex flex-col items-center gap-2">
            <RotateCw className="w-5 h-5 animate-spin text-nebula-accent" />
            <span>Escaneando el sistema en busca de instalaciones de Java...</span>
          </div>
        ) : runtimes.length === 0 ? (
          <div className="p-8 text-center bg-nebula-950/60 rounded-xl border border-dashed border-nebula-800 space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
            <h4 className="text-xs font-bold text-slate-200">No se detectaron JVMs registradas</h4>
            <p className="text-[11px] text-slate-400 max-w-md mx-auto">
              No encontramos Java en las rutas típicas del sistema ni en el PATH. Puedes descargar una versión portable oficial de Eclipse Temurin a continuación con un solo clic.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {runtimes.map((rt) => (
              <div
                key={rt.id}
                className="p-3.5 rounded-xl bg-nebula-950 border border-nebula-850 hover:border-nebula-750 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-xs font-mono tabular-nums font-bold bg-nebula-accent/20 text-nebula-accent border border-nebula-accent/30">
                        Java {rt.majorVersion}
                      </span>
                      <span className="text-xs font-bold text-white font-mono">{rt.vendor}</span>
                    </div>

                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      rt.isPortable
                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {rt.isPortable ? 'Portable (Singularity)' : 'Sistema Host'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 space-y-1 mb-2 font-mono">
                    <div className="flex items-center justify-between gap-2 bg-nebula-900/70 px-2.5 py-1.5 rounded-lg border border-nebula-850">
                      <div className="flex items-center gap-1.5 text-slate-300 truncate" title={rt.path}>
                        <FolderOpen className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{rt.path}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyPath(rt.id, rt.path)}
                        className="p-1 rounded hover:bg-nebula-800 text-slate-400 hover:text-white shrink-0 transition-colors"
                        title="Copiar ruta del ejecutable Java"
                      >
                        {copiedPathId === rt.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <div className="text-[10px] text-slate-500 pt-0.5">
                      Build: {rt.versionString}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-nebula-850/60 text-[10px] font-mono text-nebula-cyber flex items-center justify-between">
                  <span>
                    {rt.majorVersion >= 25
                      ? '✓ Compatible con Minecraft 26.1 - 26.3+'
                      : rt.majorVersion >= 21
                      ? '✓ Compatible con Minecraft 1.20.5 - 1.21.4+'
                      : rt.majorVersion >= 17
                      ? '✓ Compatible con Minecraft 1.17 - 1.20.4'
                      : '✓ Compatible con Minecraft 1.12.2 & Mods'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: 1-Click Portable Eclipse Temurin Downloads */}
      <div className="bg-nebula-900 border border-nebula-800 rounded-2xl p-5 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-nebula-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-nebula-cyber" />
            <div>
              <h2 className="text-sm font-bold text-white">Descargas Portables Eclipse Temurin (Adoptium)</h2>
              <p className="text-[11px] text-slate-400">
                Se instalan de forma aislada en Singularity sin modificar el PATH global de tu sistema.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TEMURIN_PRESETS.map((preset) => {
            const isInstalled = hasJavaVersion(preset.majorVersion);
            const isDownloading = downloadingVersion === preset.majorVersion;

            return (
              <div
                key={preset.majorVersion}
                className="p-4 rounded-xl bg-nebula-950 border border-nebula-800 flex flex-col justify-between hover:border-nebula-700 transition-all space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white font-mono">{preset.label}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${preset.badgeColor}`}>
                        {preset.badge}
                      </span>
                    </div>
                    {isInstalled && (
                      <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Instalado
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-semibold text-nebula-cyber block mb-1">
                    {preset.recommendedFor}
                  </span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {preset.description}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isDownloading || isInstalled}
                  onClick={() => handleDownloadJava(preset.majorVersion)}
                  className={`w-full py-2 px-3 rounded-lg text-xs font-bold font-mono flex items-center justify-center gap-2 transition-all ${
                    isInstalled
                      ? 'bg-nebula-850 text-slate-500 border border-nebula-800 cursor-default'
                      : 'bg-nebula-cyber/15 hover:bg-nebula-cyber/25 text-nebula-cyber border border-nebula-cyber/40 shadow-sm hover:shadow-nebula-cyber/10 active:scale-[0.99]'
                  }`}
                >
                  {isDownloading ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Descargando Temurin JDK {preset.majorVersion}...</span>
                    </>
                  ) : isInstalled ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Disponible en Singularity</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar Portable (1-Clic)</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Interactive JVM Flags Generator (Aikar's G1GC & ZGC) */}
      <div className="bg-nebula-900 border border-nebula-800 rounded-2xl p-5 shadow-md space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-nebula-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-nebula-accent" />
            <div>
              <h2 className="text-sm font-bold text-white">Generador Táctico de Flags JVM (Aikar's G1GC & ZGC)</h2>
              <p className="text-[11px] text-slate-400">
                Calcula los argumentos exactos de Garbage Collector para eliminar tirones de TPS según la memoria asignada.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <button
              type="button"
              onClick={() => setFlagProfile('aikar')}
              className={`px-3 py-1 rounded-lg border transition-colors ${
                flagProfile === 'aikar'
                  ? 'bg-nebula-accent/20 text-nebula-accent border-nebula-accent/40 font-bold'
                  : 'bg-nebula-950 text-slate-400 border-nebula-800 hover:text-white'
              }`}
            >
              Aikar's G1GC
            </button>
            <button
              type="button"
              onClick={() => setFlagProfile('zgc')}
              className={`px-3 py-1 rounded-lg border transition-colors ${
                flagProfile === 'zgc'
                  ? 'bg-nebula-cyber/20 text-nebula-cyber border-nebula-cyber/40 font-bold'
                  : 'bg-nebula-950 text-slate-400 border-nebula-800 hover:text-white'
              }`}
            >
              ZGC Generacional (Java 21+)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">Memoria RAM:</span>
            {[4, 6, 8, 12, 16].map((gb) => (
              <button
                key={gb}
                type="button"
                onClick={() => setFlagRamGb(gb)}
                className={`px-2.5 py-1 rounded-lg border tabular-nums transition-colors ${
                  flagRamGb === gb
                    ? 'bg-nebula-800 text-white border-nebula-accent font-bold'
                    : 'bg-nebula-950 text-slate-400 border-nebula-850 hover:text-slate-200'
                }`}
              >
                {gb} GB
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopyFlags}
            className="px-3.5 py-1.5 rounded-xl bg-nebula-accent hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all"
          >
            {copiedFlags ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedFlags ? '¡Flags Copiados!' : 'Copiar Línea de Arranque'}</span>
          </button>
        </div>

        <div className="p-3 rounded-xl bg-black/90 border border-nebula-850 font-mono text-[11px] text-emerald-400 break-all leading-relaxed select-all">
          {generatedFlags}
        </div>
      </div>

      {/* Section 4: Educational Compatibility Matrix */}
      <div className="p-4 rounded-xl bg-nebula-950/70 border border-nebula-800 text-xs space-y-2">
        <div className="flex items-center gap-2 font-bold text-slate-300">
          <Info className="w-4 h-4 text-nebula-cyber" />
          <span>Matriz de Compatibilidad Oficial Minecraft & Java</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px] font-mono pt-1">
          <div className="p-2.5 rounded-lg bg-nebula-900 border border-nebula-850">
            <span className="text-indigo-400 font-bold block">Minecraft 26.1 - 26.3+</span>
            <span className="text-slate-400">Java 25 GA (64-bit)</span>
          </div>
          <div className="p-2.5 rounded-lg bg-nebula-900 border border-nebula-850">
            <span className="text-emerald-400 font-bold block">Minecraft 1.20.5 - 1.21.4</span>
            <span className="text-slate-400">Java 21 LTS (64-bit)</span>
          </div>
          <div className="p-2.5 rounded-lg bg-nebula-900 border border-nebula-850">
            <span className="text-cyan-400 font-bold block">Minecraft 1.18 - 1.20.4</span>
            <span className="text-slate-400">Java 17 LTS</span>
          </div>
          <div className="p-2.5 rounded-lg bg-nebula-900 border border-nebula-850">
            <span className="text-amber-400 font-bold block">Minecraft 1.7.10 - 1.16.5</span>
            <span className="text-slate-400">Java 8 LTS</span>
          </div>
        </div>
      </div>
    </div>
  );
};
