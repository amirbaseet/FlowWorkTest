// src/hooks/workspace/useWorkspaceModals.ts

import { useState, useCallback } from 'react';

export interface UseWorkspaceModalsReturn {
  // Absence Protocol Modal
  showAbsenceProtocol: boolean;
  activeProtocolStage: 1 | 2 | 3 | 6 | null;
  openAbsenceForm: (stage: 1 | 2 | 3 | 6) => void;
  closeAbsenceProtocol: () => void;
  
  // Save to Calendar Modal
  showSaveModal: boolean;
  openSaveModal: () => void;
  closeSaveModal: () => void;
  
  // Manual Assignment Popup
  activeSlot: { classId: string; period: number } | null;
  openManualPopup: (classId: string, period: number) => void;
  closeManualPopup: () => void;
  
  // Context Menu
  contextMenuPosition: { x: number; y: number } | null;
  contextMenuData: any | null;
  openContextMenu: (x: number, y: number, data: any) => void;
  closeContextMenu: () => void;
}

/**
 * Modal management for Workspace component
 * Centralized state for all popups, modals, and menus
 */
export const useWorkspaceModals = (): UseWorkspaceModalsReturn => {
  // Absence Protocol Modal
  const [showAbsenceProtocol, setShowAbsenceProtocol] = useState(true);
  const [activeProtocolStage, setActiveProtocolStage] = useState<1 | 2 | 3 | 6 | null>(null);
  
  // Save to Calendar Modal
  const [showSaveModal, setShowSaveModal] = useState(false);
  
  // Manual Assignment Popup
  const [activeSlot, setActiveSlot] = useState<{ classId: string; period: number } | null>(null);
  
  // Context Menu
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuData, setContextMenuData] = useState<any | null>(null);

  const openAbsenceForm = useCallback((stage: 1 | 2 | 3 | 6) => {
    setActiveProtocolStage(stage);
  }, []);

  const closeAbsenceProtocol = useCallback(() => {
    setShowAbsenceProtocol(false);
    setActiveProtocolStage(null);
  }, []);

  const openSaveModal = useCallback(() => {
    setShowSaveModal(true);
  }, []);

  const closeSaveModal = useCallback(() => {
    setShowSaveModal(false);
  }, []);

  const openManualPopup = useCallback((classId: string, period: number) => {
    setActiveSlot({ classId, period });
  }, []);

  const closeManualPopup = useCallback(() => {
    setActiveSlot(null);
  }, []);

  const openContextMenu = useCallback((x: number, y: number, data: any) => {
    setContextMenuPosition({ x, y });
    setContextMenuData(data);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenuPosition(null);
    setContextMenuData(null);
  }, []);

  return {
    showAbsenceProtocol,
    activeProtocolStage,
    openAbsenceForm,
    closeAbsenceProtocol,
    
    showSaveModal,
    openSaveModal,
    closeSaveModal,
    
    activeSlot,
    openManualPopup,
    closeManualPopup,
    
    contextMenuPosition,
    contextMenuData,
    openContextMenu,
    closeContextMenu
  };
};
