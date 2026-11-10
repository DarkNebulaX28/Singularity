import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthService } from '../../../auth-identity/services/auth-service.js';
import type { AuthTokenPayload, UserRole } from '../../../auth-identity/models/user.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthTokenPayload;
  }
}

export function createAuthHook(authService: AuthService) {
  return async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    let token: string | undefined;

    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else if (request.method === 'GET' && request.url.includes('/download')) {
      const query = request.query as { token?: string } | undefined;
      if (query?.token && typeof query.token === 'string') {
        token = query.token.trim();
      }
    }

    if (!token) {
      reply.status(401).send({ error: 'Acceso no autorizado: Token no proporcionado' });
      return;
    }

    try {
      const payload = authService.verifyToken(token);

      // Verify live user status in DB if user record exists (revokes disabled accounts immediately)
      const dbUser = authService.getUserById(payload.userId);
      if (dbUser) {
        if (dbUser.isActive === false) {
          reply.status(403).send({ error: 'Acceso denegado: Esta cuenta ha sido deshabilitada' });
          return;
        }
        payload.role = dbUser.role;
        payload.allowedServers = dbUser.allowedServers || ['*'];
      }

      request.user = payload;
    } catch {
      reply.status(401).send({ error: 'Token de sesión inválido o expirado' });
      return;
    }
  };
}

export function requireRole(allowedRoles: UserRole[]) {
  return async function checkRole(request: FastifyRequest, reply: FastifyReply) {
    if (!request.user) {
      reply.status(401).send({ error: 'Acceso no autorizado' });
      return;
    }

    if (!allowedRoles.includes(request.user.role)) {
      reply.status(403).send({ error: 'Acceso denegado: Permisos insuficientes' });
      return;
    }
  };
}

export function hasServerAccess(user: AuthTokenPayload | undefined, serverId: string): boolean {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  const allowed = user.allowedServers || ['*'];
  return allowed.includes('*') || allowed.includes(serverId);
}
