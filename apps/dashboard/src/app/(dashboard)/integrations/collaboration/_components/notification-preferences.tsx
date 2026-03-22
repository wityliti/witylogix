'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface NotificationPreference {
  id: string;
  event: string;
  slack: boolean;
  teams: boolean;
  pusher: boolean;
  sound: boolean;
}

interface NotificationPreferencesProps {
  preferences: NotificationPreference[];
}

export function NotificationPreferences({
  preferences,
}: NotificationPreferencesProps) {
  return (
    <Card className="bg-[#1a1a2e]">
      <CardContent className="pt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e2e]">
                <th className="text-left py-3 px-4 font-semibold text-gray-400">
                  Event
                </th>
                <th className="text-center py-3 px-4 font-semibold text-gray-400">
                  Slack
                </th>
                <th className="text-center py-3 px-4 font-semibold text-gray-400">
                  Teams
                </th>
                <th className="text-center py-3 px-4 font-semibold text-gray-400">
                  Pusher
                </th>
                <th className="text-center py-3 px-4 font-semibold text-gray-400">
                  Sound
                </th>
              </tr>
            </thead>
            <tbody>
              {preferences.map((pref) => (
                <tr
                  key={pref.id}
                  className="border-b border-[#1e1e2e] hover:bg-[#12121a]"
                >
                  <td className="py-3 px-4 text-white">{pref.event}</td>
                  <td className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={pref.slack}
                      onChange={() => {}}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={pref.teams}
                      onChange={() => {}}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={pref.pusher}
                      onChange={() => {}}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={pref.sound}
                      onChange={() => {}}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex gap-2">
          <Button variant="primary" className="bg-blue-500 hover:bg-blue-500/90">
            Save Preferences
          </Button>
          <Button
            variant="secondary"
            className="bg-[#12121a] hover:bg-[#1a1a2e]"
          >
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
