import { useState, useEffect } from 'react';
import { useChatStore } from '@/stores';

const ringTemplate = [
  '            ########            ',
  '        ####        ####        ',
  '      ##                ##      ',
  '    ##                    ##    ',
  '   ##                      ##   ',
  '  ##                        ##  ',
  '  ##                        ##  ',
  ' ##                          ## ',
  ' ##                          ## ',
  ' ##                          ## ',
  ' ##                          ## ',
  '  ##                        ##  ',
  '  ##                        ##  ',
  '   ##                      ##   ',
  '    ##                    ##    ',
  '      ##                ##      ',
  '        ####        ####        ',
  '            ########            ',
].join('\n');

const idleChars = '#*@%&$+=~';
const thinkingChars = '◐◓◑◒●○◦∘';

// Get all positions of # in template
const positions: number[] = [];
ringTemplate.split('').forEach((char, i) => {
  if (char === '#') positions.push(i);
});

const generateRing = (chars: string) => {
  const result = ringTemplate.split('');
  positions.forEach((pos) => {
    result[pos] = chars[Math.floor(Math.random() * chars.length)];
  });
  return result.join('');
};

export function PixelCube() {
  const { isLoading, resultStatus, currentActivity } = useChatStore();
  const status = resultStatus || (isLoading ? 'thinking' : 'idle');
  const displayText = status === 'thinking' && currentActivity ? currentActivity : status;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const speed = status === 'thinking' ? 40 : 150;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, speed);
    return () => clearInterval(interval);
  }, [status]);

  const chars = status === 'thinking' ? thinkingChars : idleChars;
  const ring = generateRing(chars);

  const [scale, setScale] = useState(0.75);

  useEffect(() => {
    if (status === 'ok') {
      // Keep same size, just change color
      setScale(1);
    } else if (status === 'thinking') {
      // Wind up: shrink to nothing then expand
      setScale(0);
      const timer = setTimeout(() => setScale(1), 350);
      return () => clearTimeout(timer);
    } else if (status === 'error') {
      setScale(1);
    } else {
      setScale(0.75);
    }
  }, [status]);

  return (
    <div className="flex flex-col items-center gap-4">
      <pre
        className={`font-mono text-[10px] leading-none select-none whitespace-pre ${
          status === 'thinking' ? 'text-yellow-400' :
          status === 'ok' ? 'text-green-400' :
          status === 'error' ? 'text-red-400' :
          'text-text-primary'
        }`}
        style={{
          transform: `scale(${scale})`,
          transition: 'transform 0.3s ease-out'
        }}
      >
        {ring}
      </pre>

      <div className="font-mono text-[10px] text-text-muted tracking-widest lowercase max-w-[200px] truncate text-center">
        [{displayText}]
      </div>
    </div>
  );
}
