import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components';
import { useAuth } from '../auth/AuthContext';

const BACKGROUND_VIDEO = '/video/welcome.mp4';
// An early frame of the video — shown while it loads, and instead of it for
// visitors who've asked their device to reduce motion.
const BACKGROUND_POSTER = '/video/welcome-poster.jpg';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// The first screen a visitor sees. Many Users are older and arrive without
// an account (or a Google login), so instead of landing on Log in with a
// small "Sign up" link at the bottom, they get one obvious choice up front.
export function Welcome() {
  const { account, isLoading } = useAuth();
  const navigate = useNavigate();

  if (isLoading) return null;
  if (account) return <Navigate to="/dashboard" replace />;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-bg-page">
      {prefersReducedMotion() ? (
        <img src={BACKGROUND_POSTER} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <video
          src={BACKGROUND_VIDEO}
          poster={BACKGROUND_POSTER}
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      {/* Fades the video to a soft backdrop so it never competes with the
          logo or the buttons. */}
      <div className="absolute inset-0 bg-bg-page/75" />

      <div className="relative flex h-[45vh] min-h-[280px] items-center justify-center px-10 py-6">
        <img src="/logo-transparent.png" alt="10 Minute English" className="h-full w-full object-contain" />
      </div>

      <div className="relative flex flex-1 flex-col justify-center gap-4 px-5 pb-10">
        <Button size="lg" onClick={() => navigate('/signup')}>
          I'm new here
        </Button>
        <Button size="lg" variant="secondary" tone="blue" onClick={() => navigate('/login')}>
          I have an account
        </Button>
      </div>
    </div>
  );
}
