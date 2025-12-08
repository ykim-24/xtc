import { ThemeProvider } from '@/themes';
import { MainLayout } from '@/components/layout';

export function App() {
  return (
    <ThemeProvider>
      <MainLayout />
    </ThemeProvider>
  );
}
