import React from 'react';
import ChatWindow from './components/ChatWindow';

/**
 * Vercel-inspired Clean App Layout
 */
export default function App() {
  return (
    <div style={styles.appWrapper}>
      {/* Vercel Header */}
      <header style={styles.header}>
        <div style={styles.headerContent}>
          <div style={styles.brandGroup}>
            <div style={styles.logoContainer}>
              <svg width="22" height="22" viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="#FFFFFF"/>
              </svg>
            </div>
            <div style={styles.divider}>/</div>
            <span style={styles.title}>Personal Brain</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={styles.main}>
        <ChatWindow />
      </main>
    </div>
  );
}

const styles = {
  appWrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    backgroundColor: 'var(--bg-dark)'
  },
  header: {
    backgroundColor: '#0a0a0a',
    borderBottom: '1px solid var(--border-subtle)',
    padding: '0.75rem 1.5rem',
    position: 'sticky',
    top: 0,
    zIndex: 50
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  brandGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem'
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  divider: {
    color: 'var(--border-medium)',
    fontSize: '1.1rem',
    fontWeight: '300'
  },
  title: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: '-0.02em'
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden'
  }
};
