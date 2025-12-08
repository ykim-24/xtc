import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Loader2, X } from 'lucide-react';
import { Panel, IconButton } from '@/components/ui';
import { useSkillsStore, Skill } from '@/stores';
import { AddSkillModal } from './AddSkillModal';

const CATEGORY_LABELS: Record<Skill['category'], string> = {
  language: 'Languages',
  framework: 'Frameworks',
  tooling: 'Tooling',
  testing: 'Testing',
  deployment: 'Deployment',
  custom: 'Custom',
};

const CATEGORY_ORDER: Skill['category'][] = ['language', 'framework', 'tooling', 'testing', 'deployment', 'custom'];

export function SkillsPanel() {
  const { skills, toggleSkill, removeSkill, isLoading } = useSkillsStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Group skills by category
  const skillsByCategory = skills.reduce((acc, skill) => {
    const category = skill.category || 'custom';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(skill);
    return acc;
  }, {} as Record<Skill['category'], Skill[]>);

  return (
    <Panel
      title="Skills"
      className="h-full border-l border-t border-border-primary"
      actions={
        <IconButton size="sm" onClick={() => setIsModalOpen(true)} title="Add skill">
          <Plus className="w-3.5 h-3.5" />
        </IconButton>
      }
    >
      <div className="p-2 space-y-3 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
            <span className="ml-2 text-xs text-text-muted">Detecting skills...</span>
          </div>
        ) : skills.length === 0 ? (
          <p className="text-[11px] text-text-muted py-2 text-center">
            -- empty --
          </p>
        ) : (
          CATEGORY_ORDER.map((category) => {
            const categorySkills = skillsByCategory[category];
            if (!categorySkills || categorySkills.length === 0) return null;

            return (
              <div key={category}>
                <div className="text-[10px] font-mono text-purple-400 px-2 mb-1">
                  [{CATEGORY_LABELS[category].toUpperCase()}]
                </div>
                <div className="space-y-0.5">
                  {categorySkills.map((skill) => (
                    <SkillItem
                      key={skill.id}
                      skill={skill}
                      onToggle={() => toggleSkill(skill.id)}
                      onDelete={() => removeSkill(skill.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <AddSkillModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </Panel>
  );
}

interface SkillItemProps {
  skill: Skill;
  onToggle: () => void;
  onDelete: () => void;
}

function SkillItem({ skill, onToggle, onDelete }: SkillItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!skill.description) return;

    // Hide tooltip when moving
    setShowTooltip(false);

    // Clear existing timer
    if (timerRef.current) clearTimeout(timerRef.current);

    // Show tooltip after mouse stops for 300ms
    const x = e.clientX;
    const y = e.clientY;
    timerRef.current = setTimeout(() => {
      // Estimate tooltip size (max-width is 200px, estimate height ~60px)
      const tooltipWidth = 200;
      const tooltipHeight = 60;

      // Calculate position with edge detection
      let posX = x + 10;
      let posY = y - 10;

      // Check right edge
      if (posX + tooltipWidth > window.innerWidth) {
        posX = x - tooltipWidth - 10;
      }

      // Check bottom edge
      if (posY + tooltipHeight > window.innerHeight) {
        posY = y - tooltipHeight - 10;
      }

      // Check top edge
      if (posY < 0) {
        posY = y + 20;
      }

      // Check left edge
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

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
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
        className="w-full flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-bg-hover transition-colors text-left font-mono text-[11px] group"
      >
        <button onClick={onToggle} className="flex items-center gap-1.5 flex-1 min-w-0">
          <span className={skill.isActive ? 'text-accent-success' : 'text-text-muted'}>
            {skill.isActive ? '[*]' : '[ ]'}
          </span>
          <span className="text-text-primary truncate">{skill.name}</span>
          {skill.isAutoDetected && (
            <span className="text-text-muted">(auto)</span>
          )}
        </button>
        {isHovered && (
          <button
            onClick={handleDelete}
            className="flex-shrink-0 p-0.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent-error transition-colors"
            title="Delete skill"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      {showTooltip && skill.description && createPortal(
        <div
          className="fixed px-2 py-1 bg-bg-tertiary border border-border-primary rounded text-[10px] text-text-secondary shadow-lg font-mono max-w-[200px] pointer-events-none"
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        >
          {skill.description}
        </div>,
        document.body
      )}
    </>
  );
}
