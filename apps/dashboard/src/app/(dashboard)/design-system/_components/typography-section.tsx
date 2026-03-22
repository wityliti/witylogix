'use client';

export function TypographySection() {
  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Typography
        </h2>
        <p className="text-gray-300 mb-8">
          Font family: DM Sans (sans), JetBrains Mono (mono). Text sizes from xs
          (11px) to 3xl (30px).
        </p>

        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Font Sizes
            </h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  Extra Small (11px)
                </p>
                <p className="text-xs">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  Small (13px)
                </p>
                <p className="text-sm">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  Base (14px)
                </p>
                <p className="text-base">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  Large (17px)
                </p>
                <p className="text-lg">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  Extra Large (20px)
                </p>
                <p className="text-xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  2XL (24px)
                </p>
                <p className="text-2xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  3XL (30px)
                </p>
                <p className="text-3xl">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Font Weights
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  Regular (400)
                </p>
                <p className="font-normal">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  Medium (500)
                </p>
                <p className="font-medium">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  Semibold (600)
                </p>
                <p className="font-semibold">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">
                  Bold (700)
                </p>
                <p className="font-bold">
                  The quick brown fox jumps over the lazy dog
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-4">
              Monospace Font
            </h3>
            <p className="font-mono text-sm">
              jetbrains mono: const foo = "bar";
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
