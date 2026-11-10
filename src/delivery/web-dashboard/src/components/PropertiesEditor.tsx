import React, { useState, useEffect, useMemo } from 'react';
import {
  Save,
  RotateCcw,
  Search,
  Sliders,
  Shield,
  Globe,
  Radio,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Swords,
  Terminal,
  Eye,
  EyeOff
} from 'lucide-react';
import { MotdDesigner } from './MotdDesigner';
import { api } from '../services/api-client.js';

export interface PropertiesEditorProps {
  serverId: string;
  serverName?: string;
  onSaved?: () => void;
}

type PropertyValue = string | number | boolean;

interface PropertyDefinition {
  key: string;
  label: string;
  description: string;
  type: 'boolean' | 'number' | 'string' | 'select';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  category: 'gameplay' | 'network' | 'world' | 'advanced';
}

const PROPERTY_DEFINITIONS: PropertyDefinition[] = [
  // Gameplay & Rules
  {
    key: 'difficulty',
    label: 'Dificultad',
    description: 'Nivel de desafío del juego para los jugadores y mobs.',
    type: 'select',
    category: 'gameplay',
    options: [
      { value: 'peaceful', label: 'Pacífico (Sin mobs hostiles)' },
      { value: 'easy', label: 'Fácil' },
      { value: 'normal', label: 'Normal' },
      { value: 'hard', label: 'Difícil' }
    ]
  },
  {
    key: 'gamemode',
    label: 'Modo de Juego por Defecto',
    description: 'Modo asignado a los nuevos jugadores al conectarse.',
    type: 'select',
    category: 'gameplay',
    options: [
      { value: 'survival', label: 'Supervivencia' },
      { value: 'creative', label: 'Creativo' },
      { value: 'adventure', label: 'Aventura' },
      { value: 'spectator', label: 'Espectador' }
    ]
  },
  {
    key: 'pvp',
    label: 'Combate PvP (Jugador contra Jugador)',
    description: 'Permite que los jugadores se hagan daño entre sí.',
    type: 'boolean',
    category: 'gameplay'
  },
  {
    key: 'allow-flight',
    label: 'Permitir Vuelo (Allow Flight)',
    description: 'Evita que el servidor expulse a jugadores flotando en el aire (indispensable en modpacks).',
    type: 'boolean',
    category: 'gameplay'
  },
  {
    key: 'white-list',
    label: 'Lista Blanca (Whitelist)',
    description: 'Solo los jugadores agregados a whitelist.json podrán ingresar.',
    type: 'boolean',
    category: 'gameplay'
  },
  {
    key: 'enforce-whitelist',
    label: 'Forzar Lista Blanca',
    description: 'Expulsa de inmediato a jugadores conectados que sean removidos de la whitelist.',
    type: 'boolean',
    category: 'gameplay'
  },
  {
    key: 'hardcore',
    label: 'Modo Hardcore',
    description: 'Si un jugador muere, queda bloqueado en modo espectador.',
    type: 'boolean',
    category: 'gameplay'
  },
  {
    key: 'enable-command-block',
    label: 'Bloques de Comandos',
    description: 'Habilita la ejecución de bloques de comandos en el mundo.',
    type: 'boolean',
    category: 'gameplay'
  },

  // Network & Connectivity
  {
    key: 'server-port',
    label: 'Puerto del Servidor',
    description: 'Puerto TCP en el que escucha el servidor (estándar: 25565).',
    type: 'number',
    min: 1024,
    max: 65535,
    category: 'network'
  },
  {
    key: 'max-players',
    label: 'Máximo de Jugadores',
    description: 'Cantidad máxima de jugadores simultáneos permitidos.',
    type: 'number',
    min: 1,
    max: 1000,
    category: 'network'
  },
  {
    key: 'online-mode',
    label: 'Modo Online (Autenticación Mojang/Microsoft)',
    description: 'Si está activo, solo cuentas oficiales de Minecraft pueden unirse.',
    type: 'boolean',
    category: 'network'
  },
  {
    key: 'view-distance',
    label: 'Distancia de Renderizado (Chunks)',
    description: 'Radio de chunks enviados al cliente (recomendado: 8 - 12 para rendimiento).',
    type: 'number',
    min: 3,
    max: 32,
    category: 'network'
  },
  {
    key: 'simulation-distance',
    label: 'Distancia de Simulación (Chunks)',
    description: 'Radio de chunks donde las entidades y ticks de redstone se procesan activamente.',
    type: 'number',
    min: 3,
    max: 32,
    category: 'network'
  },
  {
    key: 'network-compression-threshold',
    label: 'Umbral de Compresión de Red',
    description: 'Tamaño en bytes a partir del cual los paquetes son comprimidos (-1 para desactivar).',
    type: 'number',
    category: 'network'
  },

  // World Generation
  {
    key: 'level-name',
    label: 'Nombre de la Carpeta del Mundo',
    description: 'Directorio donde se almacenan las dimensiones (por defecto: world).',
    type: 'string',
    category: 'world'
  },
  {
    key: 'level-seed',
    label: 'Semilla del Mundo (Seed)',
    description: 'Semilla aleatoria para la generación procedural de terreno.',
    type: 'string',
    category: 'world'
  },
  {
    key: 'level-type',
    label: 'Tipo de Mundo',
    description: 'Generador de mundo (ej. minecraft:normal, minecraft:flat, etc.).',
    type: 'string',
    category: 'world'
  },
  {
    key: 'spawn-monsters',
    label: 'Generar Mobs Hostiles',
    description: 'Permite el nacimiento natural de zombis, esqueletos, creepers, etc.',
    type: 'boolean',
    category: 'world'
  },
  {
    key: 'spawn-animals',
    label: 'Generar Animales Pacíficos',
    description: 'Permite el nacimiento de vacas, ovejas, cerdos y aldeanos.',
    type: 'boolean',
    category: 'world'
  },
  {
    key: 'spawn-npcs',
    label: 'Generar Aldeanos (NPCs)',
    description: 'Permite la generación de aldeanos en aldeas.',
    type: 'boolean',
    category: 'world'
  },
  {
    key: 'generate-structures',
    label: 'Generar Estructuras Naturales',
    description: 'Crea templos, minas abandonadas, fortalezas y aldeas.',
    type: 'boolean',
    category: 'world'
  },
  {
    key: 'spawn-protection',
    label: 'Radio de Protección del Spawn (Bloques)',
    description: 'Radio en el punto de aparición donde los no-operadores no pueden romper bloques (0 para desactivar).',
    type: 'number',
    min: 0,
    max: 100,
    category: 'world'
  },

  // Advanced & RCON
  {
    key: 'enable-rcon',
    label: 'Habilitar Protocolo RCON',
    description: 'Permite la conexión remota por consola mediante socket autenticado.',
    type: 'boolean',
    category: 'advanced'
  },
  {
    key: 'rcon.port',
    label: 'Puerto RCON',
    description: 'Puerto de escucha para clientes RCON (por defecto: 25575).',
    type: 'number',
    category: 'advanced'
  },
  {
    key: 'rcon.password',
    label: 'Contraseña RCON',
    description: 'Clave de seguridad para autenticar clientes RCON.',
    type: 'string',
    category: 'advanced'
  },
  {
    key: 'sync-chunk-writes',
    label: 'Escritura Síncrona de Chunks',
    description: 'Garantiza mayor integridad ante apagones bruscos a costa de rendimiento.',
    type: 'boolean',
    category: 'advanced'
  }
];

export const PropertiesEditor: React.FC<PropertiesEditorProps> = ({
  serverId,
  serverName,
  onSaved
}) => {
  const [properties, setProperties] = useState<Record<string, PropertyValue>>({});
  const [initialProperties, setInitialProperties] = useState<Record<string, PropertyValue>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'gameplay' | 'network' | 'world' | 'advanced' | 'motd' | 'custom'>('all');

  // Custom key addition state
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const fetchProperties = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Record<string, PropertyValue>>(`/servers/${serverId}/properties`);
      setProperties(data);
      setInitialProperties(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al cargar propiedades';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [serverId]);

  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(properties) !== JSON.stringify(initialProperties);
  }, [properties, initialProperties]);

  const handleUpdate = (key: string, val: PropertyValue) => {
    setProperties((prev) => ({
      ...prev,
      [key]: val
    }));
  };

  const handleDeleteProperty = (key: string) => {
    setProperties((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleAddCustomProperty = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedKey = newKey.trim();
    if (!trimmedKey) return;

    let parsedVal: PropertyValue = newValue;
    if (newValue === 'true') parsedVal = true;
    else if (newValue === 'false') parsedVal = false;
    else if (/^-?\d+$/.test(newValue)) parsedVal = parseInt(newValue, 10);

    setProperties((prev) => ({
      ...prev,
      [trimmedKey]: parsedVal
    }));
    setNewKey('');
    setNewValue('');
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await api.put(`/servers/${serverId}/properties`, { properties });

      setInitialProperties(properties);
      setSuccessMessage('¡Archivo server.properties guardado y sincronizado con éxito!');
      onSaved?.();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar propiedades';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setProperties(initialProperties);
  };

  // Filtered properties
  const filteredDefs = useMemo(() => {
    return PROPERTY_DEFINITIONS.filter((def) => {
      if (activeCategory !== 'all' && activeCategory !== 'motd' && activeCategory !== 'custom' && def.category !== activeCategory) {
        return false;
      }
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return (
        def.key.toLowerCase().includes(q) ||
        def.label.toLowerCase().includes(q) ||
        def.description.toLowerCase().includes(q)
      );
    });
  }, [activeCategory, searchFilter]);

  // Identify extra/custom properties not in defined list and not motd
  const customProperties = useMemo(() => {
    const knownKeys = new Set(PROPERTY_DEFINITIONS.map((d) => d.key));
    knownKeys.add('motd');
    return Object.entries(properties).filter(([k]) => {
      if (knownKeys.has(k)) return false;
      if (!searchFilter.trim()) return true;
      return k.toLowerCase().includes(searchFilter.toLowerCase());
    });
  }, [properties, searchFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-3">
        <div className="w-8 h-8 border-2 border-nebula-accent border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs font-mono">Cargando server.properties...</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Action Bar with Dirty Status */}
      <div className="bg-nebula-900 border border-nebula-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-nebula-accent/10 border border-nebula-accent/20 text-nebula-accent">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>Editor de server.properties</span>
              {hasUnsavedChanges && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                  Cambios sin guardar
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              Personaliza la configuración nativa del servidor Minecraft sin reiniciar manualmente archivos de texto.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {hasUnsavedChanges && (
            <button
              onClick={handleReset}
              disabled={saving}
              className="px-3 py-2 rounded-lg bg-nebula-800 hover:bg-nebula-750 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Descartar</span>
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            className="px-4 py-2 rounded-lg bg-nebula-accent hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-nebula-accent/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl p-3 flex items-center gap-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3 flex items-center gap-2.5 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs pb-1 sm:pb-0">
          {[
            { id: 'all' as const, label: 'Todo', icon: Sliders },
            { id: 'motd' as const, label: 'MOTD & Presentación', icon: Swords },
            { id: 'gameplay' as const, label: 'Jugabilidad', icon: Shield },
            { id: 'network' as const, label: 'Red y Conexión', icon: Radio },
            { id: 'world' as const, label: 'Mundo', icon: Globe },
            { id: 'advanced' as const, label: 'Avanzado & RCON', icon: Terminal },
            { id: 'custom' as const, label: 'Otras Claves', icon: HelpCircle }
          ].map((cat) => {
            const Icon = cat.icon;
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-nebula-800 text-nebula-accent border border-nebula-700 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-nebula-850'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Buscar propiedad..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-nebula-950 border border-nebula-800 text-slate-200 text-xs focus:outline-none focus:border-nebula-accent transition-colors"
          />
        </div>
      </div>

      {/* MOTD Designer Section (if activeCategory is 'all' or 'motd') */}
      {(activeCategory === 'all' || activeCategory === 'motd') && (
        <div className="bg-nebula-900 border border-nebula-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 border-b border-nebula-800 pb-3">
            <Swords className="w-4 h-4 text-nebula-accent" />
            <h3 className="text-sm font-bold text-white">Diseñador Interactivo de MOTD</h3>
          </div>
          <MotdDesigner
            value={String(properties['motd'] ?? 'A Minecraft Server')}
            onChange={(nextMotd) => handleUpdate('motd', nextMotd)}
            serverName={serverName || String(properties['level-name'] || 'Singularity Server')}
            maxPlayers={Number(properties['max-players'] ?? 20)}
            onlineCount={0}
          />
        </div>
      )}

      {/* Curated Grid of Properties (Gameplay, Network, World, Advanced) */}
      {activeCategory !== 'motd' && activeCategory !== 'custom' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDefs.map((def) => {
            const currentValue = properties[def.key];

            return (
              <div
                key={def.key}
                className="bg-nebula-900 border border-nebula-800 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-nebula-700 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-white">{def.label}</span>
                    <span className="font-mono text-[10px] text-slate-500">{def.key}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{def.description}</p>
                </div>

                <div className="pt-2 border-t border-nebula-800/60">
                  {def.type === 'boolean' && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-300">
                        Estado: <strong className={currentValue ? 'text-emerald-400' : 'text-slate-500'}>
                          {currentValue ? 'Habilitado' : 'Deshabilitado'}
                        </strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdate(def.key, !currentValue)}
                        className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          currentValue ? 'bg-nebula-accent' : 'bg-nebula-750'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                            currentValue ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  )}

                  {def.type === 'select' && (
                    <select
                      value={String(currentValue ?? def.options?.[0]?.value)}
                      onChange={(e) => handleUpdate(def.key, e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-nebula-950 border border-nebula-750 text-slate-200 text-xs focus:outline-none focus:border-nebula-accent"
                    >
                      {def.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {def.type === 'number' && (
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min={def.min}
                        max={def.max}
                        value={currentValue !== undefined ? Number(currentValue) : ''}
                        onChange={(e) => handleUpdate(def.key, parseInt(e.target.value, 10) || 0)}
                        className="w-full px-3 py-1.5 rounded-lg bg-nebula-950 border border-nebula-750 text-slate-200 text-xs font-mono focus:outline-none focus:border-nebula-accent"
                      />
                      {def.min !== undefined && def.max !== undefined && (
                        <input
                          type="range"
                          min={def.min}
                          max={def.max}
                          value={currentValue !== undefined ? Number(currentValue) : def.min}
                          onChange={(e) => handleUpdate(def.key, parseInt(e.target.value, 10))}
                          className="w-28 accent-nebula-accent cursor-pointer"
                        />
                      )}
                    </div>
                  )}

                  {def.type === 'string' && (
                    <div className="relative flex items-center">
                      <input
                        type={def.key.includes('password') && !showPasswords[def.key] ? 'password' : 'text'}
                        value={String(currentValue ?? '')}
                        onChange={(e) => handleUpdate(def.key, e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-nebula-950 border border-nebula-750 text-slate-200 text-xs font-mono focus:outline-none focus:border-nebula-accent"
                      />
                      {def.key.includes('password') && (
                        <button
                          type="button"
                          onClick={() => setShowPasswords((prev) => ({ ...prev, [def.key]: !prev[def.key] }))}
                          className="absolute right-2.5 text-slate-400 hover:text-slate-200"
                          title={showPasswords[def.key] ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showPasswords[def.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Custom & Extra Properties Table (All remaining keys) */}
      {(activeCategory === 'all' || activeCategory === 'custom') && (
        <div className="bg-nebula-900 border border-nebula-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-nebula-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Otras Propiedades y Claves Personalizadas</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-nebula-800 text-slate-400">
                  {customProperties.length}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Añade o modifica cualquier parámetro del motor Minecraft o de mods específicos.
              </p>
            </div>
          </div>

          {/* Add custom property form */}
          <form onSubmit={handleAddCustomProperty} className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="text"
              placeholder="Nueva clave (ej. broadcast-rcon-to-ops)"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg bg-nebula-950 border border-nebula-750 text-slate-200 text-xs font-mono focus:outline-none focus:border-nebula-accent"
            />
            <input
              type="text"
              placeholder="Valor (ej. true, 123, texto)"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="flex-1 min-w-[150px] px-3 py-1.5 rounded-lg bg-nebula-950 border border-nebula-750 text-slate-200 text-xs font-mono focus:outline-none focus:border-nebula-accent"
            />
            <button
              type="submit"
              disabled={!newKey.trim()}
              className="px-3.5 py-1.5 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-nebula-accent border border-nebula-700 font-semibold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Clave</span>
            </button>
          </form>

          {/* List of custom properties */}
          {customProperties.length > 0 ? (
            <div className="divide-y divide-nebula-800/60 max-h-96 overflow-y-auto pr-1">
              {customProperties.map(([key, val]) => (
                <div key={key} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="font-mono text-slate-300 font-semibold min-w-[180px] truncate">
                    {key}
                  </div>
                  <div className="flex-1 max-w-sm">
                    <input
                      type="text"
                      value={String(val)}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === 'true') handleUpdate(key, true);
                        else if (raw === 'false') handleUpdate(key, false);
                        else if (/^-?\d+$/.test(raw)) handleUpdate(key, parseInt(raw, 10));
                        else handleUpdate(key, raw);
                      }}
                      className="w-full px-2.5 py-1 rounded bg-nebula-950 border border-nebula-750 text-slate-200 font-mono text-xs focus:outline-none focus:border-nebula-accent"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteProperty(key)}
                    className="p-1.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title={`Eliminar propiedad ${key}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-slate-500 font-mono">
              No hay propiedades personalizadas adicionales.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
