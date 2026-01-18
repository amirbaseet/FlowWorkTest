import React, { useState, useMemo } from 'react';
import { Bell, X, AlertCircle, AlertTriangle, Info, CheckCircle, Trash2 } from 'lucide-react';

interface DutyNotification {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  relatedIds?: string[];
}

interface DutyNotificationCenterProps {
  notifications: DutyNotification[];
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

const DutyNotificationCenter: React.FC<DutyNotificationCenterProps> = ({
  notifications,
  onMarkAsRead,
  onDelete,
  onClearAll
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [notifications]);

  const getIcon = (type: DutyNotification['type']) => {
    switch (type) {
      case 'critical': return <AlertCircle className="text-red-600" size={20} />;
      case 'warning': return <AlertTriangle className="text-amber-600" size={20} />;
      case 'info': return <Info className="text-blue-600" size={20} />;
      case 'success': return <CheckCircle className="text-green-600" size={20} />;
    }
  };

  const getBgColor = (type: DutyNotification['type'], read: boolean) => {
    if (read) return 'bg-gray-50';
    switch (type) {
      case 'critical': return 'bg-red-50';
      case 'warning': return 'bg-amber-50';
      case 'info': return 'bg-blue-50';
      case 'success': return 'bg-green-50';
    }
  };

  const getBorderColor = (type: DutyNotification['type']) => {
    switch (type) {
      case 'critical': return 'border-red-200';
      case 'warning': return 'border-amber-200';
      case 'info': return 'border-blue-200';
      case 'success': return 'border-green-200';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    if (days < 7) return `منذ ${days} يوم`;
    return date.toLocaleDateString('ar');
  };

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell size={20} className="text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Panel */}
          <div 
            className="absolute left-0 top-12 w-96 max-h-[600px] bg-white rounded-xl shadow-2xl border-2 border-gray-200 z-50 overflow-hidden flex flex-col"
            dir="rtl"
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={18} />
                <h3 className="font-black text-sm">الإشعارات</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">
                    {unreadCount} جديد
                  </span>
                )}
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/20 rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Actions */}
            {notifications.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-200 flex justify-end">
                <button
                  onClick={onClearAll}
                  className="text-xs text-red-600 hover:text-red-700 font-bold"
                >
                  مسح الكل
                </button>
              </div>
            )}

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {sortedNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="mx-auto mb-3 text-gray-300" size={48} />
                  <p className="text-sm text-gray-500 font-medium">لا توجد إشعارات</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {sortedNotifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`p-3 transition-colors ${getBgColor(notification.type, notification.read)} hover:bg-gray-100 border-r-4 ${getBorderColor(notification.type)}`}
                      onClick={() => !notification.read && onMarkAsRead(notification.id)}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 mt-0.5">
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className={`text-sm font-bold text-gray-800 ${!notification.read ? 'font-black' : ''}`}>
                              {notification.title}
                            </h4>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(notification.id);
                              }}
                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                            >
                              <Trash2 size={12} className="text-gray-500" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-600 mb-1">
                            {notification.message}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {formatTimestamp(notification.timestamp)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DutyNotificationCenter;
