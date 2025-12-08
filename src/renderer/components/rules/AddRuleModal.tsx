import { useState } from 'react';
import { Plus, AlertTriangle, AlertCircle, Lightbulb } from 'lucide-react';
import { Modal } from '@/components/ui';
import { useRulesStore, RuleSeverity } from '@/stores';

interface AddRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SEVERITY_OPTIONS: { value: RuleSeverity; label: string; description: string; icon: typeof AlertTriangle }[] = [
  {
    value: 'error',
    label: 'Error',
    description: 'Must never violate',
    icon: AlertTriangle,
  },
  {
    value: 'warning',
    label: 'Warning',
    description: 'Strongly avoid',
    icon: AlertCircle,
  },
  {
    value: 'suggestion',
    label: 'Suggestion',
    description: 'Prefer when possible',
    icon: Lightbulb,
  },
];

export function AddRuleModal({ isOpen, onClose }: AddRuleModalProps) {
  const { addRule } = useRulesStore();

  const [name, setName] = useState('');
  const [rule, setRule] = useState('');
  const [severity, setSeverity] = useState<RuleSeverity>('warning');

  const resetForm = () => {
    setName('');
    setRule('');
    setSeverity('warning');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = () => {
    if (!name.trim() || !rule.trim()) return;

    addRule({
      name: name.trim(),
      description: '',
      rule: rule.trim(),
      severity,
      isActive: true,
      source: 'user',
    });

    handleClose();
  };

  const getSeverityColor = (s: RuleSeverity) => {
    switch (s) {
      case 'error':
        return 'text-accent-error';
      case 'warning':
        return 'text-accent-warning';
      case 'suggestion':
        return 'text-accent-primary';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Rule" className="w-[400px]">
      <div className="p-4 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs text-text-muted mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., No console.log"
            className="w-full px-3 py-2 text-sm bg-bg-tertiary text-text-primary rounded-lg border border-border-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
            autoFocus
          />
        </div>

        {/* Rule instruction */}
        <div>
          <label className="block text-xs text-text-muted mb-1">
            Rule (what Claude should follow)
          </label>
          <textarea
            value={rule}
            onChange={(e) => setRule(e.target.value)}
            placeholder="e.g., Never use console.log in production code. Use proper logging utilities instead."
            rows={3}
            className="w-full px-3 py-2 text-sm bg-bg-tertiary text-text-primary rounded-lg border border-border-primary focus:outline-none focus:ring-1 focus:ring-accent-primary resize-none"
          />
        </div>

        {/* Severity */}
        <div>
          <label className="block text-xs text-text-muted mb-2">Severity</label>
          <div className="flex gap-2">
            {SEVERITY_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = severity === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setSeverity(option.value)}
                  className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border transition-all ${
                    isSelected
                      ? `border-current ${getSeverityColor(option.value)} bg-current/5`
                      : 'border-border-primary text-text-muted hover:border-border-secondary hover:bg-bg-hover'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? getSeverityColor(option.value) : ''}`} />
                  <span className={`text-xs font-medium ${isSelected ? 'text-text-primary' : ''}`}>
                    {option.label}
                  </span>
                  <span className="text-[10px] text-text-muted">{option.description}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!name.trim() || !rule.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-accent-primary hover:bg-accent-secondary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>
    </Modal>
  );
}
