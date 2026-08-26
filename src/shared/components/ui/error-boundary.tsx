import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, ChevronDown, ChevronUp, RefreshCw, RotateCw } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card'

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  /** Called when an error is caught (e.g. to send to Sentry). */
  onReportError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void
  /** Register to receive async/unhandled errors. Call setError with the error; return a cleanup function. */
  onRegisterHandler?: (setError: (error: Error) => void) => () => void
  showDetails?: boolean
  enableRecovery?: boolean
  resetKeys?: Array<string | number>
  level?: 'page' | 'component'
}

export interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  errorId: string | null
  showDetails: boolean
  retryCount: number
}

const generateErrorId = (): string => {
  return `ERR-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetTimeoutId: ReturnType<typeof setTimeout> | null = null
  private unregisterHandler: (() => void) | null = null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      showDetails: props.showDetails ?? false,
      retryCount: 0,
    }
  }

  componentDidMount() {
    const { onRegisterHandler } = this.props
    if (onRegisterHandler) {
      this.unregisterHandler = onRegisterHandler((error: Error) => {
        const errorId = generateErrorId()
        const errorInfo = {
          componentStack: 'Async error caught by global error handler',
        } as ErrorInfo

        this.setState({
          hasError: true,
          error,
          errorId,
          errorInfo,
        })

        this.reportError(error, errorInfo, errorId)
      })
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: generateErrorId(),
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props
    const { errorId } = this.state

    if (errorId) {
      this.reportError(error, errorInfo, errorId)
    }

    onError?.(error, errorInfo)
    this.setState({ errorInfo })
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetKeys } = this.props
    const { hasError } = this.state

    if (hasError && resetKeys && prevProps.resetKeys !== resetKeys) {
      if (resetKeys.some((key, index) => key !== prevProps.resetKeys?.[index])) {
        this.resetErrorBoundary()
      }
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
    this.unregisterHandler?.()
  }

  reportError = (error: Error, errorInfo: ErrorInfo, errorId: string) => {
    const { onReportError } = this.props
    if (import.meta.env?.DEV) {
      console.group('Error Boundary Caught Error')
      console.error('Error ID:', errorId)
      console.error('Error:', error)
      console.error('Error Info:', errorInfo)
      console.groupEnd()
    }
    onReportError?.(error, errorInfo, errorId)
  }

  resetErrorBoundary = () => {
    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      showDetails: false,
      retryCount: prevState.retryCount + 1,
    }))
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
    this.resetErrorBoundary()
  }

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }))
  }

  render() {
    const { hasError, error, errorInfo, errorId, showDetails, retryCount } = this.state
    const { children, fallback, level = 'page', enableRecovery = true } = this.props

    if (!hasError) {
      return children
    }

    if (fallback) {
      return fallback
    }

    if (level === 'component') {
      return (
        <Alert variant="destructive" className="my-4">
          <AlertTriangle className="size-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            <div className="space-y-2">
              <p>{error?.message ?? 'An unexpected error occurred'}</p>
              {enableRecovery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={this.resetErrorBoundary}
                  className="mt-2"
                >
                  <RefreshCw className="mr-2 size-3" />
                  Try again
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )
    }

    return (
      <div className="bg-background flex min-h-screen flex-col items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="text-center">
            <div className="bg-destructive/10 mx-auto mb-4 flex size-16 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive size-8" />
            </div>
            <CardTitle className="text-2xl">Something went wrong</CardTitle>
            <CardDescription>
              We encountered an unexpected error. Don&apos;t worry, we&apos;re on it!
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle className="text-sm font-medium">
                  {error.name}: {error.message}
                </AlertTitle>
                {errorId && (
                  <AlertDescription className="text-muted-foreground text-xs">
                    Error ID: {errorId}
                  </AlertDescription>
                )}
              </Alert>
            )}

            {errorInfo && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={this.toggleDetails}
                  className="w-full justify-between"
                >
                  <span className="text-sm">Technical Details</span>
                  {showDetails ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </Button>
                {showDetails && error && (
                  <div className="bg-muted mt-2 rounded-md border p-3">
                    <pre className="max-h-60 overflow-auto text-xs">
                      {error.stack ?? error.message}
                      {'\n\n'}
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {retryCount > 0 && (
              <Alert>
                <AlertDescription className="text-xs">Retry attempt: {retryCount}</AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-2 sm:flex-row">
            {enableRecovery && (
              <Button variant="secondary" onClick={this.resetErrorBoundary} className="flex-1">
                <RefreshCw className="mr-2 size-4" />
                Try Again
              </Button>
            )}

            <Button variant="default" onClick={this.handleReload} className="flex-1">
              <RotateCw className="mr-2 size-4" />
              Reload Page
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }
}
