import { Component, ReactNode, ErrorInfo } from "react";
import styles from "../styles/ErrorBoundary.module.css";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(_error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.setState({ hasError: true, error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container}>
          <h2 className={styles.title}>Something went wrong</h2>
          
          <p className={styles.message}>
            The app encountered an unexpected error. Try refreshing the page.
          </p>
          
          <button
            onClick={() => window.location.reload()}
            className={`btn ${styles.refreshButton}`}
          >
            Refresh Page
          </button>
          
          {this.state.error && (
            <details className={styles.details}>
              <summary className={styles.summary}>
                Technical Details
              </summary>
              <pre className={styles.errorContent}>
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}