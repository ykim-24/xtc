import { X, Monitor, Code, Bot, Keyboard } from 'lucide-react';
import { useSettingsStore } from '@/stores';
import { useState } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'appearance' | 'editor' | 'claude' | 'shortcuts';

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  const {
    theme, setTheme,
    fontSize, setFontSize,
    fontFamily, setFontFamily,
    tabSize, setTabSize,
    wordWrap, setWordWrap,
    lineNumbers, setLineNumbers,
    minimap, setMinimap,
    cursorBlinking, setCursorBlinking,
    cursorStyle, setCursorStyle,
    renderWhitespace, setRenderWhitespace,
    bracketPairColorization, setBracketPairColorization,
    autoClosingBrackets, setAutoClosingBrackets,
    formatOnSave, setFormatOnSave,
    formatOnPaste, setFormatOnPaste,
    lineHeight, setLineHeight,
    scrollBeyondLastLine, setScrollBeyondLastLine,
    smoothScrolling, setSmoothScrolling,
    autoApproveEdits, setAutoApproveEdits,
    autoDetectContext, setAutoDetectContext,
  } = useSettingsStore();

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'appearance', label: 'Appearance', icon: <Monitor className="w-4 h-4" /> },
    { id: 'editor', label: 'Editor', icon: <Code className="w-4 h-4" /> },
    { id: 'claude', label: 'Claude', icon: <Bot className="w-4 h-4" /> },
    { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard className="w-4 h-4" /> },
  ];

  // Platform detection for shortcut display
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const mod = isMac ? '⌘' : 'Ctrl';
  const shift = isMac ? '⇧' : 'Shift';

  const shortcuts = [
    // File Management
    { action: 'New File', keys: `${mod} + N`, category: 'Files' },
    { action: 'Open Folder', keys: `${mod} + O`, category: 'Files' },
    { action: 'Save', keys: `${mod} + S`, category: 'Files' },
    { action: 'Save All', keys: `${mod} + ${shift} + S`, category: 'Files' },
    { action: 'Go to File', keys: `${mod} + P`, category: 'Files' },

    // Tabs
    { action: 'Close Tab', keys: `${mod} + W`, category: 'Tabs' },
    { action: 'Reopen Closed Tab', keys: `${mod} + ${shift} + T`, category: 'Tabs' },
    { action: 'Next Tab', keys: `${mod} + Alt + →`, category: 'Tabs' },
    { action: 'Previous Tab', keys: `${mod} + Alt + ←`, category: 'Tabs' },
    { action: 'Cycle Tabs', keys: `Ctrl + Tab`, category: 'Tabs' },

    // Panels
    { action: 'Toggle Sidebar', keys: `${mod} + B`, category: 'Panels' },
    { action: 'Toggle Terminal', keys: `${mod} + J`, category: 'Panels' },
    { action: 'Toggle Chat', keys: `${mod} + ${shift} + C`, category: 'Panels' },
    { action: 'Toggle Debug Panel', keys: `${mod} + 0`, category: 'Panels' },

    // Window
    { action: 'Close Window', keys: `${mod} + ${shift} + W`, category: 'Window' },
    { action: 'Settings', keys: `${mod} + ,`, category: 'Window' },
    { action: 'Focus XTC Window', keys: `${mod} + ${shift} + U`, category: 'Window' },

    // Chat
    { action: 'Send Message', keys: `Enter`, category: 'Chat' },
    { action: 'New Line in Chat', keys: `${shift} + Enter`, category: 'Chat' },
  ];

  const fontFamilies = [
    { value: 'Monaco', label: 'Monaco' },
    { value: 'Menlo', label: 'Menlo' },
    { value: 'SF Mono', label: 'SF Mono' },
    { value: 'Fira Code', label: 'Fira Code' },
    { value: 'JetBrains Mono', label: 'JetBrains Mono' },
    { value: 'Cascadia Code', label: 'Cascadia Code' },
    { value: 'Source Code Pro', label: 'Source Code Pro' },
    { value: 'Consolas', label: 'Consolas' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-[700px] h-[500px] bg-bg-primary border border-border-primary rounded-lg shadow-xl flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 bg-bg-secondary border-r border-border-primary p-2 flex-shrink-0">
          <div className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-2">
            Settings
          </div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded transition-colors ${
                activeTab === tab.id
                  ? 'bg-bg-active text-text-primary'
                  : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary flex-shrink-0">
            <h2 className="text-lg font-semibold text-text-primary">
              {tabs.find((t) => t.id === activeTab)?.label}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-bg-hover transition-colors"
            >
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>

          {/* Settings Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === 'appearance' && (
              <>
                <SettingItem
                  label="Theme"
                  description="Select the color theme for the interface"
                >
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}
                    className="px-3 py-1.5 bg-bg-secondary border border-border-primary rounded text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </SettingItem>
              </>
            )}

            {activeTab === 'editor' && (
              <>
                <SettingSection title="Font">
                  <SettingItem
                    label="Font Family"
                    description="Controls the font family used in the editor"
                  >
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="px-3 py-1.5 bg-bg-secondary border border-border-primary rounded text-sm text-text-primary focus:outline-none focus:border-accent-primary cursor-pointer"
                    >
                      {fontFamilies.map((font) => (
                        <option key={font.label} value={font.value} className="bg-bg-secondary text-text-primary">{font.label}</option>
                      ))}
                    </select>
                  </SettingItem>

                  <SettingItem
                    label="Font Size"
                    description="Controls the font size in pixels"
                  >
                    <input
                      type="number"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      min={10}
                      max={30}
                      className="w-20 px-3 py-1.5 bg-bg-secondary border border-border-primary rounded text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                    />
                  </SettingItem>

                  <SettingItem
                    label="Line Height"
                    description="Controls the line height (multiplier)"
                  >
                    <input
                      type="number"
                      value={lineHeight}
                      onChange={(e) => setLineHeight(Number(e.target.value))}
                      min={1}
                      max={3}
                      step={0.1}
                      className="w-20 px-3 py-1.5 bg-bg-secondary border border-border-primary rounded text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                    />
                  </SettingItem>
                </SettingSection>

                <SettingSection title="Cursor">
                  <SettingItem
                    label="Cursor Style"
                    description="Controls the cursor style"
                  >
                    <select
                      value={cursorStyle}
                      onChange={(e) => setCursorStyle(e.target.value as 'line' | 'block' | 'underline')}
                      className="px-3 py-1.5 bg-bg-secondary border border-border-primary rounded text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                    >
                      <option value="line">Line</option>
                      <option value="block">Block</option>
                      <option value="underline">Underline</option>
                    </select>
                  </SettingItem>

                  <SettingItem
                    label="Cursor Blinking"
                    description="Controls the cursor animation style"
                  >
                    <select
                      value={cursorBlinking}
                      onChange={(e) => setCursorBlinking(e.target.value as 'blink' | 'smooth' | 'phase' | 'expand' | 'solid')}
                      className="px-3 py-1.5 bg-bg-secondary border border-border-primary rounded text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                    >
                      <option value="blink">Blink</option>
                      <option value="smooth">Smooth</option>
                      <option value="phase">Phase</option>
                      <option value="expand">Expand</option>
                      <option value="solid">Solid</option>
                    </select>
                  </SettingItem>
                </SettingSection>

                <SettingSection title="Display">
                  <SettingItem
                    label="Line Numbers"
                    description="Controls the display of line numbers"
                  >
                    <select
                      value={lineNumbers}
                      onChange={(e) => setLineNumbers(e.target.value as 'on' | 'off' | 'relative')}
                      className="px-3 py-1.5 bg-bg-secondary border border-border-primary rounded text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                    >
                      <option value="on">On</option>
                      <option value="off">Off</option>
                      <option value="relative">Relative</option>
                    </select>
                  </SettingItem>

                  <SettingItem
                    label="Minimap"
                    description="Controls whether the minimap is shown"
                  >
                    <ToggleSwitch
                      checked={minimap}
                      onChange={setMinimap}
                    />
                  </SettingItem>

                  <SettingItem
                    label="Render Whitespace"
                    description="Controls how whitespace characters are rendered"
                  >
                    <select
                      value={renderWhitespace}
                      onChange={(e) => setRenderWhitespace(e.target.value as 'none' | 'boundary' | 'selection' | 'trailing' | 'all')}
                      className="px-3 py-1.5 bg-bg-secondary border border-border-primary rounded text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                    >
                      <option value="none">None</option>
                      <option value="boundary">Boundary</option>
                      <option value="selection">Selection</option>
                      <option value="trailing">Trailing</option>
                      <option value="all">All</option>
                    </select>
                  </SettingItem>
                </SettingSection>

                <SettingSection title="Text">
                  <SettingItem
                    label="Tab Size"
                    description="The number of spaces a tab is equal to"
                  >
                    <select
                      value={tabSize}
                      onChange={(e) => setTabSize(Number(e.target.value))}
                      className="px-3 py-1.5 bg-bg-secondary border border-border-primary rounded text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                    >
                      <option value={2}>2 spaces</option>
                      <option value={4}>4 spaces</option>
                      <option value={8}>8 spaces</option>
                    </select>
                  </SettingItem>

                  <SettingItem
                    label="Word Wrap"
                    description="Controls how lines should wrap"
                  >
                    <ToggleSwitch
                      checked={wordWrap}
                      onChange={setWordWrap}
                    />
                  </SettingItem>

                  <SettingItem
                    label="Bracket Pair Colorization"
                    description="Controls whether bracket pairs are colorized"
                  >
                    <ToggleSwitch
                      checked={bracketPairColorization}
                      onChange={setBracketPairColorization}
                    />
                  </SettingItem>

                  <SettingItem
                    label="Auto Closing Brackets"
                    description="Controls whether brackets are automatically closed"
                  >
                    <ToggleSwitch
                      checked={autoClosingBrackets}
                      onChange={setAutoClosingBrackets}
                    />
                  </SettingItem>
                </SettingSection>

                <SettingSection title="Formatting">
                  <SettingItem
                    label="Format On Save"
                    description="Format the file when saving"
                  >
                    <ToggleSwitch
                      checked={formatOnSave}
                      onChange={setFormatOnSave}
                    />
                  </SettingItem>

                  <SettingItem
                    label="Format On Paste"
                    description="Format pasted content automatically"
                  >
                    <ToggleSwitch
                      checked={formatOnPaste}
                      onChange={setFormatOnPaste}
                    />
                  </SettingItem>
                </SettingSection>

                <SettingSection title="Scrolling">
                  <SettingItem
                    label="Scroll Beyond Last Line"
                    description="Allow scrolling past the last line"
                  >
                    <ToggleSwitch
                      checked={scrollBeyondLastLine}
                      onChange={setScrollBeyondLastLine}
                    />
                  </SettingItem>

                  <SettingItem
                    label="Smooth Scrolling"
                    description="Enable smooth scrolling animation"
                  >
                    <ToggleSwitch
                      checked={smoothScrolling}
                      onChange={setSmoothScrolling}
                    />
                  </SettingItem>
                </SettingSection>
              </>
            )}

            {activeTab === 'claude' && (
              <>
                <SettingItem
                  label="Auto-Approve Edits"
                  description="Automatically apply file edits from Claude without confirmation"
                >
                  <ToggleSwitch
                    checked={autoApproveEdits}
                    onChange={setAutoApproveEdits}
                  />
                </SettingItem>

                <SettingItem
                  label="Auto-Detect Context"
                  description="Automatically add related files to context when chatting (coming soon)"
                  disabled
                >
                  <ToggleSwitch
                    checked={autoDetectContext}
                    onChange={setAutoDetectContext}
                    disabled
                  />
                </SettingItem>
              </>
            )}

            {activeTab === 'shortcuts' && (
              <div className="space-y-6">
                {['Files', 'Tabs', 'Panels', 'Window', 'Chat'].map((category) => {
                  const categoryShortcuts = shortcuts.filter(s => s.category === category);
                  if (categoryShortcuts.length === 0) return null;
                  return (
                    <div key={category}>
                      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-3">
                        {category}
                      </h3>
                      <div className="space-y-1">
                        {categoryShortcuts.map((shortcut) => (
                          <div
                            key={shortcut.action}
                            className="flex items-center justify-between py-2 px-3 rounded hover:bg-bg-secondary"
                          >
                            <span className="text-sm text-text-primary">{shortcut.action}</span>
                            <kbd className="px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-xs text-text-secondary font-mono">
                              {shortcut.keys}
                            </kbd>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingSection({ title, children }: SettingSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-text-primary border-b border-border-primary pb-2">
        {title}
      </h3>
      <div className="space-y-4 pl-2">
        {children}
      </div>
    </div>
  );
}

interface SettingItemProps {
  label: string;
  description: string;
  children: React.ReactNode;
  disabled?: boolean;
}

function SettingItem({ label, description, children, disabled }: SettingItemProps) {
  return (
    <div className={`flex items-center justify-between gap-4 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text-primary">{label}</div>
        <div className="text-xs text-text-muted">{description}</div>
      </div>
      <div className="flex-shrink-0">
        {children}
      </div>
    </div>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative w-10 h-5 rounded-full transition-colors ${
        checked ? 'bg-accent-primary' : 'bg-bg-tertiary'
      } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}
