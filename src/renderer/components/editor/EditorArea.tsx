import { useState, useCallback } from 'react';
import { EditorTabs } from './EditorTabs';
import { MonacoEditor } from './MonacoEditor';
import { EditorWelcome } from './EditorWelcome';
import { DiffViewer } from '@/components/diff';
import { useProjectStore, useEditsStore } from '@/stores';

export function EditorArea() {
  const { openFiles } = useProjectStore();
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

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {hasOpenFiles && !hasPendingEdits && <EditorTabs />}

      <div className="flex-1 overflow-hidden">
        {hasPendingEdits && currentEdit ? (
          <DiffViewer
            edit={currentEdit}
            onAccept={handleAccept}
            onReject={handleReject}
            onPrev={handlePrev}
            onNext={handleNext}
            currentIndex={safeIndex}
            totalCount={pendingEdits.length}
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
