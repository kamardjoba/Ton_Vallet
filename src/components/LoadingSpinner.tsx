/**
 * Loading spinner component
 * Reusable loading indicator for various operations
 */

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({ 
  size = 'medium', 
  text,
  fullScreen = false 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    small: '20px',
    medium: '40px',
    large: '60px',
  };

  const spinnerSize = sizeClasses[size];

  const spinner = (
    <div className="loading-spinner-container" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      padding: fullScreen ? '60px 20px' : '20px',
    }}>
      <div 
        className="loading-spinner"
        style={{
          width: spinnerSize,
          height: spinnerSize,
          border: `3px solid rgba(102, 126, 234, 0.2)`,
          borderTopColor: '#667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      {text && (
        <p style={{
          fontSize: '14px',
          color: 'var(--tg-theme-hint-color, #666)',
          margin: 0,
        }}>
          {text}
        </p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--tg-theme-bg-color, rgba(255, 255, 255, 0.9))',
        zIndex: 9999,
      }}>
        {spinner}
      </div>
    );
  }

  return spinner;
}

// Add spin animation to global styles if not already present
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  if (!document.head.querySelector('style[data-spinner]')) {
    style.setAttribute('data-spinner', 'true');
    document.head.appendChild(style);
  }
}
