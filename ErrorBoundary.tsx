import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/** If a screen crashes, show a plain message instead of a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Screen crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="wrap page-narrow">
        <div className="plate">
          <h1>Something went wrong</h1>
          <p className="lede">Reload the page. Your bids and budget are stored on the server and are safe.</p>
          <button className="btn" type="button" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}
