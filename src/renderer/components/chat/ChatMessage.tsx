import { User, Bot } from 'lucide-react';
import { clsx } from 'clsx';
import { ChatMessage as ChatMessageType } from '@/stores/chatStore';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={clsx(
        'flex gap-3 p-3',
        isUser ? 'bg-bg-secondary' : 'bg-bg-primary'
      )}
    >
      <div
        className={clsx(
          'flex-shrink-0 w-6 h-6 rounded flex items-center justify-center',
          isUser ? 'bg-accent-primary' : 'bg-accent-secondary'
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-text-muted mb-1">
          {isUser ? 'You' : 'Claude'}
        </div>
        <div className="text-sm text-text-primary whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    </div>
  );
}
