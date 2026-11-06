import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Folder,
  File,
  FileText,
  FileCode,
  Download,
  Trash2,
  Edit3,
  ArrowLeft,
  RotateCw,
  Search,
  Check,
  X,
  AlertCircle,
  Save,
  FolderPlus,
  FilePlus,
  Code2,
  ChevronDown,
  FolderOpen,
  Upload
} from 'lucide-react';
import { api } from '../services/api-client.js';

export interface FileItemData {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  sizeBytes: number;
  modifiedAt: string;
  extension: string;
}

interface FileManagerProps {
  serverId: string;
}

export const FileManager: React.FC<FileManagerProps> = ({ serverId }) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [files, setFiles] = useState<FileItemData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editor Modal State
  const [editingFile, setEditingFile] = useState<{ path: string; name: string } | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [isEditorLoading, setIsEditorLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New Item Modals
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isNewFileOpen, setIsNewFileOpen] = useState(false);
  const [newFileName, setNewFileName] = useState('');

  // Rename Modal
  const [renamingItem, setRenamingItem] = useState<FileItemData | null>(null);
  const [renameTargetName, setRenameTargetName] = useState('');

  // Upload State & Drag Drop
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressMsg, setUploadProgressMsg] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Desktop IDE Bridge Integration: Available in Electron or when running locally on host
  const isDesktop = typeof window !== 'undefined' && (
    Boolean((window as any).singularityDesktop?.isElectron) ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
  const [availableIdes, setAvailableIdes] = useState<Array<{ id: string; name: string; isAvailable: boolean }>>([]);
  const [isIdeMenuOpen, setIsIdeMenuOpen] = useState(false);
  const [ideFeedbackMsg, setIdeFeedbackMsg] = useState<string | null>(null);
  const ideMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDesktop) {
      const desktopApi = (window as any).singularityDesktop;
      if (desktopApi?.getAvailableIdes) {
        desktopApi.getAvailableIdes().then((ides: Array<{ id: string; name: string; isAvailable: boolean }>) => {
          setAvailableIdes(ides);
        }).catch(() => {});
      } else {
        api.get<Array<{ id: string; name: string; isAvailable: boolean }>>('/servers/ides').then((ides) => {
          setAvailableIdes(ides);
        }).catch(() => {});
      }
    }
  }, [isDesktop]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ideMenuRef.current && !ideMenuRef.current.contains(e.target as Node)) {
        setIsIdeMenuOpen(false);
      }
    };
    if (isIdeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isIdeMenuOpen]);

  const handleOpenInIde = async (preferred?: string) => {
    const desktopApi = (window as any).singularityDesktop;
    const ideToUse = preferred || localStorage.getItem('singularity_preferred_ide') || 'antigravity';
    setIsIdeMenuOpen(false);

    try {
      if (desktopApi?.openInIde) {
        try {
          const res = await desktopApi.openInIde(serverId, ideToUse);
          if (res.success) {
            localStorage.setItem('singularity_preferred_ide', ideToUse);
            setIdeFeedbackMsg(`Abierto en ${res.ideUsed}`);
            setTimeout(() => setIdeFeedbackMsg(null), 3000);
            return;
          } else {
            setErrorMessage(res.error || 'No se pudo abrir el editor seleccionado.');
            return;
          }
        } catch {
          // Fall through to REST API if desktop IPC has issues
        }
      }

      const res = await api.post<{ success: boolean; ideUsed: string; error?: string }>(`/servers/${serverId}/open-ide`, { ide: ideToUse });
      if (res.success) {
        localStorage.setItem('singularity_preferred_ide', ideToUse);
        setIdeFeedbackMsg(`Abierto en ${res.ideUsed}`);
        setTimeout(() => setIdeFeedbackMsg(null), 3000);
      } else {
        setErrorMessage(res.error || 'No se pudo abrir el editor seleccionado.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al invocar el editor');
    }
  };

  const fetchFiles = useCallback(async (dirPath: string = currentPath) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await api.get<FileItemData[]>(
        `/servers/${serverId}/files?path=${encodeURIComponent(dirPath)}`
      );
      setFiles(data);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al cargar directorio');
    } finally {
      setIsLoading(false);
    }
  }, [serverId, currentPath]);

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

  // Open file editor
  const handleOpenFile = async (item: FileItemData) => {
    setEditingFile({ path: item.relativePath, name: item.name });
    setIsEditorLoading(true);
    setSaveSuccess(false);
    setErrorMessage(null);
    try {
      const data = await api.get<{ content: string; isTruncated: boolean }>(
        `/servers/${serverId}/files/content?path=${encodeURIComponent(item.relativePath)}`
      );
      setEditorContent(data.content);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al leer archivo');
      setEditingFile(null);
    } finally {
      setIsEditorLoading(false);
    }
  };

  // Save file content
  const handleSaveFile = async () => {
    if (!editingFile) return;
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await api.put(`/servers/${serverId}/files/content`, {
        path: editingFile.path,
        content: editorContent
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      fetchFiles();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al guardar archivo');
    } finally {
      setIsSaving(false);
    }
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
      alert(err instanceof Error ? err.message : 'Error al crear carpeta');
    }
  };

  // Create Empty File & Open in Editor
  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const target = currentPath ? `${currentPath}/${newFileName.trim()}` : newFileName.trim();
    try {
      await api.put(`/servers/${serverId}/files/content`, { path: target, content: '' });
      setIsNewFileOpen(false);
      setNewFileName('');
      await fetchFiles();
      setEditingFile({ path: target, name: target.split('/').pop() || target });
      setEditorContent('');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al crear archivo');
    }
  };

  // Delete item
  const handleDeleteItem = async (item: FileItemData) => {
    const isDir = item.isDirectory;
    const confirmMsg = isDir
      ? `¿Eliminar la carpeta "${item.name}" y todo su contenido? Esta acción no se puede deshacer.`
      : `¿Eliminar el archivo "${item.name}"?`;

    if (!confirm(confirmMsg)) return;

    try {
      await api.delete(`/servers/${serverId}/files?path=${encodeURIComponent(item.relativePath)}`);
      fetchFiles();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al eliminar elemento');
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
      alert(err instanceof Error ? err.message : 'Error al renombrar elemento');
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
    if (['yml', 'yaml', 'json', 'toml', 'properties'].includes(ext)) {
      return <FileCode className="w-4 h-4 text-nebula-cyber shrink-0" />;
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
    return ['txt', 'yml', 'yaml', 'json', 'properties', 'log', 'toml', 'cfg', 'conf', 'sh', 'bat', 'md', 'env'].includes(ext);
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const breadcrumbs = currentPath.split('/').filter(Boolean);

  return (
    <div className="bg-nebula-900 border border-nebula-800 rounded-2xl flex flex-col h-full shadow-md overflow-hidden">
      {/* Top Toolbar */}
      <div className="p-3.5 border-b border-nebula-800 flex flex-wrap items-center justify-between gap-3 bg-nebula-950/40">
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs font-mono overflow-x-auto max-w-full">
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

        {/* Toolbar Actions */}
        <div className="flex items-center gap-2">
          {/* Search within folder */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrar archivos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-nebula-950 border border-nebula-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-nebula-accent w-36 sm:w-44"
            />
          </div>

          {currentPath && (
            <button
              type="button"
              onClick={handleGoUp}
              className="p-1.5 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-slate-300 border border-nebula-750 transition-colors"
              title="Subir un nivel"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => fetchFiles()}
            className="p-1.5 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-slate-300 border border-nebula-750 transition-colors"
            title="Recargar archivos"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsNewFolderOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-nebula-850 hover:bg-nebula-800 text-slate-300 border border-nebula-750 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Crear nueva carpeta"
          >
            <FolderPlus className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Carpeta</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewFileOpen(true)}
            className="px-2.5 py-1.5 rounded-lg bg-nebula-accent/15 hover:bg-nebula-accent/25 text-nebula-accent border border-nebula-accent/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Crear nuevo archivo de texto"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Archivo</span>
          </button>

          {/* Subir archivo */}
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
            title="Subir archivos a esta carpeta (o arrastra y suelta)"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Subir</span>
          </button>

          {/* Desktop IDE Selector Button & Dropdown */}
          {isDesktop && (
            <div className="relative inline-flex items-center" ref={ideMenuRef}>
              <button
                type="button"
                onClick={() => handleOpenInIde()}
                className="px-2.5 py-1.5 rounded-l-lg bg-nebula-800 hover:bg-nebula-750 text-nebula-cyber border border-r-0 border-nebula-700 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                title="Abrir directorio de archivos en tu editor preferido"
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>{ideFeedbackMsg || 'Abrir en IDE'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsIdeMenuOpen((prev) => !prev)}
                className="px-1.5 py-1.5 rounded-r-lg bg-nebula-800 hover:bg-nebula-750 text-nebula-cyber border border-nebula-700 font-semibold text-xs flex items-center transition-colors"
                title="Seleccionar editor o explorador"
              >
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isIdeMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isIdeMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl bg-nebula-900 border border-nebula-750 shadow-2xl z-50 py-1.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider border-b border-nebula-800 mb-1">
                    Abrir archivos en:
                  </div>
                  {availableIdes.length > 0 ? (
                    availableIdes.map((ide) => (
                      <button
                        key={ide.id}
                        type="button"
                        onClick={() => handleOpenInIde(ide.id)}
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
                            Listo
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-500">
                            No detectado
                          </span>
                        )}
                      </button>
                    ))
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleOpenInIde('antigravity')}
                        className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 text-slate-200 hover:bg-nebula-800/80"
                      >
                        <Code2 className="w-3.5 h-3.5 text-nebula-cyber" />
                        <span>Antigravity IDE</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenInIde('vscode')}
                        className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 text-slate-200 hover:bg-nebula-800/80"
                      >
                        <Code2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Visual Studio Code</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenInIde('explorer')}
                        className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 text-slate-200 hover:bg-nebula-800/80"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                        <span>Explorador de Archivos</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-950/60 border-b border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {uploadProgressMsg && (
        <div
          className={`p-3 border-b text-xs flex items-center gap-2 transition-colors ${
            uploadProgressMsg.startsWith('Error')
              ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
              : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
          }`}
        >
          {isUploading ? (
            <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0" />
          ) : (
            <Upload className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{uploadProgressMsg}</span>
        </div>
      )}

      {/* Files Table / List */}
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
                <th className="py-2.5 px-4 font-semibold">Nombre</th>
                <th className="py-2.5 px-4 font-semibold hidden sm:table-cell">Tamaño</th>
                <th className="py-2.5 px-4 font-semibold hidden md:table-cell">Modificado</th>
                <th className="py-2.5 px-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nebula-850/60">
              {filteredFiles.map((item) => (
                <tr
                  key={item.relativePath}
                  className="hover:bg-nebula-800/40 transition-colors group"
                >
                  <td className="py-2 px-4">
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
                              ? 'text-slate-300 hover:text-white cursor-pointer'
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
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      {isEditable(item) && (
                        <button
                          type="button"
                          onClick={() => handleOpenFile(item)}
                          className="p-1.5 rounded hover:bg-nebula-800 text-slate-300 hover:text-nebula-accent transition-colors"
                          title="Editar archivo"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {!item.isDirectory && (
                        <a
                          href={`/api/servers/${serverId}/files/download?path=${encodeURIComponent(item.relativePath)}`}
                          download
                          className="p-1.5 rounded hover:bg-nebula-800 text-slate-300 hover:text-emerald-400 transition-colors"
                          title="Descargar archivo"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}

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

      {/* Embedded File Editor Modal */}
      {editingFile && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in">
          <div className="bg-nebula-900 border border-nebula-750 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Editor Header */}
            <div className="p-3.5 border-b border-nebula-800 bg-nebula-950 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 font-mono text-xs text-slate-300 truncate">
                <FileCode className="w-4 h-4 text-nebula-accent shrink-0" />
                <span className="font-bold text-white">{editingFile.name}</span>
                <span className="text-slate-500 hidden sm:inline">({editingFile.path})</span>
              </div>

              <div className="flex items-center gap-2">
                {saveSuccess && (
                  <span className="text-xs font-mono text-emerald-400 flex items-center gap-1 animate-in fade-in">
                    <Check className="w-3.5 h-3.5" /> Guardado
                  </span>
                )}

                <button
                  type="button"
                  disabled={isSaving || isEditorLoading}
                  onClick={handleSaveFile}
                  className="px-3.5 py-1.5 rounded-lg bg-nebula-accent hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  title="Guardar archivo (Ctrl+S)"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditingFile(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-nebula-800 transition-colors"
                  title="Cerrar editor"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Editor Textarea */}
            <div className="flex-1 p-2 bg-nebula-950 overflow-hidden relative">
              {isEditorLoading ? (
                <div className="h-full flex items-center justify-center text-xs font-mono text-slate-500">
                  Cargando contenido del archivo...
                </div>
              ) : (
                <textarea
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                      e.preventDefault();
                      handleSaveFile();
                    }
                  }}
                  className="w-full h-full p-3 bg-transparent text-slate-100 font-mono text-xs resize-none focus:outline-none border-0 leading-relaxed selection:bg-nebula-accent/30"
                  placeholder="El archivo está vacío..."
                  spellCheck={false}
                />
              )}
            </div>
          </div>
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

      {/* New File Modal */}
      {isNewFileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateFile}
            className="bg-nebula-900 border border-nebula-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-nebula-800 pb-3">
              <div className="flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-nebula-accent" />
                <h3 className="text-sm font-bold text-white">Nuevo Archivo de Texto</h3>
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
              <label className="text-xs text-slate-300 font-semibold block">Nombre del Archivo (con extensión)</label>
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
                Crear y Editar
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
