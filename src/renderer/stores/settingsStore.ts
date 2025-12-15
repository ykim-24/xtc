import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ThemeName } from "@/themes/tokens";

interface SettingsState {
  // User
  userName: string;
  setUserName: (name: string) => void;
  hasCompletedOnboarding: boolean;
  setHasCompletedOnboarding: (completed: boolean) => void;

  // Appearance
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;

  // Prompt settings
  showEnhancedPrompt: boolean;
  setShowEnhancedPrompt: (show: boolean) => void;

  // Editor settings
  fontSize: number;
  setFontSize: (size: number) => void;
  fontFamily: string;
  setFontFamily: (family: string) => void;
  tabSize: number;
  setTabSize: (size: number) => void;
  wordWrap: boolean;
  setWordWrap: (wrap: boolean) => void;
  lineNumbers: "on" | "off" | "relative";
  setLineNumbers: (value: "on" | "off" | "relative") => void;
  minimap: boolean;
  setMinimap: (show: boolean) => void;
  cursorBlinking: "blink" | "smooth" | "phase" | "expand" | "solid";
  setCursorBlinking: (
    style: "blink" | "smooth" | "phase" | "expand" | "solid"
  ) => void;
  cursorStyle: "line" | "block" | "underline";
  setCursorStyle: (style: "line" | "block" | "underline") => void;
  renderWhitespace: "none" | "boundary" | "selection" | "trailing" | "all";
  setRenderWhitespace: (
    value: "none" | "boundary" | "selection" | "trailing" | "all"
  ) => void;
  bracketPairColorization: boolean;
  setBracketPairColorization: (enabled: boolean) => void;
  autoClosingBrackets: boolean;
  setAutoClosingBrackets: (enabled: boolean) => void;
  formatOnSave: boolean;
  setFormatOnSave: (enabled: boolean) => void;
  formatOnPaste: boolean;
  setFormatOnPaste: (enabled: boolean) => void;
  lineHeight: number;
  setLineHeight: (height: number) => void;
  scrollBeyondLastLine: boolean;
  setScrollBeyondLastLine: (enabled: boolean) => void;
  smoothScrolling: boolean;
  setSmoothScrolling: (enabled: boolean) => void;

  // Panel visibility
  explorerVisible: boolean;
  setExplorerVisible: (visible: boolean) => void;
  contextVisible: boolean;
  setContextVisible: (visible: boolean) => void;
  chatVisible: boolean;
  setChatVisible: (visible: boolean) => void;
  terminalVisible: boolean;
  setTerminalVisible: (visible: boolean) => void;
  debugVisible: boolean;
  setDebugVisible: (visible: boolean) => void;

  // Panel sizes (percentages)
  leftPanelSize: number;
  setLeftPanelSize: (size: number) => void;
  rightPanelSize: number;
  setRightPanelSize: (size: number) => void;

  // Claude settings
  autoApproveEdits: boolean;
  setAutoApproveEdits: (autoApprove: boolean) => void;
  autoDetectContext: boolean;
  setAutoDetectContext: (autoDetect: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // User
      userName: "",
      setUserName: (userName) => set({ userName }),
      hasCompletedOnboarding: false,
      setHasCompletedOnboarding: (hasCompletedOnboarding) =>
        set({ hasCompletedOnboarding }),

      // Appearance
      theme: "dark",
      setTheme: (theme) => set({ theme }),

      // Prompt settings
      showEnhancedPrompt: false,
      setShowEnhancedPrompt: (showEnhancedPrompt) =>
        set({ showEnhancedPrompt }),

      // Editor settings
      fontSize: 13,
      setFontSize: (fontSize) => set({ fontSize }),
      fontFamily: "Monaco",
      setFontFamily: (fontFamily) => set({ fontFamily }),
      tabSize: 2,
      setTabSize: (tabSize) => set({ tabSize }),
      wordWrap: true,
      setWordWrap: (wordWrap) => set({ wordWrap }),
      lineNumbers: "on",
      setLineNumbers: (lineNumbers) => set({ lineNumbers }),
      minimap: true,
      setMinimap: (minimap) => set({ minimap }),
      cursorBlinking: "blink",
      setCursorBlinking: (cursorBlinking) => set({ cursorBlinking }),
      cursorStyle: "line",
      setCursorStyle: (cursorStyle) => set({ cursorStyle }),
      renderWhitespace: "selection",
      setRenderWhitespace: (renderWhitespace) => set({ renderWhitespace }),
      bracketPairColorization: true,
      setBracketPairColorization: (bracketPairColorization) =>
        set({ bracketPairColorization }),
      autoClosingBrackets: true,
      setAutoClosingBrackets: (autoClosingBrackets) =>
        set({ autoClosingBrackets }),
      formatOnSave: false,
      setFormatOnSave: (formatOnSave) => set({ formatOnSave }),
      formatOnPaste: false,
      setFormatOnPaste: (formatOnPaste) => set({ formatOnPaste }),
      lineHeight: 1.5,
      setLineHeight: (lineHeight) => set({ lineHeight }),
      scrollBeyondLastLine: true,
      setScrollBeyondLastLine: (scrollBeyondLastLine) =>
        set({ scrollBeyondLastLine }),
      smoothScrolling: true,
      setSmoothScrolling: (smoothScrolling) => set({ smoothScrolling }),

      // Panel visibility
      explorerVisible: true,
      setExplorerVisible: (explorerVisible) => set({ explorerVisible }),
      contextVisible: true,
      setContextVisible: (contextVisible) => set({ contextVisible }),
      chatVisible: true,
      setChatVisible: (chatVisible) => set({ chatVisible }),
      terminalVisible: true,
      setTerminalVisible: (terminalVisible) => set({ terminalVisible }),
      debugVisible: false,
      setDebugVisible: (debugVisible) => set({ debugVisible }),

      // Panel sizes
      leftPanelSize: 20,
      setLeftPanelSize: (leftPanelSize) => set({ leftPanelSize }),
      rightPanelSize: 30,
      setRightPanelSize: (rightPanelSize) => set({ rightPanelSize }),

      // Claude settings
      autoApproveEdits: false,
      setAutoApproveEdits: (autoApproveEdits) => set({ autoApproveEdits }),
      autoDetectContext: false,
      setAutoDetectContext: (autoDetectContext) => set({ autoDetectContext }),
    }),
    {
      name: "xtc-settings",
    }
  )
);
