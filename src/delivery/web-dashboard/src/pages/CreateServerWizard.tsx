import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Cpu,
  HardDrive,
  AlertTriangle,
  Info,
  Search,
  Layers
} from 'lucide-react';
import { api } from '../services/api-client.js';
import { useDialog } from '../context/DialogContext.js';
import type { ServerInstanceData } from '../components/ServerCard.js';

interface CreateServerWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (server: ServerInstanceData) => void;
}

interface JavaRuntimeInfo {
  id: string;
  majorVersion: number;
  versionString: string;
  path: string;
  vendor: string;
  isPortable: boolean;
}

export interface MinecraftVersionItem {
  id: string;
  name: string;
  type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
  releaseTime: string;
  recommendedJava: number;
  isLatestRelease: boolean;
  isLatestSnapshot: boolean;
}

interface VersionsApiResponse {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: MinecraftVersionItem[];
}

export type WizardLoader = 'paper' | 'purpur' | 'spigot' | 'fabric' | 'forge' | 'neoforge' | 'quilt' | 'vanilla';

interface LoaderDefinition {
  id: WizardLoader;
  title: string;
  category: 'plugins' | 'mods' | 'vanilla';
  categoryLabel: string;
  badge: string;
  badgeColor: string;
  desc: string;
  minMcVersion?: string;
  recommendedJava: string;
}

const LOADERS: LoaderDefinition[] = [
  {
    id: 'paper',
    title: 'PaperMC',
    category: 'plugins',
    categoryLabel: 'Plugins Bukkit / Spigot',
    badge: 'Estándar Oro',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    desc: 'El software de servidor más usado. Rendimiento extremo, optimizaciones anti-lag y 100% compatible con plugins Bukkit y Spigot.',
    recommendedJava: 'Java 25 (26.x), Java 21 (1.20.5+) o Java 17'
  },
  {
    id: 'purpur',
    title: 'Purpur',
    category: 'plugins',
    categoryLabel: 'Plugins Bukkit / Spigot',
    badge: 'Ultra Configurable',
    badgeColor: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    desc: 'Fork de Paper diseñado para control total de mecánicas del juego (montar mobs, portales custom y físicas modificables).',
    recommendedJava: 'Java 21 o Java 17'
  },
  {
    id: 'spigot',
    title: 'Spigot / Bukkit',
    category: 'plugins',
    categoryLabel: 'Plugins Clásicos',
    badge: 'Tradicional',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    desc: 'El motor clásico sucesor de Bukkit. Compatible con la librería histórica de plugins para servidores con configuraciones vanilla exactas.',
    recommendedJava: 'Java 8 a 21'
  },
  {
    id: 'fabric',
    title: 'Fabric',
    category: 'mods',
    categoryLabel: 'Mods & Datapacks',
    badge: 'Ligero & Rápido',
    badgeColor: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    desc: 'Carga mods a velocidad récord con bajo consumo de memoria. Ideal para mods de optimización (Lithium, FerriteCore) y técnicos.',
    recommendedJava: 'Java 25 (26.x), Java 21 (1.21+) o Java 17'
  },
  {
    id: 'neoforge',
    title: 'NeoForge',
    category: 'mods',
    categoryLabel: 'Mods Modernos 1.20.2+',
    badge: 'El Futuro de Forge',
    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    desc: 'La evolución moderna creada por el equipo principal de Forge. Es el nuevo estándar oficial para modpacks pesados en Minecraft 1.20.2 en adelante.',
    minMcVersion: '1.20.2',
    recommendedJava: 'Java 21 LTS'
  },
  {
    id: 'forge',
    title: 'Forge Clásico',
    category: 'mods',
    categoryLabel: 'Modpacks Clásicos',
    badge: 'Modpacks Masivos',
    badgeColor: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    desc: 'El loader legendario con el catálogo más grande de modpacks en CurseForge. Imprescindible para versiones como 1.7.10, 1.12.2, 1.16.5 y 1.20.1.',
    recommendedJava: 'Java 8 (1.12.2) o Java 17'
  },
  {
    id: 'quilt',
    title: 'Quilt',
    category: 'mods',
    categoryLabel: 'Ecosistema Modular',
    badge: 'Innovación Abierta',
    badgeColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
    desc: 'Bifurcación modular de Fabric con librerías extendidas. Ejecuta la gran mayoría de mods de Fabric de manera transparente.',
    recommendedJava: 'Java 21 o Java 17'
  },
  {
    id: 'vanilla',
    title: 'Vanilla Oficial',
    category: 'vanilla',
    categoryLabel: 'Mojang Oficial',
    badge: 'Puro sin Mods',
    badgeColor: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
    desc: 'El archivo server.jar oficial directo de Mojang Studios. La experiencia pura de Minecraft sin añadidos ni modificaciones.',
    recommendedJava: 'Java 25 (26.x) o Java 21 LTS'
  }
];

const POPULAR_VERSIONS = [
  { id: '26.3', label: '26.3 (Última Oficial)', badge: 'Nuevo 2026' },
  { id: '26.1', label: '26.1', badge: 'Estable 2026' },
  { id: '1.21.4', label: '1.21.4', badge: 'Moderna' },
  { id: '1.20.1', label: '1.20.1', badge: 'Top Mods' },
  { id: '1.16.5', label: '1.16.5', badge: 'Nether' },
  { id: '1.12.2', label: '1.12.2', badge: 'Modpacks' },
  { id: '1.8.8', label: '1.8.8', badge: 'PvP' },
  { id: '1.7.10', label: '1.7.10', badge: 'Vintage' }
];

export const CreateServerWizard: React.FC<CreateServerWizardProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { toast } = useDialog();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter Categories in Step 1
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'plugins' | 'mods' | 'vanilla'>('all');

  // Form Fields
  const [name, setName] = useState('Nuevo Servidor');
  const [loader, setLoader] = useState<WizardLoader>('paper');
  const [gameVersion, setGameVersion] = useState('26.3');
  const [memoryMb, setMemoryMb] = useState(4096);
  const [port, setPort] = useState(25565);
  const [javaPath, setJavaPath] = useState<string>('');
  const [motd, setMotd] = useState('§aUn servidor administrado con §bSingularity');

  // Minecraft Versions from API
  const [versionsList, setVersionsList] = useState<MinecraftVersionItem[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [includeSnapshots, setIncludeSnapshots] = useState(false);
  const [versionSearch, setVersionSearch] = useState('');

  // Installed Java runtimes on host
  const [installedJavas, setInstalledJavas] = useState<JavaRuntimeInfo[]>([]);

  // Fetch installed Java and Minecraft versions
  useEffect(() => {
    if (isOpen) {
      // Fetch detected Java runtimes
      api.get<JavaRuntimeInfo[]>('/java/detect')
        .then((runtimes) => {
          setInstalledJavas(runtimes);
          if (runtimes.length > 0 && runtimes[0]) {
            setJavaPath(runtimes[0].path);
          }
        })
        .catch(() => {
          // ignore detection error
        });
    }
  }, [isOpen]);

  // Fetch Minecraft versions
  useEffect(() => {
    if (isOpen) {
      setIsLoadingVersions(true);
      const url = `/servers/versions?includeSnapshots=${includeSnapshots}`;
      api.get<VersionsApiResponse>(url)
        .then((res) => {
          if (res.versions && res.versions.length > 0) {
            setVersionsList(res.versions);
            // Default to latest release if current version is unset or not found
            if (res.latest?.release) {
              setGameVersion((curr) => curr || res.latest.release);
            }
          }
        })
        .catch(() => {
          // Fallback to popular versions
          setVersionsList(
            POPULAR_VERSIONS.map((pv) => ({
              id: pv.id,
              name: pv.label,
              type: 'release',
              releaseTime: new Date().toISOString(),
              recommendedJava: pv.id.startsWith('26') ? 25 : pv.id.startsWith('1.21') ? 21 : pv.id.startsWith('1.20') ? 17 : 8,
              isLatestRelease: pv.id === '26.3',
              isLatestSnapshot: false
            }))
          );
        })
        .finally(() => {
          setIsLoadingVersions(false);
        });
    }
  }, [isOpen, includeSnapshots]);

  // Recommended Java major version based on gameVersion
  const recommendedJava = useMemo((): number => {
    const clean = gameVersion.trim();
    const firstPart = parseInt(clean.split('.')[0] ?? '0', 10);
    if (firstPart >= 26) return 25;
    if (firstPart >= 22) return 21;

    const parts = clean.split('.').map((p) => parseInt(p, 10));
    const minor = parts[1] ?? 0;
    const patch = parts[2] ?? 0;

    if (minor > 20 || (minor === 20 && patch >= 5)) return 21;
    if (minor >= 18) return 17;
    if (minor === 17) return 16;
    return 8;
  }, [gameVersion]);

  // Auto-select best matching installed Java when gameVersion or installedJavas change
  useEffect(() => {
    if (installedJavas.length > 0) {
      const match = installedJavas.find((j) => j.majorVersion === recommendedJava);
      if (match) {
        setJavaPath(match.path);
      } else if (!javaPath || !installedJavas.some((j) => j.path === javaPath)) {
        setJavaPath(installedJavas[0]?.path || '');
      }
    }
  }, [recommendedJava, installedJavas]);

  // Check if recommended Java is installed
  const hasMatchingJava = useMemo(() => {
    if (installedJavas.length === 0) return true; // System PATH java might match
    return installedJavas.some((j) => j.majorVersion === recommendedJava);
  }, [installedJavas, recommendedJava]);

  // Filtered Loaders
  const filteredLoaders = useMemo(() => {
    if (selectedCategory === 'all') return LOADERS;
    return LOADERS.filter((l) => l.category === selectedCategory);
  }, [selectedCategory]);

  // Filtered Versions List for Select / Search
  const filteredVersions = useMemo(() => {
    if (!versionSearch.trim()) return versionsList;
    const q = versionSearch.toLowerCase().trim();
    return versionsList.filter((v) => v.id.toLowerCase().includes(q) || v.name.toLowerCase().includes(q));
  }, [versionsList, versionSearch]);

  if (!isOpen) return null;

  const handleDeploy = async () => {
    setErrorMsg(null);
    setIsCreating(true);

    try {
      const created = await api.post<ServerInstanceData>('/servers', {
        name: name.trim() || 'Servidor Minecraft',
        loader,
        gameVersion,
        memoryMb,
        port,
        javaPath: javaPath || undefined,
        motd
      });

      toast(`Instancia "${created.name}" desplegada exitosamente`, 'success');
      onSuccess(created);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear servidor';
      setErrorMsg(msg);
      toast(msg, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="w-full max-w-2xl bg-nebula-900 border border-nebula-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Wizard Header & Stepper */}
        <div className="px-6 py-4 border-b border-nebula-800 bg-nebula-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-nebula-accent/15 border border-nebula-accent/30 flex items-center justify-center text-nebula-accent shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Desplegar Nueva Instancia
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-nebula-850 text-slate-300 border border-nebula-800">
                  Paso {step} de 3
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {step === 1 && 'Selecciona el motor (loader) y nombre del servidor'}
                {step === 2 && 'Elige la versión de Minecraft (hasta 26.3) y runtime Java'}
                {step === 3 && 'Asigna memoria RAM, puerto de red y mensaje de bienvenida'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-nebula-850 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Line */}
        <div className="grid grid-cols-3 h-1 bg-nebula-950">
          <div className={`h-full transition-all duration-300 ${step >= 1 ? 'bg-nebula-accent' : 'bg-transparent'}`} />
          <div className={`h-full transition-all duration-300 ${step >= 2 ? 'bg-nebula-accent' : 'bg-transparent'}`} />
          <div className={`h-full transition-all duration-300 ${step >= 3 ? 'bg-nebula-accent' : 'bg-transparent'}`} />
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Step Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* STEP 1: Name and Complete Loader Ecosystem */}
          {step === 1 && (
            <div className="space-y-4">
              {/* 1-Click Tactical Blueprints */}
              <div className="p-3 rounded-xl bg-nebula-950 border border-nebula-850 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                  PLANTILLAS DE MISIÓN RÁPIDA (1-CLIC):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    {
                      label: '⚡ Paper SMP',
                      loader: 'paper' as WizardLoader,
                      ver: '1.21.4',
                      ram: 6144,
                      name: 'Survival Paper SMP'
                    },
                    {
                      label: '🧪 Fabric Tech',
                      loader: 'fabric' as WizardLoader,
                      ver: '1.21.4',
                      ram: 6144,
                      name: 'Fabric Tech Server'
                    },
                    {
                      label: '🔥 NeoForge Mods',
                      loader: 'neoforge' as WizardLoader,
                      ver: '1.21.1',
                      ram: 8192,
                      name: 'NeoForge Modpack'
                    },
                    {
                      label: '🏛️ Vanilla 26.3',
                      loader: 'vanilla' as WizardLoader,
                      ver: '26.3',
                      ram: 4096,
                      name: 'Vanilla Oficial 26.3'
                    }
                  ].map((bp) => (
                    <button
                      key={bp.label}
                      type="button"
                      onClick={() => {
                        setName(bp.name);
                        setLoader(bp.loader);
                        setGameVersion(bp.ver);
                        setMemoryMb(bp.ram);
                        toast(`Plantilla "${bp.label}" aplicada (${bp.ver} • ${bp.ram / 1024}GB RAM)`, 'info');
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-nebula-900 hover:bg-nebula-800 border border-nebula-800 hover:border-nebula-accent/50 text-left transition-all"
                    >
                      <span className="block text-xs font-mono font-bold text-slate-200">{bp.label}</span>
                      <span className="block text-[10px] font-mono text-slate-500">
                        MC {bp.ver} &bull; {bp.ram / 1024}GB
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Nombre de la Instancia
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej. Survival SMP, Modded Galaxy, RPG Skyblock"
                    className="flex-1 px-3 py-2 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-nebula-accent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const ideas = ['Survival SMP', 'Cosmic Realm', 'Aether World', 'Anarchy Lab', 'Pixelmon Arena', 'Create City', 'Singularity Realm'];
                      setName(ideas[Math.floor(Math.random() * ideas.length)] || 'Servidor');
                    }}
                    className="px-3 py-2 text-xs font-mono text-slate-400 bg-nebula-950 hover:bg-nebula-850 border border-nebula-800 rounded-lg transition-colors"
                    title="Generar nombre aleatorio"
                  >
                    🎲 Sugerir
                  </button>
                </div>
              </div>

              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <label className="block text-xs font-semibold text-slate-200">
                    Tipo de Software / Loader
                  </label>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-nebula-950 border border-nebula-850 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('all')}
                      className={`px-2 py-1 rounded transition-colors ${
                        selectedCategory === 'all'
                          ? 'bg-nebula-accent text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Todos (8)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('plugins')}
                      className={`px-2 py-1 rounded transition-colors ${
                        selectedCategory === 'plugins'
                          ? 'bg-nebula-accent text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      🔌 Plugins
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('mods')}
                      className={`px-2 py-1 rounded transition-colors ${
                        selectedCategory === 'mods'
                          ? 'bg-nebula-accent text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      ⚙️ Mods
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('vanilla')}
                      className={`px-2 py-1 rounded transition-colors ${
                        selectedCategory === 'vanilla'
                          ? 'bg-nebula-accent text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      🏛️ Oficial
                    </button>
                  </div>
                </div>

                {/* Loaders Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
                  {filteredLoaders.map((item) => {
                    const isSelected = loader === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setLoader(item.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-nebula-accent/10 border-nebula-accent text-slate-100 shadow-md shadow-nebula-accent/10 ring-1 ring-nebula-accent'
                            : 'bg-nebula-950/60 border-nebula-850 text-slate-400 hover:border-nebula-700 hover:bg-nebula-850/40'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-bold flex items-center gap-1.5 ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                              {item.title}
                            </span>
                            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                            {item.desc}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-nebula-850/60 text-[10px] font-mono text-slate-500">
                          <span>{item.categoryLabel}</span>
                          {isSelected && (
                            <span className="flex items-center gap-1 text-nebula-accent font-bold">
                              <Check className="w-3 h-3" /> Seleccionado
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Version (All 103+ versions up to 26.3) and Smart Java Assistant */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-nebula-accent" />
                    Versión de Minecraft
                  </label>

                  {/* Toggle Snapshots */}
                  <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer font-mono">
                    <input
                      type="checkbox"
                      checked={includeSnapshots}
                      onChange={(e) => setIncludeSnapshots(e.target.checked)}
                      className="rounded border-nebula-800 bg-nebula-950 text-nebula-accent focus:ring-0"
                    />
                    <span>Incluir Snapshots / Pruebas</span>
                  </label>
                </div>

                {/* Popular Version Quick Chips */}
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {POPULAR_VERSIONS.map((pv) => {
                    const isSelected = gameVersion === pv.id;
                    return (
                      <button
                        key={pv.id}
                        type="button"
                        onClick={() => setGameVersion(pv.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all border ${
                          isSelected
                            ? 'bg-nebula-accent text-slate-950 font-bold border-nebula-accent shadow-sm'
                            : 'bg-nebula-950 text-slate-300 border-nebula-850 hover:border-nebula-700 hover:text-white'
                        }`}
                      >
                        <span>{pv.id}</span>
                        {pv.id === '26.3' && <span className="ml-1 text-[9px] bg-slate-950/20 px-1 rounded font-sans">⭐ 26.3</span>}
                      </button>
                    );
                  })}
                </div>

                {/* Search & Comprehensive Version Dropdown */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={versionSearch}
                      onChange={(e) => setVersionSearch(e.target.value)}
                      placeholder="Filtrar entre todas las versiones (ej. 26.3, 26.2, 1.21, 1.20, 1.16)..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-nebula-accent font-mono"
                    />
                  </div>

                  <select
                    value={gameVersion}
                    onChange={(e) => setGameVersion(e.target.value)}
                    disabled={isLoadingVersions}
                    className="w-full px-3 py-2.5 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-slate-100 focus:outline-none focus:border-nebula-accent font-mono"
                  >
                    {isLoadingVersions ? (
                      <option value={gameVersion}>Cargando catálogo completo de versiones desde Mojang...</option>
                    ) : filteredVersions.length === 0 ? (
                      <option value={gameVersion}>No hay versiones que coincidan con "{versionSearch}"</option>
                    ) : (
                      filteredVersions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} &bull; Requiere Java {v.recommendedJava} LTS {v.type === 'snapshot' ? '[SNAPSHOT]' : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 px-0.5 font-mono">
                  <span>Total versiones disponibles: {versionsList.length || '100+'}</span>
                  <span className="text-nebula-cyber font-semibold">Seleccionada: {gameVersion}</span>
                </div>

                {loader === 'neoforge' && gameVersion.startsWith('1.1') && (
                  <span className="text-[11px] text-amber-400 mt-1 block">
                    ⚠️ Nota: NeoForge fue creado para Minecraft 1.20.2 o superior. Para versiones anteriores como {gameVersion} usa Forge Clásico.
                  </span>
                )}
              </div>

              {/* Smart Java Requirement Tile */}
              <div className="p-4 rounded-xl bg-nebula-950 border border-nebula-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-nebula-cyber" />
                    Compatibilidad de Java Runtime
                  </span>
                  <span className="font-mono text-xs text-nebula-accent font-bold px-2 py-0.5 rounded bg-nebula-accent/10 border border-nebula-accent/20">
                    Requiere Java {recommendedJava} LTS
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Para Minecraft <strong>{gameVersion}</strong> con <strong>{loader.toUpperCase()}</strong>, Singularity detecta que la máquina virtual correcta es <strong>Java {recommendedJava} LTS</strong>.
                </p>

                {!hasMatchingJava && (
                  <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2 mt-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Atención: No se detectó <strong>Java {recommendedJava}</strong> en tu sistema. Puedes descargarlo en 1-clic desde la sección <strong>Java Runtimes</strong> de la barra lateral.
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Runtime Java a Usar
                </label>
                {installedJavas.length === 0 ? (
                  <div className="p-3 rounded-lg bg-nebula-950 border border-nebula-850 text-xs text-slate-400 flex items-center gap-2">
                    <Info className="w-4 h-4 text-nebula-cyber shrink-0" />
                    <span>Se usará el comando <code className="text-nebula-accent font-mono font-bold">java</code> detectado en el PATH del sistema.</span>
                  </div>
                ) : (
                  <select
                    value={javaPath}
                    onChange={(e) => setJavaPath(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-slate-100 focus:outline-none focus:border-nebula-accent font-mono"
                  >
                    {installedJavas.map((j) => (
                      <option key={j.id} value={j.path}>
                        Java {j.majorVersion} ({j.vendor}) {j.majorVersion === recommendedJava ? '⭐ [Recomendado para esta versión]' : ''} - {j.path}
                      </option>
                    ))}
                  </select>
                )}
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Puedes descargar runtimes portables de Eclipse Temurin en la pestaña "Java Runtimes" de la barra lateral.
                </span>
              </div>
            </div>
          )}

          {/* STEP 3: Memory, Port and Real-time MOTD Preview */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <HardDrive className="w-4 h-4 text-nebula-accent" />
                    Memoria RAM Asignada (Xmx)
                  </label>
                  <span className="text-xs font-mono font-bold text-nebula-accent">
                    {(memoryMb / 1024).toFixed(1)} GB ({memoryMb} MB)
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {[
                    { label: '2 GB', mb: 2048, hint: 'Pruebas' },
                    { label: '4 GB', mb: 4096, hint: 'Estándar' },
                    { label: '6 GB', mb: 6144, hint: 'Mods leves' },
                    { label: '8 GB', mb: 8192, hint: 'Modpacks' },
                    { label: '16 GB', mb: 16384, hint: 'Masivo' }
                  ].map((preset) => {
                    const isSelected = memoryMb === preset.mb;
                    return (
                      <button
                        key={preset.mb}
                        type="button"
                        onClick={() => setMemoryMb(preset.mb)}
                        className={`py-2 px-1 rounded-xl text-center transition-all border ${
                          isSelected
                            ? 'bg-nebula-accent/20 border-nebula-accent text-nebula-accent shadow-sm'
                            : 'bg-nebula-950 border-nebula-850 text-slate-400 hover:text-slate-200 hover:border-nebula-700'
                        }`}
                      >
                        <span className="block text-xs font-mono font-bold">{preset.label}</span>
                        <span className="block text-[9px] text-slate-500 font-sans mt-0.5">{preset.hint}</span>
                      </button>
                    );
                  })}
                </div>

                <input
                  type="range"
                  min={1024}
                  max={32768}
                  step={512}
                  value={memoryMb}
                  onChange={(e) => setMemoryMb(parseInt(e.target.value, 10))}
                  className="w-full accent-nebula-accent cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Puerto del Servidor (Server Port)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    required
                    value={port}
                    onChange={(e) => setPort(parseInt(e.target.value, 10) || 25565)}
                    className="w-36 px-3 py-1.5 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-slate-100 font-mono focus:outline-none focus:border-nebula-accent"
                  />
                  <span className="text-xs text-slate-400">
                    Puerto estándar de Minecraft: <code className="text-nebula-cyber font-mono font-bold">25565</code>
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-200">
                    Mensaje del Día (MOTD)
                  </label>

                  {/* Formatting Shortcuts */}
                  <div className="flex items-center gap-1 text-[10px] font-mono">
                    <button
                      type="button"
                      onClick={() => setMotd((m) => m + '§a')}
                      className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 hover:bg-emerald-900"
                    >
                      §a Verde
                    </button>
                    <button
                      type="button"
                      onClick={() => setMotd((m) => m + '§b')}
                      className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 hover:bg-cyan-900"
                    >
                      §b Celeste
                    </button>
                    <button
                      type="button"
                      onClick={() => setMotd((m) => m + '§6')}
                      className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800 hover:bg-amber-900"
                    >
                      §6 Oro
                    </button>
                    <button
                      type="button"
                      onClick={() => setMotd((m) => m + '§c')}
                      className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-400 border border-rose-800 hover:bg-rose-900"
                    >
                      §c Rojo
                    </button>
                    <button
                      type="button"
                      onClick={() => setMotd((m) => m + '§l')}
                      className="px-1.5 py-0.5 rounded bg-slate-800 text-white font-bold border border-slate-700 hover:bg-slate-700"
                    >
                      §l Negrita
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={motd}
                  onChange={(e) => setMotd(e.target.value)}
                  placeholder="§aBienvenido a §bMi Servidor"
                  className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-slate-100 focus:outline-none focus:border-nebula-accent font-mono mb-2"
                />

                {/* Minecraft-style MOTD Preview Box */}
                <div className="p-3.5 rounded-xl bg-black border border-nebula-800 font-mono text-xs flex items-center justify-between shadow-2xl">
                  <div className="space-y-0.5 overflow-hidden pr-2">
                    <span className="text-slate-100 font-bold block truncate">{name}</span>
                    <span className="text-emerald-400 block font-normal break-all">
                      {motd.replace(/§[0-9a-fk-or]/gi, '')}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-500 block font-mono">0 / 20</span>
                    <span className="text-[10px] text-nebula-cyber block font-mono">● 18ms</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="px-6 py-4 border-t border-nebula-800 bg-nebula-950 flex items-center justify-between">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as 1 | 2)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Atrás</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as 2 | 3)}
                className="flex items-center gap-1.5 px-4 py-2 bg-nebula-accent hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-nebula-accent/20 transition-all"
              >
                <span>Continuar</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isCreating}
                onClick={handleDeploy}
                className="flex items-center gap-2 px-5 py-2 bg-nebula-accent hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-nebula-accent/20 transition-all disabled:opacity-50"
              >
                {isCreating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Desplegando Servidor...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Crear Instancia Ahora</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
