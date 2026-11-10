import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import ssh2 from 'ssh2';
import type { AuthService } from '../../auth-identity/services/auth-service.js';
import type { UserRole } from '../../auth-identity/models/user.js';
import { SftpPathResolver } from './sftp-path-resolver.js';
import { SftpSessionHandler } from './sftp-session-handler.js';

const { Server } = ssh2;

export interface SftpServerOptions {
  authService: AuthService;
  port?: number;
  host?: string;
  rootDir?: string;
  hostKeyPath?: string;
}

export class SftpServer {
  private readonly authService: AuthService;
  private readonly port: number;
  private readonly host: string;
  private readonly rootDir: string;
  private readonly hostKeyPath: string;
  private readonly pathResolver: SftpPathResolver;

  private server: any = null;
  private running = false;
  private activeClients = new Set<any>();

  constructor(options: SftpServerOptions) {
    this.authService = options.authService;
    this.port = options.port ?? (parseInt(process.env['SINGULARITY_SFTP_PORT'] || '2022', 10));
    this.host = options.host ?? (process.env['SINGULARITY_SFTP_HOST'] || '0.0.0.0');
    this.rootDir = path.resolve(options.rootDir ?? (process.env['SINGULARITY_SERVERS_DIR'] || 'data/servers'));
    this.hostKeyPath = path.resolve(options.hostKeyPath ?? 'data/ssh_host_rsa_key');
    this.pathResolver = new SftpPathResolver(this.rootDir);
  }

  get isRunning(): boolean {
    return this.running;
  }

  getPort(): number {
    return this.port;
  }

  getRootDir(): string {
    return this.rootDir;
  }

  private getOrCreateHostKey(): string {
    if (fs.existsSync(this.hostKeyPath)) {
      return fs.readFileSync(this.hostKeyPath, 'utf8');
    }

    const hostKeyDir = path.dirname(this.hostKeyPath);
    if (!fs.existsSync(hostKeyDir)) {
      fs.mkdirSync(hostKeyDir, { recursive: true });
    }

    const { privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
    });

    fs.writeFileSync(this.hostKeyPath, privateKey, { mode: 0o600 });
    return privateKey;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    // Ensure root directory exists
    if (!fs.existsSync(this.rootDir)) {
      fs.mkdirSync(this.rootDir, { recursive: true });
    }

    const hostKey = this.getOrCreateHostKey();

    return new Promise<void>((resolve, reject) => {
      this.server = new Server({ hostKeys: [hostKey] }, (client: any) => {
        this.activeClients.add(client);

        let authenticatedUser: { username: string; role: UserRole; allowedServers: string[] } | null = null;

        client.on('error', () => {
          // Suppress unhandled socket resets from disconnected clients
        });

        client.on('authentication', async (ctx: any) => {
          if (ctx.method !== 'password') {
            return ctx.reject(['password']);
          }

          try {
            const loginResult = await this.authService.login(ctx.username, ctx.password);
            authenticatedUser = {
              username: loginResult.user.username,
              role: loginResult.user.role,
              allowedServers: loginResult.user.allowedServers || ['*']
            };
            ctx.accept();
          } catch {
            ctx.reject();
          }
        });

        client.on('ready', () => {
          if (!authenticatedUser) {
            return client.end();
          }

          const user = authenticatedUser;

          client.on('session', (acceptSession: any) => {
            const session = acceptSession();

            session.on('sftp', (acceptSftp: any) => {
              const sftpStream = acceptSftp();
              const sessionHandler = new SftpSessionHandler({
                username: user.username,
                role: user.role,
                allowedServers: user.allowedServers,
                pathResolver: this.pathResolver
              });
              sessionHandler.attach(sftpStream);
            });
          });
        });

        client.on('close', () => {
          this.activeClients.delete(client);
        });
      });

      this.server.on('error', (err: Error) => {
        if (!this.running) {
          reject(err);
        }
      });

      this.server.listen(this.port, this.host, () => {
        this.running = true;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.running || !this.server) {
      return;
    }

    // Terminate all connected clients
    for (const client of this.activeClients) {
      try {
        client.end();
      } catch {
        // Ignore
      }
    }
    this.activeClients.clear();

    return new Promise<void>((resolve) => {
      this.server.close(() => {
        this.running = false;
        this.server = null;
        resolve();
      });
    });
  }
}
