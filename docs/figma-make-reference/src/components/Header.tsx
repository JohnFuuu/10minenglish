import { useNavigate } from 'react-router-dom'

interface HeaderProps {
  title: string
  showBack?: boolean
  right?: React.ReactNode
}

export default function Header({ title, showBack, right }: HeaderProps) {
  const navigate = useNavigate()

  return (
    <header
      className="flex items-center justify-between px-5 pt-12 pb-4 sticky top-0 z-40"
      style={{ background: '#ffffff', borderBottom: '2px solid #e5e5e5' }}
    >
      {showBack ? (
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center"
          style={{ borderRadius: 12, border: '2px solid #e5e5e5', borderBottom: '3px solid #e5e5e5', background: '#ffffff' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3c3c3c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      ) : (
        <div className="w-9" />
      )}
      <h1
        className="font-bold"
        style={{
          fontSize: 17,
          letterSpacing: '0.06em',
          color: '#042c60',
          fontFamily: 'Nunito, sans-serif',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </h1>
      <div className="w-9 flex justify-end">{right}</div>
    </header>
  )
}
