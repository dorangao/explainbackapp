// Typed surface of the plain-JavaScript engine next to this file. Hand-maintained;
// frontend/lib/engines.test.ts checks the lesson types against the JSON schema.
export function formatDemoNumber(value: number): string;
export const demoSchema: {
  anyOf: {
    properties: Record<string, { properties?: Record<string, unknown> }>;
    required: string[];
  }[];
};
export function validateDemo(value: unknown): unknown;
export function compileExpression(source: string, names?: string[]): unknown;
export function evaluateExpression(ast: unknown, values: Record<string, number>): number;
export function validInputValue(input: { min: number; max: number; step: number }, value: number): boolean;
