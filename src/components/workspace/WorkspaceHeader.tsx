// src/components/workspace/WorkspaceHeader.tsx

import React from 'react';
import { Check } from 'lucide-react';

/**
 * WorkspaceHeader - Top navigation bar with logo and title
 * Stateless presentational component
 */
const WorkspaceHeader: React.FC = () => {
  return (
    <header className="h-12 bg-white/80 backdrop-blur-md border-b border-indigo-200 flex items-center justify-between px-2 shrink-0 shadow-lg">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 bg-cyan-500 rounded-md flex items-center justify-center shadow-lg">
          <Check className="text-white" size={16} />
        </div>
        <h1 className="text-base font-black text-cyan-900">مساحة العمل</h1>
      </div>
    </header>
  );
};

export default WorkspaceHeader;
