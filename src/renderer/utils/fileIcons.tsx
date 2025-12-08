import {
  File,
  FileText,
  FileCode,
  FileJson,
  FileType,
  Image,
  Film,
  Music,
  Archive,
  Database,
  Settings,
  Lock,
  GitBranch,
  Terminal,
  Braces,
  Hash,
  Gem,
  Coffee,
  Leaf,
} from 'lucide-react';

interface FileIconConfig {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

// Extension to icon mapping
const FILE_ICON_MAP: Record<string, FileIconConfig> = {
  // TypeScript/JavaScript
  '.ts': { icon: FileCode, color: 'text-blue-400' },
  '.tsx': { icon: FileCode, color: 'text-blue-400' },
  '.js': { icon: FileCode, color: 'text-yellow-400' },
  '.jsx': { icon: FileCode, color: 'text-yellow-400' },
  '.mjs': { icon: FileCode, color: 'text-yellow-400' },
  '.cjs': { icon: FileCode, color: 'text-yellow-400' },

  // Web
  '.html': { icon: FileCode, color: 'text-orange-400' },
  '.htm': { icon: FileCode, color: 'text-orange-400' },
  '.css': { icon: FileCode, color: 'text-blue-300' },
  '.scss': { icon: FileCode, color: 'text-pink-400' },
  '.sass': { icon: FileCode, color: 'text-pink-400' },
  '.less': { icon: FileCode, color: 'text-indigo-400' },
  '.vue': { icon: FileCode, color: 'text-green-400' },
  '.svelte': { icon: FileCode, color: 'text-orange-500' },

  // Data
  '.json': { icon: Braces, color: 'text-yellow-300' },
  '.yaml': { icon: FileText, color: 'text-red-300' },
  '.yml': { icon: FileText, color: 'text-red-300' },
  '.xml': { icon: FileCode, color: 'text-orange-300' },
  '.csv': { icon: Database, color: 'text-green-300' },
  '.sql': { icon: Database, color: 'text-blue-300' },

  // Markdown/Text
  '.md': { icon: FileText, color: 'text-blue-200' },
  '.mdx': { icon: FileText, color: 'text-blue-200' },
  '.txt': { icon: FileText, color: 'text-gray-400' },
  '.rtf': { icon: FileText, color: 'text-gray-400' },

  // Python
  '.py': { icon: FileCode, color: 'text-yellow-300' },
  '.pyw': { icon: FileCode, color: 'text-yellow-300' },
  '.pyx': { icon: FileCode, color: 'text-yellow-300' },
  '.ipynb': { icon: FileCode, color: 'text-orange-400' },

  // Ruby
  '.rb': { icon: Gem, color: 'text-red-400' },
  '.erb': { icon: Gem, color: 'text-red-400' },
  '.rake': { icon: Gem, color: 'text-red-400' },

  // Go
  '.go': { icon: FileCode, color: 'text-cyan-400' },

  // Rust
  '.rs': { icon: FileCode, color: 'text-orange-400' },

  // Java/Kotlin
  '.java': { icon: Coffee, color: 'text-red-400' },
  '.kt': { icon: FileCode, color: 'text-purple-400' },
  '.kts': { icon: FileCode, color: 'text-purple-400' },
  '.gradle': { icon: FileCode, color: 'text-green-400' },

  // C/C++
  '.c': { icon: FileCode, color: 'text-blue-400' },
  '.h': { icon: FileCode, color: 'text-blue-300' },
  '.cpp': { icon: FileCode, color: 'text-blue-500' },
  '.hpp': { icon: FileCode, color: 'text-blue-400' },
  '.cc': { icon: FileCode, color: 'text-blue-500' },

  // C#
  '.cs': { icon: FileCode, color: 'text-green-500' },

  // PHP
  '.php': { icon: FileCode, color: 'text-indigo-400' },

  // Swift
  '.swift': { icon: FileCode, color: 'text-orange-400' },

  // Shell
  '.sh': { icon: Terminal, color: 'text-green-400' },
  '.bash': { icon: Terminal, color: 'text-green-400' },
  '.zsh': { icon: Terminal, color: 'text-green-400' },
  '.fish': { icon: Terminal, color: 'text-green-400' },
  '.ps1': { icon: Terminal, color: 'text-blue-400' },

  // Config
  '.env': { icon: Settings, color: 'text-yellow-400' },
  '.env.local': { icon: Settings, color: 'text-yellow-400' },
  '.env.development': { icon: Settings, color: 'text-yellow-400' },
  '.env.production': { icon: Settings, color: 'text-yellow-400' },
  '.config': { icon: Settings, color: 'text-gray-400' },
  '.cfg': { icon: Settings, color: 'text-gray-400' },
  '.ini': { icon: Settings, color: 'text-gray-400' },
  '.toml': { icon: Settings, color: 'text-gray-400' },

  // Images
  '.png': { icon: Image, color: 'text-purple-400' },
  '.jpg': { icon: Image, color: 'text-purple-400' },
  '.jpeg': { icon: Image, color: 'text-purple-400' },
  '.gif': { icon: Image, color: 'text-purple-400' },
  '.svg': { icon: Image, color: 'text-yellow-400' },
  '.ico': { icon: Image, color: 'text-purple-400' },
  '.webp': { icon: Image, color: 'text-purple-400' },

  // Video
  '.mp4': { icon: Film, color: 'text-pink-400' },
  '.webm': { icon: Film, color: 'text-pink-400' },
  '.mov': { icon: Film, color: 'text-pink-400' },
  '.avi': { icon: Film, color: 'text-pink-400' },

  // Audio
  '.mp3': { icon: Music, color: 'text-pink-300' },
  '.wav': { icon: Music, color: 'text-pink-300' },
  '.ogg': { icon: Music, color: 'text-pink-300' },

  // Archives
  '.zip': { icon: Archive, color: 'text-yellow-400' },
  '.tar': { icon: Archive, color: 'text-yellow-400' },
  '.gz': { icon: Archive, color: 'text-yellow-400' },
  '.rar': { icon: Archive, color: 'text-yellow-400' },
  '.7z': { icon: Archive, color: 'text-yellow-400' },

  // Lock files
  '.lock': { icon: Lock, color: 'text-gray-500' },

  // Git
  '.gitignore': { icon: GitBranch, color: 'text-orange-400' },
  '.gitattributes': { icon: GitBranch, color: 'text-orange-400' },

  // Misc
  '.log': { icon: FileText, color: 'text-gray-500' },
  '.map': { icon: Braces, color: 'text-gray-500' },
  '.d.ts': { icon: FileCode, color: 'text-blue-300' },
};

// Special filename matches
const SPECIAL_FILES: Record<string, FileIconConfig> = {
  'package.json': { icon: Braces, color: 'text-green-400' },
  'package-lock.json': { icon: Lock, color: 'text-gray-500' },
  'yarn.lock': { icon: Lock, color: 'text-gray-500' },
  'pnpm-lock.yaml': { icon: Lock, color: 'text-gray-500' },
  'tsconfig.json': { icon: Settings, color: 'text-blue-400' },
  'jsconfig.json': { icon: Settings, color: 'text-yellow-400' },
  '.prettierrc': { icon: Settings, color: 'text-pink-400' },
  '.eslintrc': { icon: Settings, color: 'text-purple-400' },
  '.eslintrc.js': { icon: Settings, color: 'text-purple-400' },
  '.eslintrc.json': { icon: Settings, color: 'text-purple-400' },
  'vite.config.ts': { icon: Settings, color: 'text-purple-400' },
  'vite.config.js': { icon: Settings, color: 'text-purple-400' },
  'webpack.config.js': { icon: Settings, color: 'text-blue-400' },
  'tailwind.config.js': { icon: Settings, color: 'text-cyan-400' },
  'tailwind.config.ts': { icon: Settings, color: 'text-cyan-400' },
  'postcss.config.js': { icon: Settings, color: 'text-red-400' },
  'dockerfile': { icon: FileCode, color: 'text-blue-400' },
  'docker-compose.yml': { icon: FileCode, color: 'text-blue-400' },
  'docker-compose.yaml': { icon: FileCode, color: 'text-blue-400' },
  '.dockerignore': { icon: FileCode, color: 'text-blue-400' },
  'makefile': { icon: Terminal, color: 'text-orange-400' },
  'readme.md': { icon: FileText, color: 'text-blue-300' },
  'license': { icon: FileText, color: 'text-yellow-400' },
  'license.md': { icon: FileText, color: 'text-yellow-400' },
  '.nvmrc': { icon: Leaf, color: 'text-green-400' },
  '.node-version': { icon: Leaf, color: 'text-green-400' },
};

export function getFileIcon(fileName: string): FileIconConfig {
  const lowerName = fileName.toLowerCase();

  // Check special files first
  if (SPECIAL_FILES[lowerName]) {
    return SPECIAL_FILES[lowerName];
  }

  // Check for .d.ts files
  if (lowerName.endsWith('.d.ts')) {
    return FILE_ICON_MAP['.d.ts'];
  }

  // Check extension
  const ext = '.' + fileName.split('.').pop()?.toLowerCase();
  if (FILE_ICON_MAP[ext]) {
    return FILE_ICON_MAP[ext];
  }

  // Default
  return { icon: File, color: 'text-text-muted' };
}

export function FileIcon({ fileName, className = 'w-4 h-4' }: { fileName: string; className?: string }) {
  const { icon: Icon, color } = getFileIcon(fileName);
  return <Icon className={`${className} ${color}`} />;
}
