import { ReactNode } from 'react'

interface Props {
  isLoading: boolean
  children: ReactNode
  message?: string
  inline?: boolean
}

export function LoadingState({ isLoading, children, message, inline }: Props) {
  if (!isLoading) return <>{children}</>

  if (inline) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280' }}>
        <Spinner size={16} />
        {message || 'Loading...'}
      </span>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem'
    }}>
      <Spinner size={32} />
      <span style={{ color: '#6b7280', marginTop: '0.5rem' }}>{message || 'Loading...'}</span>
    </div>
  )
}

function Spinner({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="31.4 31.4"
        style={{ opacity: 0.25 }}
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="31.4 31.4"
        strokeDashoffset="23.55"
      />
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  )
}
