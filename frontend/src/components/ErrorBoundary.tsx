import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Last-resort guard: a render error shows a recoverable fallback instead of
 * a blank screen. Class component by necessity — React has no hook for
 * getDerivedStateFromError.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    // The console is the frontend's log sink; no telemetry backend exists.
    console.error('render error caught by boundary:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert">
          <p className="panel-heading__kicker">Calculator unavailable</p>
          <h1>Something went wrong.</h1>
          <p>Your calculation has not been submitted. Reset the interface and try again.</p>
          <button
            type="button"
            className="error-boundary__action"
            onClick={() => this.setState({ hasError: false })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
