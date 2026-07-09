import './global.css';
import { Toaster } from 'react-hot-toast';
import QueryProvider from './providers/query-provider';
import { ThemeProvider } from './providers/theme-provider';
import { AuthProvider } from './providers/auth-provider';

export const metadata = {
  title: 'Hello Security - Guard Assignments & Patrol Management',
  description: 'Enterprise patrol tracking and shift assignments platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              {children}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    fontFamily: 'var(--font-primary)',
                  },
                }}
              />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
