import { useState, useCallback } from 'react';
import { EditorTabs } from './EditorTabs';
import { MonacoEditor } from './MonacoEditor';
import { EditorWelcome } from './EditorWelcome';
import { ImageViewer, isImageFile } from './ImageViewer';
import { MarkdownViewer, isMarkdownFile } from './MarkdownViewer';
import { DiffViewer } from '@/components/diff';
import { useProjectStore, useEditsStore } from '@/stores';

export function EditorArea() {
  const { openFiles, activeFilePath, updateFileContent, projectPath } = useProjectStore();
  const { pendingEdits, approveEdit, rejectEdit } = useEditsStore();
  const [currentEditIndex, setCurrentEditIndex] = useState(0);

  const hasOpenFiles = openFiles.length > 0;
  const hasPendingEdits = pendingEdits.length > 0;

  // Ensure index is valid
  const safeIndex = Math.min(currentEditIndex, Math.max(0, pendingEdits.length - 1));
  const currentEdit = pendingEdits[safeIndex];

  const handleAccept = useCallback(async () => {
    if (!currentEdit) return;
    await approveEdit(currentEdit.id);
    // Move to next edit or stay at last valid index
    if (safeIndex >= pendingEdits.length - 1 && safeIndex > 0) {
      setCurrentEditIndex(safeIndex - 1);
    }
  }, [currentEdit, approveEdit, safeIndex, pendingEdits.length]);

  const handleReject = useCallback(async () => {
    if (!currentEdit) return;
    await rejectEdit(currentEdit.id);
    // Move to next edit or stay at last valid index
    if (safeIndex >= pendingEdits.length - 1 && safeIndex > 0) {
      setCurrentEditIndex(safeIndex - 1);
    }
  }, [currentEdit, rejectEdit, safeIndex, pendingEdits.length]);

  const handlePrev = useCallback(() => {
    setCurrentEditIndex(i => Math.max(0, i - 1));
  }, []);

  const handleNext = useCallback(() => {
    setCurrentEditIndex(i => Math.min(pendingEdits.length - 1, i + 1));
  }, [pendingEdits.length]);

  // Handle request to fix specific lines with feedback
  const handleRequestFix = useCallback(async (selectedLines: string[], feedback: string) => {
    if (!currentEdit || !window.electron?.claude) return;

    // Build prompt with context - include full file for context
    const fileName = currentEdit.filePath.split('/').pop() || currentEdit.filePath;
    const prompt = `I'm reviewing your changes to \`${fileName}\` and I have feedback on specific lines that need to be fixed:

**File:** \`${currentEdit.filePath}\`

**Selected lines with issues:**
\`\`\`diff
${selectedLines.join('\n')}
\`\`\`

**Issue:** ${feedback}

Please update the file to address this feedback. The file currently contains:
\`\`\`
${currentEdit.newContent}
\`\`\`

Make the necessary changes to fix the issue I described.`;

    try {
      // Clear conversation to avoid picking up unrelated context from terminal Claude usage
      await window.electron.claude.clearConversation(projectPath);

      // Send to Claude - the edit will be updated in place when Claude responds
      await window.electron.claude.send(prompt, {}, projectPath);
    } catch (error) {
      console.error('Failed to request fix:', error);
    }
  }, [currentEdit, projectPath]);

  // Check if active file is an image or markdown
  const isActiveFileImage = activeFilePath ? isImageFile(activeFilePath) : false;
  const isActiveFileMarkdown = activeFilePath ? isMarkdownFile(activeFilePath) : false;

  // Get active file content for markdown viewer
  const activeFile = openFiles.find(f => f.path === activeFilePath);
  const activeFileContent = activeFile?.content || '';

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {hasOpenFiles && !hasPendingEdits && <EditorTabs />}

      <div className="flex-1 overflow-hidden">
        {hasPendingEdits && currentEdit ? (
          <DiffViewer
            edit={currentEdit}
            onAccept={handleAccept}
            onReject={handleReject}
            onRequestFix={handleRequestFix}
            onPrev={handlePrev}
            onNext={handleNext}
            currentIndex={safeIndex}
            totalCount={pendingEdits.length}
          />
        ) : hasOpenFiles && isActiveFileImage && activeFilePath ? (
          <ImageViewer filePath={activeFilePath} />
        ) : hasOpenFiles && isActiveFileMarkdown && activeFilePath ? (
          <MarkdownViewer
            filePath={activeFilePath}
            content={activeFileContent}
            onContentChange={(content) => updateFileContent(activeFilePath, content)}
          />
        ) : hasOpenFiles ? (
          <MonacoEditor />
        ) : (
          <EditorWelcome />
        )}
      </div>
    </div>
  );
}
