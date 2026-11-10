import type { IContentProvider } from './content-provider.interface.js';
import type {
  CatalogItem,
  CatalogSearchQuery,
  CatalogSearchResult,
  ContentVersion,
  ProjectType,
  VersionDependency
} from '../models/catalog-item.js';
import { isClientOnlyMod } from '../services/client-mod-filter.js';

interface ModrinthSearchHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  categories: string[];
  client_side?: string;
  server_side?: string;
  project_type: string;
  downloads: number;
  icon_url: string | null;
  author: string;
}

interface ModrinthVersionFile {
  url: string;
  filename: string;
  primary: boolean;
  size: number;
  hashes: {
    sha1?: string;
    sha512?: string;
  };
}

interface ModrinthVersionDependency {
  project_id: string | null;
  version_id: string | null;
  dependency_type: 'required' | 'optional' | 'incompatible';
}

interface ModrinthVersionResponse {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: ModrinthVersionFile[];
  dependencies: ModrinthVersionDependency[];
}

const PLUGIN_LOADERS = ['paper', 'purpur', 'spigot', 'bukkit', 'folia', 'bungeecord', 'velocity'];
const MOD_LOADERS = ['fabric', 'forge', 'neoforge', 'quilt'];

export class ModrinthProvider implements IContentProvider {
  readonly id = 'modrinth';
  readonly name = 'Modrinth';
  readonly isEnabled = true;

  private readonly baseUrl = 'https://api.modrinth.com/v2';

  async search(query: CatalogSearchQuery): Promise<CatalogSearchResult> {
    const params = new URLSearchParams();
    params.set('query', query.query);
    params.set('limit', String(query.limit ?? 20));
    params.set('offset', String(query.offset ?? 0));

    // Construct facets
    const facets: string[][] = [];

    if (query.projectType === 'plugin') {
      // On Modrinth, plugins (including dual mod/plugin projects like Chunky, WorldEdit, LuckPerms)
      // are identified by their server plugin loader categories.
      facets.push([
        'categories:paper',
        'categories:spigot',
        'categories:bukkit',
        'categories:purpur',
        'categories:folia'
      ]);
    } else if (query.projectType === 'mod') {
      facets.push(['project_type:mod']);
      facets.push([
        'categories:fabric',
        'categories:forge',
        'categories:neoforge',
        'categories:quilt'
      ]);
    } else if (query.projectType) {
      facets.push([`project_type:${query.projectType}`]);
    }

    if (query.loader) {
      const cleanLoader = query.loader.toLowerCase();
      if (PLUGIN_LOADERS.includes(cleanLoader)) {
        facets.push([
          'categories:paper',
          'categories:spigot',
          'categories:bukkit',
          'categories:purpur',
          'categories:folia'
        ]);
      } else {
        facets.push([`categories:${cleanLoader}`]);
      }
    }

    if (query.gameVersion) {
      facets.push([`versions:${query.gameVersion}`]);
    }

    if (facets.length > 0) {
      params.set('facets', JSON.stringify(facets));
    }

    const res = await fetch(`${this.baseUrl}/search?${params.toString()}`, {
      headers: {
        'User-Agent': 'NebulaX-Singularity/0.1.0 (contact@nebulax.dev)'
      }
    });

    if (!res.ok) {
      throw new Error(`Error al consultar Modrinth API (HTTP ${res.status})`);
    }

    const data = (await res.json()) as { hits: ModrinthSearchHit[]; total_hits: number };

    const isRequestingPlugin =
      query.projectType === 'plugin' ||
      Boolean(query.loader && PLUGIN_LOADERS.includes(query.loader.toLowerCase()));

    const items: CatalogItem[] = data.hits
      .filter((hit) => {
        // Exclude client-only mods from dedicated server catalog
        if (hit.server_side === 'unsupported') return false;
        if (isClientOnlyMod(hit.slug) || isClientOnlyMod(hit.title)) return false;
        return true;
      })
      .map((hit) => {
        const isPluginCategory = hit.categories?.some((c) =>
          PLUGIN_LOADERS.includes(c.toLowerCase())
        );
        const isModCategory = hit.categories?.some((c) =>
          MOD_LOADERS.includes(c.toLowerCase())
        );

        let effectiveProjectType = (hit.project_type ?? 'mod') as ProjectType;
        if (isRequestingPlugin && isPluginCategory) {
          effectiveProjectType = 'plugin';
        } else if (effectiveProjectType === 'mod' && isPluginCategory && !isModCategory) {
          effectiveProjectType = 'plugin';
        }

        return {
          id: hit.project_id,
          slug: hit.slug,
          title: hit.title,
          description: hit.description,
          projectType: effectiveProjectType,
          categories: hit.categories ?? [],
          downloads: hit.downloads ?? 0,
          iconUrl: hit.icon_url ?? undefined,
          author: hit.author,
          providerId: this.id
        };
      });

    return {
      items,
      totalHits: items.length,
      offset: query.offset ?? 0,
      limit: query.limit ?? 20
    };
  }

  async getVersions(
    projectId: string,
    gameVersion?: string,
    loader?: string
  ): Promise<ContentVersion[]> {
    const cleanLoader = loader?.toLowerCase().trim();
    const isPluginLoader = Boolean(cleanLoader && PLUGIN_LOADERS.includes(cleanLoader));
    const isModLoader = Boolean(cleanLoader && MOD_LOADERS.includes(cleanLoader));

    // Expand plugin loaders so a Paper/Purpur/Spigot server matches Bukkit/Spigot/Paper plugin JARs (e.g. Chunky-Bukkit)
    const loaderFilterList = isPluginLoader
      ? ['paper', 'purpur', 'spigot', 'bukkit', 'folia']
      : cleanLoader
      ? [cleanLoader]
      : undefined;

    const params = new URLSearchParams();
    if (gameVersion) {
      params.set('game_versions', JSON.stringify([gameVersion]));
    }
    if (loaderFilterList) {
      params.set('loaders', JSON.stringify(loaderFilterList));
    }

    const url = `${this.baseUrl}/project/${encodeURIComponent(projectId)}/version?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'NebulaX-Singularity/0.1.0 (contact@nebulax.dev)'
      }
    });

    if (!res.ok) {
      throw new Error(`Error al obtener versiones de Modrinth para ${projectId} (HTTP ${res.status})`);
    }

    let versions = (await res.json()) as ModrinthVersionResponse[];

    // Fallback 1: If exact gameVersion + loader returned 0 results, keep the loader filter and relax only gameVersion!
    // This ensures a Paper/Spigot server NEVER falls back to downloading a Fabric/NeoForge mod JAR.
    if (versions.length === 0 && gameVersion && loaderFilterList) {
      const loaderOnlyParams = new URLSearchParams();
      loaderOnlyParams.set('loaders', JSON.stringify(loaderFilterList));
      const loaderFallbackUrl = `${this.baseUrl}/project/${encodeURIComponent(projectId)}/version?${loaderOnlyParams.toString()}`;
      const loaderFallbackRes = await fetch(loaderFallbackUrl, {
        headers: {
          'User-Agent': 'NebulaX-Singularity/0.1.0 (contact@nebulax.dev)'
        }
      });
      if (loaderFallbackRes.ok) {
        versions = (await loaderFallbackRes.json()) as ModrinthVersionResponse[];
      }
    }

    // Fallback 2: Only if still empty (e.g., datapacks or universal packages), fetch all versions and filter incompatible loaders
    if (versions.length === 0 && (gameVersion || loaderFilterList)) {
      const fallbackUrl = `${this.baseUrl}/project/${encodeURIComponent(projectId)}/version`;
      const fallbackRes = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'NebulaX-Singularity/0.1.0 (contact@nebulax.dev)'
        }
      });
      if (fallbackRes.ok) {
        const allVersions = (await fallbackRes.json()) as ModrinthVersionResponse[];
        if (isPluginLoader) {
          const pluginCompatible = allVersions.filter((v) =>
            v.loaders?.some((l) => PLUGIN_LOADERS.includes(l.toLowerCase()))
          );
          versions = pluginCompatible.length > 0 ? pluginCompatible : allVersions;
        } else if (isModLoader && cleanLoader) {
          const modCompatible = allVersions.filter((v) =>
            v.loaders?.some((l) => l.toLowerCase() === cleanLoader)
          );
          versions = modCompatible.length > 0 ? modCompatible : allVersions;
        } else {
          versions = allVersions;
        }
      }
    }

    return versions.map((v) => {
      const primaryFile = v.files.find((f) => f.primary) ?? v.files[0];

      const dependencies: VersionDependency[] = (v.dependencies ?? [])
        .filter((d) => d.project_id !== null)
        .map((d) => ({
          projectId: d.project_id!,
          versionId: d.version_id ?? undefined,
          dependencyType: d.dependency_type
        }));

      return {
        id: v.id,
        projectId: v.project_id,
        name: v.name,
        versionNumber: v.version_number,
        gameVersions: v.game_versions,
        loaders: v.loaders,
        fileName: primaryFile?.filename ?? `${v.name}.jar`,
        downloadUrl: primaryFile?.url ?? '',
        size: primaryFile?.size ?? 0,
        hashes: {
          sha1: primaryFile?.hashes?.sha1,
          sha512: primaryFile?.hashes?.sha512
        },
        dependencies
      };
    });
  }
}
