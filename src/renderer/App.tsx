import { ThemeProvider } from '@/themes';
import { MainLayout } from '@/components/layout';
import { WelcomeScreen } from '@/components/welcome';
import { useSettingsStore } from '@/stores';

export function App() {
  const hasCompletedOnboarding = useSettingsStore((state) => state.hasCompletedOnboarding);

  return (
    <ThemeProvider>
      {!hasCompletedOnboarding && <WelcomeScreen />}
      <MainLayout />
    </ThemeProvider>
  );
}
