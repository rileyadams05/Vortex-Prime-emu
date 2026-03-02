import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div style={{ 
          padding: '2rem', 
          backgroundColor: '#1a1a1a', 
          color: 'white', 
          height: '100vh', 
          fontFamily: 'Segoe UI, sans-serif',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          <h1 style={{ color: '#ff4d4d' }}>Something went wrong.</h1>
          <p>The application encountered an error during startup.</p>
          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            backgroundColor: '#000', 
            borderRadius: '4px', 
            textAlign: 'left',
            maxWidth: '800px',
            overflow: 'auto',
            maxHeight: '400px',
            border: '1px solid #333'
          }}>
            <code style={{ color: '#ff8080' }}>{this.state.error && this.state.error.toString()}</code>
            <br />
            <pre style={{ color: '#aaa', fontSize: '0.8rem' }}>
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </div>
          <button 
            onClick={() => window.location.reload()}
            style={{
              marginTop: '2rem',
              padding: '0.8rem 1.6rem',
              backgroundColor: '#107C10',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
