import { ErrorBoundary, FallbackProps } from 'react-error-boundary'
import { ReactNode } from 'react'

function NetworkErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const isNetworkError =
    error.message?.includes('fetch') ||
    error.message?.includes('NetworkError') ||
    error.message?.includes('Failed to')

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <div style={{ color: '#dc2626', fontSize: '1.125rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        {isNetworkError ? 'Connection Error' : 'Something went wrong'}
      </div>
      <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
        {isNetworkError
          ? 'Unable to connect to the server. Please check your connection.'
          : error.message}
      </p>
      <button
        onClick={resetErrorBoundary}
        style={{
          padding: '0.5rem 1rem',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: 'pointer'
        }}
      >
        Try Again
      </button>
    </div>
  )
}

interface Props {
  children: ReactNode
  onReset?: () => void
}

export function NetworkErrorBoundary({ children, onReset }: Props) {
  return (
    <ErrorBoundary
      FallbackComponent={NetworkErrorFallback}
      onReset={onReset}
      onError={(error, info) => {
        console.error('[NetworkErrorBoundary]', error, info)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
