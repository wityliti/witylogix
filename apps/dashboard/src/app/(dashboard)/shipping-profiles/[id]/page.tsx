'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Settings,
  MapPin,
  DollarSign,
  Truck,
  Package,
  Calendar,
  Save,
  X,
  Edit,
  Plus,
  Trash2,
  ChevronDown,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useApiQuery } from '@/hooks/use-api';
import { useParams } from 'next/navigation';

// Mock shipping profiles
const mockProfiles: Record<string, any> = {
  'SP-001': {
    id: 'SP-001',
    name: 'Express Metro Delivery',
    carrier: 'FedEx',
    status: 'active',
    lastUpdated: '2026-03-05',
    defaultCost: 9.99,
    rateTable: [
      { zone: 'Zone 1', distance: '0-5 km', baseRate: 4.99, perKm: 0.5, minCost: 4.99 },
      { zone: 'Zone 2', distance: '5-15 km', baseRate: 6.99, perKm: 0.35, minCost: 6.99 },
      { zone: 'Zone 3', distance: '15-50 km', baseRate: 9.99, perKm: 0.25, minCost: 9.99 },
      { zone: 'Zone 4', distance: '50+ km', baseRate: 14.99, perKm: 0.15, minCost: 14.99 },
    ],
    rules: [
      { id: 'R1', zone: 'Zone 1', condition: 'weight < 5kg', discount: '10%' },
      { id: 'R2', zone: 'Zone 2', condition: 'orders > 10/day', discount: '15%' },
      { id: 'R3', zone: 'Zone 3', condition: 'bulk > 50 units', discount: '20%' },
    ],
    timeWindows: [
      { day: 'Mon-Fri', start: '08:00', end: '20:00', active: true },
      { day: 'Saturday', start: '09:00', end: '18:00', active: true },
      { day: 'Sunday', start: '10:00', end: '16:00', active: false },
    ],
    locations: [
      { id: 'L1', name: 'Downtown Hub', address: '123 Main St' },
      { id: 'L2', name: 'Midtown Center', address: '456 Oak Ave' },
      { id: 'L3', name: 'Warehouse A', address: '789 Industrial Blvd' },
    ],
    calendarProfile: 'Business Hours',
    costStructure: 'per-km',
  },
};

interface RateRow {
  zone: string;
  distance: string;
  baseRate: number;
  perKm: number;
  minCost: number;
}

interface Rule {
  id: string;
  zone: string;
  condition: string;
  discount: string;
}

interface TimeWindow {
  day: string;
  start: string;
  end: string;
  active: boolean;
}

interface Location {
  id: string;
  name: string;
  address: string;
}

export default function ShippingProfileDetail({ params }: { params: { id: string } }) {
  const profileId = params.id || 'SP-001';
  const profile = mockProfiles[profileId];
  const [isEditing, setIsEditing] = useState(false);
  const [editingTab, setEditingTab] = useState<'rates' | 'rules' | 'windows' | 'locations' | 'calendar'>('rates');
  const [rateTable, setRateTable] = useState<RateRow[]>(profile.rateTable);
  const [rules, setRules] = useState<Rule[]>(profile.rules);
  const [timeWindows, setTimeWindows] = useState<TimeWindow[]>(profile.timeWindows);
  const [locations, setLocations] = useState<Location[]>(profile.locations);
  const [calendarProfile, setCalendarProfile] = useState(profile.calendarProfile);
  const [profileName, setProfileName] = useState(profile.name);
  const [costStructure, setCostStructure] = useState(profile.costStructure);
  const [newRuleZone, setNewRuleZone] = useState('');
  const [newRuleCondition, setNewRuleCondition] = useState('');
  const [newRuleDiscount, setNewRuleDiscount] = useState('');
  const [newLocationName, setNewLocationName] = useState('');
  const [newLocationAddress, setNewLocationAddress] = useState('');

  const handleSave = () => {
    setIsEditing(false);
  };

  const handleCancel = () => {
    setRateTable(profile.rateTable);
    setRules(profile.rules);
    setTimeWindows(profile.timeWindows);
    setLocations(profile.locations);
    setProfileName(profile.name);
    setCalendarProfile(profile.calendarProfile);
    setCostStructure(profile.costStructure);
    setIsEditing(false);
  };

  const updateRate = (index: number, field: keyof RateRow, value: any) => {
    const updated = [...rateTable];
    updated[index] = { ...updated[index], [field]: value };
    setRateTable(updated);
  };

  const deleteRate = (index: number) => {
    setRateTable(rateTable.filter((_, i) => i !== index));
  };

  const addRate = () => {
    setRateTable([...rateTable, { zone: 'Zone 5', distance: 'Custom', baseRate: 0, perKm: 0, minCost: 0 }]);
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
  };

  const addRule = () => {
    if (newRuleZone && newRuleCondition && newRuleDiscount) {
      setRules([...rules, { id: `R${rules.length + 1}`, zone: newRuleZone, condition: newRuleCondition, discount: newRuleDiscount }]);
      setNewRuleZone('');
      setNewRuleCondition('');
      setNewRuleDiscount('');
    }
  };

  const toggleTimeWindow = (index: number) => {
    const updated = [...timeWindows];
    updated[index].active = !updated[index].active;
    setTimeWindows(updated);
  };

  const deleteLocation = (id: string) => {
    setLocations(locations.filter((l) => l.id !== id));
  };

  const addLocation = () => {
    if (newLocationName && newLocationAddress) {
      setLocations([...locations, { id: `L${locations.length + 1}`, name: newLocationName, address: newLocationAddress }]);
      setNewLocationName('');
      setNewLocationAddress('');
    }
  };

  if (!profile) {
    return (
      <div className="p-6 min-h-screen bg-[#12121a]">
        <p className="text-gray-400">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-[#12121a]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h1 className="text-4xl font-bold text-white mb-1">
              {isEditing ? (
                <Input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full p-2 px-3 bg-[#12121a] border border-blue-500 rounded text-white text-2xl font-bold"
                />
              ) : (
                profile.name
              )}
            </h1>
            <p className="text-gray-400">ID: {profile.id}</p>
          </div>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  variant="primary"
                  size="md"
                  className="flex items-center gap-1.5"
                  onClick={handleSave}
                >
                  <Save size={16} /> Save Changes
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  className="flex items-center gap-1.5"
                  onClick={handleCancel}
                >
                  <X size={16} /> Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                size="md"
                className="flex items-center gap-1.5"
                onClick={() => setIsEditing(true)}
              >
                <Edit size={16} /> Edit Profile
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          <Badge variant={profile.status === 'active' ? 'success' : 'warning'}>{profile.status.toUpperCase()}</Badge>
          <span className="text-xs text-gray-400">Last updated: {profile.lastUpdated}</span>
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-6">
        <Card className="bg-[#12121a] border border-[#1e1e2e]">
          <CardContent className="p-5">
            <p className="text-xs text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
              <Truck size={14} /> Carrier
            </p>
            <p className="text-base text-white font-semibold">{profile.carrier}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#12121a] border border-[#1e1e2e]">
          <CardContent className="p-5">
            <p className="text-xs text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
              <DollarSign size={14} /> Default Cost
            </p>
            <p className="text-base font-semibold text-blue-500">${profile.defaultCost.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="bg-[#12121a] border border-[#1e1e2e]">
          <CardContent className="p-5">
            <p className="text-xs text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
              <Settings size={14} /> Cost Structure
            </p>
            {isEditing ? (
              <Select value={costStructure} onChange={(v) => setCostStructure(v)}>
                <option value="flat-rate">Flat Rate</option>
                <option value="per-km">Per KM</option>
                <option value="tiered">Tiered</option>
              </Select>
            ) : (
              <p className="text-base text-white font-semibold">{costStructure.replace('-', ' ').toUpperCase()}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Editing */}
      {isEditing && (
        <div className="mb-6">
          <div className="flex gap-2 border-b border-[#1e1e2e] pb-3 flex-wrap">
            {(['rates', 'rules', 'windows', 'locations', 'calendar'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setEditingTab(tab)}
                className="px-4 py-2 rounded border-none cursor-pointer text-xs font-semibold transition-all"
                style={{
                  backgroundColor: editingTab === tab ? '#6C63FF' : 'transparent',
                  color: editingTab === tab ? '#e2e8f0' : '#94a3b8',
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rate Table Section */}
      <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
        <CardHeader className="pb-4 border-b border-[#1e1e2e]">
          <CardTitle className="flex items-center gap-2">
            <DollarSign size={18} className="text-blue-500" /> Rate Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {!isEditing || editingTab === 'rates' ? (
            <>
              <div className="overflow-x-auto mb-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-[#1e1e2e]">
                      <th className="p-3 text-left text-gray-400 text-xs font-semibold">Zone</th>
                      <th className="p-3 text-left text-gray-400 text-xs font-semibold">Distance</th>
                      <th className="p-3 text-left text-gray-400 text-xs font-semibold">Base Rate</th>
                      <th className="p-3 text-left text-gray-400 text-xs font-semibold">Per KM</th>
                      <th className="p-3 text-left text-gray-400 text-xs font-semibold">Min Cost</th>
                      {isEditing && <th className="p-3 text-center text-gray-400 text-xs font-semibold">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rateTable.map((rate, idx) => (
                      <tr key={idx} className="border-b border-[#1e1e2e]">
                        <td className="p-3 text-white text-sm">
                          {isEditing ? (
                            <Input value={rate.zone} onChange={(e) => updateRate(idx, 'zone', e.target.value)} className="w-full" />
                          ) : (
                            rate.zone
                          )}
                        </td>
                        <td className="p-3 text-white text-sm">
                          {isEditing ? (
                            <Input value={rate.distance} onChange={(e) => updateRate(idx, 'distance', e.target.value)} className="w-full" />
                          ) : (
                            rate.distance
                          )}
                        </td>
                        <td className="p-3 text-sm font-semibold text-blue-500">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={rate.baseRate}
                              onChange={(e) => updateRate(idx, 'baseRate', parseFloat(e.target.value))}
                              className="w-full"
                            />
                          ) : (
                            `$${rate.baseRate.toFixed(2)}`
                          )}
                        </td>
                        <td className="p-3 text-white text-sm">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={rate.perKm}
                              onChange={(e) => updateRate(idx, 'perKm', parseFloat(e.target.value))}
                              className="w-full"
                            />
                          ) : (
                            `$${rate.perKm.toFixed(2)}`
                          )}
                        </td>
                        <td className="p-3 text-white text-sm">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={rate.minCost}
                              onChange={(e) => updateRate(idx, 'minCost', parseFloat(e.target.value))}
                              className="w-full"
                            />
                          ) : (
                            `$${rate.minCost.toFixed(2)}`
                          )}
                        </td>
                        {isEditing && (
                          <td className="p-3 text-center">
                            <Button variant="danger" size="sm" onClick={() => deleteRate(idx)}>
                              <Trash2 size={14} />
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {isEditing && (
                <Button variant="secondary" size="sm" onClick={addRate} className="flex items-center gap-1.5">
                  <Plus size={14} /> Add Rate
                </Button>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Zone-Based Rules */}
      <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
        <CardHeader className="pb-4 border-b border-[#1e1e2e]">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle size={18} className="text-amber-500" /> Zone-Based Rules
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {!isEditing || editingTab === 'rules' ? (
            <>
              <div className="flex flex-col gap-3 mb-4">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="p-3 rounded bg-[#12121a] border border-[#1e1e2e] flex justify-between items-center"
                  >
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        <strong>{rule.zone}</strong> · {rule.condition}
                      </p>
                      <Badge variant="success" className="text-xs">
                        {rule.discount} Discount
                      </Badge>
                    </div>
                    {isEditing && (
                      <Button variant="danger" size="sm" onClick={() => deleteRule(rule.id)}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {isEditing && (
                <div className="p-4 rounded bg-[#12121a] border border-[#1e1e2e] flex flex-col gap-3">
                  <div className="grid grid-cols-3 gap-2">
                    <Select value={newRuleZone} onChange={(v) => setNewRuleZone(v)}>
                      <option value="">Zone</option>
                      {rateTable.map((r) => (
                        <option key={r.zone} value={r.zone}>
                          {r.zone}
                        </option>
                      ))}
                    </Select>
                    <Input placeholder="Condition (e.g., weight < 5kg)" value={newRuleCondition} onChange={(e) => setNewRuleCondition(e.target.value)} />
                    <Input placeholder="Discount %" value={newRuleDiscount} onChange={(e) => setNewRuleDiscount(e.target.value)} />
                  </div>
                  <Button variant="primary" size="sm" onClick={addRule} className="flex items-center gap-1.5">
                    <Plus size={14} /> Add Rule
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Delivery Time Windows */}
      <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
        <CardHeader className="pb-4 border-b border-[#1e1e2e]">
          <CardTitle className="flex items-center gap-2">
            <Clock size={18} className="text-blue-500" /> Delivery Time Windows
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {!isEditing || editingTab === 'windows' ? (
            <div className="flex flex-col gap-3">
              {timeWindows.map((window, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded bg-[#12121a] border border-[#1e1e2e] flex justify-between items-center"
                >
                  <div className="flex-1">
                    <p className="text-sm text-white font-semibold">{window.day}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {window.start} – {window.end}
                    </p>
                  </div>
                  {isEditing ? (
                    <Button
                      variant={window.active ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => toggleTimeWindow(idx)}
                      className="min-w-20"
                    >
                      {window.active ? 'Active' : 'Inactive'}
                    </Button>
                  ) : (
                    <Badge variant={window.active ? 'success' : 'default'}>{window.active ? 'ACTIVE' : 'INACTIVE'}</Badge>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Location Attachments */}
      <Card className="bg-[#12121a] border border-[#1e1e2e] mb-6">
        <CardHeader className="pb-4 border-b border-[#1e1e2e]">
          <CardTitle className="flex items-center gap-2">
            <MapPin size={18} className="text-blue-500" /> Attached Locations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {!isEditing || editingTab === 'locations' ? (
            <>
              <div className="flex flex-col gap-3 mb-4">
                {locations.map((location) => (
                  <div
                    key={location.id}
                    className="p-3 rounded bg-[#12121a] border border-[#1e1e2e] flex justify-between items-start"
                  >
                    <div>
                      <p className="text-sm text-white font-semibold">{location.name}</p>
                      <p className="text-xs text-gray-400 mt-1">{location.address}</p>
                    </div>
                    {isEditing && (
                      <Button variant="danger" size="sm" onClick={() => deleteLocation(location.id)}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {isEditing && (
                <div className="p-4 rounded bg-[#12121a] border border-[#1e1e2e] flex flex-col gap-3">
                  <Input placeholder="Location Name" value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)} />
                  <Input placeholder="Address" value={newLocationAddress} onChange={(e) => setNewLocationAddress(e.target.value)} />
                  <Button variant="primary" size="sm" onClick={addLocation} className="flex items-center gap-1.5">
                    <Plus size={14} /> Add Location
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Calendar Profile Picker */}
      <Card className="bg-[#12121a] border border-[#1e1e2e]">
        <CardHeader className="pb-4 border-b border-[#1e1e2e]">
          <CardTitle className="flex items-center gap-2">
            <Calendar size={18} className="text-blue-500" /> Calendar Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {isEditing ? (
            <Select value={calendarProfile} onChange={(v) => setCalendarProfile(v)}>
              <option value="Business Hours">Business Hours</option>
              <option value="Extended Hours">Extended Hours</option>
              <option value="24/7">24/7</option>
              <option value="Weekend">Weekend Only</option>
            </Select>
          ) : (
            <p className="text-base text-white">{calendarProfile}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
