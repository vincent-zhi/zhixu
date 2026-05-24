import type { ProgressBoard, ProgressColumn } from "./types.js";

export class ProgressBoardManager {
  createBoard(projectId: string): ProgressBoard {
    const defaultColumns: ProgressColumn[] = [
      { id: crypto.randomUUID(), title: "To Do", taskIds: [], orderIndex: 0 },
      { id: crypto.randomUUID(), title: "In Progress", taskIds: [], orderIndex: 1 },
      { id: crypto.randomUUID(), title: "Review", taskIds: [], orderIndex: 2 },
      { id: crypto.randomUUID(), title: "Done", taskIds: [], orderIndex: 3 },
    ];

    return {
      id: crypto.randomUUID(),
      projectId,
      columns: defaultColumns,
      lastUpdated: new Date().toISOString(),
    };
  }

  moveTask(board: ProgressBoard, taskId: string, targetColumnId: string): ProgressBoard {
    for (const column of board.columns) {
      const idx = column.taskIds.indexOf(taskId);
      if (idx >= 0) {
        column.taskIds.splice(idx, 1);
      }
    }

    const targetColumn = board.columns.find((c) => c.id === targetColumnId);
    if (targetColumn) {
      targetColumn.taskIds.push(taskId);
    }

    board.lastUpdated = new Date().toISOString();
    return board;
  }

  addColumn(board: ProgressBoard, title: string): ProgressColumn {
    const maxOrder = board.columns.reduce(
      (max, c) => Math.max(max, c.orderIndex),
      -1
    );

    const column: ProgressColumn = {
      id: crypto.randomUUID(),
      title,
      taskIds: [],
      orderIndex: maxOrder + 1,
    };

    board.columns.push(column);
    board.lastUpdated = new Date().toISOString();
    return column;
  }
}
