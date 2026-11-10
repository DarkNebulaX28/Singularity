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
    } else if (query.projectType === 'datapack') {
      // On Modrinth, datapacks (including hybrid mod+datapack projects like Terralith, Incendium, Tectonic)
      // use either project_type:datapack or categories:datapack.
      facets.push(['project_type:datapack', 'categories:datapack']);
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
      } else if (cleanLoader === 'datapack' || cleanLoader === 'vanilla') {
        facets.push(['project_type:datapack', 'categories:datapack']);
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
    const isRequestingMod =
      query.projectType === 'mod' ||
      Boolean(query.loader && MOD_LOADERS.includes(query.loader.toLowerCase()));
    const isRequestingDatapack =
      query.projectType === 'datapack' ||
      query.loader?.toLowerCase() === 'datapack' ||
      query.loader?.toLowerCase() === 'vanilla';

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
        const isDatapackCategory =
          hit.project_type === 'datapack' ||
          hit.categories?.some((c) => c.toLowerCase() === 'datapack');

        let effectiveProjectType = (hit.project_type ?? 'mod') as ProjectType;
        if (isRequestingDatapack && isDatapackCategory) {
          effectiveProjectType = 'datapack';
        } else if (isRequestingPlugin && isPluginCategory) {
          effectiveProjectType = 'plugin';
        } else if (isRequestingMod && isModCategory) {
          effectiveProjectType = 'mod';
        } else if (effectiveProjectType === 'mod' && isPluginCategory && !isModCategory) {
          effectiveProjectType = 'plugin';
        } else if (effectiveProjectType === 'mod' && isDatapackCategory && !isModCategory && !isPluginCategory) {
          effectiveProjectType = 'datapack';
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
    const isDatapackLoader = cleanLoader === 'datapack' || cleanLoader === 'vanilla';

    // Expand loader filter list according to target engine ecosystem:
    // - Plugin servers (Paper/Purpur/Spigot) match Bukkit/Spigot/Paper/Purpur/Folia plugin builds
    // - Datapack/Vanilla requests match 'datapack' builds (.zip)
    // - Mod servers (Fabric/NeoForge/Forge/Quilt) match that specific mod loader
    const loaderFilterList = isPluginLoader
      ? ['paper', 'purpur', 'spigot', 'bukkit', 'folia']
      : isDatapackLoader
      ? ['datapack']
      : isModLoader && cleanLoader
      ? cleanLoader === 'quilt'
        ? ['quilt', 'fabric']
        : [cleanLoader]
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
    // This ensures:
    // - A Paper/Spigot server NEVER falls back to downloading a Fabric/NeoForge mod JAR.
    // - A Fabric/NeoForge/Forge server NEVER falls back to downloading a Bukkit plugin or wrong mod loader JAR.
    // - A Datapack request NEVER falls back to downloading a .jar mod instead of the .zip datapack.
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

    // Fallback 2: Only if still empty (e.g., universal packages), fetch all versions and filter by compatible ecosystem
    if (versions.length === 0 && (gameVersion || loaderFilterList)) {
      const fallbackUrl = `${this.baseUrl}/project/${encodeURIComponent(projectId)}/version`;
      const fallbackRes = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'NebulaX-Singularity/0.1.0 (contact@nebulax.dev)'
        }
      });
      if (fallbackRes.ok) {
        const allVersions = (await fallbackRes.json()) as ModrinthVersionResponse[];
        if (isDatapackLoader) {
          const datapackCompatible = allVersions.filter(
            (v) =>
              v.loaders?.some((l) => l.toLowerCase() === 'datapack') ||
              v.files?.some((f) => f.filename.toLowerCase().endsWith('.zip'))
          );
          versions = datapackCompatible.length > 0 ? datapackCompatible : allVersions;
        } else if (isPluginLoader) {
          const pluginCompatible = allVersions.filter((v) =>
            v.loaders?.some((l) => PLUGIN_LOADERS.includes(l.toLowerCase()))
          );
          versions = pluginCompatible.length > 0 ? pluginCompatible : allVersions;
        } else if (isModLoader && cleanLoader) {
          const modCompatible = allVersions.filter((v) =>
            v.loaders?.some(
              (l) =>
                l.toLowerCase() === cleanLoader ||
                (cleanLoader === 'quilt' && l.toLowerCase() === 'fabric')
            )
          );
          versions = modCompatible.length > 0 ? modCompatible : allVersions;
        } else {
          versions = allVersions;
        }
      }
    }

    return versions.map((v) => {
      // Prefer .zip file when requesting a datapack, or .jar when requesting a mod/plugin
      const preferredFile = isDatapackLoader
        ? v.files.find((f) => f.filename.toLowerCase().endsWith('.zip'))
        : isPluginLoader || isModLoader
        ? v.files.find((f) => f.filename.toLowerCase().endsWith('.jar') && f.primary) ??
          v.files.find((f) => f.filename.toLowerCase().endsWith('.jar'))
        : undefined;
      const primaryFile = preferredFile ?? v.files.find((f) => f.primary) ?? v.files[0];

      const dependencies: VersionDependency[] = (v.dependencies ?? [])
        .filter((d) => d.project_id !== null)
        .map((d) => ({
          projectId: d.project_id!,
          versionId: d.version_id ?? undefined,
          dependencyType: d.dependency_type
        }));

      const fallbackExt = isDatapackLoader ? 'zip' : 'jar';

      return {
        id: v.id,
        projectId: v.project_id,
        name: v.name,
        versionNumber: v.version_number,
        gameVersions: v.game_versions,
        loaders: v.loaders,
        fileName: primaryFile?.filename ?? `${v.name}.${fallbackExt}`,
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
