// src/hooks/workspace/useWorkspaceMode.ts

import { useState, useMemo, useCallback } from 'react';
import { ScheduleConfig, EngineContext } from '@/types';
import { getModeMetadata } from '@/utils/modeMetadata';

export interface UseWorkspaceModeReturn {
  selectedMode: string;
  confirmedModes: Array<{
    modeId: string;
    classes: string[];
    periods: number[];
  }>;
  selectedClasses: string[];
  selectedPeriods: number[];
  activeDistributionIndex: number | null;
  showDistribution: boolean;
  canConfirm: boolean;
  allPatternButtons: Array<any>;
  handleModeToggle: (buttonId: string) => void;
  handleConfirmMode: () => void;
  toggleClass: (classId: string) => void;
  togglePeriod: (period: number) => void;
  clearSelections: () => void;
  removeConfirmedMode: (index: number) => void;
  setActiveDistributionIndex: (index: number | null) => void;
  setShowDistribution: (show: boolean) => void;
}

export interface UseWorkspaceModeProps {
  scheduleConfig: ScheduleConfig;
  engineContext: EngineContext;
  addToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

// Map UI button IDs to engineContext mode keys
const getModeKey = (buttonId: string): string => {
  const mapping: Record<string, string> = {
    'EXAM': 'examMode',
    'TRIP': 'tripMode',
    'RAINY': 'rainyMode',
    'EMERGENCY': 'emergencyMode',
    'HOLIDAY': 'holidayMode',
    'ACTIVITY': 'normalMode' // Activity uses normal mode
  };
  return mapping[buttonId] || buttonId;
};

// Get pattern-specific buttons from centralized metadata utility
const getPatternButtons = (modeId: string, engineContext: EngineContext) => {
  const mode = engineContext[modeId as keyof EngineContext] as any;
  if (!mode || !mode.linkedEventType) return [];

  // Get metadata configuration from utility
  const metadata = getModeMetadata(mode.linkedEventType);

  // Map buttons with modeId
  return metadata.buttons.map(btn => ({
    ...btn,
    modeId: modeId
  }));
};

export const useWorkspaceMode = ({
  scheduleConfig,
  engineContext,
  addToast
}: UseWorkspaceModeProps): UseWorkspaceModeReturn => {
  
  // State
  const [selectedMode, setSelectedMode] = useState<string>('');
  const [confirmedModes, setConfirmedModes] = useState<Array<{
    modeId: string;
    classes: string[];
    periods: number[];
  }>>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedPeriods, setSelectedPeriods] = useState<number[]>([]);
  const [activeDistributionIndex, setActiveDistributionIndex] = useState<number | null>(null);
  const [showDistribution, setShowDistribution] = useState(false);

  // Computed: Can confirm mode
  const canConfirm = useMemo(() => {
    return selectedMode !== '' && selectedClasses.length > 0 && selectedPeriods.length > 0;
  }, [selectedMode, selectedClasses, selectedPeriods]);

  // Computed: All pattern buttons for confirmed modes
  const allPatternButtons = useMemo(() => {
    const buttons: Array<{
      id: string;
      label: string;
      icon: string;
      color: string;
      modeId: string;
      type: 'automatic' | 'monitored' | 'partner';
      classes: string[];
      periods: number[];
    }> = [];

    confirmedModes.forEach(template => {
      const modeButtons = getPatternButtons(template.modeId, engineContext);
      modeButtons.forEach(btn => {
        buttons.push({
          ...btn,
          classes: template.classes,
          periods: template.periods
        });
      });
    });

    return buttons;
  }, [confirmedModes, engineContext]);

  // Handlers
  const handleModeToggle = useCallback((buttonId: string) => {
    // If clicking already selected mode, deselect it
    if (selectedMode === buttonId) {
      setSelectedMode('');
    } else {
      // Select new mode
      setSelectedMode(buttonId);
      // Reset selections when switching modes
      setSelectedClasses([]);
      setSelectedPeriods([]);
    }
    setShowDistribution(false);
  }, [selectedMode]);

  const handleConfirmMode = useCallback(() => {
    if (!selectedMode) {
      alert('يرجى اختيار نمط');
      return;
    }
    if (selectedClasses.length === 0 || selectedPeriods.length === 0) {
      alert('يرجى تحديد الصفوف والحصص');
      return;
    }

    // Convert button ID to mode key
    const modeKey = getModeKey(selectedMode);

    // Check if mode already confirmed
    if (confirmedModes.some(cm => cm.modeId === modeKey)) {
      alert('تم تثبيت هذا النمط مسبقاً');
      return;
    }

    // Add to confirmed modes with selections
    setConfirmedModes(prev => [
      ...prev,
      {
        modeId: modeKey,
        classes: [...selectedClasses],
        periods: [...selectedPeriods]
      }
    ]);

    // Reset selections for next mode
    setSelectedMode('');
    setSelectedClasses([]);
    setSelectedPeriods([]);
    setShowDistribution(false);
    
    addToast(`✅ تم تثبيت النمط بنجاح`, 'success');
  }, [selectedMode, selectedClasses, selectedPeriods, confirmedModes, addToast]);

  const toggleClass = useCallback((classId: string) => {
    setSelectedClasses(prev =>
      prev.includes(classId) ? prev.filter(c => c !== classId) : [...prev, classId]
    );
  }, []);

  const togglePeriod = useCallback((period: number) => {
    setSelectedPeriods(prev =>
      prev.includes(period) ? prev.filter(p => p !== period) : [...prev, period]
    );
  }, []);

  const clearSelections = useCallback(() => {
    setSelectedMode('');
    setSelectedClasses([]);
    setSelectedPeriods([]);
    setConfirmedModes([]);
    setShowDistribution(false);
    setActiveDistributionIndex(null);
  }, []);

  const removeConfirmedMode = useCallback((index: number) => {
    setConfirmedModes(prev => prev.filter((_, i) => i !== index));
    addToast('تم إزالة النمط', 'info');
  }, [addToast]);

  return {
    selectedMode,
    confirmedModes,
    selectedClasses,
    selectedPeriods,
    activeDistributionIndex,
    showDistribution,
    canConfirm,
    allPatternButtons,
    handleModeToggle,
    handleConfirmMode,
    toggleClass,
    togglePeriod,
    clearSelections,
    removeConfirmedMode,
    setActiveDistributionIndex,
    setShowDistribution
  };
};
