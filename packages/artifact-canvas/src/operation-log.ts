import type { CanvasDocument, CanvasOperation } from "./types.js";

export interface OperationLog {
  readonly undoStack: readonly CanvasDocument[];
  readonly redoStack: readonly CanvasDocument[];
}

export function createLog(): OperationLog {
  return { undoStack: [], redoStack: [] };
}

export function push(log: OperationLog, doc: CanvasDocument, op: CanvasOperation): OperationLog {
  return {
    undoStack: [...log.undoStack, doc],
    redoStack: []
  };
}

export function undo(log: OperationLog, doc: CanvasDocument): { log: OperationLog; doc: CanvasDocument } {
  if (log.undoStack.length === 0) {
    return { log, doc };
  }
  const lastIndex = log.undoStack.length - 1;
  const previousDoc = log.undoStack[lastIndex]!;
  const remaining = log.undoStack.slice(0, lastIndex);
  return {
    log: {
      undoStack: remaining,
      redoStack: [...log.redoStack, doc]
    },
    doc: previousDoc
  };
}

export function redo(log: OperationLog, doc: CanvasDocument): { log: OperationLog; doc: CanvasDocument } {
  if (log.redoStack.length === 0) {
    return { log, doc };
  }
  const lastIndex = log.redoStack.length - 1;
  const nextDoc = log.redoStack[lastIndex]!;
  const remaining = log.redoStack.slice(0, lastIndex);
  return {
    log: {
      undoStack: [...log.undoStack, doc],
      redoStack: remaining
    },
    doc: nextDoc
  };
}

export function canUndo(log: OperationLog): boolean {
  return log.undoStack.length > 0;
}

export function canRedo(log: OperationLog): boolean {
  return log.redoStack.length > 0;
}
