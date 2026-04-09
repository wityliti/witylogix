/**
 * RouteNavigator - Turn-by-turn route display with stop management
 */

import React, { useState } from 'react';

export interface DeliveryStop {
  id: string;
  order: number;
  address: string;
  customerName: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
  notes?: string;
  latitude?: number;
  longitude?: number;
}

interface RouteNavigatorProps {
  stops: DeliveryStop[];
  currentStopId?: string;
  onStopSelect?: (stopId: string) => void;
  onStopStatusChange?: (stopId: string, status: DeliveryStop['status']) => void;
  onNavigate?: (stop: DeliveryStop) => void;
  onReorder?: (reorderedStops: DeliveryStop[]) => void;
}

const RouteNavigator: React.FC<RouteNavigatorProps> = ({
  stops,
  currentStopId,
  onStopSelect,
  onStopStatusChange,
  onNavigate,
  onReorder,
}) => {
  const [draggedStop, setDraggedStop] = useState<string | null>(null);

  const getStatusColor = (status: DeliveryStop['status']): string => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'in-progress':
        return '#2196F3';
      case 'failed':
        return '#f44336';
      case 'skipped':
        return '#9E9E9E';
      default:
        return '#FFC107';
    }
  };

  const getStatusIcon = (status: DeliveryStop['status']): string => {
    switch (status) {
      case 'completed':
        return '✓';
      case 'in-progress':
        return '⟳';
      case 'failed':
        return '✕';
      case 'skipped':
        return '⊘';
      default:
        return '◯';
    }
  };

  const calculateETA = (index: number): string => {
    const minutesPerStop = 15;
    const minutes = (index + 1) * minutesPerStop;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const now = new Date();
    now.setHours(now.getHours() + hours, now.getMinutes() + mins);
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const handleDragStart = (stopId: string) => {
    setDraggedStop(stopId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (targetStopId: string) => {
    if (!draggedStop || draggedStop === targetStopId || !onReorder) return;

    const draggedIndex = stops.findIndex((s) => s.id === draggedStop);
    const targetIndex = stops.findIndex((s) => s.id === targetStopId);

    const newStops = [...stops];
    const [draggedItem] = newStops.splice(draggedIndex, 1);
    newStops.splice(targetIndex, 0, draggedItem);

    // Reorder by order property
    newStops.forEach((stop, index) => {
      stop.order = index + 1;
    });

    onReorder(newStops);
    setDraggedStop(null);
  };

  const completedCount = stops.filter((s) => s.status === 'completed').length;
  const totalCount = stops.length;
  const progressPercent = (completedCount / totalCount) * 100;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '16px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
          Route ({completedCount}/{totalCount})
        </h3>
        <div style={{ fontSize: '12px', color: '#666' }}>
          {totalCount - completedCount} remaining
        </div>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#e0e0e0',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              backgroundColor: '#4CAF50',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div style={{ fontSize: '12px', color: '#666', textAlign: 'right' }}>
          {Math.round(progressPercent)}% complete
        </div>
      </div>

      {/* Stops List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {stops.map((stop, index) => {
          const isCurrentStop = currentStopId === stop.id;
          const statusColor = getStatusColor(stop.status);

          return (
            <div
              key={stop.id}
              draggable={onReorder !== undefined}
              onDragStart={() => handleDragStart(stop.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(stop.id)}
              onClick={() => onStopSelect?.(stop.id)}
              style={{
                padding: '12px',
                backgroundColor: isCurrentStop ? '#e3f2fd' : 'white',
                border: isCurrentStop ? `2px solid ${statusColor}` : '1px solid #ddd',
                borderRadius: '6px',
                cursor: onReorder ? 'grab' : 'pointer',
                transition: 'all 0.2s ease',
                opacity: draggedStop === stop.id ? 0.5 : 1,
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                {/* Status Badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: statusColor,
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    flexShrink: 0,
                  }}
                >
                  {getStatusIcon(stop.status)}
                </div>

                {/* Stop Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: '600',
                          color: '#333',
                        }}
                      >
                        Stop #{stop.order}: {stop.customerName}
                      </div>
                      <div
                        style={{
                          fontSize: '13px',
                          color: '#666',
                          marginTop: '2px',
                        }}
                      >
                        {stop.address}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#666',
                          marginBottom: '4px',
                        }}
                      >
                        ETA: {calculateETA(index)}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#999',
                        }}
                      >
                        {stop.timeWindowStart} - {stop.timeWindowEnd}
                      </div>
                    </div>
                  </div>

                  {stop.notes && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#999',
                        marginTop: '6px',
                        fontStyle: 'italic',
                      }}
                    >
                      {stop.notes}
                    </div>
                  )}

                  {/* Actions */}
                  {isCurrentStop && stop.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate?.(stop);
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          backgroundColor: '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                        }}
                      >
                        📍 Navigate
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStopStatusChange?.(stop.id, 'in-progress');
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                        }}
                      >
                        Start
                      </button>
                    </div>
                  )}

                  {isCurrentStop && stop.status === 'in-progress' && (
                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStopStatusChange?.(stop.id, 'completed');
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          backgroundColor: '#4CAF50',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                        }}
                      >
                        ✓ Delivered
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStopStatusChange?.(stop.id, 'failed');
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          backgroundColor: '#f44336',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                        }}
                      >
                        ✕ Failed
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStopStatusChange?.(stop.id, 'skipped');
                        }}
                        style={{
                          flex: 1,
                          padding: '6px 8px',
                          backgroundColor: '#9E9E9E',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                        }}
                      >
                        Skip
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {stops.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '24px',
            color: '#999',
          }}
        >
          No stops assigned yet
        </div>
      )}
    </div>
  );
};

export default RouteNavigator;
