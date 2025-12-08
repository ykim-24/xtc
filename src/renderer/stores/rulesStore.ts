import { create } from 'zustand';
import { useProjectStore } from './projectStore';

export type RuleSeverity = 'error' | 'warning' | 'suggestion';

export interface Rule {
  id: string;
  name: string;
  description: string;
  rule: string; // The actual instruction/guideline
  severity: RuleSeverity; // error = must never violate, warning = strongly avoid, suggestion = prefer
  isActive: boolean;
  createdAt: string;
  source: 'user' | 'learned'; // 'user' = manually created, 'learned' = from rejection
  // For learned rules, store the context
  learnedFrom?: {
    rejectionReason: string;
    originalPrompt?: string;
    suggestedEdit?: string;
    timestamp: string;
  };
}

interface RulesState {
  rules: Rule[];
  isLoading: boolean;
  loadRules: () => Promise<void>;
  saveRules: () => Promise<void>;
  addRule: (rule: Omit<Rule, 'id' | 'createdAt'>) => void;
  addLearnedRule: (rejectionReason: string, originalPrompt?: string, suggestedEdit?: string) => Promise<Rule>;
  updateRule: (id: string, updates: Partial<Rule>) => void;
  removeRule: (id: string) => void;
  toggleRule: (id: string) => void;
  getActiveRules: () => Rule[];
  getActiveRulesByServerity: () => { errors: Rule[]; warnings: Rule[]; suggestions: Rule[] };
  formatRulesForPrompt: () => string;
  clearRules: () => void;
  findSimilarRule: (reason: string) => Rule | null;
}

const getRulesPath = (projectPath: string) => `${projectPath}/.xtc/rules.json`;

// Simple similarity check - could be enhanced with embeddings later
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  // Word overlap
  const words1 = new Set(s1.split(/\s+/).filter((w) => w.length > 3));
  const words2 = new Set(s2.split(/\s+/).filter((w) => w.length > 3));

  if (words1.size === 0 || words2.size === 0) return 0;

  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }

  return overlap / Math.max(words1.size, words2.size);
}

// Generate a rule name from rejection reason
function generateRuleName(reason: string): string {
  // Take first few words, capitalize
  const words = reason.split(/\s+/).slice(0, 5);
  if (words.length === 0) return 'New Rule';

  // Capitalize first letter
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);

  let name = words.join(' ');
  if (name.length > 40) {
    name = name.slice(0, 37) + '...';
  }

  return name;
}

// Convert rejection reason to a rule instruction
function generateRuleInstruction(reason: string): string {
  const lowerReason = reason.toLowerCase().trim();

  // If it already starts with action words, use as-is
  if (
    lowerReason.startsWith("don't") ||
    lowerReason.startsWith('do not') ||
    lowerReason.startsWith('never') ||
    lowerReason.startsWith('always') ||
    lowerReason.startsWith('prefer') ||
    lowerReason.startsWith('avoid') ||
    lowerReason.startsWith('use')
  ) {
    return reason;
  }

  // Otherwise, prefix with instruction
  return `Avoid: ${reason}`;
}

export const useRulesStore = create<RulesState>((set, get) => ({
  rules: [],
  isLoading: false,

  loadRules: async () => {
    const projectPath = useProjectStore.getState().projectPath;
    if (!projectPath || !window.electron) return;

    set({ isLoading: true });
    const result = await window.electron.readFile(getRulesPath(projectPath));

    if (result.success && result.content) {
      try {
        const rules = JSON.parse(result.content);
        set({ rules });
      } catch {
        set({ rules: [] });
      }
    } else {
      set({ rules: [] });
    }
    set({ isLoading: false });
  },

  saveRules: async () => {
    const projectPath = useProjectStore.getState().projectPath;
    if (!projectPath || !window.electron) return;

    const { rules } = get();
    await window.electron.writeFile(
      getRulesPath(projectPath),
      JSON.stringify(rules, null, 2)
    );

    // Regenerate CLAUDE.md with updated rules (dynamic import to avoid circular dependency)
    const { useSkillsStore } = await import('./skillsStore');
    await useSkillsStore.getState().generateClaudeMd();
  },

  addRule: (rule) => {
    const newRule: Rule = {
      ...rule,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    set((state) => ({
      rules: [...state.rules, newRule],
    }));
    get().saveRules();
  },

  addLearnedRule: async (rejectionReason: string, originalPrompt?: string, suggestedEdit?: string) => {
    // Check for similar existing rules first
    const existingRule = get().findSimilarRule(rejectionReason);
    if (existingRule) {
      // Don't add duplicate, return existing
      return existingRule;
    }

    const newRule: Rule = {
      id: crypto.randomUUID(),
      name: generateRuleName(rejectionReason),
      description: `Learned from rejection: "${rejectionReason.slice(0, 100)}${rejectionReason.length > 100 ? '...' : ''}"`,
      rule: generateRuleInstruction(rejectionReason),
      severity: 'warning', // Learned rules default to warning, user can upgrade to error
      isActive: true,
      createdAt: new Date().toISOString(),
      source: 'learned',
      learnedFrom: {
        rejectionReason,
        originalPrompt,
        suggestedEdit,
        timestamp: new Date().toISOString(),
      },
    };

    set((state) => ({
      rules: [...state.rules, newRule],
    }));
    await get().saveRules();

    return newRule;
  },

  findSimilarRule: (reason: string) => {
    const { rules } = get();
    const SIMILARITY_THRESHOLD = 0.6;

    for (const rule of rules) {
      // Check against rule text
      if (calculateSimilarity(reason, rule.rule) >= SIMILARITY_THRESHOLD) {
        return rule;
      }
      // Check against rejection reason if learned
      if (rule.learnedFrom?.rejectionReason) {
        if (calculateSimilarity(reason, rule.learnedFrom.rejectionReason) >= SIMILARITY_THRESHOLD) {
          return rule;
        }
      }
    }

    return null;
  },

  updateRule: (id, updates) => {
    set((state) => ({
      rules: state.rules.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    }));
    get().saveRules();
  },

  removeRule: (id) => {
    set((state) => ({
      rules: state.rules.filter((r) => r.id !== id),
    }));
    get().saveRules();
  },

  toggleRule: (id) => {
    set((state) => ({
      rules: state.rules.map((r) =>
        r.id === id ? { ...r, isActive: !r.isActive } : r
      ),
    }));
    get().saveRules();
  },

  getActiveRules: () => get().rules.filter((r) => r.isActive),

  getActiveRulesByServerity: () => {
    const activeRules = get().rules.filter((r) => r.isActive);
    return {
      errors: activeRules.filter((r) => r.severity === 'error'),
      warnings: activeRules.filter((r) => r.severity === 'warning'),
      suggestions: activeRules.filter((r) => r.severity === 'suggestion'),
    };
  },

  formatRulesForPrompt: () => {
    const { errors, warnings, suggestions } = get().getActiveRulesByServerity();

    if (errors.length === 0 && warnings.length === 0 && suggestions.length === 0) {
      return '';
    }

    const lines: string[] = ['## Code Rules'];

    if (errors.length > 0) {
      lines.push('');
      lines.push('ERRORS (you must NEVER violate these):');
      errors.forEach((r) => lines.push(`- ${r.rule}`));
    }

    if (warnings.length > 0) {
      lines.push('');
      lines.push('WARNINGS (strongly avoid unless explicitly asked):');
      warnings.forEach((r) => lines.push(`- ${r.rule}`));
    }

    if (suggestions.length > 0) {
      lines.push('');
      lines.push('SUGGESTIONS (prefer when reasonable):');
      suggestions.forEach((r) => lines.push(`- ${r.rule}`));
    }

    return lines.join('\n');
  },

  clearRules: () => set({ rules: [] }),
}));
