import React, { useState } from 'react';
import { Users, Shield, UserX, UserMinus, ShieldAlert, UserPlus, Check, AlertCircle } from 'lucide-react';
import { api } from '../services/api-client.js';
import { getMinecraftAvatarUrl, STEVE_AVATAR_SVG } from '../utils/minecraft-skin';

export interface PlayerData {
  username: string;
  uuid?: string;
  joinedAt?: string;
  isOp?: boolean;
}

interface PlayerManagerProps {
  serverId: string;
  isOnline: boolean;
  players: PlayerData[];
  onPlayerActionSent?: () => void;
}

export const PlayerManager: React.FC<PlayerManagerProps> = ({
  serverId,
  isOnline,
  players,
  onPlayerActionSent
}) => {
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [quickPlayerName, setQuickPlayerName] = useState('');
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const showFeedback = (type: 'ok' | 'err', text: string) => {
    setStatusFeedback({ type, text });
    setTimeout(() => setStatusFeedback(null), 3000);
  };

  const sendCommand = async (cmd: string, successLabel?: string) => {
    try {
      await api.post(`/servers/${serverId}/command`, { command: cmd });
      if (successLabel) showFeedback('ok', successLabel);
      onPlayerActionSent?.();
    } catch (err: unknown) {
      showFeedback('err', err instanceof Error ? err.message : 'Error al enviar comando');
    }
  };

  const handleOp = async (username: string) => {
    setActionInProgress(username);
    await sendCommand(`op ${username}`, `OP otorgado a ${username}`);
    setActionInProgress(null);
  };

  const handleDeop = async (username: string) => {
    setActionInProgress(username);
    await sendCommand(`deop ${username}`, `OP revocado a ${username}`);
    setActionInProgress(null);
  };

  const handleGamemode = async (username: string, mode: 'survival' | 'creative' | 'spectator') => {
    setActionInProgress(username);
    await sendCommand(`gamemode ${mode} ${username}`, `${username} -> ${mode.toUpperCase()}`);
    setActionInProgress(null);
  };

  const handleKick = async (username: string) => {
    setActionInProgress(username);
    await sendCommand(`kick ${username} Expulsado por el operador`, `${username} expulsado`);
    setActionInProgress(null);
  };

  const handleBan = async (username: string) => {
    setActionInProgress(username);
    await sendCommand(`ban ${username} Baneado del servidor`, `${username} baneado`);
    setActionInProgress(null);
  };

  const handleQuickAction = async (action: 'whitelist' | 'op') => {
    const clean = quickPlayerName.trim();
    if (!clean || !isOnline) return;
    setActionInProgress(clean);
    if (action === 'whitelist') {
      await sendCommand(`whitelist add ${clean}`, `${clean} añadido a Whitelist`);
    } else {
      await sendCommand(`op ${clean}`, `OP otorgado a ${clean}`);
    }
    setQuickPlayerName('');
    setActionInProgress(null);
  };

  return (
    <div className="bg-nebula-900 border border-nebula-800 rounded-xl p-3 sm:p-4 shadow-md flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between pb-2.5 border-b border-nebula-800 mb-2.5 shrink-0">
        <div className="flex items-center gap-2 text-slate-200">
          <Users className="w-4 h-4 text-nebula-accent" />
          <h3 className="font-bold text-xs">Jugadores &amp; Accesos</h3>
        </div>
        <span className="text-[10px] font-mono tabular-nums px-2 py-0.5 rounded-full bg-nebula-850 text-slate-400 border border-nebula-800">
          {players.length} online
        </span>
      </div>

      {/* Quick OP / Whitelist Bar */}
      {isOnline && (
        <div className="mb-2.5 space-y-1.5 shrink-0">
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={quickPlayerName}
              onChange={(e) => setQuickPlayerName(e.target.value)}
              placeholder="Nick (ej. Steve)..."
              className="flex-1 min-w-0 px-2.5 py-1 text-[11px] font-mono bg-nebula-950 border border-nebula-800 rounded-lg text-slate-100 placeholder-slate-600 focus:outline-none focus:border-nebula-accent"
            />
            <button
              type="button"
              disabled={!quickPlayerName.trim() || Boolean(actionInProgress)}
              onClick={() => handleQuickAction('whitelist')}
              title="Añadir jugador a la Whitelist (/whitelist add)"
              className="px-2 py-1 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-nebula-cyber border border-nebula-750 text-[10px] font-mono font-bold transition-colors disabled:opacity-40 flex items-center gap-1 shrink-0"
            >
              <UserPlus className="w-3 h-3" />
              <span>WL</span>
            </button>
            <button
              type="button"
              disabled={!quickPlayerName.trim() || Boolean(actionInProgress)}
              onClick={() => handleQuickAction('op')}
              title="Dar permisos de Operador (/op)"
              className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold transition-colors disabled:opacity-40 flex items-center gap-1 shrink-0"
            >
              <Shield className="w-3 h-3" />
              <span>OP</span>
            </button>
          </div>

          {statusFeedback && (
            <div
              className={`px-2.5 py-1 rounded text-[10px] font-mono flex items-center gap-1.5 ${
                statusFeedback.type === 'ok'
                  ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/60 border border-rose-500/30 text-rose-300'
              }`}
            >
              {statusFeedback.type === 'ok' ? (
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
              )}
              <span className="truncate">{statusFeedback.text}</span>
            </div>
          )}
        </div>
      )}

      {!isOnline ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-slate-500 font-mono">
          <span>Servidor offline</span>
        </div>
      ) : players.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-slate-500">
          <span>No hay jugadores conectados actualmente</span>
        </div>
      ) : (
        <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
          {players.map((player) => (
            <div
              key={player.username}
              className="p-2 rounded-lg bg-nebula-950 border border-nebula-850 hover:border-nebula-700 transition-colors space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <img
                    src={getMinecraftAvatarUrl(player.username, 32)}
                    alt={player.username}
                    className="w-7 h-7 rounded-md bg-nebula-850 shrink-0 border border-nebula-800"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = STEVE_AVATAR_SVG;
                    }}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-200 font-mono truncate">
                        {player.username}
                      </span>
                      {player.isOp && (
                        <span className="text-[9px] font-mono font-bold px-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                          OP
                        </span>
                      )}
                    </div>
                    {player.joinedAt && (
                      <span className="text-[10px] text-slate-500 block font-mono tabular-nums">
                        {new Date(player.joinedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Player Admin Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  {player.isOp ? (
                    <button
                      disabled={actionInProgress === player.username}
                      onClick={() => handleDeop(player.username)}
                      title="Quitar permisos de operador (/deop)"
                      className="p-1 rounded text-amber-400 hover:bg-amber-950/30 transition-colors disabled:opacity-40"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      disabled={actionInProgress === player.username}
                      onClick={() => handleOp(player.username)}
                      title="Otorgar permisos de operador (/op)"
                      className="p-1 rounded text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/30 transition-colors disabled:opacity-40"
                    >
                      <Shield className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    disabled={actionInProgress === player.username}
                    onClick={() => handleKick(player.username)}
                    title="Expulsar jugador (/kick)"
                    className="p-1 rounded text-slate-400 hover:text-orange-400 hover:bg-orange-950/30 transition-colors disabled:opacity-40"
                  >
                    <UserMinus className="w-3.5 h-3.5" />
                  </button>

                  <button
                    disabled={actionInProgress === player.username}
                    onClick={() => handleBan(player.username)}
                    title="Banear jugador (/ban)"
                    className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition-colors disabled:opacity-40"
                  >
                    <UserX className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Quick Gamemode Pills */}
              <div className="flex items-center justify-between pt-1 border-t border-nebula-900 text-[9px] font-mono">
                <span className="text-slate-500">Modo:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleGamemode(player.username, 'survival')}
                    className="px-1.5 py-0.5 rounded bg-nebula-900 hover:bg-nebula-800 text-slate-400 hover:text-emerald-400 border border-nebula-800 transition-colors"
                    title="Cambiar a Supervivencia"
                  >
                    SURV
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGamemode(player.username, 'creative')}
                    className="px-1.5 py-0.5 rounded bg-nebula-900 hover:bg-nebula-800 text-slate-400 hover:text-nebula-cyber border border-nebula-800 transition-colors"
                    title="Cambiar a Creativo"
                  >
                    CREA
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGamemode(player.username, 'spectator')}
                    className="px-1.5 py-0.5 rounded bg-nebula-900 hover:bg-nebula-800 text-slate-400 hover:text-purple-400 border border-nebula-800 transition-colors"
                    title="Cambiar a Espectador"
                  >
                    SPEC
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
