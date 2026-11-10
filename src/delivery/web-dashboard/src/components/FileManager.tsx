import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as monaco from 'monaco-editor';
import Editor, { loader, type OnMount } from '@monaco-editor/react';
import YAML from 'yaml';
import {
  Folder,
  File,
  FileText,
  FileCode,
  FileArchive,
  Download,
  Trash2,
  Edit3,
  ArrowLeft,
  RotateCw,
  Search,
  Check,
  X,
  AlertCircle,
  AlertTriangle,
  Save,
  FolderPlus,
  FilePlus,
  Code2,
  ChevronDown,
  FolderOpen,
  Upload,
  Copy,
  Archive,
  PackageOpen,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  Terminal,
  WrapText,
  Map as MapIcon,
  Sparkles,
  ExternalLink,
  LayoutList
} from 'lucide-react';
import { api } from '../services/api-client.js';
import { useDialog } from '../context/DialogContext.js';

// Configure Monaco to use the locally bundled VS Code engine (100% offline-ready for Desktop & Web)
loader.config({ monaco });

export interface FileItemData {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  sizeBytes: number;
  modifiedAt: string;
  extension: string;
}

interface OpenEditorTab {
  path: string;
  name: string;
  extension: string;
  content: string;
  originalContent: string;
  isTruncated: boolean;
  sizeBytes: number;
  cursorLine: number;
  cursorColumn: number;
}

interface SyntaxDiagnostic {
  valid: boolean;
  message?: string;
  line?: number;
  column?: number;
}

interface ContextMenuState {
  x: number;
  y: number;
  item: FileItemData;
}

interface FileManagerProps {
  serverId: string;
}

const FILE_TEMPLATES: Record<string, { label: string; ext: string; content: string }> = {
  empty: { label: 'Archivo vacío', ext: '', content: '' },
  yaml: {
    label: 'Configuración Plugin YAML (.yml)',
    ext: '.yml',
    content: `# Configuración generada en Singularity Studio\nenabled: true\ndebug: false\nsettings:\n  prefix: "&b[Singularity]&r "\n  max-items: 50\n`
  },
  json: {
    label: 'Archivo JSON (.json)',
    ext: '.json',
    content: `{\n  "enabled": true,\n  "version": "1.0.0"\n}\n`
  },
  properties: {
    label: 'Propiedades Minecraft (.properties)',
    ext: '.properties',
    content: `# Minecraft properties file\nmotd=Un servidor impulsado por Singularity\npvp=true\nmax-players=20\n`
  },
  toml: {
    label: 'Configuración Mod TOML (.toml)',
    ext: '.toml',
    content: `# Configuración TOML\n[general]\nenabled = true\nmaxConnections = 20\n`
  }
};

function detectMonacoLanguage(filename: string, ext: string): string {
  const lowerName = filename.toLowerCase();
  const cleanExt = ext.toLowerCase();
  if (cleanExt === 'yml' || cleanExt === 'yaml') return 'yaml';
  if (cleanExt === 'json' || cleanExt === 'mcmeta') return 'json';
  if (cleanExt === 'properties' || cleanExt === 'cfg' || cleanExt === 'conf' || cleanExt === 'ini' || cleanExt === 'env') return 'ini';
  if (cleanExt === 'toml') return 'ini';
  if (cleanExt === 'js' || cleanExt === 'mjs' || cleanExt === 'cjs') return 'javascript';
  if (cleanExt === 'ts') return 'typescript';
  if (cleanExt === 'java') return 'java';
  if (cleanExt === 'xml' || cleanExt === 'html') return 'xml';
  if (cleanExt === 'sh' || cleanExt === 'bash') return 'shell';
  if (cleanExt === 'bat' || cleanExt === 'cmd') return 'bat';
  if (cleanExt === 'md' || cleanExt === 'markdown') return 'markdown';
  if (cleanExt === 'sql') return 'sql';
  if (cleanExt === 'lua') return 'lua';
  if (lowerName === 'eula.txt') return 'ini';
  return 'plaintext';
}

function validateFileSyntax(content: string, ext: string): SyntaxDiagnostic {
  const cleanExt = ext.toLowerCase();
  if (!content.trim()) return { valid: true };

  if (cleanExt === 'json' || cleanExt === 'mcmeta') {
    try {
      JSON.parse(content);
      return { valid: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'JSON inválido';
      const posMatch = msg.match(/position\s+(\d+)/i);
      let line = 1;
      let column = 1;
      if (posMatch && posMatch[1]) {
        const idx = parseInt(posMatch[1], 10);
        const upTo = content.slice(0, idx);
        const lines = upTo.split('\n');
        line = lines.length;
        column = (lines[lines.length - 1]?.length ?? 0) + 1;
      }
      return {
        valid: false,
        message: `Error de sintaxis JSON: ${msg}`,
        line,
        column
      };
    }
  }

  if (cleanExt === 'yml' || cleanExt === 'yaml') {
    try {
      YAML.parse(content, { strict: false });
      return { valid: true };
    } catch (err: any) {
      const linePos = err?.linePos?.[0];
      return {
        valid: false,
        message: `Error YAML: ${err?.message?.split('\n')[0] || 'Sintaxis YAML inválida'}`,
        line: linePos?.line || 1,
        column: linePos?.col || 1
      };
    }
  }

  return { valid: true };
}

export const FileManager: React.FC<FileManagerProps> = ({ serverId }) => {
  const { confirm } = useDialog();
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<FileItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // View Mode: 'explorer' (table + multi-actions) or 'ide' (full VS Code / Antigravity Workbench)
  const [viewMode, setViewMode] = useState<'explorer' | 'ide'>('explorer');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isZenFullscreen, setIsZenFullscreen] = useState(false);

  // Monaco Editor Multi-Tab State
  const [openTabs, setOpenTabs] = useState<OpenEditorTab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Monaco Editor Preferences
  const [showMinimap, setShowMinimap] = useState(true);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');
  const [fontSize, setFontSize] = useState<number>(13);
  const editorInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  // Multi-selection in Explorer
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Modals
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isNewFileOpen, setIsNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('empty');
  const [renamingItem, setRenamingItem] = useState<FileItemData | null>(null);
  const [renameTargetName, setRenameTargetName] = useState('');
  const [isCompressModalOpen, setIsCompressModalOpen] = useState(false);
  const [zipOutputName, setZipOutputName] = useState('archivo.zip');

  // Context Menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Upload State & Drag Drop
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Desktop IDE Bridge Integration
  const isDesktop =
    typeof window !== 'undefined' &&
    (Boolean((window as any).singularityDesktop?.isElectron) ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');
  const [availableIdes, setAvailableIdes] = useState<Array<{ id: string; name: string; isAvailable: boolean }>>([]);
  const [isIdeMenuOpen, setIsIdeMenuOpen] = useState(false);
  const [ideFeedbackMsg, setIdeFeedbackMsg] = useState<string | null>(null);
  const ideMenuRef = useRef<HTMLDivElement>(null);

  const activeTab = useMemo(
    () => openTabs.find((t) => t.path === activeTabPath) || null,
    [openTabs, activeTabPath]
  );

  const activeDiagnostic = useMemo<SyntaxDiagnostic>(() => {
    if (!activeTab) return { valid: true };
    return validateFileSyntax(activeTab.content, activeTab.extension);
  }, [activeTab]);

  // Update Monaco markers when diagnostic changes
  useEffect(() => {
    const editor = editorInstanceRef.current;
    if (!editor || !activeTab) return;
    const model = editor.getModel();
    if (!model) return;

    if (!activeDiagnostic.valid && activeDiagnostic.message) {
      const ln = activeDiagnostic.line || 1;
      const col = activeDiagnostic.column || 1;
      monaco.editor.setModelMarkers(model, 'singularity-linter', [
        {
          severity: monaco.MarkerSeverity.Error,
          message: activeDiagnostic.message,
          startLineNumber: ln,
          startColumn: col,
          endLineNumber: ln,
          endColumn: col + 12
        }
      ]);
    } else {
      monaco.editor.setModelMarkers(model, 'singularity-linter', []);
    }
  }, [activeDiagnostic, activeTab]);

  useEffect(() => {
    if (isDesktop) {
      const desktopApi = (window as any).singularityDesktop;
      if (desktopApi?.getAvailableIdes) {
        desktopApi
          .getAvailableIdes()
          .then((ides: Array<{ id: string; name: string; isAvailable: boolean }>) => {
            setAvailableIdes(ides);
          })
          .catch(() => {});
      } else {
        api
          .get<Array<{ id: string; name: string; isAvailable: boolean }>>('/servers/ides')
          .then((ides) => {
            setAvailableIdes(ides);
          })
          .catch(() => {});
      }
    }
  }, [isDesktop]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ideMenuRef.current && !ideMenuRef.current.contains(e.target as Node)) {
        setIsIdeMenuOpen(false);
      }
      setContextMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleOpenInNativeIde = async (preferred?: string, specificFilePath?: string) => {
    const desktopApi = (window as any).singularityDesktop;
    const ideToUse = preferred || localStorage.getItem('singularity_preferred_ide') || 'antigravity';
    setIsIdeMenuOpen(false);
    setErrorMessage(null);

    try {
      if (desktopApi?.openInIde) {
        try {
          setIdeFeedbackMsg('Sincronizando con IDE...');
          let syncFiles: Array<{ relativePath: string; content: string }> | undefined;
          try {
            const bundle = await api.get<{ files: Array<{ relativePath: string; content: string }> }>(
              `/servers/${serverId}/files/workspace-bundle`
            );
            syncFiles = bundle.files;
          } catch {
            // Ignore bundle error if offline
          }

          const res = await desktopApi.openInIde(serverId, ideToUse, {
            filePath: specificFilePath,
            syncFiles,
            remoteApiUrl: window.location.origin,
            authToken: localStorage.getItem('singularity_token') || undefined
          });
          if (res.success) {
            localStorage.setItem('singularity_preferred_ide', ideToUse);
            setIdeFeedbackMsg(`Abierto en ${res.ideUsed} (Auto-Sync Activo)`);
            setTimeout(() => setIdeFeedbackMsg(null), 4000);
            return;
          } else {
            setIdeFeedbackMsg(null);
            setErrorMessage(res.error || 'No se pudo abrir el editor seleccionado.');
            return;
          }
        } catch {
          setIdeFeedbackMsg(null);
        }
      }

      const res = await api.post<{ success: boolean; ideUsed: string; error?: string }>(
        `/servers/${serverId}/open-ide`,
        { ide: ideToUse, filePath: specificFilePath }
      );
      if (res.success) {
        localStorage.setItem('singularity_preferred_ide', ideToUse);
        setIdeFeedbackMsg(`Abierto en ${res.ideUsed}`);
        setTimeout(() => setIdeFeedbackMsg(null), 3500);
      } else {
        setErrorMessage(res.error || 'No se pudo abrir el editor seleccionado.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al invocar el editor nativo');
    }
  };

  const fetchFiles = useCallback(
    async (dirPath: string = currentPath) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await api.get<FileItemData[]>(
          `/servers/${serverId}/files?path=${encodeURIComponent(dirPath)}`
        );
        setFiles(data);
        setSelectedPaths(new Set());
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Error al cargar directorio');
      } finally {
        setIsLoading(false);
      }
    },
    [serverId, currentPath]
  );

  useEffect(() => {
    fetchFiles(currentPath);
  }, [fetchFiles, currentPath]);

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
    setSearchQuery('');
  };

  const handleGoUp = () => {
    if (!currentPath) return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join('/'));
  };

  // Open file in Multi-Tab Monaco IDE
  const handleOpenFile = async (item: FileItemData) => {
    setViewMode('ide');
    setSaveSuccess(false);
    setErrorMessage(null);

    // Check if already open in a tab
    const existing = openTabs.find((t) => t.path === item.relativePath);
    if (existing) {
      setActiveTabPath(existing.path);
      return;
    }

    setIsEditorLoading(true);
    try {
      const data = await api.get<{ content: string; isTruncated: boolean; sizeBytes: number }>(
        `/servers/${serverId}/files/content?path=${encodeURIComponent(item.relativePath)}`
      );
      const newTab: OpenEditorTab = {
        path: item.relativePath,
        name: item.name,
        extension: item.extension || item.name.split('.').pop() || '',
        content: data.content,
        originalContent: data.content,
        isTruncated: Boolean(data.isTruncated),
        sizeBytes: data.sizeBytes ?? item.sizeBytes,
        cursorLine: 1,
        cursorColumn: 1
      };
      setOpenTabs((prev) => [...prev, newTab]);
      setActiveTabPath(newTab.path);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al leer archivo');
    } finally {
      setIsEditorLoading(false);
    }
  };

  const handleCloseTab = async (pathToClose: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const tab = openTabs.find((t) => t.path === pathToClose);
    if (tab && tab.content !== tab.originalContent) {
      const ok = await confirm({
        title: 'Cambios sin Guardar',
        message: `El archivo "${tab.name}" tiene cambios sin guardar. ¿Deseas cerrarlo y descartar los cambios?`,
        confirmLabel: 'Descartar y Cerrar',
        variant: 'warning'
      });
      if (!ok) {
        return;
      }
    }

    const remaining = openTabs.filter((t) => t.path !== pathToClose);
    setOpenTabs(remaining);
    if (activeTabPath === pathToClose) {
      setActiveTabPath(remaining.length > 0 ? remaining[remaining.length - 1]!.path : null);
    }
  };

  const updateActiveTabContent = (newValue: string) => {
    if (!activeTabPath) return;
    setOpenTabs((prev) =>
      prev.map((tab) => (tab.path === activeTabPath ? { ...tab, content: newValue } : tab))
    );
  };

  // Save current active file
  const handleSaveActiveFile = useCallback(async () => {
    if (!activeTab || activeTab.isTruncated) return;

    const diag = validateFileSyntax(activeTab.content, activeTab.extension);
    if (!diag.valid) {
      const proceed = await confirm({
        title: 'Advertencia de Sintaxis Detectada',
        message: `Se detectó un problema de sintaxis en "${activeTab.name}" (Línea ${diag.line || 1}):\n\n${diag.message}\n\n¿Deseas guardar el archivo de todos modos?`,
        confirmLabel: 'Guardar de Todos Modos',
        variant: 'warning'
      });
      if (!proceed) return;
    }

    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);
    try {
      await api.put(`/servers/${serverId}/files/content`, {
        path: activeTab.path,
        content: activeTab.content
      });
      setOpenTabs((prev) =>
        prev.map((t) => (t.path === activeTab.path ? { ...t, originalContent: t.content } : t))
      );
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      fetchFiles();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al guardar archivo');
    } finally {
      setIsSaving(false);
    }
  }, [activeTab, serverId, fetchFiles]);

  // Save all dirty tabs
  const handleSaveAllFiles = async () => {
    const dirtyTabs = openTabs.filter((t) => !t.isTruncated && t.content !== t.originalContent);
    if (dirtyTabs.length === 0) return;

    setIsSaving(true);
    setErrorMessage(null);
    try {
      for (const tab of dirtyTabs) {
        await api.put(`/servers/${serverId}/files/content`, {
          path: tab.path,
          content: tab.content
        });
      }
      setOpenTabs((prev) => prev.map((t) => ({ ...t, originalContent: t.content })));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      fetchFiles();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al guardar todos los archivos');
    } finally {
      setIsSaving(false);
    }
  };

  // Configure custom Antigravity Dark Theme & keybindings on Monaco mount
  const handleEditorMount: OnMount = (editor, monacoInstance) => {
    editorInstanceRef.current = editor;

    monacoInstance.editor.defineTheme('antigravity-nebula-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
        { token: 'keyword', foreground: '38BDF8' },
        { token: 'string', foreground: '34D399' },
        { token: 'number', foreground: 'FBBF24' },
        { token: 'type', foreground: '818CF8' }
      ],
      colors: {
        'editor.background': '#070a12',
        'editor.foreground': '#E2E8F0',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#38BDF8',
        'editorCursor.foreground': '#10B981',
        'editor.selectionBackground': '#10B98133',
        'editor.lineHighlightBackground': '#0F172A99',
        'editorWidget.background': '#0B0F1A',
        'editorWidget.border': '#1E293B',
        'minimap.background': '#070a12'
      }
    });
    monacoInstance.editor.setTheme('antigravity-nebula-dark');

    // Ctrl+S / Cmd+S shortcut inside Monaco
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      handleSaveActiveFile();
    });

    editor.onDidChangeCursorPosition((e) => {
      setOpenTabs((prev) =>
        prev.map((t) =>
          t.path === activeTabPath
            ? { ...t, cursorLine: e.position.lineNumber, cursorColumn: e.position.column }
            : t
        )
      );
    });
  };

  const triggerMonacoAction = (actionId: string) => {
    const editor = editorInstanceRef.current;
    if (!editor) return;
    editor.focus();
    editor.trigger('singularity-toolbar', actionId, null);
  };

  // Create Directory
  const handleCreateDirectory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const target = currentPath ? `${currentPath}/${newFolderName.trim()}` : newFolderName.trim();
    try {
      await api.post(`/servers/${serverId}/files/mkdir`, { path: target });
      setIsNewFolderOpen(false);
      setNewFolderName('');
      fetchFiles();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al crear carpeta');
    }
  };

  // Create File with optional template & open in Monaco IDE
  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const tpl = FILE_TEMPLATES[selectedTemplate] || FILE_TEMPLATES['empty']!;
    let cleanName = newFileName.trim();
    if (tpl.ext && !cleanName.includes('.')) {
      cleanName += tpl.ext;
    }
    const target = currentPath ? `${currentPath}/${cleanName}` : cleanName;
    try {
      await api.put(`/servers/${serverId}/files/content`, { path: target, content: tpl.content });
      setIsNewFileOpen(false);
      setNewFileName('');
      setSelectedTemplate('empty');
      await fetchFiles();

      const ext = cleanName.split('.').pop() || '';
      const newTab: OpenEditorTab = {
        path: target,
        name: cleanName,
        extension: ext,
        content: tpl.content,
        originalContent: tpl.content,
        isTruncated: false,
        sizeBytes: tpl.content.length,
        cursorLine: 1,
        cursorColumn: 1
      };
      setOpenTabs((prev) => [...prev.filter((t) => t.path !== target), newTab]);
      setActiveTabPath(target);
      setViewMode('ide');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al crear archivo');
    }
  };

  // Duplicate file or folder
  const handleDuplicateItem = async (item: FileItemData) => {
    const ext = item.extension ? `.${item.extension}` : '';
    const baseName = ext && item.name.endsWith(ext) ? item.name.slice(0, -ext.length) : item.name;
    const copyName = `${baseName}_copy${ext}`;
    const parentDir = currentPath ? `${currentPath}/` : '';
    const destPath = `${parentDir}${copyName}`;

    try {
      await api.post(`/servers/${serverId}/files/copy`, {
        sourcePath: item.relativePath,
        destinationPath: destPath
      });
      setIdeFeedbackMsg(`Duplicado como ${copyName}`);
      setTimeout(() => setIdeFeedbackMsg(null), 3000);
      fetchFiles();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al duplicar elemento');
    }
  };

  // Compress selected or single item to ZIP
  const handleCompressItems = async (e: React.FormEvent) => {
    e.preventDefault();
    const pathsToCompress = Array.from(selectedPaths);
    if (pathsToCompress.length === 0 || !zipOutputName.trim()) return;

    const parentDir = currentPath ? `${currentPath}/` : '';
    const outPath = `${parentDir}${zipOutputName.trim()}`;

    try {
      const res = await api.post<{ message: string }>(`/servers/${serverId}/files/compress`, {
        paths: pathsToCompress,
        outputZipPath: outPath
      });
      setIsCompressModalOpen(false);
      setIdeFeedbackMsg(res.message || 'Archivo ZIP creado');
      setTimeout(() => setIdeFeedbackMsg(null), 3500);
      fetchFiles();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al comprimir en ZIP');
    }
  };

  // Extract a .zip file into current directory
  const handleExtractZip = async (item: FileItemData) => {
    try {
      setIdeFeedbackMsg(`Extrayendo ${item.name}...`);
      const res = await api.post<{ message: string; extractedCount: number }>(
        `/servers/${serverId}/files/extract`,
        {
          zipPath: item.relativePath,
          targetDir: currentPath
        }
      );
      setIdeFeedbackMsg(res.message || 'Archivo ZIP extraído exitosamente');
      setTimeout(() => setIdeFeedbackMsg(null), 3500);
      fetchFiles();
    } catch (err: unknown) {
      setIdeFeedbackMsg(null);
      setErrorMessage(err instanceof Error ? err.message : 'Error al extraer archivo ZIP');
    }
  };

  // Delete item
  const handleDeleteItem = async (item: FileItemData) => {
    const isDir = item.isDirectory;
    const confirmMsg = isDir
      ? `¿Eliminar la carpeta "${item.name}" y todo su contenido? Esta acción no se puede deshacer.`
      : `¿Eliminar el archivo "${item.name}" de forma permanente?`;

    const ok = await confirm({
      title: isDir ? 'Eliminar Carpeta' : 'Eliminar Archivo',
      message: confirmMsg,
      confirmLabel: 'Eliminar',
      variant: 'danger'
    });
    if (!ok) return;

    try {
      await api.delete(`/servers/${serverId}/files?path=${encodeURIComponent(item.relativePath)}`);
      setOpenTabs((prev) => prev.filter((t) => t.path !== item.relativePath));
      if (activeTabPath === item.relativePath) {
        setActiveTabPath(null);
      }
      fetchFiles();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al eliminar elemento');
    }
  };

  // Delete multiple selected items
  const handleDeleteSelected = async () => {
    if (selectedPaths.size === 0) return;
    const ok = await confirm({
      title: 'Eliminar Elementos Seleccionados',
      message: `¿Eliminar los ${selectedPaths.size} elemento(s) seleccionados del servidor? Esta acción no se puede deshacer.`,
      confirmLabel: `Eliminar (${selectedPaths.size})`,
      variant: 'danger'
    });
    if (!ok) return;

    try {
      for (const relPath of selectedPaths) {
        await api.delete(`/servers/${serverId}/files?path=${encodeURIComponent(relPath)}`);
      }
      fetchFiles();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al eliminar seleccionados');
    }
  };

  // Rename item
  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingItem || !renameTargetName.trim()) return;

    const parentDir = currentPath ? `${currentPath}/` : '';
    const newPath = `${parentDir}${renameTargetName.trim()}`;

    try {
      await api.post(`/servers/${serverId}/files/rename`, {
        oldPath: renamingItem.relativePath,
        newPath
      });
      setRenamingItem(null);
      setRenameTargetName('');
      fetchFiles();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al renombrar elemento');
    }
  };

  const handleUploadFiles = async (selectedFiles: FileList | File[]) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgressMsg(`Subiendo ${selectedFiles.length} archivo(s)...`);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (file) {
          formData.append('files', file);
        }
      }

      const res = await api.upload<{ message: string; files: Array<{ filename: string; size: number }> }>(
        `/servers/${serverId}/files/upload?path=${encodeURIComponent(currentPath)}`,
        formData
      );

      setIdeFeedbackMsg(res.message || 'Archivos subidos exitosamente');
      setTimeout(() => setIdeFeedbackMsg(null), 3500);
      await fetchFiles();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al subir archivo(s)');
    } finally {
      setIsUploading(false);
      setUploadProgressMsg(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUploadFiles(e.dataTransfer.files);
    }
  };

  const toggleSelectItem = (relativePath: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(relativePath)) {
        next.delete(relativePath);
      } else {
        next.add(relativePath);
      }
      return next;
    });
  };

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (item: FileItemData) => {
    if (item.isDirectory) {
      return <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20 shrink-0" />;
    }
    const ext = item.extension.toLowerCase();
    if (['yml', 'yaml', 'json', 'toml', 'properties', 'js', 'ts', 'java', 'sk', 'lua'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-nebula-cyber shrink-0" />;
    }
    if (['zip', 'tar', 'gz', 'mrpack'].includes(ext)) {
      return <FileArchive className="w-4 h-4 text-purple-400 shrink-0" />;
    }
    if (['log', 'txt', 'md'].includes(ext)) {
      return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
    }
    if (['jar'].includes(ext)) {
      return <File className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    return <File className="w-4 h-4 text-slate-500 shrink-0" />;
  };

  const isEditable = (item: FileItemData): boolean => {
    if (item.isDirectory) return false;
    const ext = item.extension.toLowerCase();
    return [
      'txt', 'yml', 'yaml', 'json', 'properties', 'log', 'toml', 'cfg', 'conf',
      'ini', 'sh', 'bat', 'cmd', 'md', 'env', 'js', 'ts', 'java', 'sk', 'lua',
      'xml', 'html', 'sql', 'csv', 'mcmeta'
    ].includes(ext);
  };

  const isZipArchive = (item: FileItemData): boolean => {
    return !item.isDirectory && item.extension.toLowerCase() === 'zip';
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const breadcrumbs = currentPath.split('/').filter(Boolean);
  const dirtyTabsCount = openTabs.filter((t) => t.content !== t.originalContent).length;

  return (
    <div
      className={`${
        isZenFullscreen ? 'fixed inset-0 z-50 rounded-none' : 'rounded-2xl h-full'
      } bg-nebula-900 border border-nebula-800 flex flex-col shadow-md overflow-hidden`}
    >
      {/* Top Studio Header & Mode Switcher */}
      <div className="p-3 border-b border-nebula-800 flex flex-wrap items-center justify-between gap-2.5 bg-nebula-950/60 shrink-0">
        {/* Left: Mode Toggle + Breadcrumbs */}
        <div className="flex items-center gap-2.5 overflow-x-auto max-w-full">
          {/* Switcher between Explorer Table & VS Code / Antigravity Studio IDE */}
          <div className="inline-flex rounded-xl bg-nebula-950 p-0.5 border border-nebula-800 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('explorer')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'explorer'
                  ? 'bg-nebula-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Vista Tabla de Archivos"
            >
              <LayoutList className="w-3.5 h-3.5 text-amber-400" />
              <span>Explorador</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ide')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'ide'
                  ? 'bg-nebula-accent/20 text-nebula-accent border border-nebula-accent/30 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Motor Oficial VS Code / Antigravity IDE Integrado"
            >
              <Sparkles className="w-3.5 h-3.5 text-nebula-cyber" />
              <span>IDE Studio</span>
              {openTabs.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-nebula-800 text-slate-200">
                  {openTabs.length}
                </span>
              )}
            </button>
          </div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1 text-xs font-mono overflow-x-auto">
            <button
              type="button"
              onClick={() => handleNavigate('')}
              className={`px-2 py-1 rounded hover:bg-nebula-800 transition-colors ${
                !currentPath ? 'text-nebula-accent font-bold' : 'text-slate-400'
              }`}
            >
              raíz/
            </button>
            {breadcrumbs.map((crumb, idx) => {
              const pathUpTo = breadcrumbs.slice(0, idx + 1).join('/');
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={pathUpTo}>
                  <span className="text-slate-600">/</span>
                  <button
                    type="button"
                    onClick={() => handleNavigate(pathUpTo)}
                    className={`px-2 py-1 rounded hover:bg-nebula-800 transition-colors ${
                      isLast ? 'text-nebula-accent font-bold' : 'text-slate-400'
                    }`}
                  >
                    {crumb}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Right: Actions & Native Antigravity / VS Code Bridge */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrar archivos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-2.5 py-1.5 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-nebula-accent w-32 sm:w-40"
            />
          </div>

          {currentPath && (
            <button
              type="button"
              onClick={handleGoUp}
              className="p-1.5 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-slate-300 border border-nebula-750 transition-colors"
              title="Subir un nivel"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => fetchFiles()}
            className="p-1.5 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-slate-300 border border-nebula-750 transition-colors"
            title="Recargar archivos"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsNewFolderOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-slate-300 border border-nebula-750 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Crear nueva carpeta"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Carpeta</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewFileOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-nebula-accent/15 hover:bg-nebula-accent/25 text-nebula-accent border border-nebula-accent/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Crear nuevo archivo con plantilla"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Archivo</span>
          </button>

          {/* Upload File(s) */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleUploadFiles(e.target.files);
                e.target.value = '';
              }
            }}
            multiple
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Subir archivos (o arrastra y suelta)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Subir</span>
          </button>

          {/* Native Desktop IDE Selector (Antigravity IDE / VS Code / Cursor with Live Auto-Sync) */}
          {isDesktop && (
            <div className="relative inline-flex items-center" ref={ideMenuRef}>
              <button
                type="button"
                onClick={() => handleOpenInNativeIde(undefined, activeTab?.path)}
                className="px-2.5 py-1.5 rounded-l-lg bg-nebula-800 hover:bg-nebula-750 text-nebula-cyber border border-r-0 border-nebula-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                title="Abrir servidor o archivo actual en Antigravity IDE / VS Code original con sincronización automática"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{ideFeedbackMsg || 'Abrir en IDE Original'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsIdeMenuOpen((prev) => !prev)}
                className="px-1.5 py-1.5 rounded-r-lg bg-nebula-800 hover:bg-nebula-750 text-nebula-cyber border border-nebula-700 font-semibold text-xs flex items-center transition-colors"
                title="Elegir editor nativo (Antigravity IDE, VS Code, Cursor)"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isIdeMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isIdeMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl bg-nebula-900 border border-nebula-750 shadow-2xl z-50 py-1.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider border-b border-nebula-800 mb-1">
                    Abrir con Auto-Sync en:
                  </div>
                  {(availableIdes.length > 0
                    ? availableIdes
                    : [
                        { id: 'antigravity', name: 'Antigravity IDE', isAvailable: true },
                        { id: 'vscode', name: 'Visual Studio Code', isAvailable: true },
                        { id: 'cursor', name: 'Cursor', isAvailable: false },
                        { id: 'explorer', name: 'Explorador de Archivos', isAvailable: true }
                      ]
                  ).map((ide) => (
                    <button
                      key={ide.id}
                      type="button"
                      onClick={() => handleOpenInNativeIde(ide.id, activeTab?.path)}
                      className="w-full px-3 py-2 text-left text-xs flex items-center justify-between text-slate-200 hover:bg-nebula-800/80 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {ide.id === 'explorer' ? (
                          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Code2 className="w-3.5 h-3.5 text-nebula-cyber" />
                        )}
                        <span className="font-medium">{ide.name}</span>
                      </div>
                      {ide.isAvailable ? (
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                          Auto-Sync
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500">No detectado</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Zen Fullscreen button */}
          <button
            type="button"
            onClick={() => setIsZenFullscreen((prev) => !prev)}
            className="p-1.5 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-slate-300 border border-nebula-750 transition-colors"
            title={isZenFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa (Zen Mode)'}
          >
            {isZenFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Multi-selection Action Bar (when items selected in Explorer) */}
      {selectedPaths.size > 0 && viewMode === 'explorer' && (
        <div className="px-4 py-2 bg-nebula-800/90 border-b border-nebula-700 flex items-center justify-between text-xs animate-in fade-in shrink-0">
          <span className="font-mono text-nebula-cyber font-semibold">
            {selectedPaths.size} elemento(s) seleccionado(s)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setZipOutputName(`seleccion_${Date.now()}.zip`);
                setIsCompressModalOpen(true);
              }}
              className="px-2.5 py-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 font-semibold flex items-center gap-1.5"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Comprimir en .ZIP</span>
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-semibold flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar Seleccionados</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedPaths(new Set())}
              className="px-2 py-1 rounded text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Alerts */}
      {errorMessage && (
        <div className="p-2.5 bg-rose-950/60 border-b border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-300 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {uploadProgressMsg && (
        <div className="p-2.5 bg-emerald-950/60 border-b border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 shrink-0">
          <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0" />
          <span>{uploadProgressMsg}</span>
        </div>
      )}

      {/* ==================== MAIN BODY: IDE STUDIO WORKBENCH OR EXPLORER TABLE ==================== */}
      {viewMode === 'ide' ? (
        <div
          className="flex-1 flex min-h-0 overflow-hidden relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Left File Tree Sidebar (VS Code / Antigravity Explorer Panel) */}
          {isSidebarOpen && (
            <div className="w-64 sm:w-72 border-r border-nebula-800 bg-nebula-950/70 flex flex-col shrink-0 select-none">
              <div className="px-3 py-2 border-b border-nebula-800/80 flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <span className="font-bold text-slate-300 truncate">
                  Explorador /{currentPath || 'raíz'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsNewFileOpen(true)}
                    className="p-1 rounded hover:bg-nebula-800 text-slate-400 hover:text-nebula-accent"
                    title="Nuevo archivo"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewFolderOpen(true)}
                    className="p-1 rounded hover:bg-nebula-800 text-slate-400 hover:text-amber-400"
                    title="Nueva carpeta"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    className="p-1 rounded hover:bg-nebula-800 text-slate-400 hover:text-white"
                    title="Ocultar barra lateral"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-1 divide-y divide-nebula-900/40">
                {currentPath && (
                  <button
                    type="button"
                    onClick={handleGoUp}
                    className="w-full px-3 py-1.5 text-left text-xs font-mono text-slate-400 hover:bg-nebula-800/60 flex items-center gap-2"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                    <span>.. (Subir carpeta)</span>
                  </button>
                )}

                {filteredFiles.map((item) => {
                  const isCurrentTab = activeTabPath === item.relativePath;
                  const isOpenInTabs = openTabs.some((t) => t.path === item.relativePath);
                  return (
                    <div
                      key={item.relativePath}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, item });
                      }}
                      className={`group px-3 py-1.5 flex items-center justify-between text-xs font-mono cursor-pointer transition-colors ${
                        isCurrentTab
                          ? 'bg-nebula-accent/15 text-nebula-accent font-bold border-l-2 border-nebula-accent'
                          : 'text-slate-300 hover:bg-nebula-800/50'
                      }`}
                      onClick={() => {
                        if (item.isDirectory) {
                          handleNavigate(item.relativePath);
                        } else if (isEditable(item)) {
                          handleOpenFile(item);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {getFileIcon(item)}
                        <span className="truncate">{item.isDirectory ? `${item.name}/` : item.name}</span>
                        {isOpenInTabs && !isCurrentTab && (
                          <span className="w-1.5 h-1.5 rounded-full bg-nebula-cyber shrink-0" />
                        )}
                      </div>
                      <div className="hidden group-hover:flex items-center gap-1 shrink-0 ml-1">
                        {isZipArchive(item) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleExtractZip(item);
                            }}
                            className="p-0.5 rounded hover:bg-nebula-700 text-purple-400"
                            title="Extraer ZIP aquí"
                          >
                            <PackageOpen className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteItem(item);
                          }}
                          className="p-0.5 rounded hover:bg-rose-950 text-slate-400 hover:text-rose-400"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Right Monaco Editor Workbench */}
          <div className="flex-1 flex flex-col min-w-0 bg-[#070a12]">
            {/* Multi-Tab Bar + Editor Controls */}
            <div className="h-10 border-b border-nebula-800 bg-nebula-950 flex items-center justify-between px-2 gap-2 shrink-0">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0 flex-1">
                {!isSidebarOpen && (
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(true)}
                    className="p-1.5 rounded-lg hover:bg-nebula-800 text-slate-400 hover:text-white mr-1 shrink-0"
                    title="Mostrar árbol de archivos"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                  </button>
                )}

                {openTabs.length === 0 ? (
                  <span className="text-xs font-mono text-slate-500 px-2">
                    Selecciona un archivo del árbol lateral para editarlo con el motor de VS Code / Antigravity
                  </span>
                ) : (
                  openTabs.map((tab) => {
                    const isActive = tab.path === activeTabPath;
                    const isDirty = tab.content !== tab.originalContent;
                    return (
                      <div
                        key={tab.path}
                        onClick={() => setActiveTabPath(tab.path)}
                        className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-mono cursor-pointer border-t-2 transition-all shrink-0 ${
                          isActive
                            ? 'bg-[#070a12] text-white border-nebula-accent font-semibold'
                            : 'bg-nebula-900/60 text-slate-400 border-transparent hover:bg-nebula-850 hover:text-slate-200'
                        }`}
                        title={tab.path}
                      >
                        <FileCode className="w-3.5 h-3.5 text-nebula-cyber shrink-0" />
                        <span className="max-w-[140px] truncate">{tab.name}</span>
                        {isDirty && (
                          <span
                            className="w-2 h-2 rounded-full bg-amber-400 shrink-0"
                            title="Cambios sin guardar"
                          />
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleCloseTab(tab.path, e)}
                          className="p-0.5 rounded hover:bg-nebula-750 text-slate-500 hover:text-white"
                          title="Cerrar pestaña"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Editor Action Toolbar */}
              {activeTab && (
                <div className="flex items-center gap-1 shrink-0">
                  {saveSuccess && (
                    <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 mr-1">
                      <Check className="w-3.5 h-3.5" /> Guardado
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => triggerMonacoAction('actions.find')}
                    className="p-1.5 rounded-lg hover:bg-nebula-800 text-slate-400 hover:text-white text-xs"
                    title="Buscar y Reemplazar (Ctrl+F / Ctrl+H)"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerMonacoAction('editor.action.quickCommand')}
                    className="px-2 py-1 rounded-lg hover:bg-nebula-800 text-slate-300 border border-nebula-800 text-[11px] font-mono flex items-center gap-1"
                    title="Abrir Paleta de Comandos de VS Code (F1)"
                  >
                    <Terminal className="w-3 h-3 text-nebula-cyber" />
                    <span className="hidden lg:inline">Paleta (F1)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWordWrap((w) => (w === 'on' ? 'off' : 'on'))}
                    className={`p-1.5 rounded-lg text-xs transition-colors ${
                      wordWrap === 'on' ? 'bg-nebula-800 text-nebula-cyber' : 'text-slate-400 hover:bg-nebula-800'
                    }`}
                    title="Ajuste de línea automático (Word Wrap)"
                  >
                    <WrapText className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowMinimap((m) => !m)}
                    className={`p-1.5 rounded-lg text-xs transition-colors ${
                      showMinimap ? 'bg-nebula-800 text-nebula-cyber' : 'text-slate-400 hover:bg-nebula-800'
                    }`}
                    title="Mostrar/Ocultar Minimapa de código"
                  >
                    <MapIcon className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center border border-nebula-800 rounded-lg overflow-hidden text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setFontSize((s) => Math.max(10, s - 1))}
                      className="px-1.5 py-1 hover:bg-nebula-800 text-slate-400 hover:text-white"
                      title="Reducir fuente"
                    >
                      A-
                    </button>
                    <button
                      type="button"
                      onClick={() => setFontSize((s) => Math.min(22, s + 1))}
                      className="px-1.5 py-1 hover:bg-nebula-800 text-slate-400 hover:text-white"
                      title="Aumentar fuente"
                    >
                      A+
                    </button>
                  </div>

                  {isDesktop && (
                    <button
                      type="button"
                      onClick={() => handleOpenInNativeIde(undefined, activeTab.path)}
                      className="px-2 py-1 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-nebula-cyber border border-nebula-750 text-[11px] font-semibold flex items-center gap-1"
                      title="Abrir este archivo directamente en Antigravity IDE / VS Code de escritorio"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span className="hidden xl:inline">IDE Nativo</span>
                    </button>
                  )}

                  {dirtyTabsCount > 1 && (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleSaveAllFiles}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs"
                      title="Guardar todas las pestañas modificadas"
                    >
                      Guardar Todo ({dirtyTabsCount})
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isSaving || isEditorLoading || activeTab.isTruncated}
                    onClick={handleSaveActiveFile}
                    className="px-3 py-1 rounded-lg bg-nebula-accent hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    title={activeTab.isTruncated ? 'Modo solo lectura (> 2 MB)' : 'Guardar archivo (Ctrl+S)'}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>
                      {activeTab.isTruncated ? 'Solo Lectura' : isSaving ? 'Guardando...' : 'Guardar'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Truncated File Warning Banner */}
            {activeTab?.isTruncated && (
              <div className="px-4 py-1.5 bg-amber-950/80 border-b border-amber-500/40 text-amber-200 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Este archivo supera los 2 MB. Se muestran los primeros 2 MB en{' '}
                  <strong>modo solo lectura</strong> para evitar pérdida de datos.
                </span>
              </div>
            )}

            {/* Real-time Syntax Linter Warning Banner */}
            {activeTab && !activeDiagnostic.valid && (
              <div className="px-4 py-1.5 bg-rose-950/80 border-b border-rose-500/40 text-rose-200 text-xs flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 truncate">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span className="font-mono truncate">
                    Línea {activeDiagnostic.line || 1}: {activeDiagnostic.message}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (editorInstanceRef.current && activeDiagnostic.line) {
                      editorInstanceRef.current.revealLineInCenter(activeDiagnostic.line);
                      editorInstanceRef.current.setPosition({
                        lineNumber: activeDiagnostic.line,
                        column: activeDiagnostic.column || 1
                      });
                      editorInstanceRef.current.focus();
                    }
                  }}
                  className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-mono text-[11px] shrink-0"
                >
                  Ir al error
                </button>
              </div>
            )}

            {/* Monaco Editor Canvas */}
            <div className="flex-1 min-h-[420px] relative">
              {isEditorLoading ? (
                <div className="h-full flex items-center justify-center text-xs font-mono text-slate-400">
                  Cargando archivo en el motor de VS Code / Antigravity...
                </div>
              ) : !activeTab ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 select-none">
                  <div className="w-14 h-14 rounded-2xl bg-nebula-900 border border-nebula-800 flex items-center justify-center mb-3 shadow-inner">
                    <Code2 className="w-7 h-7 text-nebula-cyber" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-200">
                    Singularity Studio — Motor VS Code & Antigravity IDE
                  </h3>
                  <p className="text-xs text-slate-400 max-w-md mt-1">
                    Haz clic en cualquier archivo de configuración (<code className="text-nebula-accent">.yml</code>,{' '}
                    <code className="text-nebula-accent">.properties</code>,{' '}
                    <code className="text-nebula-accent">.json</code>,{' '}
                    <code className="text-nebula-accent">.toml</code>) en el panel izquierdo para abrirlo en pestañas con validación de sintaxis en tiempo real.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => setIsNewFileOpen(true)}
                      className="px-3 py-1.5 rounded-lg bg-nebula-accent/15 hover:bg-nebula-accent/25 text-nebula-accent border border-nebula-accent/30 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <FilePlus className="w-3.5 h-3.5" />
                      <span>Crear Nuevo Archivo</span>
                    </button>
                    {isDesktop && (
                      <button
                        type="button"
                        onClick={() => handleOpenInNativeIde('antigravity')}
                        className="px-3 py-1.5 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-nebula-cyber border border-nebula-750 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <Code2 className="w-3.5 h-3.5" />
                        <span>Abrir en Antigravity IDE Original</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <Editor
                  height="100%"
                  path={activeTab.path}
                  language={detectMonacoLanguage(activeTab.name, activeTab.extension)}
                  value={activeTab.content}
                  theme="antigravity-nebula-dark"
                  onChange={(val) => updateActiveTabContent(val ?? '')}
                  onMount={handleEditorMount}
                  options={{
                    readOnly: activeTab.isTruncated,
                    fontSize,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
                    wordWrap,
                    minimap: { enabled: showMinimap },
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    bracketPairColorization: { enabled: true },
                    guides: { bracketPairs: true, indentation: true },
                    renderWhitespace: 'selection',
                    formatOnPaste: true,
                    tabSize: 2
                  }}
                />
              )}
            </div>

            {/* Bottom VS Code / Antigravity Status Bar */}
            <div className="h-6 px-3 bg-nebula-950 border-t border-nebula-800 flex items-center justify-between text-[11px] font-mono text-slate-400 shrink-0 select-none">
              <div className="flex items-center gap-3">
                {activeTab ? (
                  activeDiagnostic.valid ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Sintaxis Válida
                    </span>
                  ) : (
                    <span className="text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Error en línea {activeDiagnostic.line || 1}
                    </span>
                  )
                ) : (
                  <span>Listo</span>
                )}
                {activeTab && (
                  <span className="text-slate-500 hidden sm:inline">
                    {activeTab.path} ({formatSize(activeTab.sizeBytes)})
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4">
                {activeTab && (
                  <>
                    <span>
                      Lín {activeTab.cursorLine}, Col {activeTab.cursorColumn}
                    </span>
                    <span className="hidden sm:inline">UTF-8</span>
                    <span className="text-nebula-cyber uppercase font-semibold">
                      {detectMonacoLanguage(activeTab.name, activeTab.extension)}
                    </span>
                  </>
                )}
                <span className="text-slate-500 hidden md:inline">Monaco VS Code Engine</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== EXPLORER TABLE VIEW ==================== */
        <div
          className="flex-1 overflow-y-auto relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDraggingOver && (
            <div className="absolute inset-0 z-30 bg-nebula-900/90 border-2 border-dashed border-emerald-400/80 rounded-xl flex flex-col items-center justify-center pointer-events-none backdrop-blur-xs animate-in fade-in duration-150">
              <Upload className="w-10 h-10 text-emerald-400 animate-bounce mb-2" />
              <p className="text-sm font-semibold text-white">Suelta los archivos aquí para subirlos</p>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                Destino: /{currentPath || 'raíz'}
              </p>
            </div>
          )}
          {isLoading ? (
            <div className="py-20 text-center text-xs font-mono text-slate-500">
              Cargando archivos del servidor...
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="py-20 text-center text-xs font-mono text-slate-500">
              {searchQuery ? 'No se encontraron archivos que coincidan' : 'Esta carpeta está vacía'}
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-nebula-950/60 text-slate-400 font-mono text-[11px] uppercase border-b border-nebula-800/80 sticky top-0 z-10">
                <tr>
                  <th className="py-2.5 pl-4 pr-2 w-8">
                    <input
                      type="checkbox"
                      checked={
                        filteredFiles.length > 0 &&
                        filteredFiles.every((f) => selectedPaths.has(f.relativePath))
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPaths(new Set(filteredFiles.map((f) => f.relativePath)));
                        } else {
                          setSelectedPaths(new Set());
                        }
                      }}
                      className="rounded border-nebula-700 bg-nebula-950"
                    />
                  </th>
                  <th className="py-2.5 px-3 font-semibold">Nombre</th>
                  <th className="py-2.5 px-4 font-semibold hidden sm:table-cell">Tamaño</th>
                  <th className="py-2.5 px-4 font-semibold hidden md:table-cell">Modificado</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-nebula-850/60">
                {filteredFiles.map((item) => (
                  <tr
                    key={item.relativePath}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({ x: e.clientX, y: e.clientY, item });
                    }}
                    className={`hover:bg-nebula-800/40 transition-colors group ${
                      selectedPaths.has(item.relativePath) ? 'bg-nebula-800/30' : ''
                    }`}
                  >
                    <td className="py-2 pl-4 pr-2">
                      <input
                        type="checkbox"
                        checked={selectedPaths.has(item.relativePath)}
                        onChange={() => toggleSelectItem(item.relativePath)}
                        className="rounded border-nebula-700 bg-nebula-950"
                      />
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2.5">
                        {getFileIcon(item)}
                        {item.isDirectory ? (
                          <button
                            type="button"
                            onClick={() => handleNavigate(item.relativePath)}
                            className="font-medium text-slate-200 hover:text-nebula-accent transition-colors text-left truncate max-w-xs sm:max-w-md font-mono"
                          >
                            {item.name}/
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={!isEditable(item)}
                            onClick={() => handleOpenFile(item)}
                            className={`text-left truncate max-w-xs sm:max-w-md font-mono ${
                              isEditable(item)
                                ? 'text-slate-200 hover:text-nebula-cyber cursor-pointer'
                                : 'text-slate-400 cursor-default'
                            }`}
                          >
                            {item.name}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-4 text-slate-400 font-mono text-[11px] hidden sm:table-cell">
                      {item.isDirectory ? '-' : formatSize(item.sizeBytes)}
                    </td>
                    <td className="py-2 px-4 text-slate-500 font-mono text-[11px] hidden md:table-cell">
                      {new Date(item.modifiedAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-85 group-hover:opacity-100 transition-opacity">
                        {isEditable(item) && (
                          <button
                            type="button"
                            onClick={() => handleOpenFile(item)}
                            className="px-2 py-1 rounded bg-nebula-accent/10 hover:bg-nebula-accent/20 text-nebula-accent font-mono text-[11px] flex items-center gap-1 transition-colors"
                            title="Abrir en IDE Studio (Motor VS Code / Antigravity)"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span className="hidden lg:inline">Editar</span>
                          </button>
                        )}

                        {isZipArchive(item) && (
                          <button
                            type="button"
                            onClick={() => handleExtractZip(item)}
                            className="px-2 py-1 rounded bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 font-mono text-[11px] flex items-center gap-1 transition-colors"
                            title="Extraer archivo .ZIP en esta carpeta"
                          >
                            <PackageOpen className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Extraer</span>
                          </button>
                        )}

                        {!item.isDirectory && (
                          <button
                            type="button"
                            onClick={() => {
                              api
                                .download(
                                  `/servers/${serverId}/files/download?path=${encodeURIComponent(item.relativePath)}`,
                                  item.name
                                )
                                .catch((err: unknown) => {
                                  setErrorMessage(
                                    err instanceof Error ? err.message : 'Error al descargar archivo'
                                  );
                                });
                            }}
                            className="p-1.5 rounded hover:bg-nebula-800 text-slate-300 hover:text-emerald-400 transition-colors"
                            title="Descargar archivo"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDuplicateItem(item)}
                          className="p-1.5 rounded hover:bg-nebula-800 text-slate-400 hover:text-nebula-cyber transition-colors"
                          title="Duplicar"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setRenamingItem(item);
                            setRenameTargetName(item.name);
                          }}
                          className="p-1.5 rounded hover:bg-nebula-800 text-slate-400 hover:text-slate-200 transition-colors"
                          title="Renombrar"
                        >
                          <span className="font-mono text-[10px] uppercase font-bold">REN</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          className="p-1.5 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-56 rounded-xl bg-nebula-900 border border-nebula-750 shadow-2xl py-1.5 text-xs text-slate-200 backdrop-blur-md animate-in fade-in duration-100"
        >
          <div className="px-3 py-1 text-[10px] font-mono text-slate-400 border-b border-nebula-800 truncate">
            {contextMenu.item.name}
          </div>
          {isEditable(contextMenu.item) && (
            <button
              type="button"
              onClick={() => {
                handleOpenFile(contextMenu.item);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-nebula-800 flex items-center gap-2 text-nebula-accent font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Abrir en IDE Studio</span>
            </button>
          )}
          {isDesktop && !contextMenu.item.isDirectory && (
            <>
              <button
                type="button"
                onClick={() => {
                  handleOpenInNativeIde('antigravity', contextMenu.item.relativePath);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-nebula-800 flex items-center gap-2 text-nebula-cyber"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Abrir en Antigravity IDE</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleOpenInNativeIde('vscode', contextMenu.item.relativePath);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-nebula-800 flex items-center gap-2 text-blue-400"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Abrir en VS Code Original</span>
              </button>
            </>
          )}
          {isZipArchive(contextMenu.item) && (
            <button
              type="button"
              onClick={() => {
                handleExtractZip(contextMenu.item);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-nebula-800 flex items-center gap-2 text-purple-300"
            >
              <PackageOpen className="w-3.5 h-3.5" />
              <span>Extraer .ZIP aquí</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              handleDuplicateItem(contextMenu.item);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-nebula-800 flex items-center gap-2"
          >
            <Copy className="w-3.5 h-3.5 text-slate-400" />
            <span>Duplicar</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedPaths(new Set([contextMenu.item.relativePath]));
              setZipOutputName(`${contextMenu.item.name}.zip`);
              setIsCompressModalOpen(true);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-nebula-800 flex items-center gap-2"
          >
            <Archive className="w-3.5 h-3.5 text-purple-400" />
            <span>Comprimir en .ZIP</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRenamingItem(contextMenu.item);
              setRenameTargetName(contextMenu.item.name);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-nebula-800 flex items-center gap-2"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-400" />
            <span>Renombrar</span>
          </button>
          <button
            type="button"
            onClick={() => {
              handleDeleteItem(contextMenu.item);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-rose-950/60 text-rose-400 flex items-center gap-2 border-t border-nebula-800 mt-1 pt-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eliminar</span>
          </button>
        </div>
      )}

      {/* New Folder Modal */}
      {isNewFolderOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateDirectory}
            className="bg-nebula-900 border border-nebula-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-nebula-800 pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Nueva Carpeta</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewFolderOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-semibold block">Nombre de Carpeta</label>
              <input
                type="text"
                autoFocus
                placeholder="ej. plugins_backup"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-white font-mono focus:outline-none focus:border-nebula-accent"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewFolderOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:bg-nebula-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!newFolderName.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-nebula-accent hover:bg-emerald-600 text-slate-950 font-bold text-xs disabled:opacity-50"
              >
                Crear Carpeta
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New File Modal with Templates */}
      {isNewFileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateFile}
            className="bg-nebula-900 border border-nebula-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-nebula-800 pb-3">
              <div className="flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-nebula-accent" />
                <h3 className="text-sm font-bold text-white">Nuevo Archivo en IDE Studio</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewFileOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-semibold block">Plantilla Inicial</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-slate-200 focus:outline-none focus:border-nebula-accent"
              >
                {Object.entries(FILE_TEMPLATES).map(([key, tpl]) => (
                  <option key={key} value={key}>
                    {tpl.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-semibold block">
                Nombre del Archivo (con extensión)
              </label>
              <input
                type="text"
                autoFocus
                placeholder="ej. config.yml, rules.txt, whitelist.json"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-white font-mono focus:outline-none focus:border-nebula-accent"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsNewFileOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:bg-nebula-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!newFileName.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-nebula-accent hover:bg-emerald-600 text-slate-950 font-bold text-xs disabled:opacity-50"
              >
                Crear y Abrir en IDE
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Compress to ZIP Modal */}
      {isCompressModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCompressItems}
            className="bg-nebula-900 border border-nebula-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-nebula-800 pb-3">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Comprimir en Archivo .ZIP</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCompressModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-semibold block">
                Nombre del archivo .ZIP resultante
              </label>
              <input
                type="text"
                autoFocus
                value={zipOutputName}
                onChange={(e) => setZipOutputName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-white font-mono focus:outline-none focus:border-nebula-accent"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCompressModalOpen(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:bg-nebula-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!zipOutputName.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-bold text-xs disabled:opacity-50"
              >
                Comprimir Ahora
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {renamingItem && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleRename}
            className="bg-nebula-900 border border-nebula-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-nebula-800 pb-3">
              <h3 className="text-sm font-bold text-white">Renombrar Elemento</h3>
              <button
                type="button"
                onClick={() => setRenamingItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-semibold block">Nuevo Nombre</label>
              <input
                type="text"
                autoFocus
                value={renameTargetName}
                onChange={(e) => setRenameTargetName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-white font-mono focus:outline-none focus:border-nebula-accent"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRenamingItem(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:bg-nebula-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!renameTargetName.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-nebula-accent hover:bg-emerald-600 text-slate-950 font-bold text-xs disabled:opacity-50"
              >
                Renombrar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
