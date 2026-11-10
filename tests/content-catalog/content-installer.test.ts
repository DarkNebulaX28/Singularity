import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { ContentInstallerService } from '../../src/content-catalog/services/content-installer.js';
import type { InstallContentRequest } from '../../src/content-catalog/models/catalog-item.js';

function createMockStream(content: Buffer): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(content);
      controller.close();
    }
  });
}

describe('ContentInstallerService', () => {
  const testServersDir = path.join(process.cwd(), 'data', 'test-catalog-servers');
  const instanceId = 'srv_test_installer';
  const instanceDir = path.join(testServersDir, instanceId);

  let installer: ContentInstallerService;

  beforeEach(async () => {
    try {
      await fs.rm(testServersDir, { recursive: true, force: true });
    } catch {}
    await fs.mkdir(path.join(instanceDir, 'mods'), { recursive: true });
    await fs.mkdir(path.join(instanceDir, 'plugins'), { recursive: true });
    await fs.mkdir(path.join(instanceDir, 'datapacks'), { recursive: true });

    installer = new ContentInstallerService(testServersDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(testServersDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup
    }
  });

  it('should install a server mod into mods/ folder and record it in singularity-manifest.json', async () => {
    const mockFileContent = Buffer.from('mock-jar-content');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: createMockStream(mockFileContent)
    } as unknown as Response);

    const request: InstallContentRequest = {
      instanceId,
      providerId: 'modrinth',
      projectId: 'fabric-api',
      projectType: 'mod',
      versionId: 'ver_01',
      versionNumber: '0.92.0',
      fileName: 'fabric-api-0.92.0.jar',
      downloadUrl: 'https://example.com/fabric-api-0.92.0.jar',
      hashes: {
        sha1: 'test-sha1'
      }
    };

    const installed = await installer.install(request);

    expect(installed.fileName).toBe('fabric-api-0.92.0.jar');
    expect(installed.projectType).toBe('mod');

    // Check file on disk
    const targetFile = path.join(instanceDir, 'mods', 'fabric-api-0.92.0.jar');
    const exists = await fs
      .access(targetFile)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);

    // Check manifest
    const manifest = await installer.getManifest(instanceId);
    expect(manifest.installedItems.length).toBe(1);
    expect(manifest.installedItems[0]?.fileName).toBe('fabric-api-0.92.0.jar');
  });

  it('should reject a client-only mod on dedicated server with an informative error', async () => {
    const request: InstallContentRequest = {
      instanceId,
      providerId: 'modrinth',
      projectId: 'sodium',
      projectType: 'mod',
      versionId: 'ver_sodium',
      versionNumber: '0.5.8',
      fileName: 'sodium-fabric-0.5.8.jar',
      downloadUrl: 'https://example.com/sodium-fabric-0.5.8.jar'
    };

    await expect(installer.install(request)).rejects.toThrow(
      /es exclusivo de cliente/
    );
  });

  it('should automatically route mods and plugins to plugins/ folder on a Paper server instance', async () => {
    // Write Paper server metadata
    await fs.writeFile(
      path.join(instanceDir, 'singularity-instance.json'),
      JSON.stringify({ loader: 'paper', gameVersion: '1.21.4' })
    );

    const mockFileContent = Buffer.from('mock-auraskills-content');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: createMockStream(mockFileContent)
    } as unknown as Response);

    // Request comes with projectType: 'mod' (like Modrinth categorizes AuraSkills)
    const request: InstallContentRequest = {
      instanceId,
      providerId: 'modrinth',
      projectId: 'uDdZAVls',
      projectType: 'mod',
      versionId: '9rSJ3THD',
      versionNumber: '2.4.0',
      fileName: 'AuraSkills-2.4.0.jar',
      downloadUrl: 'https://cdn.modrinth.com/data/uDdZAVls/versions/9rSJ3THD/AuraSkills-2.4.0.jar'
    };

    const installed = await installer.install(request);

    // Check that it was placed in plugins/ and not mods/
    const pluginPath = path.join(instanceDir, 'plugins', 'AuraSkills-2.4.0.jar');
    const modPath = path.join(instanceDir, 'mods', 'AuraSkills-2.4.0.jar');

    const inPlugins = await fs.access(pluginPath).then(() => true).catch(() => false);
    const inMods = await fs.access(modPath).then(() => true).catch(() => false);

    expect(inPlugins).toBe(true);
    expect(inMods).toBe(false);
    expect(installed.projectType).toBe('plugin');
  });

  it('should uninstall an item, delete its file and remove from manifest', async () => {
    const mockFileContent = Buffer.from('mock-plugin-content');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: createMockStream(mockFileContent)
    } as unknown as Response);

    const request: InstallContentRequest = {
      instanceId,
      providerId: 'modrinth',
      projectId: 'plugin_01',
      projectType: 'plugin',
      versionId: 'v1',
      versionNumber: '1.0.0',
      fileName: 'viaversion.jar',
      downloadUrl: 'https://example.com/viaversion.jar'
    };

    await installer.install(request);
    let manifest = await installer.getManifest(instanceId);
    expect(manifest.installedItems.length).toBe(1);

    // Uninstall
    await installer.uninstall(instanceId, 'plugin_01');
    manifest = await installer.getManifest(instanceId);
    expect(manifest.installedItems.length).toBe(0);

    const fileStillExists = await fs
      .access(path.join(instanceDir, 'plugins', 'viaversion.jar'))
      .then(() => true)
      .catch(() => false);
    expect(fileStillExists).toBe(false);
  });

  it('should discover custom user-uploaded .jar files on disk and allow uninstalling them', async () => {
    // Manually place custom plugin and mod on disk
    await fs.writeFile(path.join(instanceDir, 'plugins', 'CustomAuth.jar'), 'custom-auth-bytes');
    await fs.writeFile(path.join(instanceDir, 'mods', 'CustomWeaponMod.jar'), 'custom-weapon-bytes');

    const manifest = await installer.getManifest(instanceId);
    const customPlugin = manifest.installedItems.find((i) => i.fileName === 'CustomAuth.jar');
    const customMod = manifest.installedItems.find((i) => i.fileName === 'CustomWeaponMod.jar');

    expect(customPlugin).toBeDefined();
    expect(customPlugin?.providerId).toBe('custom');
    expect(customPlugin?.projectType).toBe('plugin');
    expect(customPlugin?.versionNumber).toBe('Personalizado');

    expect(customMod).toBeDefined();
    expect(customMod?.providerId).toBe('custom');
    expect(customMod?.projectType).toBe('mod');
    expect(customMod?.versionNumber).toBe('Personalizado');

    // Uninstall custom plugin
    await installer.uninstall(instanceId, customPlugin!.projectId);
    const manifestAfter = await installer.getManifest(instanceId);
    expect(manifestAfter.installedItems.some((i) => i.fileName === 'CustomAuth.jar')).toBe(false);

    const pluginExists = await fs
      .access(path.join(instanceDir, 'plugins', 'CustomAuth.jar'))
      .then(() => true)
      .catch(() => false);
    expect(pluginExists).toBe(false);
  });

  it('should block SSRF download URLs targeting localhost or private networks (SEC-03)', async () => {
    const ssrfRequest: InstallContentRequest = {
      instanceId,
      providerId: 'modrinth',
      projectId: 'ssrf-test',
      projectType: 'mod',
      versionId: 'v1',
      versionNumber: '1.0.0',
      fileName: 'mod.jar',
      downloadUrl: 'http://127.0.0.1:8080/internal-secret.jar'
    };

    await expect(installer.install(ssrfRequest)).rejects.toThrow(/No se permiten descargas desde direcciones locales o redes privadas/);

    const metadataRequest: InstallContentRequest = {
      ...ssrfRequest,
      downloadUrl: 'http://169.254.169.254/latest/meta-data/'
    };

    await expect(installer.install(metadataRequest)).rejects.toThrow(/No se permiten descargas desde direcciones locales o redes privadas/);
  });

  it('should sanitize path traversal sequences in fileName during install (SEC-03)', async () => {
    const mockFileContent = Buffer.from('safe-content');
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: createMockStream(mockFileContent)
    } as unknown as Response);

    const request: InstallContentRequest = {
      instanceId,
      providerId: 'modrinth',
      projectId: 'traversal-test',
      projectType: 'mod',
      versionId: 'v1',
      versionNumber: '1.0.0',
      fileName: '../../escaped.jar',
      downloadUrl: 'https://example.com/escaped.jar'
    };

    const installed = await installer.install(request);
    expect(installed.fileName).toBe('escaped.jar');

    const safePath = path.join(instanceDir, 'mods', 'escaped.jar');
    const existsInMods = await fs.access(safePath).then(() => true).catch(() => false);
    expect(existsInMods).toBe(true);
  });
});
