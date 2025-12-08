import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { Panel, IconButton } from '@/components/ui';
import { useRulesStore, Rule, RuleSeverity } from '@/stores';
import { AddRuleModal } from './AddRuleModal';

const SEVERITY_CONFIG: Record<RuleSeverity, { symbol: string; color: string; label: string }> = {
  error: {
    symbol: '!',
    color: 'text-accent-error',
    label: 'ERRORS',
  },
  warning: {
    symbol: '~',
    color: 'text-accent-warning',
    label: 'WARNINGS',
  },
  suggestion: {
    symbol: '*',
    color: 'text-accent-primary',
    label: 'SUGGESTIONS',
  },
};

export function RulesPanel() {
  const { rules, toggleRule, removeRule, getActiveRulesByServerity } = useRulesStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { errors, warnings, suggestions } = getActiveRulesByServerity();

  // Group active rules by severity
  const errorRules = rules.filter((r) => r.severity === 'error');
  const warningRules = rules.filter((r) => r.severity === 'warning');
  const suggestionRules = rules.filter((r) => r.severity === 'suggestion');

  return (
    <>
      <Panel
        title="Rules"
        className="h-full border-l border-t border-border-primary"
        actions={
          <IconButton size="sm" onClick={() => setIsModalOpen(true)} title="Add rule">
            <Plus className="w-3.5 h-3.5" />
          </IconButton>
        }
      >
        <div className="p-2 space-y-3 overflow-y-auto font-mono">
          {rules.length === 0 ? (
            <p className="text-[11px] text-text-muted py-2 text-center">
              -- empty --
            </p>
          ) : (
            <>
              {/* Error rules */}
              {errorRules.length > 0 && (
                <RuleSection
                  severity="error"
                  rules={errorRules}
                  activeCount={errors.length}
                  onToggle={toggleRule}
                  onRemove={removeRule}
                />
              )}

              {/* Warning rules */}
              {warningRules.length > 0 && (
                <RuleSection
                  severity="warning"
                  rules={warningRules}
                  activeCount={warnings.length}
                  onToggle={toggleRule}
                  onRemove={removeRule}
                />
              )}

              {/* Suggestion rules */}
              {suggestionRules.length > 0 && (
                <RuleSection
                  severity="suggestion"
                  rules={suggestionRules}
                  activeCount={suggestions.length}
                  onToggle={toggleRule}
                  onRemove={removeRule}
                />
              )}
            </>
          )}
        </div>
      </Panel>

      <AddRuleModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

interface RuleSectionProps {
  severity: RuleSeverity;
  rules: Rule[];
  activeCount: number;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

function RuleSection({ severity, rules, activeCount, onToggle, onRemove }: RuleSectionProps) {
  const config = SEVERITY_CONFIG[severity];

  return (
    <div>
      <div className={`text-[10px] px-2 mb-1 ${config.color}`}>
        [{config.label}] <span className="text-text-muted">x{activeCount}</span>
      </div>
      <div className="space-y-0.5">
        {rules.map((rule) => (
          <RuleItem
            key={rule.id}
            rule={rule}
            severity={severity}
            onToggle={() => onToggle(rule.id)}
            onRemove={() => onRemove(rule.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface RuleItemProps {
  rule: Rule;
  severity: RuleSeverity;
  onToggle: () => void;
  onRemove: () => void;
}

function RuleItem({ rule, severity, onToggle, onRemove }: RuleItemProps) {
  const config = SEVERITY_CONFIG[severity];
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    setShowTooltip(false);
    if (timerRef.current) clearTimeout(timerRef.current);

    const x = e.clientX;
    const y = e.clientY;
    timerRef.current = setTimeout(() => {
      const tooltipWidth = 200;
      const tooltipHeight = 60;

      let posX = x + 10;
      let posY = y - 10;

      if (posX + tooltipWidth > window.innerWidth) {
        posX = x - tooltipWidth - 10;
      }
      if (posY + tooltipHeight > window.innerHeight) {
        posY = y - tooltipHeight - 10;
      }
      if (posY < 0) {
        posY = y + 20;
      }
      if (posX < 0) {
        posX = 10;
      }

      setTooltipPos({ x: posX, y: posY });
      setShowTooltip(true);
    }, 300);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowTooltip(false);
  };

  return (
    <>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => {
          setIsHovered(false);
          handleMouseLeave();
        }}
        onMouseMove={handleMouseMove}
        className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-bg-hover transition-colors"
      >
        <button
          onClick={onToggle}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left text-[11px]"
        >
          <span className={rule.isActive ? config.color : 'text-text-muted'}>
            {rule.isActive ? '[*]' : '[ ]'}
          </span>
          <span className={`text-text-primary truncate ${!rule.isActive ? 'opacity-50' : ''}`}>
            {rule.name}
          </span>
          {rule.source === 'learned' && (
            <span className="text-text-muted">(auto)</span>
          )}
        </button>
        {isHovered && (
          <button
            onClick={onRemove}
            className="flex-shrink-0 p-0.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent-error transition-colors"
            title="Remove rule"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      {showTooltip && rule.rule && createPortal(
        <div
          className="fixed px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-[10px] text-text-secondary shadow-lg font-mono max-w-[200px] pointer-events-none"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          {rule.rule}
        </div>,
        document.body
      )}
    </>
  );
}
