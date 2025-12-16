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
    danger: 'text-text-secondary hover:text-red-400',
    warning: 'text-text-secondary hover:text-yellow-400',
    default: 'text-text-secondary hover:text-accent-primary',
  }[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} className="w-[400px]">
      <div className="p-4">
        <p className="text-sm text-text-secondary mb-6">{message}</p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onClose}
            className="text-xs font-mono text-text-secondary hover:text-text-primary transition-colors"
          >
            [ {cancelText.toLowerCase()} ]
          </button>
          <button
            onClick={handleConfirm}
            className={`text-xs font-mono transition-colors ${confirmButtonClass}`}
          >
            [ {confirmText.toLowerCase()} ]
          </button>
        </div>
      </div>
    </Modal>
  );
}
