import { useState } from 'react';
import { Wand2, PenLine, Loader2, Plus, Check } from 'lucide-react';
import { Modal } from '@/components/ui';
import { useSkillsStore, Skill } from '@/stores';

interface AddSkillModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Mode = 'manual' | 'auto';
type Category = Skill['category'];

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'language', label: 'Language' },
  { value: 'framework', label: 'Framework' },
  { value: 'tooling', label: 'Tooling' },
  { value: 'testing', label: 'Testing' },
  { value: 'deployment', label: 'Deployment' },
  { value: 'custom', label: 'Custom' },
];

interface GeneratedSkill {
  name: string;
  description: string;
  category: Category;
  selected: boolean;
}

export function AddSkillModal({ isOpen, onClose }: AddSkillModalProps) {
  const [mode, setMode] = useState<Mode>('manual');
  const { addSkill, skills: existingSkills } = useSkillsStore();

  // Manual mode state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('custom');

  // Auto mode state
  const [suggestion, setSuggestion] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSkills, setGeneratedSkills] = useState<GeneratedSkill[]>([]);
  const [autoError, setAutoError] = useState<string | null>(null);

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('custom');
    setSuggestion('');
    setGeneratedSkills([]);
    setAutoError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleManualSubmit = () => {
    if (!name.trim()) return;

    addSkill({
      name: name.trim(),
      description: description.trim(),
      category,
      isActive: true,
    });

    handleClose();
  };

  const handleGenerate = async () => {
    if (!suggestion.trim()) return;

    setIsGenerating(true);
    setAutoError(null);
    setGeneratedSkills([]);

    try {
      // Use Claude to generate skills based on suggestion
      const prompt = `Generate 2-3 most relevant development skills/technologies for: "${suggestion}"

Return a JSON array with 2-3 items max. Each object must have:
- "name": skill name (e.g., "Playwright")
- "description": brief description (1 sentence)
- "category": one of "language", "framework", "tooling", "testing", "deployment", "custom"

IMPORTANT: Return ONLY the JSON array, no markdown, no explanation. Maximum 3 skills.
Example: [{"name":"Playwright","description":"End-to-end testing framework","category":"testing"}]`;

      const result = await window.electron?.claude.send(prompt, {}, null);

      if (result?.success && result.response) {
        try {
          let content = result.response.trim();

          // Remove markdown code blocks if present
          content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
          content = content.trim();

          // Try to find JSON array in the response
          const jsonMatch = content.match(/\[[\s\S]*?\]/);
          if (jsonMatch) {
            const skills = JSON.parse(jsonMatch[0]);
            if (Array.isArray(skills) && skills.length > 0) {
              // Filter out skills that already exist (case-insensitive name match)
              const existingNames = new Set(existingSkills.map(s => s.name.toLowerCase()));
              const newSkills = skills
                .filter((s: { name: string }) => !existingNames.has(s.name?.toLowerCase()))
                .map((s: { name: string; description: string; category: Category }) => ({
                  name: s.name || 'Unknown',
                  description: s.description || '',
                  category: CATEGORIES.some(c => c.value === s.category) ? s.category : 'custom',
                  selected: true,
                }));

              if (newSkills.length > 0) {
                setGeneratedSkills(newSkills);
              } else {
                setAutoError('All suggested skills already exist');
              }
            } else {
              setAutoError('No skills generated');
            }
          } else {
            console.log('Response content:', content);
            setAutoError('Could not parse skills from response');
          }
        } catch (e) {
          console.error('Parse error:', e);
          setAutoError('Failed to parse generated skills');
        }
      } else {
        setAutoError(result?.error || 'Failed to generate skills');
      }
    } catch (err) {
      console.error('Generate error:', err);
      setAutoError('Failed to connect to Claude');
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleGeneratedSkill = (index: number) => {
    setGeneratedSkills((prev) =>
      prev.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s))
    );
  };

  const handleAddGenerated = () => {
    const selectedSkills = generatedSkills.filter((s) => s.selected);
    for (const skill of selectedSkills) {
      addSkill({
        name: skill.name,
        description: skill.description,
        category: skill.category,
        isActive: true,
      });
    }
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Add Skill" className="w-[400px]">
      <div className="p-4">
        {/* Mode Toggle */}
        <div className="flex gap-1 p-1 bg-bg-tertiary rounded-lg mb-4">
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-md transition-colors ${
              mode === 'manual'
                ? 'bg-bg-secondary text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            Manual
          </button>
          <button
            onClick={() => setMode('auto')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs rounded-md transition-colors ${
              mode === 'auto'
                ? 'bg-bg-secondary text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5" />
            Auto
          </button>
        </div>

        {mode === 'manual' ? (
          /* Manual Mode */
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., React, TypeScript, Docker"
                className="w-full px-3 py-2 text-sm bg-bg-tertiary text-text-primary rounded-lg border border-border-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
              />
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the skill..."
                rows={2}
                className="w-full px-3 py-2 text-sm bg-bg-tertiary text-text-primary rounded-lg border border-border-primary focus:outline-none focus:ring-1 focus:ring-accent-primary resize-none"
              />
            </div>

            <div>
              <label className="block text-xs text-text-muted mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full px-3 py-2 text-sm bg-bg-tertiary text-text-primary rounded-lg border border-border-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleManualSubmit}
              disabled={!name.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-accent-primary hover:bg-accent-secondary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Skill
            </button>
          </div>
        ) : (
          /* Auto Mode */
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-text-muted mb-1">
                Describe what skills you need
              </label>
              <textarea
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder="e.g., I'm building a full-stack web app with real-time features..."
                rows={3}
                className="w-full px-3 py-2 text-sm bg-bg-tertiary text-text-primary rounded-lg border border-border-primary focus:outline-none focus:ring-1 focus:ring-accent-primary resize-none"
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={!suggestion.trim() || isGenerating}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-accent-primary hover:bg-accent-secondary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  Generate Skills
                </>
              )}
            </button>

            {autoError && (
              <p className="text-xs text-accent-error">{autoError}</p>
            )}

            {generatedSkills.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs text-text-muted">
                  Select skills to add:
                </label>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {generatedSkills.map((skill, index) => (
                    <button
                      key={index}
                      onClick={() => toggleGeneratedSkill(index)}
                      className={`w-full flex items-start gap-2 p-2 rounded-lg text-left transition-colors ${
                        skill.selected
                          ? 'bg-accent-primary/10 border border-accent-primary/30'
                          : 'bg-bg-tertiary border border-transparent hover:border-border-primary'
                      }`}
                    >
                      <div className="mt-0.5">
                        {skill.selected ? (
                          <Check className="w-3.5 h-3.5 text-accent-primary" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded border border-text-muted" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-text-primary font-medium">
                          {skill.name}
                        </div>
                        <div className="text-[10px] text-text-muted truncate">
                          {skill.description}
                        </div>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 bg-bg-secondary text-text-muted rounded">
                        {skill.category}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleAddGenerated}
                  disabled={!generatedSkills.some((s) => s.selected)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm bg-accent-success hover:bg-accent-success/80 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Selected ({generatedSkills.filter((s) => s.selected).length})
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
