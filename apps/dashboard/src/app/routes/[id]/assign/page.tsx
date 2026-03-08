'use client';

import { useState } from 'react';
import { cn } from '../../../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Input } from '../../../../components/ui/input';
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

// Mock data
const mockShipments = [
  { id: 'SHP-001', customer: 'John Doe', address: '123 Broadway, NYC', weight: 2.5, items: 3, priority: 'high', eta: '2:30 PM', assigned: false },
  { id: 'SHP-002', customer: 'Jane Smith', address: '456 5th Ave, NYC', weight: 1.2, items: 1, priority: 'normal', eta: '3:15 PM', assigned: false },
  { id: 'SHP-003', customer: 'Bob Johnson', address: '789 Park Ave, NYC', weight: 3.8, items: 5, priority: 'normal', eta: '4:00 PM', assigned: false },
  { id: 'SHP-004', customer: 'Alice Brown', address: '321 Madison Ave, NYC', weight: 0.8, items: 1, priority: 'low', eta: '4:45 PM', assigned: false },
  { id: 'SHP-005', customer: 'Charlie Wilson', address: '654 3rd Ave, NYC', weight: 2.1, items: 2, priority: 'high', eta: '2:15 PM', assigned: false },
  { id: 'SHP-006', customer: 'Diana Martinez', address: '987 2nd Ave, NYC', weight: 1.5, items: 2, priority: 'normal', eta: '5:00 PM', assigned: false },
];

const mockRoute = {
  id: 'RTE-001',
  name: 'Manhattan North Loop',
  driver: { id: 'DRV-001', name: 'Michael Brown', vehicle: 'Van-001', capacity: 50 },
  currentStops: 5,
  maxStops: 15,
  currentWeight: 18.5,
  maxWeight: 100,
  currentCapacity: 37,
  eta: '6:30 PM',
  status: 'active',
};

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

const getPriorityColor = (priority: string) => {
  if (priority === 'high') return 'danger';
  if (priority === 'low') return 'info';
  return 'default';
};

export default function RouteAssignPage({ params }: { params: { id: string } }) {
  const routeId = params.id || 'RTE-001';
  const [searchQuery, setSearchQuery] = useState('');
  const [shipments, setShipments] = useState<Shipment[]>(mockShipments);
  const [assignedShipments, setAssignedShipments] = useState<Shipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [currentCapacity, setCurrentCapacity] = useState(mockRoute.currentCapacity);
  const [currentWeight, setCurrentWeight] = useState(mockRoute.currentWeight);

  const filteredShipments = searchQuery
    ? shipments.filter(
        (s) =>
          s.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.id.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : shipments;

  const handleAssign = (shipment: Shipment) => {
    const newCapacity = currentCapacity - 1;
    const newWeight = currentWeight + shipment.weight;

    if (newCapacity < 0 || newWeight > mockRoute.maxWeight) {
      return;
    }

    setAssignedShipments([...assignedShipments, shipment]);
    setShipments(shipments.filter((s) => s.id !== shipment.id));
    setCurrentCapacity(newCapacity);
    setCurrentWeight(newWeight);
    setSelectedShipment(null);
  };

  const handleUnassign = (shipment: Shipment) => {
    setAssignedShipments(assignedShipments.filter((s) => s.id !== shipment.id));
    setShipments([...shipments, shipment]);
    setCurrentCapacity(currentCapacity + 1);
    setCurrentWeight(currentWeight - shipment.weight);
  };

  const handleOptimize = () => {
    const sorted = [...assignedShipments].sort((a, b) => {
      const priorityOrder = { high: 0, normal: 1, low: 2 };
      return priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
    });
    setAssignedShipments(sorted);
  };

  const totalAssignedWeight = assignedShipments.reduce((sum, s) => sum + s.weight, 0);
  const capacityUsed = ((mockRoute.currentWeight + totalAssignedWeight) / mockRoute.maxWeight) * 100;
  const stopsUsed = (mockRoute.currentStops + assignedShipments.length) / mockRoute.maxStops;

  return (
    <div className={cn("p-6 min-h-screen bg-wl-bg-root")}>
      {/* Header */}
      <div className={cn("mb-6")}>
        <h1 className={cn("text-4xl font-bold text-wl-text-primary mb-2")}>{mockRoute.name}</h1>
        <p className={cn("text-wl-text-secondary mb-4")}>Assign shipments to this route</p>
        <div className={cn("flex gap-3 items-center flex-wrap")}>
          <Badge variant="success">ACTIVE</Badge>
          <span className={cn("text-xs text-wl-text-secondary")}>Driver: {mockRoute.driver.name}</span>
          <span className={cn("text-xs text-wl-text-secondary")}>Vehicle: {mockRoute.driver.vehicle}</span>
          <span className={cn("text-xs text-wl-text-secondary")}>ETA: {mockRoute.eta}</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className={cn("grid gap-6")} style={{ gridTemplateColumns: '1fr 400px' }}>
        {/* Left Column - Unassigned Shipments */}
        <div>
          {/* Search Bar */}
          <Card className={cn("bg-wl-bg-elevated border border-wl-border-default mb-6")}>
            <CardContent className={cn("p-4")}>
              <div className={cn("relative")}>
                <Search size={16} className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-wl-primary-500")} />
                <Input
                  placeholder="Search shipments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn("pl-9 w-full bg-wl-bg-root border border-wl-border-default")}
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
                    "bg-wl-bg-elevated border-2 border-wl-primary-500": selectedShipment?.id === shipment.id,
                    "bg-wl-bg-surface border border-wl-border-default": selectedShipment?.id !== shipment.id,
                  })}
                  onClick={() => setSelectedShipment(selectedShipment?.id === shipment.id ? null : shipment)}
                >
                  <CardContent className={cn("p-4")}>
                    <div className={cn("flex gap-3 items-start")}>
                      <div className={cn("flex items-center mt-0.5")}>
                        <Package size={16} className={cn("text-wl-primary-500")} />
                      </div>
                      <div className={cn("flex-1 min-w-0")}>
                        <div className={cn("flex justify-between items-center mb-1")}>
                          <p className={cn("text-sm font-semibold text-wl-text-primary")}>{shipment.id}</p>
                          <Badge variant={getPriorityColor(shipment.priority)}>{shipment.priority.toUpperCase()}</Badge>
                        </div>
                        <p className={cn("text-xs text-wl-text-secondary mb-2")}>{shipment.customer}</p>
                        <div className={cn("flex gap-4 flex-wrap")}>
                          <span className={cn("text-xs text-wl-text-secondary flex items-center gap-1")}>
                            <MapPin size={12} /> {shipment.address}
                          </span>
                          <span className={cn("text-xs text-wl-text-secondary flex items-center gap-1")}>
                            <Weight size={12} /> {shipment.weight} kg
                          </span>
                          <span className={cn("text-xs text-wl-text-secondary flex items-center gap-1")}>
                            <Clock size={12} /> {shipment.eta}
                          </span>
                        </div>
                      </div>
                    </div>
                    {selectedShipment?.id === shipment.id && (
                      <div className={cn("mt-3 pt-3 border-t border-wl-border-default")}>
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
              <Card className={cn("bg-wl-bg-surface border border-wl-border-default")}>
                <CardContent className={cn("p-6 text-center")}>
                  <p className={cn("text-wl-text-secondary")}>No unassigned shipments found</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right Sidebar - Route Details & Assigned Shipments */}
        <div className={cn("flex flex-col gap-4")}>
          {/* Capacity Meter */}
          <Card className={cn("bg-wl-bg-surface border border-wl-border-default")}>
            <CardHeader className={cn("pb-3 border-b border-wl-border-default")}>
              <CardTitle className={cn("text-base flex items-center gap-1.5")}>
                <Truck size={16} className={cn("text-wl-primary-500")} /> Route Capacity
              </CardTitle>
            </CardHeader>
            <CardContent className={cn("p-4")}>
              <div className={cn("mb-4")}>
                <div className={cn("flex justify-between mb-1.5")}>
                  <span className={cn("text-xs text-wl-text-secondary")}>Stops</span>
                  <span className={cn("text-xs font-semibold text-wl-text-primary")}>
                    {mockRoute.currentStops + assignedShipments.length}/{mockRoute.maxStops}
                  </span>
                </div>
                <div
                  className={cn("w-full h-1.5 bg-wl-bg-root rounded overflow-hidden")}
                >
                  <div
                    className={cn({
                      "bg-wl-danger-500": stopsUsed > 0.8,
                      "bg-wl-warning-500": stopsUsed > 0.5 && stopsUsed <= 0.8,
                      "bg-wl-primary-500": stopsUsed <= 0.5,
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
                  <span className={cn("text-xs text-wl-text-secondary")}>Weight</span>
                  <span className={cn("text-xs font-semibold text-wl-text-primary")}>
                    {(mockRoute.currentWeight + totalAssignedWeight).toFixed(1)}/{mockRoute.maxWeight} kg
                  </span>
                </div>
                <div
                  className={cn("w-full h-1.5 bg-wl-bg-root rounded overflow-hidden")}
                >
                  <div
                    className={cn({
                      "bg-wl-danger-500": capacityUsed > 80,
                      "bg-wl-warning-500": capacityUsed > 50 && capacityUsed <= 80,
                      "bg-wl-primary-500": capacityUsed <= 50,
                    })}
                    style={{
                      width: `${capacityUsed.toFixed(1)}%`,
                      transition: 'width 200ms ease',
                    }}
                  />
                </div>
              </div>

              <div
                className={cn("p-3 bg-wl-bg-root rounded border border-wl-border-default")}
              >
                <p className={cn("text-xs text-wl-text-secondary mb-1")}>Remaining Capacity</p>
                <p className={cn("text-sm font-semibold text-wl-primary-500")}>{currentCapacity} slots</p>
              </div>
            </CardContent>
          </Card>

          {/* ETA Preview */}
          <Card className={cn("bg-wl-bg-surface border border-wl-border-default")}>
            <CardHeader className={cn("pb-3 border-b border-wl-border-default")}>
              <CardTitle className={cn("text-base flex items-center gap-1.5")}>
                <Clock size={16} className={cn("text-wl-primary-500")} /> ETA Preview
              </CardTitle>
            </CardHeader>
            <CardContent className={cn("p-4")}>
              <div
                className={cn("p-3 bg-wl-bg-root rounded border border-wl-border-default")}
              >
                <p className={cn("text-xs text-wl-text-secondary mb-1")}>Current Route ETA</p>
                <p className={cn("text-base font-semibold text-wl-success-500")}>{mockRoute.eta}</p>
                <p className={cn("text-xs text-wl-text-secondary mt-1.5")}>+{assignedShipments.length * 8} min estimated</p>
              </div>
            </CardContent>
          </Card>

          {/* Assigned Shipments List */}
          <Card className={cn("bg-wl-bg-surface border border-wl-border-default flex-1 flex flex-col")}>
            <CardHeader className={cn("pb-3 border-b border-wl-border-default")}>
              <CardTitle className={cn("text-base flex items-center justify-between")}>
                <span className={cn("flex items-center gap-1.5")}>
                  <CheckCircle size={16} className={cn("text-wl-success-500")} /> Assigned ({assignedShipments.length})
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
                    className={cn("p-2.5 bg-wl-bg-root rounded border border-wl-border-default flex items-start gap-2")}
                  >
                    <GripVertical size={14} className={cn("text-wl-primary-500 mt-0.5 flex-shrink-0")} />
                    <div className={cn("flex-1 min-w-0")}>
                      <div className={cn("flex justify-between items-center mb-0.5")}>
                        <p className={cn("text-xs font-semibold text-wl-text-primary")}>{idx + 1}. {shipment.id}</p>
                        <button
                          onClick={() => handleUnassign(shipment)}
                          className={cn("bg-none border-none text-wl-danger-500 cursor-pointer text-xs font-semibold p-0")}
                        >
                          Remove
                        </button>
                      </div>
                      <p className={cn("text-xs text-wl-text-secondary")}>{shipment.weight} kg</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className={cn("text-center py-5")}>
                  <p className={cn("text-xs text-wl-text-secondary")}>No shipments assigned yet</p>
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
