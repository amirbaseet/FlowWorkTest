// src/hooks/useActionHistory.ts

import { useState, useCallback, useRef } from 'react';
import type { Action, ActionHistory, ActionType } from '@/types/actionHistory';

const MAX_HISTORY_SIZE = 50; // Keep last 50 actions

export function useActionHistory(addToast?: (message: string, type: 'success' | 'error' | 'info') => void) {
  const [history, setHistory] = useState<ActionHistory>({
    past: [],
    future: [],
    maxHistorySize: MAX_HISTORY_SIZE,
  });

  // Track if we're in the middle of undo/redo to prevent recording
  const isUndoingRef = useRef(false);

  // Generate unique ID
  const generateId = () => `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // RECORD ACTION
  const recordAction = useCallback((action: Omit<Action, 'id' | 'timestamp'>) => {
    // Don't record if we're undoing/redoing
    if (isUndoingRef.current) return;

    const newAction: Action = {
      ...action,
      id: generateId(),
      timestamp: new Date(),
    };

    setHistory(prev => {
      const newPast = [...prev.past, newAction];
      
      // Limit history size
      if (newPast.length > prev.maxHistorySize) {
        newPast.shift(); // Remove oldest
      }

      return {
        ...prev,
        past: newPast,
        future: [], // Clear redo stack when new action is performed
      };
    });

    console.log('📝 [Action History] Action recorded:', newAction);
  }, []);

  // UNDO
  const undo = useCallback((): Action | null => {
    if (history.past.length === 0) {
      addToast?.('لا يوجد إجراءات للتراجع عنها', 'error');
      return null;
    }

    const actionToUndo = history.past[history.past.length - 1];
    
    setHistory(prev => ({
      ...prev,
      past: prev.past.slice(0, -1),
      future: [actionToUndo, ...prev.future],
    }));

    isUndoingRef.current = true;
    
    addToast?.(`↶ تراجع: ${actionToUndo.description}`, 'success');
    console.log('↶ [Action History] Undo:', actionToUndo);
    
    return actionToUndo;
  }, [history.past, addToast]);

  // REDO
  const redo = useCallback((): Action | null => {
    if (history.future.length === 0) {
      addToast?.('لا يوجد إجراءات لإعادتها', 'error');
      return null;
    }

    const actionToRedo = history.future[0];
    
    setHistory(prev => ({
      ...prev,
      past: [...prev.past, actionToRedo],
      future: prev.future.slice(1),
    }));

    isUndoingRef.current = true;

    addToast?.(`↷ إعادة: ${actionToRedo.description}`, 'success');
    console.log('↷ [Action History] Redo:', actionToRedo);

    return actionToRedo;
  }, [history.future, addToast]);

  // CLEAR HISTORY
  const clearHistory = useCallback(() => {
    setHistory({
      past: [],
      future: [],
      maxHistorySize: MAX_HISTORY_SIZE,
    });
    addToast?.('تم مسح سجل الإجراءات', 'success');
  }, [addToast]);

  // GET LAST ACTION
  const getLastAction = useCallback((): Action | null => {
    return history.past[history.past.length - 1] || null;
  }, [history.past]);

  // RESET UNDOING FLAG
  const resetUndoingFlag = useCallback(() => {
    isUndoingRef.current = false;
  }, []);

  // CAN UNDO/REDO
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  return {
    // Core operations
    recordAction,
    undo,
    redo,
    clearHistory,
    
    // State queries
    canUndo,
    canRedo,
    undoCount: history.past.length,
    redoCount: history.future.length,
    
    // History access
    getLastAction,
    history: history.past,
    
    // Internal
    resetUndoingFlag,
  };
}
