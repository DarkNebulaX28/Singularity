import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { ServerLifecycleService } from '../../src/servers/services/server-lifecycle.js';
import { FileManagerService } from '../../src/file-manager/services/file-manager-service.js';

describe('FileManager Domain > FileManagerService', () => {
  const testDir = path.resolve('data/test-file-manager-suite');
  let lifecycle: ServerLifecycleService;
  let service: FileManagerService;
  let instanceId: string;

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    lifecycle = new ServerLifecycleService(testDir);
    service = new FileManagerService(lifecycle);

    const inst = await lifecycle.createInstance({
      name: 'SMP File Test',
      loader: 'paper',
      gameVersion: '1.20.4'
    });
    instanceId = inst.id;

    // Create some test structure
    const instanceDir = lifecycle.getInstanceDir(instanceId);
    await fs.writeFile(path.join(instanceDir, 'config.yml'), 'server-name: Test SMP\nport: 25565', 'utf8');
    await fs.mkdir(path.join(instanceDir, 'plugins', 'MyPlugin'), { recursive: true });
    await fs.writeFile(
      path.join(instanceDir, 'plugins', 'MyPlugin', 'plugin.yml'),
      'name: MyPlugin\nversion: 1.0.0',
      'utf8'
    );
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  it('should list files in root directory with directories sorted first', async () => {
    const items = await service.listFiles(instanceId);
    expect(items.length).toBeGreaterThan(0);

    // Verify directories come first
    const firstNonDirIndex = items.findIndex((i) => !i.isDirectory);
    if (firstNonDirIndex !== -1) {
      for (let i = 0; i < firstNonDirIndex; i++) {
        expect(items[i]?.isDirectory).toBe(true);
      }
    }

    const configItem = items.find((i) => i.name === 'config.yml');
    expect(configItem).toBeDefined();
    expect(configItem?.isDirectory).toBe(false);
    expect(configItem?.extension).toBe('yml');
  });

  it('should list files in subdirectories', async () => {
    const items = await service.listFiles(instanceId, 'plugins/MyPlugin');
    expect(items.length).toBe(1);
    expect(items[0]?.name).toBe('plugin.yml');
    expect(items[0]?.relativePath).toBe('plugins/MyPlugin/plugin.yml');
  });

  it('should throw security error on path traversal attempts', () => {
    expect(() => service.resolveSafePath(instanceId, '../../secret.txt')).toThrow('Acceso denegado');
    expect(() => service.resolveSafePath(instanceId, '../another-server')).toThrow('Acceso denegado');
    expect(() => service.resolveSafePath(instanceId, `../${instanceId}-fake/file.txt`)).toThrow('Acceso denegado');
    expect(() => service.resolveSafePath(instanceId, 'config.yml\0.exe')).toThrow('Acceso denegado');
  });

  it('should read and write text file contents', async () => {
    const read = await service.readFileContent(instanceId, 'config.yml');
    expect(read.content).toContain('server-name: Test SMP');

    await service.writeFileContent(instanceId, 'config.yml', 'server-name: Updated SMP\nport: 25565');

    const updated = await service.readFileContent(instanceId, 'config.yml');
    expect(updated.content).toBe('server-name: Updated SMP\nport: 25565');
  });

  it('should create new folder and rename files', async () => {
    await service.createDirectory(instanceId, 'world_nether');
    let items = await service.listFiles(instanceId);
    expect(items.some((i) => i.name === 'world_nether')).toBe(true);

    await service.rename(instanceId, 'config.yml', 'config-backup.yml');
    items = await service.listFiles(instanceId);
    expect(items.some((i) => i.name === 'config-backup.yml')).toBe(true);
    expect(items.some((i) => i.name === 'config.yml')).toBe(false);
  });

  it('should delete files and directories safely without touching server root', async () => {
    await service.deleteFileOrDirectory(instanceId, 'plugins/MyPlugin');
    const plugins = await service.listFiles(instanceId, 'plugins');
    expect(plugins.some((i) => i.name === 'MyPlugin')).toBe(false);

    // Attempting to delete server root throws
    await expect(service.deleteFileOrDirectory(instanceId, '')).rejects.toThrow('No se puede eliminar la raíz');
  });

  it('should save file streams and binary buffers safely', async () => {
    const { Readable } = await import('node:stream');
    const stream = Readable.from([Buffer.from('binary-jar-payload-123')]);

    const streamRes = await service.saveFileStream(instanceId, 'plugins/TestPlugin.jar', stream);
    expect(streamRes.bytesWritten).toBe(Buffer.from('binary-jar-payload-123').length);

    const bufferPayload = Buffer.from('buffer-mod-payload-456');
    const bufRes = await service.saveFileBuffer(instanceId, 'mods/TestMod.jar', bufferPayload);
    expect(bufRes.bytesWritten).toBe(bufferPayload.length);

    const plugins = await service.listFiles(instanceId, 'plugins');
    expect(plugins.some((p) => p.name === 'TestPlugin.jar')).toBe(true);

    const mods = await service.listFiles(instanceId, 'mods');
    expect(mods.some((m) => m.name === 'TestMod.jar')).toBe(true);
  });

  it('should copy files and directories, compress to ZIP, and extract ZIP safely', async () => {
    await service.copyFileOrDirectory(instanceId, 'config.yml', 'config_copy.yml');
    const copied = await service.readFileContent(instanceId, 'config_copy.yml');
    expect(copied.content).toContain('server-name: Test SMP');

    const zipRes = await service.compressToZip(
      instanceId,
      ['config.yml', 'plugins/MyPlugin'],
      'pack_test.zip'
    );
    expect(zipRes.zipPath).toBe('pack_test.zip');
    expect(zipRes.sizeBytes).toBeGreaterThan(0);

    const extracted = await service.extractZip(instanceId, 'pack_test.zip', 'extracted_folder');
    expect(extracted.extractedCount).toBeGreaterThanOrEqual(2);

    const extractedConfig = await service.readFileContent(instanceId, 'extracted_folder/config.yml');
    expect(extractedConfig.content).toContain('server-name: Test SMP');
  });

  it('should export editable workspace bundle for live IDE sync', async () => {
    const bundle = await service.exportEditableWorkspace(instanceId);
    expect(bundle.some((f) => f.relativePath === 'config.yml')).toBe(true);
    expect(bundle.some((f) => f.relativePath === 'plugins/MyPlugin/plugin.yml')).toBe(true);
  });
});
