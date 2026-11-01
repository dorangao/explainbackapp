import type { CanvasBinding, Demo, Drawing, Experiment } from '../frontend/lib/types';
export function validateCanvas(value: unknown, demo: Demo): CanvasBinding;
export function validateDrawing(value: unknown): Drawing;
export function chartDomain(experiment: Experiment): {low:number;high:number};
export function drawingEvidence(experiment: Experiment, value:unknown): {series:string;unit:string;axis:string;samples:{progress:number;predicted:number;calculated:number}[]};
