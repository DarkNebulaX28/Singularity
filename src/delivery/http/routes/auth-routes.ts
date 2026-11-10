import type { FastifyPluginAsync } from 'fastify';
import type { AuthService } from '../../../auth-identity/services/auth-service.js';
import { createAuthHook, requireRole } from '../middleware/auth-hook.js';
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UpdateProfileRequest
} from '../../../auth-identity/models/user.js';

export interface AuthRoutesOptions {
  authService: AuthService;
}

interface LoginAttemptRecord {
  failures: number;
  resetAt: number;
}

const LOGIN_WINDOW_MS = 60_000;
const MAX_FAILED_ATTEMPTS = 10;

export const authRoutes: FastifyPluginAsync<AuthRoutesOptions> = async (fastify, opts) => {
  const { authService } = opts;
  const authenticate = createAuthHook(authService);
  const loginAttempts = new Map<string, LoginAttemptRecord>();

  // Public: Login (with Brute-Force Rate Limiting)
  fastify.post<{
    Body: { username: string; password: string };
  }>('/login', async (request, reply) => {
    const { username, password } = request.body || {};
    if (!username || !password) {
      return reply.status(400).send({ error: 'Usuario y contraseña requeridos' });
    }

    const clientIp = request.ip || 'unknown';
    const rateKey = `${clientIp}:${username.toLowerCase()}`;
    const now = Date.now();
    const record = loginAttempts.get(rateKey);

    if (record && now < record.resetAt && record.failures >= MAX_FAILED_ATTEMPTS) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      return reply.status(429).send({
        error: `Demasiados intentos fallidos de inicio de sesión. Intenta nuevamente en ${retryAfterSec} segundos.`
      });
    }

    try {
      const result = await authService.login(username, password);
      loginAttempts.delete(rateKey);
      return reply.status(200).send(result);
    } catch (err: unknown) {
      const current = loginAttempts.get(rateKey);
      if (!current || now >= current.resetAt) {
        loginAttempts.set(rateKey, { failures: 1, resetAt: now + LOGIN_WINDOW_MS });
      } else {
        current.failures += 1;
      }

      const message = err instanceof Error ? err.message : 'Error de autenticación';
      return reply.status(401).send({ error: message });
    }
  });

  // Protected: Current user profile
  fastify.get('/me', { preHandler: [authenticate] }, async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'No autenticado' });
    }

    const user = authService.getUserById(request.user.userId);
    if (!user) {
      return reply.status(404).send({ error: 'Usuario no encontrado' });
    }

    return reply.status(200).send({
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      isActive: user.isActive,
      displayName: user.displayName,
      minecraftUsername: user.minecraftUsername,
      allowedServers: user.allowedServers,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  });

  // Protected: Update own user profile (Display Name, Minecraft skin nickname)
  fastify.put<{
    Body: UpdateProfileRequest;
  }>('/me', { preHandler: [authenticate] }, async (request, reply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'No autenticado' });
    }

    try {
      const updated = await authService.updateProfile(request.user.userId, request.body || {});
      return reply.status(200).send(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al actualizar perfil';
      return reply.status(400).send({ error: message });
    }
  });

  // Protected: Change password
  fastify.post<{
    Body: { userId: string; currentPassword: string; newPassword: string };
  }>('/change-password', { preHandler: [authenticate] }, async (request, reply) => {
    const { userId, currentPassword, newPassword } = request.body || {};
    if (!userId || !currentPassword || !newPassword) {
      return reply.status(400).send({ error: 'Todos los campos son requeridos' });
    }

    // Only allow changing own password unless ADMIN
    if (request.user?.role !== 'ADMIN' && request.user?.userId !== userId) {
      return reply.status(403).send({ error: 'No autorizado para cambiar contraseñas de otros usuarios' });
    }

    try {
      await authService.changePassword(userId, currentPassword, newPassword);
      return reply.status(200).send({ message: 'Contraseña actualizada exitosamente' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al cambiar contraseña';
      return reply.status(400).send({ error: message });
    }
  });

  // Protected (ADMIN only): List users
  fastify.get(
    '/users',
    { preHandler: [authenticate, requireRole(['ADMIN'])] },
    async (_request, reply) => {
      const users = authService.listUsers();
      return reply.status(200).send(users);
    }
  );

  // Protected (ADMIN only): Create user
  fastify.post<{
    Body: CreateUserRequest;
  }>(
    '/users',
    { preHandler: [authenticate, requireRole(['ADMIN'])] },
    async (request, reply) => {
      try {
        const created = await authService.createUser(request.body);
        return reply.status(201).send(created);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al crear usuario';
        return reply.status(400).send({ error: message });
      }
    }
  );

  // Protected (ADMIN only): Update user (Role, Active Status, Server Permissions, Password Reset)
  fastify.put<{
    Params: { id: string };
    Body: UpdateUserRequest;
  }>(
    '/users/:id',
    { preHandler: [authenticate, requireRole(['ADMIN'])] },
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({ error: 'No autenticado' });
      }

      try {
        const updated = await authService.updateUser(request.user.userId, request.params.id, request.body || {});
        return reply.status(200).send(updated);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al actualizar usuario';
        return reply.status(400).send({ error: message });
      }
    }
  );

  // Protected (ADMIN only): Delete user
  fastify.delete<{
    Params: { id: string };
  }>(
    '/users/:id',
    { preHandler: [authenticate, requireRole(['ADMIN'])] },
    async (request, reply) => {
      if (!request.user) {
        return reply.status(401).send({ error: 'No autenticado' });
      }

      try {
        await authService.deleteUser(request.user.userId, request.params.id);
        return reply.status(200).send({ success: true, message: 'Usuario eliminado exitosamente' });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al eliminar usuario';
        return reply.status(400).send({ error: message });
      }
    }
  );
};
