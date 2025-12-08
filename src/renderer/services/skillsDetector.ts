// Skills auto-detection service
// Analyzes package.json, README, and project structure to detect skills

export interface DetectedSkill {
  id: string;
  name: string;
  description: string;
  category: 'language' | 'framework' | 'tooling' | 'testing' | 'deployment';
  confidence: 'high' | 'medium' | 'low';
  source: string; // Where it was detected from
}

interface PackageJson {
  name?: string;
  description?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

// Known frameworks and their detection patterns
const FRAMEWORK_PATTERNS: Record<string, { name: string; category: DetectedSkill['category']; description: string }> = {
  // Frontend frameworks
  'react': { name: 'React', category: 'framework', description: 'React UI library' },
  'react-dom': { name: 'React', category: 'framework', description: 'React UI library' },
  'next': { name: 'Next.js', category: 'framework', description: 'Next.js React framework with SSR/SSG' },
  'vue': { name: 'Vue', category: 'framework', description: 'Vue.js UI framework' },
  'nuxt': { name: 'Nuxt', category: 'framework', description: 'Nuxt.js Vue framework' },
  'svelte': { name: 'Svelte', category: 'framework', description: 'Svelte UI framework' },
  '@angular/core': { name: 'Angular', category: 'framework', description: 'Angular framework' },

  // Backend frameworks
  'express': { name: 'Express', category: 'framework', description: 'Express.js web server' },
  'fastify': { name: 'Fastify', category: 'framework', description: 'Fastify web server' },
  'koa': { name: 'Koa', category: 'framework', description: 'Koa web server' },
  'hono': { name: 'Hono', category: 'framework', description: 'Hono web framework' },
  'nestjs': { name: 'NestJS', category: 'framework', description: 'NestJS backend framework' },
  '@nestjs/core': { name: 'NestJS', category: 'framework', description: 'NestJS backend framework' },

  // State management
  'zustand': { name: 'Zustand', category: 'framework', description: 'Zustand state management' },
  'redux': { name: 'Redux', category: 'framework', description: 'Redux state management' },
  '@reduxjs/toolkit': { name: 'Redux Toolkit', category: 'framework', description: 'Redux Toolkit state management' },
  'mobx': { name: 'MobX', category: 'framework', description: 'MobX state management' },
  'jotai': { name: 'Jotai', category: 'framework', description: 'Jotai atomic state management' },
  'recoil': { name: 'Recoil', category: 'framework', description: 'Recoil state management' },

  // Styling
  'tailwindcss': { name: 'Tailwind CSS', category: 'tooling', description: 'Tailwind CSS utility-first styling' },
  'styled-components': { name: 'Styled Components', category: 'tooling', description: 'CSS-in-JS with styled-components' },
  '@emotion/react': { name: 'Emotion', category: 'tooling', description: 'CSS-in-JS with Emotion' },
  'sass': { name: 'Sass', category: 'tooling', description: 'Sass CSS preprocessor' },

  // Testing
  'jest': { name: 'Jest', category: 'testing', description: 'Jest testing framework' },
  'vitest': { name: 'Vitest', category: 'testing', description: 'Vitest testing framework' },
  'mocha': { name: 'Mocha', category: 'testing', description: 'Mocha testing framework' },
  '@testing-library/react': { name: 'React Testing Library', category: 'testing', description: 'React Testing Library' },
  'cypress': { name: 'Cypress', category: 'testing', description: 'Cypress E2E testing' },
  'playwright': { name: 'Playwright', category: 'testing', description: 'Playwright E2E testing' },
  '@playwright/test': { name: 'Playwright', category: 'testing', description: 'Playwright E2E testing' },

  // Build tools
  'vite': { name: 'Vite', category: 'tooling', description: 'Vite build tool' },
  'webpack': { name: 'Webpack', category: 'tooling', description: 'Webpack bundler' },
  'esbuild': { name: 'esbuild', category: 'tooling', description: 'esbuild bundler' },
  'rollup': { name: 'Rollup', category: 'tooling', description: 'Rollup bundler' },
  'turbo': { name: 'Turborepo', category: 'tooling', description: 'Turborepo monorepo tool' },

  // Database/ORM
  'prisma': { name: 'Prisma', category: 'framework', description: 'Prisma ORM' },
  '@prisma/client': { name: 'Prisma', category: 'framework', description: 'Prisma ORM' },
  'drizzle-orm': { name: 'Drizzle', category: 'framework', description: 'Drizzle ORM' },
  'mongoose': { name: 'Mongoose', category: 'framework', description: 'Mongoose MongoDB ODM' },
  'typeorm': { name: 'TypeORM', category: 'framework', description: 'TypeORM database ORM' },

  // API
  'trpc': { name: 'tRPC', category: 'framework', description: 'tRPC end-to-end typesafe APIs' },
  '@trpc/server': { name: 'tRPC', category: 'framework', description: 'tRPC end-to-end typesafe APIs' },
  'graphql': { name: 'GraphQL', category: 'framework', description: 'GraphQL API' },
  '@apollo/client': { name: 'Apollo Client', category: 'framework', description: 'Apollo GraphQL client' },
  'axios': { name: 'Axios', category: 'tooling', description: 'Axios HTTP client' },

  // Deployment
  'electron': { name: 'Electron', category: 'deployment', description: 'Electron desktop app' },
  'tauri': { name: 'Tauri', category: 'deployment', description: 'Tauri desktop app' },
  'vercel': { name: 'Vercel', category: 'deployment', description: 'Vercel deployment' },

  // Linting/Formatting
  'eslint': { name: 'ESLint', category: 'tooling', description: 'ESLint code linting' },
  'prettier': { name: 'Prettier', category: 'tooling', description: 'Prettier code formatting' },
  'biome': { name: 'Biome', category: 'tooling', description: 'Biome linting and formatting' },
  '@biomejs/biome': { name: 'Biome', category: 'tooling', description: 'Biome linting and formatting' },
};

// Language detection based on file extensions
const LANGUAGE_EXTENSIONS: Record<string, { name: string; description: string }> = {
  '.ts': { name: 'TypeScript', description: 'TypeScript language' },
  '.tsx': { name: 'TypeScript + React', description: 'TypeScript with React JSX' },
  '.js': { name: 'JavaScript', description: 'JavaScript language' },
  '.jsx': { name: 'JavaScript + React', description: 'JavaScript with React JSX' },
  '.py': { name: 'Python', description: 'Python language' },
  '.rs': { name: 'Rust', description: 'Rust language' },
  '.go': { name: 'Go', description: 'Go language' },
  '.java': { name: 'Java', description: 'Java language' },
  '.rb': { name: 'Ruby', description: 'Ruby language' },
  '.php': { name: 'PHP', description: 'PHP language' },
  '.swift': { name: 'Swift', description: 'Swift language' },
  '.kt': { name: 'Kotlin', description: 'Kotlin language' },
  '.cs': { name: 'C#', description: 'C# language' },
  '.cpp': { name: 'C++', description: 'C++ language' },
  '.c': { name: 'C', description: 'C language' },
};

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

export async function detectSkillsFromPackageJson(projectPath: string): Promise<DetectedSkill[]> {
  const skills: DetectedSkill[] = [];
  const seenNames = new Set<string>();

  try {
    const packageJsonPath = `${projectPath}/package.json`;
    const result = await window.electron?.readFile(packageJsonPath);

    if (!result?.success || !result.content) {
      return skills;
    }

    const packageJson: PackageJson = JSON.parse(result.content);
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // Detect from dependencies
    for (const [dep, _version] of Object.entries(allDeps)) {
      const pattern = FRAMEWORK_PATTERNS[dep];
      if (pattern && !seenNames.has(pattern.name)) {
        seenNames.add(pattern.name);
        skills.push({
          id: generateId(),
          name: pattern.name,
          description: pattern.description,
          category: pattern.category,
          confidence: 'high',
          source: 'package.json',
        });
      }
    }

    // Detect TypeScript
    if (allDeps['typescript'] && !seenNames.has('TypeScript')) {
      seenNames.add('TypeScript');
      skills.push({
        id: generateId(),
        name: 'TypeScript',
        description: 'TypeScript language with static typing',
        category: 'language',
        confidence: 'high',
        source: 'package.json',
      });
    }

    // Check scripts for additional hints
    if (packageJson.scripts) {
      const scriptsStr = JSON.stringify(packageJson.scripts).toLowerCase();

      if (scriptsStr.includes('docker') && !seenNames.has('Docker')) {
        seenNames.add('Docker');
        skills.push({
          id: generateId(),
          name: 'Docker',
          description: 'Docker containerization',
          category: 'deployment',
          confidence: 'medium',
          source: 'package.json scripts',
        });
      }
    }

  } catch (error) {
    console.error('Failed to parse package.json:', error);
  }

  return skills;
}

export async function detectSkillsFromReadme(projectPath: string): Promise<{ description: string | null; skills: DetectedSkill[] }> {
  const skills: DetectedSkill[] = [];
  let description: string | null = null;

  const readmeNames = ['README.md', 'readme.md', 'README.MD', 'Readme.md'];

  for (const readmeName of readmeNames) {
    try {
      const readmePath = `${projectPath}/${readmeName}`;
      const result = await window.electron?.readFile(readmePath);

      if (result?.success && result.content) {
        const content = result.content;

        // Extract first paragraph as description (skip title)
        const lines = content.split('\n');
        let foundDescription = false;

        for (const line of lines) {
          const trimmed = line.trim();
          // Skip empty lines, headers, and badges
          if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('[!') || trimmed.startsWith('![')) {
            continue;
          }
          // Found first real content
          if (!foundDescription && trimmed.length > 20) {
            description = trimmed.slice(0, 200); // Limit length
            foundDescription = true;
            break;
          }
        }

        break; // Found a README, stop looking
      }
    } catch {
      continue;
    }
  }

  return { description, skills };
}

export async function detectSkillsFromFileStructure(projectPath: string): Promise<DetectedSkill[]> {
  const skills: DetectedSkill[] = [];
  const seenLanguages = new Set<string>();

  try {
    const result = await window.electron?.readDir(projectPath);

    if (!result?.success || !result.items) {
      return skills;
    }

    // Check for config files
    const fileNames = result.items.map((item) => item.name);

    // Docker
    if (fileNames.includes('Dockerfile') || fileNames.includes('docker-compose.yml') || fileNames.includes('docker-compose.yaml')) {
      skills.push({
        id: generateId(),
        name: 'Docker',
        description: 'Docker containerization',
        category: 'deployment',
        confidence: 'high',
        source: 'project files',
      });
    }

    // CI/CD
    if (fileNames.includes('.github')) {
      skills.push({
        id: generateId(),
        name: 'GitHub Actions',
        description: 'GitHub Actions CI/CD',
        category: 'deployment',
        confidence: 'high',
        source: '.github directory',
      });
    }

    // Detect languages from file extensions in src or root
    for (const item of result.items) {
      if (item.type === 'file') {
        const ext = item.name.substring(item.name.lastIndexOf('.'));
        const lang = LANGUAGE_EXTENSIONS[ext];
        if (lang && !seenLanguages.has(lang.name)) {
          seenLanguages.add(lang.name);
          skills.push({
            id: generateId(),
            name: lang.name,
            description: lang.description,
            category: 'language',
            confidence: 'high',
            source: 'file extensions',
          });
        }
      }
    }

  } catch (error) {
    console.error('Failed to analyze file structure:', error);
  }

  return skills;
}

export async function detectAllSkills(projectPath: string): Promise<{
  skills: DetectedSkill[];
  projectDescription: string | null;
}> {
  const [packageSkills, readmeResult, fileSkills] = await Promise.all([
    detectSkillsFromPackageJson(projectPath),
    detectSkillsFromReadme(projectPath),
    detectSkillsFromFileStructure(projectPath),
  ]);

  // Merge and deduplicate skills
  const allSkills = [...packageSkills, ...readmeResult.skills, ...fileSkills];
  const seenNames = new Set<string>();
  const uniqueSkills: DetectedSkill[] = [];

  for (const skill of allSkills) {
    if (!seenNames.has(skill.name)) {
      seenNames.add(skill.name);
      uniqueSkills.push(skill);
    }
  }

  // Sort by category then name
  uniqueSkills.sort((a, b) => {
    if (a.category !== b.category) {
      const categoryOrder = ['language', 'framework', 'tooling', 'testing', 'deployment'];
      return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  return {
    skills: uniqueSkills,
    projectDescription: readmeResult.description,
  };
}
