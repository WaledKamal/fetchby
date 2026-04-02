import type { z } from 'zod';

/**
 * Standard HTTP methods supported by the fetch API.
 */
export type FetchMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/**
 * Middleware for processing requests before they are sent.
 */
export interface RequestMiddleware {
  (url: string, config: RequestInit): Promise<RequestInit> | RequestInit;
}

/**
 * Middleware for processing responses after they are received.
 */
export interface ResponseMiddleware {
  (response: Response): Promise<Response> | Response;
}

/**
 * Configuration options for the Client instance.
 */
export interface ClientConfig extends Omit<RequestInit, 'method'> {
  /** Base URL prepended to all endpoints */
  baseUrl?: string;
  /** Number of times to retry a failed request */
  retries?: number;
  /** Delay in milliseconds between retries, or a function that receives the attempt number and returns the delay */
  retryDelay?: number | ((attempt: number) => number);
  /** Timeout in milliseconds for the request */
  timeoutMs?: number;
  middlewares?: {
    request?: RequestMiddleware[];
    response?: ResponseMiddleware[];
  };
}

/**
 * Configuration options for a single request.
 */
export interface RequestConfig<T = unknown> extends ClientConfig {
  /** The HTTP method */
  method?: FetchMethod;
  /** Zod schema for response validation and automatic type inference */
  schema?: z.ZodSchema<T>;
  /** Automatically serialized to JSON and attached to the body */
  json?: unknown;
  /** Object representing URL query parameters */
  query?: Record<string, string | number | boolean | undefined | null>;
}

/**
 * A Result pattern tuple. Returns either [Data, null] or [null, Error].
 * Avoids the need for try/catch blocks.
 */
export type Result<T, E = Error> = [data: T, error: null] | [data: null, error: E];

/**
 * Custom error class to carry additional context for failed HTTP requests.
 */
export class FetchError extends Error {
  constructor(
    public readonly message: string,
    public readonly status?: number,
    public readonly response?: Response,
    public readonly data?: any
  ) {
    super(message);
    this.name = 'FetchError';
    
    // Fix prototype chain for built-in extension in TS
    Object.setPrototypeOf(this, FetchError.prototype);
  }
}
