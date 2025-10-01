// src/components/ErrorBoundary.jsx
import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
    this.state = { hasError: true, error, errorInfo };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            maxWidth: "720px",
            margin: "2rem auto",
            padding: "2rem",
            background: "rgba(220, 38, 38, 0.1)",
            border: "1px solid rgba(220, 38, 38, 0.3)",
            borderRadius: "12px",
            textAlign: "center",
          }}
        >
          <h2 style={{ color: "#991b1b", marginTop: 0 }}>
            Something went wrong
          </h2>
          <p style={{ marginBottom: "1.5rem" }}>
            The app encountered an unexpected error. Try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn"
            style={{
              background: "#991b1b",
              padding: "0.75rem 1.5rem",
            }}
          >
            Refresh Page
          </button>
          {this.state.error && (
            <details style={{ marginTop: "1.5rem", textAlign: "left" }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: 600,
                  color: "#991b1b",
                }}
              >
                Technical Details
              </summary>
              <pre
                style={{
                  background: "white",
                  padding: "1rem",
                  borderRadius: "6px",
                  marginTop: "0.75rem",
                  fontSize: "0.85rem",
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
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