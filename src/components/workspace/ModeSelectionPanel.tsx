// src/components/workspace/ModeSelectionPanel.tsx

import React from 'react';
import { Wand2 } from 'lucide-react';

export interface Mode {
  id: string;
  name: string;
  icon: string;
  selectedClass: string;
  hoverClass: string;
  buttonClass: string;
}

interface ModeSelectionPanelProps {
  modes?: Mode[];
  selectedMode: string;
  confirmedModes: Array<{
    modeId: string;
    classes: string[];
    periods: number[];
  }>;
  onModeToggle: (modeId: string) => void;
  onAutoDistribute: (index: number) => void;
}

const DEFAULT_MODES: Mode[] = [
  {
    id: 'EXAM',
    name: 'امتحانات',
    icon: '📝',
    selectedClass: 'bg-red-50 border-red-300 text-red-700',
    hoverClass: 'hover:bg-red-50 hover:border-red-300 hover:text-red-700',
    buttonClass: 'bg-red-600 hover:bg-red-700'
  },
  {
    id: 'ACTIVITY',
    name: 'نشاط',
    icon: '🎨',
    selectedClass: 'bg-purple-50 border-purple-300 text-purple-700',
    hoverClass: 'hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700',
    buttonClass: 'bg-purple-600 hover:bg-purple-700'
  },
  {
    id: 'TRIP',
    name: 'رحلة',
    icon: '🚌',
    selectedClass: 'bg-blue-50 border-blue-300 text-blue-700',
    hoverClass: 'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700',
    buttonClass: 'bg-blue-600 hover:bg-blue-700'
  },
  {
    id: 'RAINY',
    name: 'مطر',
    icon: '🌧️',
    selectedClass: 'bg-cyan-50 border-cyan-300 text-cyan-700',
    hoverClass: 'hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-700',
    buttonClass: 'bg-cyan-600 hover:bg-cyan-700'
  },
  {
    id: 'EMERGENCY',
    name: 'طوارئ',
    icon: '🚨',
    selectedClass: 'bg-orange-50 border-orange-300 text-orange-700',
    hoverClass: 'hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700',
    buttonClass: 'bg-orange-600 hover:bg-orange-700'
  },
  {
    id: 'HOLIDAY',
    name: 'عطلة',
    icon: '🎉',
    selectedClass: 'bg-green-50 border-green-300 text-green-700',
    hoverClass: 'hover:bg-green-50 hover:border-green-300 hover:text-green-700',
    buttonClass: 'bg-green-600 hover:bg-green-700'
  }
];

// Map UI button IDs to engineContext mode keys
const getModeKey = (buttonId: string): string => {
  const mapping: Record<string, string> = {
    'EXAM': 'examMode',
    'TRIP': 'tripMode',
    'RAINY': 'rainyMode',
    'EMERGENCY': 'emergencyMode',
    'HOLIDAY': 'holidayMode',
    'ACTIVITY': 'normalMode'
  };
  return mapping[buttonId] || buttonId;
};

/**
 * ModeSelectionPanel - Mode selection grid with auto-distribute buttons
 */
const ModeSelectionPanel: React.FC<ModeSelectionPanelProps> = ({
  modes = DEFAULT_MODES,
  selectedMode,
  confirmedModes,
  onModeToggle,
  onAutoDistribute
}) => {
  return (
    <div className="bg-white rounded-l-xl shadow-lg border border-gray-200 p-2 shrink-0">
      <h2 className="text-[10px] font-black text-gray-800 mb-2">🎯 اختر النمط</h2>
      <div className="grid grid-cols-6 gap-1.5">
        {modes.map(mode => {
          const modeKey = getModeKey(mode.id);
          const confirmedIndex = confirmedModes.findIndex(t => t.modeId === modeKey);
          const isConfirmed = confirmedIndex !== -1;

          return (
            <div key={mode.id} className="flex flex-col gap-1">
              {/* Mode Button */}
              <button
                onClick={() => onModeToggle(mode.id)}
                className={`border-2 rounded-lg p-2 transition-all text-center ${
                  selectedMode === mode.id
                    ? `${mode.selectedClass} ring-2 ring-offset-1 ring-current font-black scale-105`
                    : `bg-gray-50 border-gray-200 text-gray-600 ${mode.hoverClass}`
                }`}
              >
                <div className="text-xl mb-0.5">{mode.icon}</div>
                <div className="text-[8px] font-bold">{mode.name}</div>
              </button>

              {/* Auto Distribute Button */}
              <button
                onClick={() => isConfirmed && onAutoDistribute(confirmedIndex)}
                disabled={!isConfirmed}
                className={`w-full px-1.5 py-1 text-white rounded text-[7px] font-black transition-all flex items-center justify-center gap-1 ${
                  isConfirmed
                    ? `${mode.buttonClass} shadow-sm hover:shadow-md cursor-pointer`
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                }`}
              >
                <Wand2 size={8} /> توزيع
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ModeSelectionPanel;
