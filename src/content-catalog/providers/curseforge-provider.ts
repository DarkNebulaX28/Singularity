import path from 'node:path';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import type { IContentProvider } from './content-provider.interface.js';
import type {
  CatalogItem,
  CatalogSearchQuery,
  CatalogSearchResult,
  ContentVersion,
  ProjectType
} from '../models/catalog-item.js';
import { isClientOnlyMod } from '../services/client-mod-filter.js';

interface CurseForgeCategory {
  id: number;
  name: string;
  slug: string;
}

interface CurseForgeModHit {
  id: number;
  name: string;
  slug: string;
  summary: string;
  downloadCount: number;
  classId?: number;
  categories?: CurseForgeCategory[];
  logo?: {
    url: string;
  };
  authors?: { name: string }[];
}

export class CurseForgeProvider implements IContentProvider {
  readonly id = 'curseforge';
  readonly name = 'CurseForge';

  private readonly baseUrl = 'https://api.curseforge.com/v1';
  private readonly keyFilePath: string;
  private currentApiKey: string | undefined;

  constructor(
    initialKey: string | undefined = process.env.CURSEFORGE_API_KEY,
    dataDir: string = path.join(process.cwd(), 'data')
  ) {
    this.keyFilePath = path.join(dataDir, 'curseforge-key.txt');
    this.currentApiKey = initialKey;
    this.loadPersistedKey();
  }

  private loadPersistedKey(): void {
    try {
      if (fs.existsSync(this.keyFilePath)) {
        const fileContent = fs.readFileSync(this.keyFilePath, 'utf8').trim();
        if (fileContent.length > 0) {
          this.currentApiKey = fileContent;
        }
      }
    } catch {
      // Ignore read error on startup
    }
  }

  async setApiKey(key: string): Promise<void> {
    const cleaned = key.trim().replace(/^["']|["']$/g, '').trim();
    this.currentApiKey = cleaned;
    await fsPromises.mkdir(path.dirname(this.keyFilePath), { recursive: true });
    await fsPromises.writeFile(this.keyFilePath, cleaned, 'utf8');
  }

  get cleanApiKey(): string | undefined {
    // 1. In-memory or persisted file
    if (this.currentApiKey) {
      const cleaned = this.currentApiKey.trim().replace(/^["']|["']$/g, '').trim();
      if (cleaned.length > 0) return cleaned;
    }

    // 2. Base64 environment variable (immune to $ or # bash parsing)
    if (process.env.CURSEFORGE_API_KEY_BASE64) {
      try {
        const decoded = Buffer.from(process.env.CURSEFORGE_API_KEY_BASE64, 'base64').toString('utf8').trim();
        if (decoded.length > 0) return decoded;
      } catch {}
    }

    // 3. Regular environment variable
    if (process.env.CURSEFORGE_API_KEY) {
      const cleaned = process.env.CURSEFORGE_API_KEY.trim().replace(/^["']|["']$/g, '').trim();
      if (cleaned.length > 0) return cleaned;
    }

    return undefined;
  }

  get isEnabled(): boolean {
    return Boolean(this.cleanApiKey);
  }

  getMaskedKey(): string | null {
    const key = this.cleanApiKey;
    if (!key) return null;
    if (key.length <= 8) return '****';
    return `${key.slice(0, 4)}...${key.slice(-4)} (${key.length} caracteres)`;
  }

  private format403Error(errBody: string): string {
    const key = this.cleanApiKey || '';
    const isTruncated = key.length < 30 || !key.startsWith('$2a$');

    if (isTruncated) {
      return (
        `CurseForge rechazó la API Key (HTTP 403 Forbidden: ${errBody || 'API Key missing or invalid'}). ` +
        `Detectamos que la clave recibida por el servidor parece truncada o incompleta (longitud: ${key.length} caracteres). ` +
        `Si tu clave original empieza por '$2a$10$', en Coolify o docker-compose debes escapar los signos de dólar ` +
        `escribiendo '$$2a$$10$' para evitar que Docker Compose los reemplace como variables vacías.`
      );
    }

    return (
      `CurseForge rechazó la API Key (HTTP 403 Forbidden: ${errBody || 'API Key missing or invalid'}). ` +
      `Verifica que la clave corresponda a una aplicación creada en https://console.curseforge.com/ ` +
      `y que no tenga restricciones de IP o esté deshabilitada.`
    );
  }

  async search(query: CatalogSearchQuery): Promise<CatalogSearchResult> {
    const apiKey = this.cleanApiKey;
    if (!apiKey) {
      return {
        items: [],
        totalHits: 0,
        offset: 0,
        limit: 0
      };
    }

    const params = new URLSearchParams();
    params.set('gameId', '432'); // Minecraft Game ID
    params.set('searchFilter', query.query);
    params.set('pageSize', String(query.limit ?? 20));
    params.set('index', String(query.offset ?? 0));

    // CurseForge classIds: 6 = Mods, 4471 = Modpacks, 5 = Bukkit Plugins, 6945 = Datapacks
    if (query.projectType === 'modpack') {
      params.set('classId', '4471');
    } else if (query.projectType === 'plugin') {
      params.set('classId', '5');
    } else if (query.projectType === 'datapack') {
      params.set('classId', '6945');
    } else if (query.projectType === 'mod') {
      params.set('classId', '6');
    }

    if (query.gameVersion) {
      params.set('gameVersion', query.gameVersion);
    }

    const res = await fetch(`${this.baseUrl}/mods/search?${params.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NebulaX-Singularity/0.1.0 (contact@nebulaxstudio.top)',
        'x-api-key': apiKey
      }
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      if (res.status === 403) {
        throw new Error(this.format403Error(errBody));
      }
      throw new Error(`Error al consultar CurseForge API (HTTP ${res.status}): ${errBody}`);
    }

    const data = (await res.json()) as {
      data: CurseForgeModHit[];
      pagination: { totalCount: number };
    };

    const resolveProjectType = (hit: CurseForgeModHit): ProjectType => {
      if (hit.classId === 4471) return 'modpack';
      if (hit.classId === 5) return 'plugin';
      if (hit.classId === 6945) return 'datapack';
      if (hit.classId === 6) return 'mod';
      return (query.projectType ?? 'mod') as ProjectType;
    };

    const items: CatalogItem[] = data.data
      .filter((mod) => !isClientOnlyMod(mod.slug) && !isClientOnlyMod(mod.name))
      .map((mod) => ({
        id: String(mod.id),
        slug: mod.slug,
        title: mod.name,
        description: mod.summary,
        projectType: resolveProjectType(mod),
        categories: mod.categories?.map((c) => c.name) ?? [],
        downloads: mod.downloadCount,
        iconUrl: mod.logo?.url,
        author: mod.authors?.[0]?.name ?? 'CurseForge Author',
        providerId: this.id
      }));

    return {
      items,
      totalHits: data.pagination.totalCount,
      offset: query.offset ?? 0,
      limit: query.limit ?? 20
    };
  }

  async getVersions(
    projectId: string,
    gameVersion?: string,
    loader?: string
  ): Promise<ContentVersion[]> {
    const apiKey = this.cleanApiKey;
    if (!apiKey) {
      return [];
    }

    const url = `${this.baseUrl}/mods/${encodeURIComponent(projectId)}/files`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NebulaX-Singularity/0.1.0 (contact@nebulaxstudio.top)',
        'x-api-key': apiKey
      }
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      if (res.status === 403) {
        throw new Error(this.format403Error(errBody));
      }
      throw new Error(`Error al obtener versiones de CurseForge para ${projectId} (HTTP ${res.status}): ${errBody}`);
    }

    interface CurseForgeFile {
      id: number;
      modId: number;
      displayName: string;
      fileName: string;
      fileLength: number;
      downloadUrl: string | null;
      gameVersions: string[];
      hashes: { value: string; algo: number }[];
    }

    const data = (await res.json()) as { data: CurseForgeFile[] };
    let files = data.data ?? [];

    // Sort descending by file id (latest uploads first)
    files.sort((a, b) => b.id - a.id);

    // Optional loader filter with graceful fallback
    if (loader) {
      const cleanLoader = loader.toLowerCase();
      const isPlugin = ['paper', 'purpur', 'spigot', 'bukkit', 'folia'].includes(cleanLoader);
      const matchingLoader = files.filter((f) => {
        const gvLower = (f.gameVersions ?? []).map((g) => g.toLowerCase());
        const fnLower = f.fileName.toLowerCase();
        if (isPlugin) {
          const hasPluginTag = gvLower.some((g) => ['bukkit', 'spigot', 'paper', 'purpur', 'folia'].includes(g)) ||
            fnLower.includes('bukkit') || fnLower.includes('paper') || fnLower.includes('spigot');
          const hasOnlyModTag = (fnLower.includes('fabric') || fnLower.includes('neoforge') || fnLower.includes('forge')) && !hasPluginTag;
          return hasPluginTag || !hasOnlyModTag;
        }
        return gvLower.includes(cleanLoader) || fnLower.includes(cleanLoader);
      });
      if (matchingLoader.length > 0) {
        files = matchingLoader;
      }
    }

    // Optional gameVersion filter with graceful fallback
    if (gameVersion) {
      const matching = files.filter((f) => f.gameVersions?.includes(gameVersion));
      if (matching.length > 0) {
        files = matching;
      }
    }

    return files.map((f) => {
      // CurseForge Edge CDN fallback if direct downloadUrl is null
      const downloadUrl =
        f.downloadUrl ||
        `https://edge.forgecdn.net/files/${Math.floor(f.id / 1000)}/${f.id % 1000}/${encodeURIComponent(f.fileName)}`;

      const knownLoaders = ['fabric', 'forge', 'neoforge', 'quilt', 'bukkit', 'spigot', 'paper', 'purpur'];
      const detectedLoaders = (f.gameVersions ?? [])
        .map((g) => g.toLowerCase())
        .filter((g) => knownLoaders.includes(g));

      return {
        id: String(f.id),
        projectId,
        name: f.displayName,
        versionNumber: String(f.id),
        gameVersions: f.gameVersions ?? [],
        loaders: detectedLoaders,
        fileName: f.fileName,
        downloadUrl,
        size: f.fileLength,
        hashes: {
          sha1: f.hashes?.find((h) => h.algo === 1)?.value
        },
        dependencies: []
      };
    });
  }

  async getFilesByIds(fileIds: number[]): Promise<{ id: number; fileName: string; downloadUrl: string }[]> {
    const apiKey = this.cleanApiKey;
    if (!apiKey || fileIds.length === 0) return [];

    const chunkSize = 100;
    const results: { id: number; fileName: string; downloadUrl: string }[] = [];

    for (let i = 0; i < fileIds.length; i += chunkSize) {
      const chunk = fileIds.slice(i, i + chunkSize);
      try {
        const res = await fetch(`${this.baseUrl}/mods/files`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'NebulaX-Singularity/0.1.0 (contact@nebulaxstudio.top)',
            'x-api-key': apiKey
          },
          body: JSON.stringify({ fileIds: chunk })
        });

        if (res.ok) {
          const data = (await res.json()) as {
            data: { id: number; fileName: string; downloadUrl: string | null }[];
          };
          for (const f of data.data || []) {
            const downloadUrl =
              f.downloadUrl ||
              `https://edge.forgecdn.net/files/${Math.floor(f.id / 1000)}/${f.id % 1000}/${encodeURIComponent(f.fileName)}`;
            results.push({
              id: f.id,
              fileName: f.fileName,
              downloadUrl
            });
          }
        }
      } catch {
        // Continue with other chunks
      }
    }

    return results;
  }
}
