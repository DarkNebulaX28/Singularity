import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useDialog } from '../context/DialogContext.js';
import {
  X,
  User,
  Shield,
  Key,
  AlertCircle,
  Sparkles,
  Server,
  Lock,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  Dices,
  Check
} from 'lucide-react';
import { getMinecraftBodyUrl, getMinecraftAvatarUrl, STEVE_AVATAR_SVG } from '../utils/minecraft-skin';

export interface UserProfileModalProps {
  isOpen: boolean;
  initialTab?: 'profile' | 'security';
  onClose: () => void;
}

const SKIN_PRESETS = ['Notch', 'jeb_', 'Steve', 'Alex', 'Dinnerbone', 'MHF_Steve'];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  initialTab = 'profile',
  onClose
}) => {
  const { user, updateProfile, updatePassword } = useAuth();
  const { toast } = useDialog();

  const [activeTab, setActiveTab] = useState<'profile' | 'security'>(initialTab);

  // Profile Form State
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [minecraftUsername, setMinecraftUsername] = useState(user?.minecraftUsername || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Security Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [copiedGenerated, setCopiedGenerated] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(user?.mustChangePassword ? 'security' : initialTab);
      setDisplayName(user?.displayName || '');
      setMinecraftUsername(user?.minecraftUsername || '');
      setProfileError(null);
      setPassError(null);
    }
  }, [isOpen, initialTab, user]);

  // Password Strength Telemetry
  const passwordStrength = useMemo(() => {
    if (!newPassword) return { score: 0, label: 'SIN CLAVE', color: 'bg-slate-800', textColor: 'text-slate-500' };
    let score = 0;
    if (newPassword.length >= 8) score += 25;
    if (newPassword.length >= 12) score += 25;
    if (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) score += 20;
    if (/\d/.test(newPassword)) score += 15;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 15;

    if (score < 40) return { score, label: 'DÉBIL', color: 'bg-rose-500', textColor: 'text-rose-400' };
    if (score < 70) return { score, label: 'ACEPTABLE', color: 'bg-amber-500', textColor: 'text-amber-400' };
    if (score < 90) return { score, label: 'FUERTE', color: 'bg-nebula-cyber', textColor: 'text-nebula-cyber' };
    return { score: 100, label: 'GRADO MILITAR', color: 'bg-emerald-400', textColor: 'text-emerald-400' };
  }, [newPassword]);

  if (!isOpen || !user) return null;

  const generateSecurePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-=';
    const array = new Uint32Array(16);
    window.crypto.getRandomValues(array);
    const generated = Array.from(array, (x) => chars[x % chars.length]).join('');
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowNewPass(true);
    navigator.clipboard.writeText(generated);
    setCopiedGenerated(true);
    toast('Clave segura de 16 caracteres generada y copiada al portapapeles', 'info');
    setTimeout(() => setCopiedGenerated(false), 2500);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);

    try {
      await updateProfile({
        displayName: displayName.trim(),
        minecraftUsername: minecraftUsername.trim()
      });
      setProfileSuccess(true);
      toast('Perfil e identidad de operador actualizados', 'success');
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el perfil';
      setProfileError(msg);
      toast(msg, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(false);

    if (newPassword.length < 8) {
      setPassError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPassError('La confirmación de la contraseña no coincide.');
      return;
    }

    setIsChangingPass(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setPassSuccess(true);
      toast('Contraseña de operador actualizada correctamente', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setPassSuccess(false);
        if (user.mustChangePassword) {
          onClose();
        }
      }, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar la contraseña';
      setPassError(msg);
      toast(msg, 'error');
    } finally {
      setIsChangingPass(false);
    }
  };

  const previewNick = minecraftUsername.trim() || user?.username || 'Steve';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-nebula-900 border border-nebula-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Line */}
        <div className="h-1 w-full bg-gradient-to-r from-nebula-accent via-nebula-cyber to-nebula-purple" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-nebula-800 flex items-center justify-between bg-nebula-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-nebula-950 border border-nebula-800 flex items-center justify-center overflow-hidden shadow-inner">
              <img
                src={getMinecraftAvatarUrl(previewNick, 40)}
                alt={previewNick}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = STEVE_AVATAR_SVG;
                }}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Credencial de Operador
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-nebula-accent/15 text-nebula-accent border border-nebula-accent/30 font-bold">
                  {user.role}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                @{user.username} &bull; ID: {user.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal de perfil"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-nebula-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-nebula-800 bg-nebula-950/80 px-6 pt-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'profile'
                ? 'border-nebula-accent text-nebula-accent bg-nebula-900/50 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>IDENTIDAD & SKIN 3D</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2.5 text-xs font-mono font-bold border-b-2 transition-all flex items-center gap-2 relative ${
              activeTab === 'security'
                ? 'border-nebula-accent text-nebula-accent bg-nebula-900/50 rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>SEGURIDAD & CONTRASEÑA</span>
            {user.mustChangePassword && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'profile' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: 3D/2D Minecraft Skin Preview */}
              <div className="flex flex-col items-center justify-between bg-nebula-950/90 border border-nebula-800 rounded-xl p-4 text-center">
                <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                  <span>SKIN TELEMETRY</span>
                  <Sparkles className="w-3 h-3 text-nebula-accent" />
                </div>

                <div className="w-36 h-48 bg-nebula-900/70 rounded-xl border border-nebula-800/80 flex items-center justify-center p-2 relative shadow-inner overflow-hidden group">
                  <img
                    src={getMinecraftBodyUrl(previewNick, 180)}
                    alt={`Skin de ${previewNick}`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = STEVE_AVATAR_SVG;
                    }}
                    className="max-h-full object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.8)] group-hover:scale-105 transition-transform duration-200"
                  />
                </div>

                <div className="mt-3 w-full space-y-2">
                  <div>
                    <span className="text-xs font-mono font-bold text-white block truncate">
                      {previewNick}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      Mojang / Crafatar Render
                    </span>
                  </div>

                  {/* Quick Skin Presets */}
                  <div className="pt-2 border-t border-nebula-850 flex flex-wrap justify-center gap-1">
                    {SKIN_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setMinecraftUsername(preset)}
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors ${
                          minecraftUsername.toLowerCase() === preset.toLowerCase()
                            ? 'bg-nebula-accent/20 text-nebula-accent border-nebula-accent/40 font-bold'
                            : 'bg-nebula-900 text-slate-400 border-nebula-800 hover:text-white'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Profile Form */}
              <form onSubmit={handleSaveProfile} className="md:col-span-2 space-y-4">
                {profileSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>¡Identidad sincronizada con éxito!</span>
                  </div>
                )}

                {profileError && (
                  <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{profileError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400">
                      Identificador (@username)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={user.username}
                      className="w-full px-3 py-2 text-xs bg-nebula-950/50 border border-nebula-850 rounded-lg text-slate-400 font-mono cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300">
                      Alias de Operador
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Comandante Xavier"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-750 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-nebula-accent transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300">
                    Nickname Oficial de Minecraft (Skin Vinculada)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Notch, jeb_ o tu cuenta oficial"
                    value={minecraftUsername}
                    onChange={(e) => setMinecraftUsername(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-750 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-nebula-accent transition-colors font-mono"
                  />
                  <span className="text-[11px] text-slate-500 block">
                    Se utiliza para renderizar tu avatar en la cabecera táctica, auditoría y gestión de usuarios.
                  </span>
                </div>

                {/* Permissions & Roles Summary */}
                <div className="p-3.5 rounded-xl bg-nebula-950/90 border border-nebula-800 text-xs space-y-2 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-nebula-accent" />
                      <span>NIVEL DE AUTORIZACIÓN:</span>
                    </span>
                    <span className="font-bold text-nebula-accent">{user.role}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Server className="w-3.5 h-3.5 text-nebula-cyber" />
                      <span>ALCANCE DE NODOS:</span>
                    </span>
                    <span className="text-slate-200">
                      {user.role === 'ADMIN' || !user.allowedServers || user.allowedServers.includes('*')
                        ? 'ACCESO GLOBAL (*)'
                        : `${user.allowedServers.length} INSTANCIA(S)`}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-5 py-2.5 rounded-xl bg-nebula-accent hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-nebula-accent/20 transition-all disabled:opacity-50"
                  >
                    {isSavingProfile ? (
                      <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{isSavingProfile ? 'Sincronizando...' : 'Guardar Identidad'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handleChangePassword} className="max-w-lg mx-auto space-y-4">
              {user.mustChangePassword && (
                <div className="p-3.5 rounded-xl bg-amber-950/50 border border-amber-500/40 text-amber-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 font-mono">
                    <Key className="w-4 h-4 text-amber-400" />
                    <span>ROTACIÓN DE CLAVE OBLIGATORIA</span>
                  </div>
                  <p className="text-[11px] text-amber-300/90 leading-relaxed">
                    Tu cuenta tiene una clave temporal o por defecto. Define una contraseña segura para desbloquear todas las operaciones.
                  </p>
                </div>
              )}

              {passSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>¡Contraseña actualizada y cifrada con éxito!</span>
                </div>
              )}

              {passError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{passError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300">
                  Contraseña Actual
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Ingresa tu contraseña vigente..."
                    className="w-full px-3.5 py-2 pr-10 text-xs bg-nebula-950 border border-nebula-750 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-nebula-accent font-mono"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300">
                    Nueva Contraseña (Mín. 8 caracteres)
                  </label>
                  <button
                    type="button"
                    onClick={generateSecurePassword}
                    className="text-[11px] font-mono text-nebula-cyber hover:text-cyan-300 flex items-center gap-1 transition-colors"
                  >
                    {copiedGenerated ? <Check className="w-3 h-3 text-emerald-400" /> : <Dices className="w-3.5 h-3.5" />}
                    <span>{copiedGenerated ? '¡Copiada!' : 'Generar Clave Táctica'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nueva clave de acceso..."
                    className="w-full px-3.5 py-2 pr-10 text-xs bg-nebula-950 border border-nebula-750 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-nebula-accent font-mono"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Live Password Entropy Meter */}
                <div className="pt-1 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500">ENTROPÍA DE CLAVE:</span>
                    <span className={`font-bold tabular-nums ${passwordStrength.textColor}`}>
                      {passwordStrength.label} ({passwordStrength.score}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-nebula-950 border border-nebula-850 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: `${passwordStrength.score}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-300">
                  Confirmar Nueva Contraseña
                </label>
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la nueva contraseña..."
                  className="w-full px-3.5 py-2 text-xs bg-nebula-950 border border-nebula-750 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-nebula-accent font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={isChangingPass}
                className="w-full py-2.5 px-4 rounded-xl bg-nebula-accent hover:bg-emerald-400 active:scale-[0.99] text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-nebula-accent/20 transition-all disabled:opacity-50"
              >
                {isChangingPass ? (
                  <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Lock className="w-4 h-4" />
                )}
                <span>{isChangingPass ? 'Cifrando y Actualizando...' : 'Actualizar Contraseña de Acceso'}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
