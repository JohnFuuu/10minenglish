import { useNavigate } from 'react-router-dom';

export function BackArrow({ onPress }: { onPress?: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="flex justify-end px-5 pt-12 pb-2">
      <button onClick={onPress ?? (() => navigate(-1))} className="flex h-9 w-9 items-center justify-center">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#777777" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    </div>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">Or</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export function LegalText({ action }: { action: string }) {
  return (
    <p className="text-center text-sm font-medium leading-relaxed text-text-secondary">
      By {action} to 10 Minute English, you agree to our{' '}
      <span className="font-bold text-text-body">Terms</span> and{' '}
      <span className="font-bold text-text-body">Privacy Policy</span>.
    </p>
  );
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
