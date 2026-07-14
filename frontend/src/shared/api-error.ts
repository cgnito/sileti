/**
 * Normalizes FastAPI's two error response shapes into one consistent type:
 *
 *  - Simple errors:      { "detail": "incorrect email or password" }
 *  - Validation errors:  { "detail": [{ "loc": [...], "msg": "...", "type": "..." }] }
 *
 * Everything that calls the API should be able to catch ApiError and just
 * read `.message` for display, or inspect `.fieldErrors` when it wants to
 * highlight specific form fields.
 */

export interface FastApiValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface FieldError {
  /** The form field this error applies to, e.g. "school_email". Best-effort
   *  guess from the last segment of FastAPI's `loc` array. */
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldError[];
  readonly raw: unknown;

  constructor(status: number, message: string, fieldErrors: FieldError[] = [], raw?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.raw = raw;
  }

  /** True for 401s — the one case the client treats as "session is dead". */
  get isUnauthorized() {
    return this.status === 401;
  }

  static async fromResponse(response: Response): Promise<ApiError> {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      // Response had no JSON body at all (rare, but don't crash on it).
    }

    const detail = (body as { detail?: unknown } | null)?.detail;

    // Case 1: FastAPI validation error — detail is an array.
    if (Array.isArray(detail)) {
      const fieldErrors: FieldError[] = (detail as FastApiValidationError[]).map((e) => ({
        field: String(e.loc[e.loc.length - 1] ?? "unknown"),
        message: e.msg,
      }));
      const message = fieldErrors[0]?.message ?? "Some fields are invalid.";
      return new ApiError(response.status, message, fieldErrors, body);
    }

    // Case 2: simple string detail — the common case for auth/business-logic errors.
    if (typeof detail === "string") {
      return new ApiError(response.status, detail, [], body);
    }

    // Case 3: no usable detail at all.
    return new ApiError(
      response.status,
      `Request failed with status ${response.status}`,
      [],
      body
    );
  }
}