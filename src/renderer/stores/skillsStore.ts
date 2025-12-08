import { create } from 'zustand';
import { useProjectStore } from './projectStore';
import { useRulesStore } from './rulesStore';
import { detectAllSkills, DetectedSkill } from '@/services/skillsDetector';

export interface Skill {
  id: string;
  name: string;
  description: string;
  category: 'language' | 'framework' | 'tooling' | 'testing' | 'deployment' | 'custom';
  isActive: boolean;
  isAutoDetected: boolean;
  confidence?: 'high' | 'medium' | 'low';
  source?: string;
}

interface SkillsState {
  skills: Skill[];
  projectDescription: string | null;
  isLoading: boolean;
  loadSkills: () => Promise<void>;
  saveSkills: () => Promise<void>;
  addSkill: (skill: Omit<Skill, 'id' | 'isAutoDetected'>) => void;
  updateSkill: (id: string, updates: Partial<Skill>) => void;
  removeSkill: (id: string) => void;
  toggleSkill: (id: string) => void;
  getActiveSkills: () => Skill[];
  clearSkills: () => void;
  runAutoDetection: () => Promise<void>;
  generateClaudeMd: () => Promise<void>;
}

const getSkillsPath = (projectPath: string) => `${projectPath}/.xtc/skills.json`;
const getProjectInfoPath = (projectPath: string) => `${projectPath}/.xtc/project-info.json`;

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  projectDescription: null,
  isLoading: false,

  loadSkills: async () => {
    const projectPath = useProjectStore.getState().projectPath;
    if (!projectPath || !window.electron) return;

    set({ isLoading: true });

    // Load existing skills
    const result = await window.electron.readFile(getSkillsPath(projectPath));
    let existingSkills: Skill[] = [];

    if (result.success && result.content) {
      try {
        existingSkills = JSON.parse(result.content);
      } catch {
        existingSkills = [];
      }
    }

    // Load project description
    const infoResult = await window.electron.readFile(getProjectInfoPath(projectPath));
    let projectDescription: string | null = null;

    if (infoResult.success && infoResult.content) {
      try {
        const info = JSON.parse(infoResult.content);
        projectDescription = info.description || null;
      } catch {
        // Ignore
      }
    }

    // If no existing skills, run auto-detection
    if (existingSkills.length === 0) {
      set({ skills: [], projectDescription, isLoading: true });
      await get().runAutoDetection();
    } else {
      set({ skills: existingSkills, projectDescription, isLoading: false });
      // Generate CLAUDE.md with loaded skills
      await get().generateClaudeMd();
    }
  },

  runAutoDetection: async () => {
    const projectPath = useProjectStore.getState().projectPath;
    if (!projectPath || !window.electron) return;

    set({ isLoading: true });

    try {
      const { skills: detectedSkills, projectDescription } = await detectAllSkills(projectPath);

      // Convert detected skills to store format
      const skills: Skill[] = detectedSkills.map((detected: DetectedSkill) => ({
        id: detected.id,
        name: detected.name,
        description: detected.description,
        category: detected.category,
        isActive: true, // Auto-detected skills are active by default
        isAutoDetected: true,
        confidence: detected.confidence,
        source: detected.source,
      }));

      // Merge with existing user-defined skills (non-auto-detected)
      const existingUserSkills = get().skills.filter((s) => !s.isAutoDetected);
      const mergedSkills = [...skills, ...existingUserSkills];

      set({ skills: mergedSkills, projectDescription, isLoading: false });

      // Save to disk
      await get().saveSkills();

      // Save project description
      if (projectDescription) {
        await window.electron.writeFile(
          getProjectInfoPath(projectPath),
          JSON.stringify({ description: projectDescription }, null, 2)
        );
      }
    } catch (error) {
      console.error('Failed to auto-detect skills:', error);
      set({ isLoading: false });
    }
  },

  saveSkills: async () => {
    const projectPath = useProjectStore.getState().projectPath;
    if (!projectPath || !window.electron) return;

    const { skills } = get();
    await window.electron.writeFile(
      getSkillsPath(projectPath),
      JSON.stringify(skills, null, 2)
    );

    // Regenerate CLAUDE.md with updated skills
    await get().generateClaudeMd();
  },

  addSkill: (skill) => {
    set((state) => ({
      skills: [
        ...state.skills,
        {
          ...skill,
          id: crypto.randomUUID(),
          isAutoDetected: false,
        },
      ],
    }));
    get().saveSkills();
  },

  updateSkill: (id, updates) => {
    set((state) => ({
      skills: state.skills.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    }));
    get().saveSkills();
  },

  removeSkill: (id) => {
    set((state) => ({
      skills: state.skills.filter((s) => s.id !== id),
    }));
    get().saveSkills();
  },

  toggleSkill: (id) => {
    set((state) => ({
      skills: state.skills.map((s) =>
        s.id === id ? { ...s, isActive: !s.isActive } : s
      ),
    }));
    get().saveSkills();
  },

  getActiveSkills: () => get().skills.filter((s) => s.isActive),

  clearSkills: () => set({ skills: [], projectDescription: null }),

  generateClaudeMd: async () => {
    const projectPath = useProjectStore.getState().projectPath;
    if (!projectPath || !window.electron) return;

    const { projectDescription } = get();
    const activeSkills = get().getActiveSkills();
    const { errors, warnings, suggestions } = useRulesStore.getState().getActiveRulesByServerity();

    const lines: string[] = [];

    // Project description
    if (projectDescription) {
      lines.push('# Project Overview');
      lines.push('');
      lines.push(projectDescription);
      lines.push('');
    }

    // Tech stack from skills
    if (activeSkills.length > 0) {
      lines.push('# Tech Stack');
      lines.push('');

      // Group by category
      const byCategory: Record<string, typeof activeSkills> = {};
      for (const skill of activeSkills) {
        if (!byCategory[skill.category]) {
          byCategory[skill.category] = [];
        }
        byCategory[skill.category].push(skill);
      }

      const categoryOrder = ['language', 'framework', 'tooling', 'testing', 'deployment', 'custom'];
      const categoryLabels: Record<string, string> = {
        language: 'Languages',
        framework: 'Frameworks',
        tooling: 'Tooling',
        testing: 'Testing',
        deployment: 'Deployment',
        custom: 'Other',
      };

      for (const category of categoryOrder) {
        const skills = byCategory[category];
        if (skills && skills.length > 0) {
          lines.push(`## ${categoryLabels[category]}`);
          for (const skill of skills) {
            lines.push(`- ${skill.name}${skill.description ? `: ${skill.description}` : ''}`);
          }
          lines.push('');
        }
      }
    }

    // Rules section
    const hasRules = errors.length > 0 || warnings.length > 0 || suggestions.length > 0;
    if (hasRules) {
      lines.push('# Code Rules');
      lines.push('');

      if (errors.length > 0) {
        lines.push('## ERRORS (you must NEVER violate these)');
        for (const rule of errors) {
          lines.push(`- ${rule.rule}`);
        }
        lines.push('');
      }

      if (warnings.length > 0) {
        lines.push('## WARNINGS (strongly avoid unless explicitly asked)');
        for (const rule of warnings) {
          lines.push(`- ${rule.rule}`);
        }
        lines.push('');
      }

      if (suggestions.length > 0) {
        lines.push('## SUGGESTIONS (prefer when reasonable)');
        for (const rule of suggestions) {
          lines.push(`- ${rule.rule}`);
        }
        lines.push('');
      }
    }

    // Write CLAUDE.md
    const content = lines.join('\n');
    await window.electron.writeFile(`${projectPath}/CLAUDE.md`, content);
  },
}));
