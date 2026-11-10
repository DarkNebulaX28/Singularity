import { getMinecraftAvatarUrl, STEVE_AVATAR_SVG } from '../utils/minecraft-skin';
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, type UserProfile } from '../context/AuthContext.js';
import { api } from '../services/api-client.js';
import { useDialog } from '../context/DialogContext.js';
import type { ServerInstanceData } from '../components/ServerCard.js';
import {
  Users,
  UserPlus,
  Shield,
  Server,
  Search,
  RotateCw,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldAlert,
  Sliders,
  Check,
  Eye,
  EyeOff,
  Dices
} from 'lucide-react';

export const UsersManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { confirm, toast } = useDialog();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [servers, setServers] = useState<ServerInstanceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'OPERATOR' | 'VIEWER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'DISABLED'>('ALL');

  // Notification state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    displayName: '',
    minecraftUsername: '',
    role: 'OPERATOR' as 'ADMIN' | 'OPERATOR' | 'VIEWER',
    isActive: true,
    mustChangePassword: false,
    allServers: true,
    selectedServers: [] as string[]
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [fetchedUsers, fetchedServers] = await Promise.all([
        api.get<UserProfile[]>('/auth/users'),
        api.get<ServerInstanceData[]>('/servers').catch(() => [])
      ]);
      setUsers(fetchedUsers);
      setServers(fetchedServers);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setShowPassword(false);
    setFormData({
      username: '',
      password: '',
      displayName: '',
      minecraftUsername: '',
      role: 'OPERATOR',
      isActive: true,
      mustChangePassword: false,
      allServers: true,
      selectedServers: []
    });
    setIsModalOpen(true);
  };

  const openEditModal = (targetUser: UserProfile) => {
    setEditingUser(targetUser);
    setShowPassword(false);
    const hasAll = !targetUser.allowedServers || targetUser.allowedServers.includes('*');
    setFormData({
      username: targetUser.username,
      password: '',
      displayName: targetUser.displayName || '',
      minecraftUsername: targetUser.minecraftUsername || '',
      role: targetUser.role,
      isActive: targetUser.isActive !== false,
      mustChangePassword: targetUser.mustChangePassword,
      allServers: hasAll,
      selectedServers: hasAll ? [] : targetUser.allowedServers || []
    });
    setIsModalOpen(true);
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*+-=';
    const array = new Uint32Array(14);
    window.crypto.getRandomValues(array);
    const generated = Array.from(array, (x) => chars[x % chars.length]).join('');
    setFormData((prev) => ({ ...prev, password: generated }));
    setShowPassword(true);
    navigator.clipboard.writeText(generated);
    toast('Contraseña segura generada y copiada al portapapeles', 'info');
  };

  const handleToggleStatus = async (targetUser: UserProfile) => {
    if (targetUser.id === currentUser?.id) {
      setErrorMessage('No puedes deshabilitar tu propia cuenta de administrador');
      toast('No puedes deshabilitar tu propia cuenta', 'error');
      return;
    }

    const nextStatus = targetUser.isActive === false;
    try {
      await api.put(`/auth/users/${targetUser.id}`, {
        isActive: nextStatus
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, isActive: nextStatus } : u))
      );
      const msg = `Cuenta de @${targetUser.username} ${nextStatus ? 'habilitada' : 'deshabilitada'} correctamente.`;
      setSuccessMessage(msg);
      toast(msg, 'success');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cambiar estado de la cuenta';
      setErrorMessage(msg);
      toast(msg, 'error');
    }
  };

  const handleDeleteUser = async (targetUser: UserProfile) => {
    if (targetUser.id === currentUser?.id) {
      setErrorMessage('No puedes eliminar tu propia cuenta');
      return;
    }

    const ok = await confirm({
      title: 'Eliminar Cuenta de Usuario',
      message: `¿Estás seguro de que deseas eliminar permanentemente al operador @${targetUser.username}?`,
      confirmLabel: 'Eliminar Cuenta',
      variant: 'danger'
    });
    if (!ok) {
      return;
    }

    try {
      await api.delete(`/auth/users/${targetUser.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== targetUser.id));
      setSuccessMessage(`Usuario @${targetUser.username} eliminado correctamente.`);
      toast(`Usuario @${targetUser.username} eliminado`, 'info');
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al eliminar usuario';
      setErrorMessage(msg);
      toast(msg, 'error');
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const allowed = formData.allServers ? ['*'] : formData.selectedServers;

    try {
      if (editingUser) {
        const updatePayload: Record<string, any> = {
          role: formData.role,
          isActive: formData.isActive,
          displayName: formData.displayName.trim() || undefined,
          minecraftUsername: formData.minecraftUsername.trim() || undefined,
          allowedServers: allowed,
          mustChangePassword: formData.mustChangePassword
        };
        if (formData.password.trim()) {
          updatePayload.newPassword = formData.password.trim();
        }

        const updated = await api.put<UserProfile>(`/auth/users/${editingUser.id}`, updatePayload);
        setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
        setSuccessMessage(`Usuario @${updated.username} actualizado correctamente.`);
        toast(`Usuario @${updated.username} actualizado`, 'success');
      } else {
        if (!formData.password || formData.password.length < 8) {
          throw new Error('La contraseña debe tener al menos 8 caracteres');
        }

        const created = await api.post<UserProfile>('/auth/users', {
          username: formData.username.trim(),
          password: formData.password,
          role: formData.role,
          isActive: formData.isActive,
          displayName: formData.displayName.trim() || undefined,
          minecraftUsername: formData.minecraftUsername.trim() || undefined,
          allowedServers: allowed,
          mustChangePassword: formData.mustChangePassword
        });
        setUsers((prev) => [...prev, created]);
        setSuccessMessage(`Nuevo usuario @${created.username} creado exitosamente.`);
        toast(`Cuenta @${created.username} creada`, 'success');
      }

      setIsModalOpen(false);
      setTimeout(() => setSuccessMessage(null), 3500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar usuario';
      setErrorMessage(msg);
      toast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered users calculation
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
      if (statusFilter === 'ACTIVE' && u.isActive === false) return false;
      if (statusFilter === 'DISABLED' && u.isActive !== false) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchUser = u.username.toLowerCase().includes(q);
      const matchName = u.displayName?.toLowerCase().includes(q) ?? false;
      const matchNick = u.minecraftUsername?.toLowerCase().includes(q) ?? false;
      return matchUser || matchName || matchNick;
    });
  }, [users, roleFilter, statusFilter, searchQuery]);

  // Statistics
  const totalCount = users.length;
  const activeCount = users.filter((u) => u.isActive !== false).length;
  const disabledCount = totalCount - activeCount;
  const operatorCount = users.filter((u) => u.role === 'OPERATOR').length;

  return (
    <div className="space-y-6">
      {/* Page Title & Top Action Bar */}
      <div className="bg-nebula-900 border border-nebula-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-nebula-accent/20 to-nebula-cyber/30 border border-nebula-accent/40 flex items-center justify-center text-nebula-accent shadow-md">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white flex items-center gap-2">
              <span>Gestor de Cuentas y Accesos Granulares (RBAC)</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono tabular-nums font-bold bg-nebula-800 text-slate-300">
                {totalCount} Registrados
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Crea cuentas adicionales para operadores, activa o suspende accesos y asigna servidores específicos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-slate-400 hover:text-white border border-nebula-750 transition-colors"
            title="Recargar lista de usuarios"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-nebula-accent hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-nebula-accent/20 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Crear Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-nebula-900 border border-nebula-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-semibold">Total Cuentas</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-white">{totalCount}</span>
            <Users className="w-4 h-4 text-nebula-cyber" />
          </div>
        </div>

        <div className="bg-nebula-900 border border-nebula-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-semibold">Cuentas Activas</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-400">{activeCount}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        <div className="bg-nebula-900 border border-nebula-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-semibold">Operadores</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-cyan-400">{operatorCount}</span>
            <Sliders className="w-4 h-4 text-cyan-400" />
          </div>
        </div>

        <div className="bg-nebula-900 border border-nebula-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-slate-400 text-xs font-semibold">Deshabilitadas</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-slate-500">{disabledCount}</span>
            <ShieldAlert className="w-4 h-4 text-slate-500" />
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-nebula-900/60 border border-nebula-800 rounded-xl p-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por usuario, alias o nickname Minecraft..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-nebula-950 border border-nebula-800 text-slate-200 text-xs focus:outline-none focus:border-nebula-accent font-mono"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto text-xs font-mono">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg bg-nebula-950 border border-nebula-800 text-slate-300 text-xs focus:outline-none focus:border-nebula-accent"
          >
            <option value="ALL">Todos los Roles</option>
            <option value="ADMIN">Administradores</option>
            <option value="OPERATOR">Operadores</option>
            <option value="VIEWER">Espectadores</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 rounded-lg bg-nebula-950 border border-nebula-800 text-slate-300 text-xs focus:outline-none focus:border-nebula-accent"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="ACTIVE">Solo Activos</option>
            <option value="DISABLED">Solo Deshabilitados</option>
          </select>
        </div>
      </div>

      {/* Users Table / List */}
      <div className="bg-nebula-900 border border-nebula-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-nebula-800 bg-nebula-950/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4">Usuario & Avatar</th>
                <th className="py-3 px-4">Rol Asignado</th>
                <th className="py-3 px-4">Estado de Acceso</th>
                <th className="py-3 px-4">Servidores Permitidos</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nebula-800/60">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser?.id;
                  const isActive = u.isActive !== false;
                  const skinNick = u.minecraftUsername || u.username;
                  const hasAll = !u.allowedServers || u.allowedServers.includes('*');

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-nebula-850/50 transition-colors ${
                        !isActive ? 'opacity-60 bg-nebula-950/40' : ''
                      }`}
                    >
                      {/* User & Minecraft Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-nebula-950 border border-nebula-800 flex items-center justify-center overflow-hidden shrink-0 shadow">
                            <img
                              src={getMinecraftAvatarUrl(skinNick, 36)}
                              alt={u.username}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = STEVE_AVATAR_SVG;
                              }}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white font-mono">@{u.username}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-nebula-accent/20 text-nebula-accent border border-nebula-accent/30 font-bold">
                                  TÚ
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block">
                              {u.displayName || 'Sin alias asignado'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-950/60 text-purple-300 border border-purple-500/30'
                              : u.role === 'OPERATOR'
                              ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
                              : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          <span>{u.role}</span>
                        </span>
                      </td>

                      {/* Status Toggle Switch */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            disabled={isCurrent}
                            onClick={() => handleToggleStatus(u)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                              isActive ? 'bg-nebula-accent' : 'bg-slate-700'
                            }`}
                            title={
                              isCurrent
                                ? 'No puedes deshabilitar tu propia cuenta'
                                : isActive
                                ? 'Deshabilitar cuenta'
                                : 'Habilitar cuenta'
                            }
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                                isActive ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span
                            className={`font-mono text-xs font-semibold ${
                              isActive ? 'text-emerald-400' : 'text-slate-500'
                            }`}
                          >
                            {isActive ? 'Activo' : 'Deshabilitado'}
                          </span>
                        </div>
                      </td>

                      {/* Allowed Servers */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap items-center gap-1 max-w-xs">
                          {hasAll ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-nebula-800 text-slate-300 border border-nebula-700 flex items-center gap-1">
                              <Server className="w-3 h-3 text-nebula-cyber" />
                              <span>Todos los Servidores (*)</span>
                            </span>
                          ) : u.allowedServers && u.allowedServers.length > 0 ? (
                            u.allowedServers.map((srvId) => (
                              <span
                                key={srvId}
                                className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-nebula-850 text-slate-300 border border-nebula-750"
                              >
                                {srvId}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-500 font-mono text-[11px]">
                              Sin servidores asignados
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 rounded-lg bg-nebula-800 hover:bg-nebula-750 text-slate-300 hover:text-white transition-colors"
                            title="Editar permisos y credenciales"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            disabled={isCurrent}
                            onClick={() => handleDeleteUser(u)}
                            className="p-1.5 rounded-lg bg-nebula-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isCurrent ? 'No puedes eliminarte a ti mismo' : 'Eliminar usuario'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500 font-mono">
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create or Edit User */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-nebula-900 border border-nebula-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 w-full bg-nebula-accent" />
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-nebula-800 flex items-center justify-between bg-nebula-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-nebula-accent/15 border border-nebula-accent/30 flex items-center justify-center text-nebula-accent">
                  {editingUser ? <Edit className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    {editingUser ? `Editar Operador @${editingUser.username}` : 'Crear Nueva Cuenta'}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Define privilegios de operador, credenciales de acceso y servidores autorizados.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-nebula-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitForm} className="p-6 overflow-y-auto space-y-4">
              {/* Username (Disabled on edit) */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Nombre de Usuario (@username)
                </label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingUser)}
                  placeholder="ej. operador_dan"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-750 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-nebula-accent font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Password with Generator & Visibility Toggle */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    {editingUser
                      ? 'Nueva Contraseña (opcional)'
                      : 'Contraseña Inicial (mínimo 8 caracteres)'}
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="text-[11px] font-mono text-nebula-cyber hover:text-cyan-300 flex items-center gap-1 transition-colors"
                  >
                    <Dices className="w-3.5 h-3.5" />
                    <span>Generar Clave</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required={!editingUser}
                    placeholder={editingUser ? 'Dejar vacío para mantener actual...' : 'Contraseña segura...'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 pr-10 text-xs bg-nebula-950 border border-nebula-750 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-nebula-accent font-mono"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Display Name & Minecraft Skin Nickname */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Nombre Visible (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Dan Moderador"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-750 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-nebula-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Skin Minecraft (Nickname)
                  </label>
                  <input
                    type="text"
                    placeholder="ej. Notch o Steve"
                    value={formData.minecraftUsername}
                    onChange={(e) => setFormData({ ...formData, minecraftUsername: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-750 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-nebula-accent font-mono"
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Rol y Nivel de Privilegios
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'OPERATOR', label: 'OPERATOR', desc: 'Control de consolas y servidores' },
                    { id: 'VIEWER', label: 'VIEWER', desc: 'Solo ver estado y métricas' },
                    { id: 'ADMIN', label: 'ADMIN', desc: 'Acceso total y gestión' }
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, role: r.id as any })}
                      className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
                        formData.role === r.id
                          ? 'bg-nebula-800 border-nebula-accent text-white shadow-md'
                          : 'bg-nebula-950/60 border-nebula-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="font-mono font-bold text-xs">{r.label}</span>
                      <span className="text-[10px] text-slate-500 leading-tight mt-1">{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Status and Force Password Flags */}
              <div className="pt-2 border-t border-nebula-800/80 space-y-2">
                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-4 h-4 rounded bg-nebula-950 border-nebula-700 text-nebula-accent focus:ring-nebula-accent accent-nebula-accent"
                  />
                  <span>Cuenta Habilitada (Permitir inicio de sesión)</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.mustChangePassword}
                    onChange={(e) => setFormData({ ...formData, mustChangePassword: e.target.checked })}
                    className="w-4 h-4 rounded bg-nebula-950 border-nebula-700 text-nebula-accent focus:ring-nebula-accent accent-nebula-accent"
                  />
                  <span>Obligar al usuario a cambiar su contraseña en el primer login</span>
                </label>
              </div>

              {/* Server Access Granularity */}
              <div className="pt-3 border-t border-nebula-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Server className="w-3.5 h-3.5 text-nebula-cyber" />
                    Permisos de Servidores
                  </span>
                  {!formData.allServers && servers.length > 0 && (
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, selectedServers: servers.map((s) => s.id) })}
                        className="text-nebula-cyber hover:underline"
                      >
                        Marcar todos
                      </button>
                      <span className="text-slate-600">|</span>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, selectedServers: [] })}
                        className="text-slate-400 hover:underline"
                      >
                        Limpiar
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="serverAccess"
                      checked={formData.allServers}
                      onChange={() => setFormData({ ...formData, allServers: true })}
                      className="accent-nebula-accent"
                    />
                    <span>Todos los servidores (*)</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="serverAccess"
                      checked={!formData.allServers}
                      onChange={() => setFormData({ ...formData, allServers: false })}
                      className="accent-nebula-accent"
                    />
                    <span>Servidores específicos</span>
                  </label>
                </div>

                {!formData.allServers && (
                  <div className="mt-2 p-3 rounded-xl bg-nebula-950 border border-nebula-800 space-y-1.5 max-h-36 overflow-y-auto">
                    {servers.length > 0 ? (
                      servers.map((s) => {
                        const checked = formData.selectedServers.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className="flex items-center justify-between p-1.5 rounded hover:bg-nebula-850 cursor-pointer text-xs"
                          >
                            <span className="text-slate-200 font-medium">
                              {s.name} <span className="font-mono text-[10px] text-slate-500">({s.id})</span>
                            </span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...formData.selectedServers, s.id]
                                  : formData.selectedServers.filter((id) => id !== s.id);
                                setFormData({ ...formData, selectedServers: next });
                              }}
                              className="accent-nebula-accent"
                            />
                          </label>
                        );
                      })
                    ) : (
                      <span className="text-xs text-slate-500 font-mono">
                        No hay instancias creadas aún.
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-nebula-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl bg-nebula-accent hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-nebula-accent/20 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{editingUser ? 'Guardar Cambios' : 'Crear Usuario'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
