import { useState, useRef, useEffect, useMemo } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { APP_NAME } from '@shared/constants';
import { useSettingsStore, useProjectStore } from '@/stores';
import { SettingsModal } from '@/components/settings';
import { FileSearchModal } from '@/components/search';

// Detect platform for shortcut display
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘' : 'Ctrl+';
const altKey = isMac ? '⌥' : 'Alt+';
const shiftKey = isMac ? '⇧' : 'Shift+';

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  divider?: boolean;
  disabled?: boolean;
}

interface MenuConfig {
  [key: string]: MenuItem[];
}

export function TitleBar() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fileSearchOpen, setFileSearchOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    explorerVisible, setExplorerVisible,
    chatVisible, setChatVisible,
    terminalVisible, setTerminalVisible,
    debugVisible, setDebugVisible
  } = useSettingsStore();

  const {
    projectPath,
    openFiles,
    activeFilePath,
    saveActiveFile,
    saveAllFiles,
    closeFile,
    setActiveFilePath,
    recentlyClosed,
    reopenLastClosedFile,
    createNewFile,
  } = useProjectStore();

  const activeFile = openFiles.find((f) => f.path === activeFilePath);
  const hasDirtyFiles = openFiles.some((f) => f.isDirty);
  const activeFileIndex = openFiles.findIndex((f) => f.path === activeFilePath);
  const hasRecentlyClosed = recentlyClosed.length > 0;

  const handleMinimize = () => window.electron?.minimize();
  const handleMaximize = () => window.electron?.maximize();
  const handleCloseWindow = () => window.electron?.close();

  // Close current tab, or close window if no tabs open
  const handleCloseTab = () => {
    if (activeFilePath && openFiles.length > 0) {
      closeFile(activeFilePath);
    } else {
      window.electron?.close();
    }
  };

  const handleOpenFolder = async () => {
    const path = await window.electron?.openFolder();
    if (path) {
      useProjectStore.getState().setProjectPath(path);
      // File tree loading is handled by Explorer component
    }
    setActiveMenu(null);
  };

  const handleSave = async () => {
    await saveActiveFile();
    setActiveMenu(null);
  };

  const handleSaveAll = async () => {
    await saveAllFiles();
    setActiveMenu(null);
  };

  // Navigate to next/previous tab
  const handleNextTab = () => {
    if (openFiles.length > 1) {
      const nextIndex = (activeFileIndex + 1) % openFiles.length;
      setActiveFilePath(openFiles[nextIndex].path);
    }
  };

  const handlePrevTab = () => {
    if (openFiles.length > 1) {
      const prevIndex = (activeFileIndex - 1 + openFiles.length) % openFiles.length;
      setActiveFilePath(openFiles[prevIndex].path);
    }
  };

  // Toggle sidebar (explorer)
  const handleToggleSidebar = () => {
    setExplorerVisible(!explorerVisible);
  };

  const menus: MenuConfig = useMemo(() => ({
    File: [
      { label: 'New File', shortcut: `${modKey}N`, action: createNewFile },
      { label: 'Open Folder...', shortcut: `${modKey}O`, action: handleOpenFolder },
      { label: 'divider', divider: true },
      { label: 'Save', shortcut: `${modKey}S`, action: handleSave, disabled: !activeFile?.isDirty },
      { label: 'Save All', shortcut: `${modKey}${shiftKey}S`, action: handleSaveAll, disabled: !hasDirtyFiles },
      { label: 'divider', divider: true },
      { label: 'Close Tab', shortcut: `${modKey}W`, action: handleCloseTab, disabled: openFiles.length === 0 },
      { label: 'Reopen Closed Tab', shortcut: `${modKey}${shiftKey}T`, action: reopenLastClosedFile, disabled: !hasRecentlyClosed },
      { label: 'Close Window', shortcut: `${modKey}${shiftKey}W`, action: handleCloseWindow },
    ],
    Edit: [
      { label: 'Undo', shortcut: `${modKey}Z`, action: () => document.execCommand('undo') },
      { label: 'Redo', shortcut: `${modKey}${shiftKey}Z`, action: () => document.execCommand('redo') },
      { label: 'divider', divider: true },
      { label: 'Cut', shortcut: `${modKey}X`, action: () => document.execCommand('cut') },
      { label: 'Copy', shortcut: `${modKey}C`, action: () => document.execCommand('copy') },
      { label: 'Paste', shortcut: `${modKey}V`, action: () => document.execCommand('paste') },
      { label: 'divider', divider: true },
      { label: 'Select All', shortcut: `${modKey}A`, action: () => document.execCommand('selectAll') },
    ],
    View: [
      { label: explorerVisible ? '✓ Explorer' : '  Explorer', shortcut: `${modKey}B`, action: () => { setExplorerVisible(!explorerVisible); setActiveMenu(null); } },
      { label: chatVisible ? '✓ Chat Panel' : '  Chat Panel', shortcut: `${modKey}${shiftKey}C`, action: () => { setChatVisible(!chatVisible); setActiveMenu(null); } },
      { label: terminalVisible ? '✓ Terminal' : '  Terminal', shortcut: `${modKey}J`, action: () => { setTerminalVisible(!terminalVisible); setActiveMenu(null); } },
      { label: 'divider', divider: true },
      { label: 'Toggle Developer Tools', shortcut: `${modKey}${altKey}I`, action: () => { /* Handled by Electron */ } },
    ],
    Go: [
      { label: 'Next Tab', shortcut: `${modKey}${altKey}→`, action: handleNextTab, disabled: openFiles.length <= 1 },
      { label: 'Previous Tab', shortcut: `${modKey}${altKey}←`, action: handlePrevTab, disabled: openFiles.length <= 1 },
      { label: 'divider', divider: true },
      { label: 'Go to File...', shortcut: `${modKey}P`, action: () => { setFileSearchOpen(true); setActiveMenu(null); }, disabled: !projectPath },
      { label: 'Go to Line...', shortcut: `${modKey}G`, action: () => { /* TODO: Go to line */ }, disabled: true },
    ],
    Settings: [
      { label: 'Preferences...', shortcut: `${modKey},`, action: () => { setSettingsOpen(true); setActiveMenu(null); } },
    ],
    Help: [
      { label: 'Documentation', action: () => console.log('Docs') },
      { label: 'divider', divider: true },
      { label: 'About', action: () => console.log('About') },
    ],
  }), [activeFile?.isDirty, hasDirtyFiles, explorerVisible, chatVisible, terminalVisible, openFiles.length, hasRecentlyClosed, handleOpenFolder, handleSave, handleSaveAll, handleCloseTab, handleCloseWindow, handleNextTab, handlePrevTab, createNewFile, reopenLastClosedFile, setExplorerVisible, setChatVisible, setTerminalVisible, setSettingsOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };

    if (activeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeMenu]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      const isAlt = e.altKey;

      // Close Tab: Cmd/Ctrl + W (close window if no tabs)
      if (isMod && !e.shiftKey && e.key === 'w') {
        e.preventDefault();
        handleCloseTab();
        return;
      }

      // Close Window: Cmd/Ctrl + Shift + W
      if (isMod && e.shiftKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        handleCloseWindow();
        return;
      }

      // Save: Cmd/Ctrl + S
      if (isMod && e.key === 's') {
        e.preventDefault();
        if (e.shiftKey) {
          saveAllFiles();
        } else {
          saveActiveFile();
        }
        return;
      }

      // Toggle Terminal: Cmd/Ctrl + J
      if (isMod && !e.shiftKey && e.key === 'j') {
        e.preventDefault();
        setTerminalVisible(!terminalVisible);
        return;
      }

      // Toggle Sidebar (Explorer): Cmd/Ctrl + B
      if (isMod && !e.shiftKey && e.key === 'b') {
        e.preventDefault();
        setExplorerVisible(!explorerVisible);
        return;
      }

      // Toggle Chat: Cmd/Ctrl + Shift + C
      if (isMod && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setChatVisible(!chatVisible);
        return;
      }

      // Open Settings: Cmd/Ctrl + ,
      if (isMod && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }

      // Next Tab: Cmd/Ctrl + Alt + Right or Ctrl + Tab
      if ((isMod && isAlt && e.key === 'ArrowRight') || (e.ctrlKey && e.key === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        handleNextTab();
        return;
      }

      // Previous Tab: Cmd/Ctrl + Alt + Left or Ctrl + Shift + Tab
      if ((isMod && isAlt && e.key === 'ArrowLeft') || (e.ctrlKey && e.key === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        handlePrevTab();
        return;
      }

      // Open Folder: Cmd/Ctrl + O
      if (isMod && !e.shiftKey && e.key === 'o') {
        e.preventDefault();
        handleOpenFolder();
        return;
      }

      // New File: Cmd/Ctrl + N
      if (isMod && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        createNewFile();
        return;
      }

      // Reopen Closed Tab: Cmd/Ctrl + Shift + T
      if (isMod && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        reopenLastClosedFile();
        return;
      }

      // Go to File: Cmd/Ctrl + P
      if (isMod && !e.shiftKey && e.key === 'p') {
        e.preventDefault();
        if (projectPath) {
          setFileSearchOpen(true);
        }
        return;
      }

      // Toggle Debug Panel: Cmd/Ctrl + 0
      if (isMod && e.key === '0') {
        e.preventDefault();
        setDebugVisible(!debugVisible);
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [saveActiveFile, saveAllFiles, terminalVisible, setTerminalVisible, explorerVisible, setExplorerVisible, chatVisible, setChatVisible, debugVisible, setDebugVisible, handleCloseTab, handleCloseWindow, handleNextTab, handlePrevTab, handleOpenFolder, createNewFile, reopenLastClosedFile, projectPath]);

  return (
    <div className="flex items-center justify-between h-8 bg-bg-primary border-b border-border-primary select-none app-drag">
      {/* App name and menu */}
      <div className="flex items-center gap-4 px-3 app-no-drag" ref={menuRef}>
        <span className="text-sm font-semibold text-text-primary">{APP_NAME}</span>
        <nav className="flex items-center gap-1">
          {Object.keys(menus).map((menuName) => (
            <div key={menuName} className="relative">
              <button
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  activeMenu === menuName
                    ? 'bg-bg-active text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                }`}
                onClick={() => setActiveMenu(activeMenu === menuName ? null : menuName)}
                onMouseEnter={() => activeMenu && setActiveMenu(menuName)}
              >
                {menuName}
              </button>
              {activeMenu === menuName && (
                <div className="absolute top-full left-0 mt-1 py-1 min-w-48 bg-bg-secondary border border-border-primary rounded shadow-lg z-50">
                  {menus[menuName].map((item, index) =>
                    item.divider ? (
                      <div key={index} className="my-1 border-t border-border-primary" />
                    ) : (
                      <button
                        key={index}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                          item.disabled
                            ? 'text-text-muted cursor-not-allowed'
                            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                        }`}
                        onClick={() => {
                          if (!item.disabled && item.action) {
                            item.action();
                            setActiveMenu(null);
                          }
                        }}
                        disabled={item.disabled}
                      >
                        <span>{item.label}</span>
                        {item.shortcut && (
                          <span className="ml-4 text-text-muted">{item.shortcut}</span>
                        )}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>

      {/* Window controls */}
      <div className="flex items-center app-no-drag">
        <button
          onClick={handleMinimize}
          className="flex items-center justify-center w-12 h-8 hover:bg-bg-hover transition-colors"
        >
          <Minus className="w-4 h-4 text-text-secondary" />
        </button>
        <button
          onClick={handleMaximize}
          className="flex items-center justify-center w-12 h-8 hover:bg-bg-hover transition-colors"
        >
          <Square className="w-3 h-3 text-text-secondary" />
        </button>
        <button
          onClick={handleCloseWindow}
          className="flex items-center justify-center w-12 h-8 hover:bg-accent-error transition-colors group"
        >
          <X className="w-4 h-4 text-text-secondary group-hover:text-white" />
        </button>
      </div>

      {/* Settings Modal */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* File Search Modal */}
      <FileSearchModal isOpen={fileSearchOpen} onClose={() => setFileSearchOpen(false)} />
    </div>
  );
}
