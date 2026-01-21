// src/components/workspace/UndoRedoToolbar.tsx

import React from 'react';
import { Undo, Redo, History } from 'lucide-react';

interface UndoRedoToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  redoCount: number;
}

export const UndoRedoToolbar: React.FC<UndoRedoToolbarProps> = ({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  undoCount,
  redoCount,
}) => {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-white border-b-2 border-gray-200 sticky top-0 z-40 shadow-sm">
      {/* Undo Button */}
      <button
        onClick={onUndo}
        disabled={!canUndo}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold
          transition-all duration-200 relative
          ${canUndo 
            ? 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-md active:scale-95' 
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }
        `}
        title="تراجع (Ctrl+Z)"
      >
        <Undo size={16} />
        <span>تراجع</span>
        {undoCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-sm">
            {undoCount}
          </span>
        )}
      </button>

      {/* Redo Button */}
      <button
        onClick={onRedo}
        disabled={!canRedo}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold
          transition-all duration-200 relative
          ${canRedo 
            ? 'bg-green-500 text-white hover:bg-green-600 hover:shadow-md active:scale-95' 
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }
        `}
        title="إعادة (Ctrl+Shift+Z)"
      >
        <Redo size={16} />
        <span>إعادة</span>
        {redoCount > 0 && (
          <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-sm">
            {redoCount}
          </span>
        )}
      </button>

      {/* History Indicator */}
      <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 rounded-lg border border-gray-200">
        <History size={14} className="text-gray-500" />
        <span className="text-xs font-semibold text-gray-600">
          {undoCount} إجراء
        </span>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="mr-auto text-[10px] text-gray-400 font-medium">
        Ctrl+Z: تراجع | Ctrl+Shift+Z: إعادة
      </div>
    </div>
  );
};
