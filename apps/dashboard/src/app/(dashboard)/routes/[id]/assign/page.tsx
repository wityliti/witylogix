'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useApiQuery, useApiMutation } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import {
  Package,
  MapPin,
  User,
  Truck,
  Clock,
  Weight,
  Zap,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Search,
  GripVertical,
} from 'lucide-react';

interface Shipment {
  id: string;
  customer: string;
  address: string;
  weight: number;
  items: number;
  priority: string;
  eta: string;
  assigned: boolean;
}

interface Route {
  id: string;
  name: string;
  driver: { id: string; name: string; vehicle: string; capacity: number };
  currentStops: number;
  maxStops: number;
  currentWeight: number;
  maxWeight: number;
  currentCapacity: number;
  eta: string;
  status: string;
}

const getPriorityColor = (priority: string) => {
  if (priority === 'high') return 'danger';
  if (priority === 'low') return 'info';
  return 'default';
};

export default function RouteAssignPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: route, loading: routeLoading, error: routeError, refetch: refetchRoute } = useApiQuery<Route>(
    id ? `/api/v4/routes/${id}` : null
  );
  const { data: shipments, loading: shipmentsLoading, error: shipmentsError } = useApiQuery<Shipment[]>(
    `/api/v4/shipments?unassigned=true`
  );
  const { execute: assignShipment } = useApiMutation<Shipment>('PATCH', `/api/v4/shipments`);

  const [searchQuery, setSearchQuery] = useState('');
  const [assignedShipments, setAssignedShipments] = useState<Shipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);

  if (routeLoading || shipmentsLoading) {
    return (
      <div className="p-6 min-h-screen bg-[#0a0a0f]">
        <LoadingSkeleton />
      </div>
    );
  }

  if (routeError) {
    return (
      <div className="p-6 min-h-screen bg-[#0a0a0f]">
        <ErrorState message={routeError.message} onRetry={refetchRoute} />
      </div>
    );
  }

  if (!route || !shipments) {
    return (
      <div className="p-6 min-h-screen bg-[#0a0a0f]">
        <div className="text-center text-gray-400">Data not found</div>
      </div>
    );
  }

  const filteredShipments = searchQuery
    ? shipments.filter(
        (s) =>
          s.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.id.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : shipments;

  const handleAssign = async (shipment: Shipment) => {
    const newCapacity = route.currentCapacity - 1;
    const newWeight = route.currentWeight + shipment.weight;

    if (newCapacity < 0 || newWeight > route.maxWeight) {
      return;
    }

    try {
      await assignShipment({ id: shipment.id, routeId: route.id });
      setAssignedShipments([...assignedShipments, shipment]);
      setSelectedShipment(null);
    } catch (err) {
      console.error('Failed to assign shipment:', err);
    }
  };

  const handleUnassign = (shipment: Shipment) => {
    setAssignedShipments(assignedShipments.filter((s) => s.id !== shipment.id));
  };

  const handleOptimize = () => {
    const sorted = [...assignedShipments].sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
    });
    setAssignedShipments(sorted);
  };

  const totalAssignedWeight = assignedShipments.reduce((sum, s) => sum + s.weight, 0);
  const capacityUsed = ((route.currentWeight + totalAssignedWeight) / route.maxWeight) * 100;
  const stopsUsed = (route.currentStops + assignedShipments.length) / route.maxStops;

  return (
    <div className={cn("p-6 min-h-screen bg-[#0a0a0f]")}>
      {/* Header */}
      <div className={cn("mb-6")}>
        <h1 className={cn("text-4xl font-bold text-white mb-2")}>{route.name}</h1>
        <p className={cn("text-gray-300 mb-4")}>Assign shipments to this route</p>
        <div className={cn("flex gap-3 items-center flex-wrap")}>
          <Badge variant="success">ACTIVE</Badge>
          <span className={cn("text-xs text-gray-300")}>Driver: {route.driver.name}</span>
          <span className={cn("text-xs text-gray-300")}>Vehicle: {route.driver.vehicle}</span>
          <span className={cn("text-xs text-gray-300")}>ETA: {route.eta}</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className={cn("grid gap-6")} style={{ gridTemplateColumns: '1fr 400px' }}>
        {/* Left Column - Unassigned Shipments */}
        <div>
          {/* Search Bar */}
          <Card className={cn("bg-[#12121a] border border-[#1e1e2e] mb-6")}>
            <CardContent className={cn("p-4")}>
              <div className={cn("relative")}>
                <Search size={16} className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-blue-500")} />
                <Input
                  placeholder="Search shipments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn("pl-9 w-full bg-[#0a0a0f] text-white border border-[#1e1e2e]")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Shipment List */}
          <div className={cn("flex flex-col gap-3")}>
            {filteredShipments.length > 0 ? (
              filteredShipments.map((shipment) => (
                <Card
                  key={shipment.id}
                  className={cn("cursor-pointer transition-all", {
                    "bg-[#12121a] border-2 border-blue-500": selectedShipment?.id === shipment.id,
                    "bg-[#12121a] border border-[#1e1e2e]": selectedShipment?.id !== shipment.id,
                  })}
                  onClick={() => setSelectedShipment(selectedShipment?.id === shipment.id ? null : shipment)}
                >
                  <CardContent className={cn("p-4")}>
                    <div className={cn("flex gap-3 items-start")}>
                      <div className={cn("flex items-center mt-0.5")}>
                        <Package size={16} className={cn("text-blue-500")} />
                      </div>
                      <div className={cn("flex-1 min-w-0")}>
                        <div className={cn("flex justify-between items-center mb-1")}>
                          <p className={cn("text-sm font-semibold text-white")}>{shipment.id}</p>
                          <Badge variant={getPriorityColor(shipment.priority)}>{shipment.priority.toUpperCase()}</Badge>
                        </div>
                        <p className={cn("text-xs text-gray-300 mb-2")}>{shipment.customer}</p>
                        <div className={cn("flex gap-4 flex-wrap")}>
                          <span className={cn("text-xs text-gray-300 flex items-center gap-1")}>
                            <MapPin size={12} /> {shipment.address}
                          </span>
                          <span className={cn("text-xs text-gray-300 flex items-center gap-1")}>
                            <Weight size={12} /> {shipment.weight} kg
                          </span>
                          <span className={cn("text-xs text-gray-300 flex items-center gap-1")}>
                            <Clock size={12} /> {shipment.eta}
                          </span>
                        </div>
                      </div>
                    </div>
                    {selectedShipment?.id === shipment.id && (
                      <div className={cn("mt-3 pt-3 border-t border-[#1e1e2e]")}>
                        <Button
                          variant="primary"
                          size="sm"
                          className={cn("w-full flex items-center justify-center gap-1.5")}
                          onClick={() => handleAssign(shipment)}
                        >
                          <ChevronRight size={14} /> Assign to Route
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className={cn("bg-[#12121a] border border-[#1e1e2e]")}>
                <CardContent className={cn("p-6 text-center")}>
                  <p className={cn("text-gray-300")}>No unassigned shipments found</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right Sidebar - Route Details & Assigned Shipments */}
        <div className={cn("flex flex-col gap-4")}>
          {/* Capacity Meter */}
          <Card className={cn("bg-[#12121a] border border-[#1e1e2e]")}>
            <CardHeader className={cn("pb-3 border-b border-[#1e1e2e]")}>
              <CardTitle className={cn("text-base flex items-center gap-1.5 text-white")}>
                <Truck size={16} className={cn("text-blue-500")} /> Route Capacity
              </CardTitle>
            </CardHeader>
            <CardContent className={cn("p-4")}>
              <div className={cn("mb-4")}>
                <div className={cn("flex justify-between mb-1.5")}>
                  <span className={cn("text-xs text-gray-300")}>Stops</span>
                  <span className={cn("text-xs font-semibold text-white")}>
                    {route.currentStops + assignedShipments.length}/{route.maxStops}
                  </span>
                </div>
                <div
                  className={cn("w-full h-1.5 bg-[#0a0a0f] rounded overflow-hidden")}
                >
                  <div
                    className={cn({
                      "bg-red-500": stopsUsed > 0.8,
                      "bg-amber-500": stopsUsed > 0.5 && stopsUsed <= 0.8,
                      "bg-blue-500": stopsUsed <= 0.5,
                    })}
                    style={{
                      width: `${(stopsUsed * 100).toFixed(1)}%`,
                      transition: 'width 200ms ease',
                    }}
                  />
                </div>
              </div>

              <div className={cn("mb-4")}>
                <div className={cn("flex justify-between mb-1.5")}>
                  <span className={cn("text-xs text-gray-300")}>Weight</span>
                  <span className={cn("text-xs font-semibold text-white")}>
                    {(route.currentWeight + totalAssignedWeight).toFixed(1)}/{route.maxWeight} kg
                  </span>
                </div>
                <div
                  className={cn("w-full h-1.5 bg-[#0a0a0f] rounded overflow-hidden")}
                >
                  <div
                    className={cn({
                      "bg-red-500": capacityUsed > 80,
                      "bg-amber-500": capacityUsed > 50 && capacityUsed <= 80,
                      "bg-blue-500": capacityUsed <= 50,
                    })}
                    style={{
                      width: `${capacityUsed.toFixed(1)}%`,
                      transition: 'width 200ms ease',
                    }}
                  />
                </div>
              </div>

              <div
                className={cn("p-3 bg-[#0a0a0f] rounded border border-[#1e1e2e]")}
              >
                <p className={cn("text-xs text-gray-300 mb-1")}>Remaining Capacity</p>
                <p className={cn("text-sm font-semibold text-blue-500")}>{route.currentCapacity - assignedShipments.length} slots</p>
              </div>
            </CardContent>
          </Card>

          {/* ETA Preview */}
          <Card className={cn("bg-[#12121a] border border-[#1e1e2e]")}>
            <CardHeader className={cn("pb-3 border-b border-[#1e1e2e]")}>
              <CardTitle className={cn("text-base flex items-center gap-1.5 text-white")}>
                <Clock size={16} className={cn("text-blue-500")} /> ETA Preview
              </CardTitle>
            </CardHeader>
            <CardContent className={cn("p-4")}>
              <div
                className={cn("p-3 bg-[#0a0a0f] rounded border border-[#1e1e2e]")}
              >
                <p className={cn("text-xs text-gray-300 mb-1")}>Current Route ETA</p>
                <p className={cn("text-base font-semibold text-emerald-500")}>{route.eta}</p>
                <p className={cn("text-xs text-gray-300 mt-1.5")}>+{assignedShipments.length * 8} min estimated</p>
              </div>
            </CardContent>
          </Card>

          {/* Assigned Shipments List */}
          <Card className={cn("bg-[#12121a] border border-[#1e1e2e] flex-1 flex flex-col")}>
            <CardHeader className={cn("pb-3 border-b border-[#1e1e2e]")}>
              <CardTitle className={cn("text-base flex items-center justify-between text-white")}>
                <span className={cn("flex items-center gap-1.5")}>
                  <CheckCircle size={16} className={cn("text-emerald-500")} /> Assigned ({assignedShipments.length})
                </span>
                {assignedShipments.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleOptimize} className={cn("text-xs")}>
                    <Zap size={12} /> Optimize
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className={cn("p-3 flex-1 overflow-y-auto flex flex-col gap-2")}>
              {assignedShipments.length > 0 ? (
                assignedShipments.map((shipment, idx) => (
                  <div
                    key={shipment.id}
                    className={cn("p-2.5 bg-[#0a0a0f] rounded border border-[#1e1e2e] flex items-start gap-2")}
                  >
                    <GripVertical size={14} className={cn("text-blue-500 mt-0.5 flex-shrink-0")} />
                    <div className={cn("flex-1 min-w-0")}>
                      <div className={cn("flex justify-between items-center mb-0.5")}>
                        <p className={cn("text-xs font-semibold text-white")}>{idx + 1}. {shipment.id}</p>
                        <button
                          onClick={() => handleUnassign(shipment)}
                          className={cn("bg-none border-none text-red-500 cursor-pointer text-xs font-semibold p-0")}
                        >
                          Remove
                        </button>
                      </div>
                      <p className={cn("text-xs text-gray-300")}>{shipment.weight} kg</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className={cn("text-center py-5")}>
                  <p className={cn("text-xs text-gray-300")}>No shipments assigned yet</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className={cn("grid grid-cols-2 gap-2")}>
            <Button variant="secondary" size="md" className={cn("flex items-center justify-center gap-1.5")}>
              <AlertCircle size={14} /> Review
            </Button>
            <Button variant="primary" size="md" className={cn("flex items-center justify-center gap-1.5")}>
              <CheckCircle size={14} /> Confirm Route
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
