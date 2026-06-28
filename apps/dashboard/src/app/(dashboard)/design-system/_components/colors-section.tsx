'use client';

export function ColorsSection() {
  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Color Palette
        </h2>
        <p className="text-gray-300 mb-8">
          Design tokens for colors used throughout the platform. Dark theme with
          amber primary color for logistics warmth.
        </p>

        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Primary Colors (Amber)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[
                { name: "50", hex: "#fff9eb", token: "--blue-50" },
                { name: "100", hex: "#ffefc4", token: "--blue-100" },
                { name: "200", hex: "#ffe09d", token: "--blue-200" },
                { name: "300", hex: "#ffd06a", token: "--blue-300" },
                { name: "400", hex: "#ffc240", token: "--blue-400" },
                { name: "500", hex: "#f5a623", token: "--blue-500" },
                { name: "600", hex: "#d98b0a", token: "--blue-600" },
                { name: "700", hex: "#b06f05", token: "--blue-700" },
                { name: "800", hex: "#8d5704", token: "--blue-800" },
                { name: "900", hex: "#6b4203", token: "--blue-900" },
              ].map((color) => (
                <div key={color.name}>
                  <div
                    className="w-full h-24 rounded-md mb-2 border border-wl-border-default"
                    style={{ backgroundColor: color.hex }}
                  />
                  <p className="text-xs font-mono text-gray-300">
                    {color.hex}
                  </p>
                  <p className="text-xs text-gray-400">
                    {color.token}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Semantic Colors
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div
                  className="w-full h-32 rounded-md mb-2 border border-wl-border-default"
                  style={{ backgroundColor: "#34d399" }}
                />
                <p className="text-sm font-semibold text-white">
                  Success
                </p>
                <p className="text-xs font-mono text-gray-300">
                  #34d399
                </p>
                <p className="text-xs text-gray-400">
                  --emerald-500
                </p>
              </div>

              <div>
                <div
                  className="w-full h-32 rounded-md mb-2 border border-wl-border-default"
                  style={{ backgroundColor: "#fbbf24" }}
                />
                <p className="text-sm font-semibold text-white">
                  Warning
                </p>
                <p className="text-xs font-mono text-gray-300">
                  #fbbf24
                </p>
                <p className="text-xs text-gray-400">
                  --amber-500
                </p>
              </div>

              <div>
                <div
                  className="w-full h-32 rounded-md mb-2 border border-wl-border-default"
                  style={{ backgroundColor: "#f87171" }}
                />
                <p className="text-sm font-semibold text-white">
                  Danger
                </p>
                <p className="text-xs font-mono text-gray-300">
                  #f87171
                </p>
                <p className="text-xs text-gray-400">
                  --red-500
                </p>
              </div>

              <div>
                <div
                  className="w-full h-32 rounded-md mb-2 border border-wl-border-default"
                  style={{ backgroundColor: "#60a5fa" }}
                />
                <p className="text-sm font-semibold text-white">
                  Info
                </p>
                <p className="text-xs font-mono text-gray-300">
                  #60a5fa
                </p>
                <p className="text-xs text-gray-400">
                  --blue-500
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Background Colors
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: "Root", hex: "#0a0a0c", token: "--wl-bg-root" },
                { name: "Surface", hex: "#111114", token: "--wl-bg-surface" },
                { name: "Elevated", hex: "#19191e", token: "--wl-bg-elevated" },
                { name: "Overlay", hex: "#1f1f26", token: "--wl-bg-overlay" },
                { name: "Sidebar", hex: "#0c0c10", token: "--wl-bg-sidebar" },
                { name: "Sunken", hex: "#07070a", token: "--wl-bg-sunken" },
              ].map((color) => (
                <div key={color.name}>
                  <div
                    className="w-full h-20 rounded-md mb-2 border border-wl-border-default"
                    style={{ backgroundColor: color.hex }}
                  />
                  <p className="text-sm font-semibold text-white">
                    {color.name}
                  </p>
                  <p className="text-xs font-mono text-gray-300">
                    {color.hex}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
