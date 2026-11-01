// Typed surface of the plain-JavaScript engine next to this file. Hand-maintained;
// frontend/lib/engines.test.ts checks the lesson types against the JSON schema.
export function formatDemoNumber(value: number): string;
// "1" is the authored spelling of a dimensionless unit; readers never see it.
export function shownUnit(unit: string | null | undefined): string;
export function withUnit(text: string, unit: string | null | undefined): string;
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
