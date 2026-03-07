'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
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
      <div style={{ padding: '24px', minHeight: '100vh', backgroundColor: '#0a0a0f' }}>
        <p style={{ color: '#94a3b8' }}>Profile not found</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', minHeight: '100vh', backgroundColor: '#0a0a0f' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#e2e8f0', marginBottom: '4px' }}>
              {isEditing ? (
                <Input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#12121a',
                    border: '1px solid #6C63FF',
                    borderRadius: '6px',
                    color: '#e2e8f0',
                    fontSize: '24px',
                    fontWeight: 'bold',
                  }}
                />
              ) : (
                profile.name
              )}
            </h1>
            <p style={{ color: '#94a3b8' }}>ID: {profile.id}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {isEditing ? (
              <>
                <Button
                  variant="primary"
                  size="md"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={handleSave}
                >
                  <Save size={16} /> Save Changes
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={handleCancel}
                >
                  <X size={16} /> Cancel
                </Button>
              </>
            ) : (
              <Button
                variant="secondary"
                size="md"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setIsEditing(true)}
              >
                <Edit size={16} /> Edit Profile
              </Button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge variant={profile.status === 'active' ? 'success' : 'warning'}>{profile.status.toUpperCase()}</Badge>
          <span style={{ fontSize: '12px', color: '#94a3b8' }}>Last updated: {profile.lastUpdated}</span>
        </div>
      </div>

      {/* Quick Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
          <CardContent style={{ padding: '20px' }}>
            <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Truck size={14} /> Carrier
            </p>
            <p style={{ fontSize: '16px', color: '#e2e8f0', fontWeight: '600' }}>{profile.carrier}</p>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
          <CardContent style={{ padding: '20px' }}>
            <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DollarSign size={14} /> Default Cost
            </p>
            <p style={{ fontSize: '16px', color: '#6C63FF', fontWeight: '600' }}>${profile.defaultCost.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
          <CardContent style={{ padding: '20px' }}>
            <p style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Settings size={14} /> Cost Structure
            </p>
            {isEditing ? (
              <Select value={costStructure} onChange={(v) => setCostStructure(v)}>
                <option value="flat-rate">Flat Rate</option>
                <option value="per-km">Per KM</option>
                <option value="tiered">Tiered</option>
              </Select>
            ) : (
              <p style={{ fontSize: '16px', color: '#e2e8f0', fontWeight: '600' }}>{costStructure.replace('-', ' ').toUpperCase()}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Editing */}
      {isEditing && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #1e293b', paddingBottom: '12px', flexWrap: 'wrap' }}>
            {(['rates', 'rules', 'windows', 'locations', 'calendar'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setEditingTab(tab)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: editingTab === tab ? '#6C63FF' : 'transparent',
                  color: editingTab === tab ? '#e2e8f0' : '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  transition: 'all 200ms ease',
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rate Table Section */}
      <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', marginBottom: '24px' }}>
        <CardHeader style={{ paddingBottom: '16px', borderBottom: '1px solid #1e293b' }}>
          <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={18} style={{ color: '#6C63FF' }} /> Rate Configuration
          </CardTitle>
        </CardHeader>
        <CardContent style={{ padding: '24px' }}>
          {!isEditing || editingTab === 'rates' ? (
            <>
              <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1e293b' }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>Zone</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>Distance</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>Base Rate</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>Per KM</th>
                      <th style={{ padding: '12px', textAlign: 'left', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>Min Cost</th>
                      {isEditing && <th style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', fontWeight: '600' }}>Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {rateTable.map((rate, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '12px', color: '#e2e8f0', fontSize: '13px' }}>
                          {isEditing ? (
                            <Input value={rate.zone} onChange={(e) => updateRate(idx, 'zone', e.target.value)} style={{ width: '100%' }} />
                          ) : (
                            rate.zone
                          )}
                        </td>
                        <td style={{ padding: '12px', color: '#e2e8f0', fontSize: '13px' }}>
                          {isEditing ? (
                            <Input value={rate.distance} onChange={(e) => updateRate(idx, 'distance', e.target.value)} style={{ width: '100%' }} />
                          ) : (
                            rate.distance
                          )}
                        </td>
                        <td style={{ padding: '12px', color: '#6C63FF', fontSize: '13px', fontWeight: '600' }}>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={rate.baseRate}
                              onChange={(e) => updateRate(idx, 'baseRate', parseFloat(e.target.value))}
                              style={{ width: '100%' }}
                            />
                          ) : (
                            `$${rate.baseRate.toFixed(2)}`
                          )}
                        </td>
                        <td style={{ padding: '12px', color: '#e2e8f0', fontSize: '13px' }}>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={rate.perKm}
                              onChange={(e) => updateRate(idx, 'perKm', parseFloat(e.target.value))}
                              style={{ width: '100%' }}
                            />
                          ) : (
                            `$${rate.perKm.toFixed(2)}`
                          )}
                        </td>
                        <td style={{ padding: '12px', color: '#e2e8f0', fontSize: '13px' }}>
                          {isEditing ? (
                            <Input
                              type="number"
                              value={rate.minCost}
                              onChange={(e) => updateRate(idx, 'minCost', parseFloat(e.target.value))}
                              style={{ width: '100%' }}
                            />
                          ) : (
                            `$${rate.minCost.toFixed(2)}`
                          )}
                        </td>
                        {isEditing && (
                          <td style={{ padding: '12px', textAlign: 'center' }}>
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
                <Button variant="secondary" size="sm" onClick={addRate} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={14} /> Add Rate
                </Button>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Zone-Based Rules */}
      <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', marginBottom: '24px' }}>
        <CardHeader style={{ paddingBottom: '16px', borderBottom: '1px solid #1e293b' }}>
          <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} style={{ color: '#f5a623' }} /> Zone-Based Rules
          </CardTitle>
        </CardHeader>
        <CardContent style={{ padding: '24px' }}>
          {!isEditing || editingTab === 'rules' ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      backgroundColor: '#0a0a0f',
                      border: '1px solid #1e293b',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                        <strong>{rule.zone}</strong> · {rule.condition}
                      </p>
                      <Badge variant="success" style={{ fontSize: '11px' }}>
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
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '6px',
                    backgroundColor: '#0f0f15',
                    border: '1px solid #1e293b',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
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
                  <Button variant="primary" size="sm" onClick={addRule} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={14} /> Add Rule
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Delivery Time Windows */}
      <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', marginBottom: '24px' }}>
        <CardHeader style={{ paddingBottom: '16px', borderBottom: '1px solid #1e293b' }}>
          <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={18} style={{ color: '#6C63FF' }} /> Delivery Time Windows
          </CardTitle>
        </CardHeader>
        <CardContent style={{ padding: '24px' }}>
          {!isEditing || editingTab === 'windows' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {timeWindows.map((window, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    backgroundColor: '#0a0a0f',
                    border: '1px solid #1e293b',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: '600' }}>{window.day}</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      {window.start} – {window.end}
                    </p>
                  </div>
                  {isEditing ? (
                    <Button
                      variant={window.active ? 'primary' : 'ghost'}
                      size="sm"
                      onClick={() => toggleTimeWindow(idx)}
                      style={{ minWidth: '80px' }}
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
      <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b', marginBottom: '24px' }}>
        <CardHeader style={{ paddingBottom: '16px', borderBottom: '1px solid #1e293b' }}>
          <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={18} style={{ color: '#6C63FF' }} /> Attached Locations
          </CardTitle>
        </CardHeader>
        <CardContent style={{ padding: '24px' }}>
          {!isEditing || editingTab === 'locations' ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                {locations.map((location) => (
                  <div
                    key={location.id}
                    style={{
                      padding: '12px',
                      borderRadius: '6px',
                      backgroundColor: '#0a0a0f',
                      border: '1px solid #1e293b',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: '600' }}>{location.name}</p>
                      <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{location.address}</p>
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
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '6px',
                    backgroundColor: '#0f0f15',
                    border: '1px solid #1e293b',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <Input placeholder="Location Name" value={newLocationName} onChange={(e) => setNewLocationName(e.target.value)} />
                  <Input placeholder="Address" value={newLocationAddress} onChange={(e) => setNewLocationAddress(e.target.value)} />
                  <Button variant="primary" size="sm" onClick={addLocation} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={14} /> Add Location
                  </Button>
                </div>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Calendar Profile Picker */}
      <Card style={{ backgroundColor: '#12121a', border: '1px solid #1e293b' }}>
        <CardHeader style={{ paddingBottom: '16px', borderBottom: '1px solid #1e293b' }}>
          <CardTitle style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} style={{ color: '#6C63FF' }} /> Calendar Profile
          </CardTitle>
        </CardHeader>
        <CardContent style={{ padding: '24px' }}>
          {isEditing ? (
            <Select value={calendarProfile} onChange={(v) => setCalendarProfile(v)}>
              <option value="Business Hours">Business Hours</option>
              <option value="Extended Hours">Extended Hours</option>
              <option value="24/7">24/7</option>
              <option value="Weekend">Weekend Only</option>
            </Select>
          ) : (
            <p style={{ fontSize: '14px', color: '#e2e8f0' }}>{calendarProfile}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
