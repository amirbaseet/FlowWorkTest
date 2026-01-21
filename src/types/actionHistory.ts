// src/types/actionHistory.ts

export type ActionType =
  // Pool Management
  | 'POOL_ADD_TEACHER'
  | 'POOL_REMOVE_TEACHER'
  | 'POOL_CLEAR_ALL'
  
  // Assignment
  | 'ASSIGN_SUBSTITUTE'
  | 'REMOVE_ASSIGNMENT'
  | 'BULK_ASSIGN'
  
  // Smart Swap
  | 'CREATE_SMART_SWAP'
  | 'CANCEL_SMART_SWAP'
  
  // Mode Selection
  | 'SELECT_MODE'
  | 'DESELECT_MODE'
  | 'CHANGE_MODE'
  | 'CONFIRM_MODE'
  | 'REMOVE_CONFIRMED_MODE'
  
  // Absence Management
  | 'ADD_ABSENCE'
  | 'REMOVE_ABSENCE'
  | 'UPDATE_ABSENCE'
  
  // Bulk Operations
  | 'BULK_OPERATION';

export interface Action {
  id: string;                    // Unique action ID
  type: ActionType;              // Type of action
  timestamp: Date;               // When it happened
  description: string;           // Human-readable description (Arabic)
  
  // State snapshots
  beforeState: any;              // State before action
  afterState: any;               // State after action
  
  // Metadata
  metadata?: {
    teacherId?: number;
    teacherName?: string;
    classId?: string;
    className?: string;
    period?: number;
    date?: string;
    [key: string]: any;
  };
  
  // For composite actions
  isComposite?: boolean;
  subActions?: Action[];
}

export interface ActionHistory {
  past: Action[];                // Actions that can be undone
  future: Action[];              // Actions that can be redone
  maxHistorySize: number;        // Limit history size (e.g., 50 actions)
}
