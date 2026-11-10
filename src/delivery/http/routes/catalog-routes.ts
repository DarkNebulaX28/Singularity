import type { FastifyPluginAsync } from 'fastify';
import type { IContentProvider } from '../../../content-catalog/providers/content-provider.interface.js';
import type { CurseForgeProvider } from '../../../content-catalog/providers/curseforge-provider.js';
import type { ContentInstallerService } from '../../../content-catalog/services/content-installer.js';
import type { AuthService } from '../../../auth-identity/services/auth-service.js';
import { createAuthHook, requireRole, hasServerAccess } from '../middleware/auth-hook.js';
import type {
  CatalogSearchQuery,
  InstallContentRequest,
  ProjectType
} from '../../../content-catalog/models/catalog-item.js';

export interface CatalogRoutesOptions {
  providers: Map<string, IContentProvider>;
  installer: ContentInstallerService;
  authService: AuthService;
}

export const catalogRoutes: FastifyPluginAsync<CatalogRoutesOptions> = async (fastify, opts) => {
  const { providers, installer, authService } = opts;
  const authenticate = createAuthHook(authService);

  fastify.addHook('preHandler', authenticate);

  // List all catalog providers and their availability status
  fastify.get('/providers', async (_request, reply) => {
    const list = Array.from(providers.values()).map((p) => ({
      id: p.id,
      name: p.name,
      isEnabled: p.isEnabled
    }));
    return reply.status(200).send(list);
  });

  // Get CurseForge key status
  fastify.get('/curseforge-key', async (_request, reply) => {
    const cf = providers.get('curseforge') as CurseForgeProvider | undefined;
    return reply.status(200).send({
      isConfigured: cf?.isEnabled ?? false,
      masked: cf?.getMaskedKey() ?? null
    });
  });

  // Save CurseForge key directly from Web UI (ADMIN, OPERATOR)
  fastify.post<{
    Body: { apiKey: string };
  }>('/curseforge-key', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    const { apiKey } = request.body || {};
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return reply.status(400).send({ error: 'La API Key no puede estar vacía' });
    }

    const cf = providers.get('curseforge') as CurseForgeProvider | undefined;
    if (!cf) {
      return reply.status(500).send({ error: 'Proveedor CurseForge no encontrado' });
    }

    await cf.setApiKey(apiKey);
    return reply.status(200).send({
      ok: true,
      message: 'API Key de CurseForge guardada exitosamente',
      masked: cf.getMaskedKey()
    });
  });

  // Search catalog across providers
  fastify.get<{
    Querystring: {
      query?: string;
      projectType?: ProjectType;
      gameVersion?: string;
      loader?: string;
      provider?: string;
      limit?: string;
      offset?: string;
    };
  }>('/search', async (request, reply) => {
    const {
      query,
      projectType,
      gameVersion,
      loader,
      provider: providerId = 'modrinth',
      limit,
      offset
    } = request.query;

    const provider = providers.get(providerId);
    if (!provider) {
      return reply.status(400).send({
        error: `Proveedor '${providerId}' no registrado. Disponibles: ${Array.from(providers.keys()).join(', ')}`
      });
    }

    if (!provider.isEnabled) {
      return reply.status(400).send({
        error: `El proveedor '${providerId}' no está configurado (falta API Key)`
      });
    }

    const searchQuery: CatalogSearchQuery = {
      query: query || '',
      projectType,
      gameVersion,
      loader,
      limit: limit ? parseInt(limit, 10) : 20,
      offset: offset ? parseInt(offset, 10) : 0
    };

    try {
      const results = await provider.search(searchQuery);
      return reply.status(200).send(results);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al buscar en catálogo';
      return reply.status(500).send({ error: message });
    }
  });

  // Get available versions for a specific project
  fastify.get<{
    Params: { providerId: string; projectId: string };
    Querystring: { gameVersion?: string; loader?: string };
  }>('/versions/:providerId/:projectId', async (request, reply) => {
    const { providerId, projectId } = request.params;
    const { gameVersion, loader } = request.query;

    const provider = providers.get(providerId);
    if (!provider) {
      return reply.status(400).send({
        error: `Proveedor '${providerId}' no registrado. Disponibles: ${Array.from(providers.keys()).join(', ')}`
      });
    }

    if (!provider.isEnabled) {
      return reply.status(400).send({
        error: `El proveedor '${providerId}' no está configurado (falta API Key)`
      });
    }

    try {
      const versions = await provider.getVersions(projectId, gameVersion, loader);
      return reply.status(200).send(versions);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al obtener versiones de contenido';
      return reply.status(500).send({ error: message });
    }
  });

  // Get installed manifest for an instance
  fastify.get<{
    Params: { instanceId: string };
  }>('/installed/:instanceId', async (request, reply) => {
    if (!hasServerAccess(request.user, request.params.instanceId)) {
      return reply.status(403).send({ error: 'Acceso denegado: No tienes permisos sobre este servidor' });
    }
    const manifest = await installer.getManifest(request.params.instanceId);
    return reply.status(200).send(manifest);
  });

  // Install content item (OPERATOR, ADMIN)
  fastify.post<{
    Body: InstallContentRequest;
  }>('/install', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    if (!hasServerAccess(request.user, request.body?.instanceId)) {
      return reply.status(403).send({ error: 'Acceso denegado: No tienes permisos sobre este servidor' });
    }
    try {
      const installed = await installer.install(request.body);
      return reply.status(200).send(installed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al instalar contenido';
      return reply.status(500).send({ error: message });
    }
  });

  // Uninstall content item (OPERATOR, ADMIN)
  fastify.delete<{
    Params: { instanceId: string; projectId: string };
  }>('/installed/:instanceId/:projectId', { preHandler: [requireRole(['ADMIN', 'OPERATOR'])] }, async (request, reply) => {
    const { instanceId, projectId } = request.params;
    if (!hasServerAccess(request.user, instanceId)) {
      return reply.status(403).send({ error: 'Acceso denegado: No tienes permisos sobre este servidor' });
    }
    try {
      await installer.uninstall(instanceId, projectId);
      return reply.status(200).send({ message: `Elemento ${projectId} desinstalado correctamente` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al desinstalar contenido';
      return reply.status(500).send({ error: message });
    }
  });
};
