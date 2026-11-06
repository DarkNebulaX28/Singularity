import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { buildServer } from '../../src/delivery/http/server.js';
import type { FastifyInstance } from 'fastify';

describe('Delivery API > Backups & File Manager Endpoints', () => {
  const testDir = path.resolve('data/test-backups-files-api');
  const dbPath = path.resolve('data/test-bf-auth.db');
  let app: FastifyInstance;
  let token: string;
  let serverId: string;

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });

    app = await buildServer({
      serversDir: testDir,
      dbPath,
      jwtSecret: 'test-secret'
    });

    // Login default admin
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { username: 'admin', password: 'singularity' }
    });
    token = loginRes.json().token;

    // Create server instance
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/servers',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: 'Survival SMP',
        loader: 'paper',
        gameVersion: '1.20.4'
      }
    });
    serverId = createRes.json().id;
  });

  afterEach(async () => {
    await app.close();
    try {
      await fs.rm(testDir, { recursive: true, force: true });
      await fs.rm(dbPath, { force: true });
    } catch {}
  });

  describe('File Manager API', () => {
    it('should list root directory files and create new directory', async () => {
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/servers/${serverId}/files`,
        headers: { authorization: `Bearer ${token}` }
      });
      expect(listRes.statusCode).toBe(200);
      const items = listRes.json();
      expect(Array.isArray(items)).toBe(true);

      // Create new directory
      const mkdirRes = await app.inject({
        method: 'POST',
        url: `/api/servers/${serverId}/files/mkdir`,
        headers: { authorization: `Bearer ${token}` },
        payload: { path: 'custom-configs' }
      });
      expect(mkdirRes.statusCode).toBe(201);
    });

    it('should read, write, and rename text files', async () => {
      // Write file
      const writeRes = await app.inject({
        method: 'PUT',
        url: `/api/servers/${serverId}/files/content`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          path: 'rules.txt',
          content: '1. No griefing\n2. Have fun'
        }
      });
      expect(writeRes.statusCode).toBe(200);

      // Read file
      const readRes = await app.inject({
        method: 'GET',
        url: `/api/servers/${serverId}/files/content?path=rules.txt`,
        headers: { authorization: `Bearer ${token}` }
      });
      expect(readRes.statusCode).toBe(200);
      expect(readRes.json().content).toContain('1. No griefing');

      // Rename file
      const renameRes = await app.inject({
        method: 'POST',
        url: `/api/servers/${serverId}/files/rename`,
        headers: { authorization: `Bearer ${token}` },
        payload: {
          oldPath: 'rules.txt',
          newPath: 'server-rules.txt'
        }
      });
      expect(renameRes.statusCode).toBe(200);

      // Delete file
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/servers/${serverId}/files?path=server-rules.txt`,
        headers: { authorization: `Bearer ${token}` }
      });
      expect(delRes.statusCode).toBe(200);
    });

    it('should upload files via multipart/form-data to destination folder', async () => {
      const boundary = '----WebKitFormBoundaryUploadTest123';
      const fileContent = 'custom-plugin-binary-data';
      const payload = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="files"; filename="CustomPlugin.jar"',
        'Content-Type: application/java-archive',
        '',
        fileContent,
        `--${boundary}--`
      ].join('\r\n');

      const uploadRes = await app.inject({
        method: 'POST',
        url: `/api/servers/${serverId}/files/upload?path=plugins`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': `multipart/form-data; boundary=${boundary}`
        },
        payload
      });

      expect(uploadRes.statusCode).toBe(201);
      const data = uploadRes.json();
      expect(data.files).toBeDefined();
      expect(data.files.length).toBe(1);
      expect(data.files[0].filename).toBe('CustomPlugin.jar');
      expect(data.files[0].path).toBe('plugins/CustomPlugin.jar');

      // Verify file is present via list files
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/servers/${serverId}/files?path=plugins`,
        headers: { authorization: `Bearer ${token}` }
      });
      expect(listRes.statusCode).toBe(200);
      const files = listRes.json();
      expect(files.some((f: any) => f.name === 'CustomPlugin.jar')).toBe(true);
    });
  });

  describe('Backups API', () => {
    it('should create backup, list backups, and delete backup', async () => {
      // Create backup
      const createBkp = await app.inject({
        method: 'POST',
        url: `/api/servers/${serverId}/backups`,
        headers: { authorization: `Bearer ${token}` },
        payload: { comment: 'Pre-event backup' }
      });
      expect(createBkp.statusCode).toBe(201);
      const backup = createBkp.json();
      expect(backup.id).toBeDefined();
      expect(backup.comment).toBe('Pre-event backup');

      // List backups
      const listBkp = await app.inject({
        method: 'GET',
        url: `/api/servers/${serverId}/backups`,
        headers: { authorization: `Bearer ${token}` }
      });
      expect(listBkp.statusCode).toBe(200);
      expect(listBkp.json().length).toBe(1);

      // Delete backup
      const delBkp = await app.inject({
        method: 'DELETE',
        url: `/api/servers/${serverId}/backups/${backup.id}`,
        headers: { authorization: `Bearer ${token}` }
      });
      expect(delBkp.statusCode).toBe(200);
      expect(delBkp.json().success).toBe(true);
    });
  });
});
