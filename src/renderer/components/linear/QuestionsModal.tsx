import { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { HelpCircle, Send, Sparkles } from 'lucide-react';
import type { PlanQuestion } from '@/stores/startWorkStore';

interface QuestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: PlanQuestion[];
  issueIdentifier: string;
  onSubmit: (answers: Record<string, string>) => void;
  onFigureItOut: () => void;
}

export function QuestionsModal({
  isOpen,
  onClose,
  questions,
  issueIdentifier,
  onSubmit,
  onFigureItOut,
}: QuestionsModalProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  // Reset answers when questions change
  useEffect(() => {
    const initialAnswers: Record<string, string> = {};
    questions.forEach(q => {
      initialAnswers[q.id] = q.answer || '';
    });
    setAnswers(initialAnswers);
  }, [questions]);

  const handleAnswerChange = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const hasAnyAnswers = Object.values(answers).some(a => a.trim().length > 0);

  const handleSubmit = () => {
    onSubmit(answers);
  };

  const handleFigureItOut = () => {
    onFigureItOut();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="w-[600px]">
      <div className="flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border-primary bg-bg-secondary">
          <HelpCircle className="w-5 h-5 text-yellow-400" />
          <div>
            <h2 className="text-sm font-medium text-text-primary">Questions for {issueIdentifier}</h2>
            <p className="text-xs text-text-muted mt-0.5">Claude has some clarifying questions before implementing</p>
          </div>
        </div>

        {/* Questions list */}
        <div className="flex-1 overflow-auto p-5 space-y-5">
          {questions.map((question, index) => (
            <div key={question.id} className="space-y-2">
              <label className="block">
                <span className="text-sm text-text-primary flex items-start gap-2">
                  <span className="text-yellow-400 font-mono text-xs mt-0.5">{index + 1}.</span>
                  <span>{question.question}</span>
                </span>
              </label>
              <textarea
                value={answers[question.id] || ''}
                onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                placeholder="Type your answer here..."
                className="w-full px-3 py-2 text-sm bg-bg-primary border border-border-primary rounded-md
                         text-text-primary placeholder-text-muted resize-none
                         focus:outline-none focus:ring-1 focus:ring-accent-primary focus:border-accent-primary
                         transition-colors"
                rows={2}
              />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border-primary bg-bg-secondary">
          <button
            onClick={handleFigureItOut}
            className="flex items-center gap-2 px-4 py-2 text-sm font-mono text-text-muted
                     hover:text-text-primary transition-colors rounded-md hover:bg-bg-hover"
          >
            <Sparkles className="w-4 h-4" />
            figure it out
          </button>

          <button
            onClick={handleSubmit}
            disabled={!hasAnyAnswers}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors
              ${hasAnyAnswers
                ? 'bg-accent-primary text-white hover:bg-accent-primary/90'
                : 'bg-bg-tertiary text-text-muted cursor-not-allowed'
              }`}
          >
            <Send className="w-4 h-4" />
            Submit Answers
          </button>
        </div>
      </div>
    </Modal>
  );
}
