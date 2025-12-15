import { Modal } from './Modal';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const confirmButtonClass = {
    danger: 'bg-red-500 hover:bg-red-600 text-white',
    warning: 'bg-yellow-500 hover:bg-yellow-600 text-black',
    default: 'bg-accent-primary hover:bg-accent-primary/80 text-white',
  }[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="w-[400px]">
      <div className="p-4">
        <p className="text-sm text-text-secondary mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-mono text-text-secondary hover:text-text-primary transition-colors rounded border border-border-primary hover:border-border-secondary"
          >
            [ {cancelText.toLowerCase()} ]
          </button>
          <button
            onClick={handleConfirm}
            className={`px-3 py-1.5 text-xs font-mono rounded transition-colors ${confirmButtonClass}`}
          >
            [ {confirmText.toLowerCase()} ]
          </button>
        </div>
      </div>
    </Modal>
  );
}
