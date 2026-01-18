/**
 * Mode Metadata Utility
 * Provides configuration metadata for different event/mode types
 * Used across Workspace, CalendarRequestForm, and other distribution components
 */

export interface ModeMetadata {
  label: string;           // Display name (e.g., "المراقبين")
  action: string;          // Action verb (e.g., "تعيين مراقب")
  role: string;            // Role name (e.g., "مراقب")
  color: string;           // Tailwind color class (e.g., "violet", "emerald")
  icon: string;            // Emoji icon
  desc: string;            // Description
  buttons: Array<{
    id: string;
    label: string;
    icon: string;
    color: string;
    type: 'automatic' | 'monitored' | 'partner';
  }>;
}

/**
 * Get metadata configuration for a specific event/mode type
 */
export function getModeMetadata(type: 'EXAM' | 'TRIP' | 'RAINY' | 'EMERGENCY' | 'HOLIDAY' | 'ACTIVITY' | null): ModeMetadata {
  switch (type) {
    case 'EXAM':
      return {
        label: 'المراقبين',
        action: 'تعيين مراقب',
        role: 'مراقب',
        color: 'violet',
        icon: '📝',
        desc: 'أولوية للمربي ومعلمي التخصص',
        buttons: [
          {
            id: 'auto',
            label: 'توزيع آلي - امتحانات',
            icon: '📝',
            color: 'bg-red-600 hover:bg-red-700',
            type: 'automatic'
          },
          {
            id: 'monitor',
            label: 'اقتراح مراقب',
            icon: '👁️',
            color: 'bg-violet-600 hover:bg-violet-700',
            type: 'monitored'
          }
        ]
      };
    
    case 'TRIP':
      return {
        label: 'المرافقين',
        action: 'تعيين مرافق',
        role: 'مرافق',
        color: 'emerald',
        icon: '🚌',
        desc: 'الأولوية للأكثر ارتباطاً بالطبقة',
        buttons: [
          {
            id: 'auto',
            label: 'توزيع آلي - رحلة',
            icon: '🚌',
            color: 'bg-emerald-600 hover:bg-emerald-700',
            type: 'automatic'
          },
          {
            id: 'partner',
            label: 'اقتراح مرافق',
            icon: '⚡',
            color: 'bg-emerald-600 hover:bg-emerald-700',
            type: 'partner'
          }
        ]
      };
    
    case 'RAINY':
      return {
        label: 'المناوبين (داخلي)',
        action: 'تعيين مناوب',
        role: 'مناوب داخلي',
        color: 'cyan',
        icon: '🌧️',
        desc: 'توزيع عادل حسب العبء اليومي',
        buttons: [
          {
            id: 'auto',
            label: 'توزيع مناوبين داخلي',
            icon: '🌧️',
            color: 'bg-cyan-600 hover:bg-cyan-700',
            type: 'automatic'
          }
        ]
      };
    
    case 'EMERGENCY':
      return {
        label: 'فريق الطوارئ',
        action: 'تعيين مساند',
        role: 'مساند طوارئ',
        color: 'rose',
        icon: '🚨',
        desc: 'تغطية النقص الحاد في الطاقم',
        buttons: [
          {
            id: 'auto',
            label: 'توزيع فريق طوارئ',
            icon: '🚨',
            color: 'bg-rose-600 hover:bg-rose-700',
            type: 'automatic'
          }
        ]
      };
    
    case 'HOLIDAY':
      return {
        label: 'المنظمين',
        action: 'تعيين منظم',
        role: 'منظم',
        color: 'violet',
        icon: '🎉',
        desc: 'استغلال المعلمين المتفرغين',
        buttons: [
          {
            id: 'auto',
            label: 'توزيع منظمين',
            icon: '🎉',
            color: 'bg-violet-600 hover:bg-violet-700',
            type: 'automatic'
          }
        ]
      };
    
    case 'ACTIVITY':
      return {
        label: 'المشرفين',
        action: 'تعيين مشرف',
        role: 'مشرف نشاط',
        color: 'purple',
        icon: '🎨',
        desc: 'توزيع المشرفين على الأنشطة المدرسية',
        buttons: [
          {
            id: 'auto',
            label: 'توزيع آلي - نشاط',
            icon: '🎨',
            color: 'bg-purple-600 hover:bg-purple-700',
            type: 'automatic'
          }
        ]
      };
    
    default:
      return {
        label: 'البدلاء',
        action: 'تعيين بديل',
        role: 'بديل',
        color: 'indigo',
        icon: '🤖',
        desc: 'توزيع عام',
        buttons: [
          {
            id: 'auto',
            label: 'توزيع آلي',
            icon: '🤖',
            color: 'bg-indigo-600 hover:bg-indigo-700',
            type: 'automatic'
          }
        ]
      };
  }
}
