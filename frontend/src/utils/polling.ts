/**
 * Generic polling utility with exponential backoff
 */
export interface PollingOptions<T> {
  /**
   * Function that performs the check and returns data
   */
  checkFn: () => Promise<T>

  /**
   * Function that determines if polling should continue
   * Return true to continue polling, false to stop
   */
  conditionFn: (data: T) => boolean

  /**
   * Maximum number of attempts
   * @default 30
   */
  maxAttempts?: number

  /**
   * Initial delay between attempts in milliseconds
   * @default 1000
   */
  initialDelay?: number

  /**
   * Maximum delay between attempts in milliseconds
   * @default 5000
   */
  maxDelay?: number

  /**
   * Whether to use exponential backoff
   * @default false
   */
  useExponentialBackoff?: boolean

  /**
   * Callback for each attempt
   */
  onAttempt?: (attempt: number, data: T) => void

  /**
   * Callback for errors (continues polling unless max attempts reached)
   */
  onError?: (attempt: number, error: unknown) => void
}

export interface PollingResult<T> {
  success: boolean
  data?: T
  attempts: number
  error?: string
}

/**
 * Poll a function until a condition is met or max attempts is reached
 */
export async function poll<T>(options: PollingOptions<T>): Promise<PollingResult<T>> {
  const {
    checkFn,
    conditionFn,
    maxAttempts = 30,
    initialDelay = 1000,
    maxDelay = 5000,
    useExponentialBackoff = false,
    onAttempt,
    onError
  } = options

  let attempt = 0
  let lastData: T | undefined
  let lastError: unknown

  while (attempt < maxAttempts) {
    attempt++

    try {
      const data = await checkFn()
      lastData = data

      if (onAttempt) {
        onAttempt(attempt, data)
      }

      // Check if condition is met
      if (!conditionFn(data)) {
        return {
          success: true,
          data,
          attempts: attempt
        }
      }

      // Continue polling - wait before next attempt
      if (attempt < maxAttempts) {
        const delay = useExponentialBackoff
          ? Math.min(initialDelay * Math.pow(2, attempt - 1), maxDelay)
          : initialDelay

        await new Promise(resolve => setTimeout(resolve, delay))
      }
    } catch (error) {
      lastError = error

      if (onError) {
        onError(attempt, error)
      }

      // Continue polling even on error, but wait before retrying
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, initialDelay))
      }
    }
  }

  // Max attempts reached
  return {
    success: false,
    data: lastData,
    attempts: attempt,
    error: lastError instanceof Error
      ? lastError.message
      : 'Max polling attempts reached without meeting condition'
  }
}

/**
 * Convenience function for polling with a simple boolean condition
 */
export async function pollUntilTrue(
  checkFn: () => Promise<boolean>,
  options?: Omit<PollingOptions<boolean>, 'checkFn' | 'conditionFn'>
): Promise<PollingResult<boolean>> {
  return poll({
    checkFn,
    conditionFn: (result) => !result, // Continue while false
    ...options
  })
}
