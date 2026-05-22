import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Uncaught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', direction: 'rtl' }}>
          <h2>אירעה שגיאה בלתי צפויה</h2>
          <p style={{ marginTop: '12px', color: '#666' }}>רענן את הדף כדי להמשיך.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '20px', padding: '8px 20px', cursor: 'pointer' }}
          >
            רענן דף
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
