import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ModrinthProvider } from '../../src/content-catalog/providers/modrinth-provider.js';

describe('ModrinthProvider', () => {
  let provider: ModrinthProvider;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    provider = new ModrinthProvider();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should search projects, filter out client-only mods, and format into standardized CatalogItem', async () => {
    const mockResponse = {
      hits: [
        {
          project_id: 'P7dR8mSH',
          slug: 'fabric-api',
          title: 'Fabric API',
          description: 'Essential core library for Fabric mods',
          categories: ['fabric'],
          client_side: 'optional',
          server_side: 'required',
          project_type: 'mod',
          downloads: 90000000,
          icon_url: 'https://cdn.modrinth.com/data/P7dR8mSH/icon.png',
          author: 'modmuss50'
        },
        {
          project_id: 'AANobbMI',
          slug: 'sodium',
          title: 'Sodium',
          description: 'A modern rendering engine and client-side optimization mod',
          categories: ['optimization'],
          client_side: 'required',
          server_side: 'unsupported',
          project_type: 'mod',
          downloads: 45000000,
          icon_url: 'https://cdn.modrinth.com/data/AANobbMI/icon.png',
          author: 'jellysquid3'
        }
      ],
      total_hits: 2
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse
    } as Response);

    const result = await provider.search({
      query: 'api',
      projectType: 'mod',
      loader: 'fabric',
      gameVersion: '1.21.4'
    });

    // Sodium should be filtered out because it is client-only (server_side: unsupported)
    expect(result.items.length).toBe(1);
    const item = result.items[0];
    expect(item?.id).toBe('P7dR8mSH');
    expect(item?.slug).toBe('fabric-api');
    expect(item?.title).toBe('Fabric API');
    expect(item?.projectType).toBe('mod');
    expect(item?.downloads).toBe(90000000);
    expect(item?.iconUrl).toBe('https://cdn.modrinth.com/data/P7dR8mSH/icon.png');
    expect(item?.author).toBe('modmuss50');
  });

  it('should fetch project versions filtered by game version and loader', async () => {
    const mockVersions = [
      {
        id: 'ver_01',
        project_id: 'P7dR8mSH',
        name: 'Fabric API 0.92.0',
        version_number: '0.92.0',
        game_versions: ['1.21.4'],
        loaders: ['fabric'],
        files: [
          {
            url: 'https://cdn.modrinth.com/data/P7dR8mSH/versions/ver_01/fabric-api-0.92.0.jar',
            filename: 'fabric-api-0.92.0.jar',
            primary: true,
            size: 1540000,
            hashes: {
              sha1: 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
              sha512: 'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e'
            }
          }
        ],
        dependencies: []
      }
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockVersions
    } as Response);

    const versions = await provider.getVersions('P7dR8mSH', '1.21.4', 'fabric');

    expect(versions.length).toBe(1);
    expect(versions[0]?.id).toBe('ver_01');
    expect(versions[0]?.versionNumber).toBe('0.92.0');
    expect(versions[0]?.downloadUrl).toBe(
      'https://cdn.modrinth.com/data/P7dR8mSH/versions/ver_01/fabric-api-0.92.0.jar'
    );
  });

  it('should resolve dual mod+plugin projects like Chunky as plugin and preserve Bukkit/Paper loader filter on fallback', async () => {
    // 1. Test search with projectType: 'plugin'
    const mockSearchResponse = {
      hits: [
        {
          project_id: 'fALzjamp',
          slug: 'chunky',
          title: 'Chunky',
          description: 'Pre-generates chunks, quickly, efficiently, and safely',
          categories: ['bukkit', 'fabric', 'folia', 'forge', 'neoforge', 'paper', 'purpur', 'quilt', 'spigot'],
          client_side: 'optional',
          server_side: 'required',
          project_type: 'mod', // Modrinth stores dual projects as project_type: "mod"
          downloads: 12000000,
          icon_url: 'https://cdn.modrinth.com/data/fALzjamp/icon.png',
          author: 'pop4959'
        }
      ],
      total_hits: 1
    };

    const fetchMock = vi.fn()
      // Call 1: search({ query: 'chunky', projectType: 'plugin' })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse
      } as Response)
      // Call 2: getVersions('fALzjamp', '26.3', 'paper') -> exact version '26.3' returns empty
      .mockResolvedValueOnce({
        ok: true,
        json: async () => []
      } as Response)
      // Call 3: Fallback 1 preserves loaders=['paper','purpur','spigot','bukkit','folia'] and returns Chunky-Bukkit
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'ver_chunky_bukkit',
            project_id: 'fALzjamp',
            name: 'Chunky 1.4.27 (Bukkit/Paper)',
            version_number: '1.4.27',
            game_versions: ['1.21', '1.21.1', '1.21.4'],
            loaders: ['bukkit', 'spigot', 'paper', 'purpur', 'folia'],
            files: [
              {
                url: 'https://cdn.modrinth.com/data/fALzjamp/versions/ver_chunky_bukkit/Chunky-Bukkit-1.4.27.jar',
                filename: 'Chunky-Bukkit-1.4.27.jar',
                primary: true,
                size: 420000
              }
            ],
            dependencies: []
          }
        ]
      } as Response);

    globalThis.fetch = fetchMock;

    const searchResult = await provider.search({
      query: 'chunky',
      projectType: 'plugin'
    });

    expect(searchResult.items.length).toBe(1);
    expect(searchResult.items[0]?.slug).toBe('chunky');
    expect(searchResult.items[0]?.projectType).toBe('plugin');

    const versions = await provider.getVersions('fALzjamp', '26.3', 'paper');
    expect(versions.length).toBe(1);
    expect(versions[0]?.fileName).toBe('Chunky-Bukkit-1.4.27.jar');
    expect(versions[0]?.loaders).toContain('paper');

    // Verify Fallback 1 URL still included the plugin loaders parameter
    const fallbackCallUrl = String(fetchMock.mock.calls[2]?.[0] || '');
    expect(fallbackCallUrl).toContain('loaders=');
    expect(fallbackCallUrl).toContain('bukkit');
    expect(fallbackCallUrl).not.toContain('game_versions=');
  });
});
