// The one error type routes throw for a client-facing status and message. Shared by the
// server and the route modules it delegates to.
export class RequestError extends Error { constructor(status, message) { super(message); this.status = status; } }
