'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export function VariantMapping() {
  return (
    <Card className="bg-wl-bg-elevated border-wl-border-default">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Variant Mapping
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[
            {
              attribute: 'Size',
              shopify: 'size (xs, s, m, l, xl)',
              woo: 'size (small, medium, large)',
            },
            {
              attribute: 'Color',
              shopify: 'color (red, blue, green)',
              woo: 'color (rouge, bleu, vert)',
            },
            {
              attribute: 'Material',
              shopify: 'material (cotton, polyester)',
              woo: 'fabric (cotton, poly)',
            },
          ].map((variant, idx) => (
            <div
              key={idx}
              className="p-4 bg-wl-bg-surface rounded-lg border border-wl-border-default"
            >
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                {variant.attribute}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500">Shopify</div>
                  <div className="text-sm text-gray-400 mt-1">
                    {variant.shopify}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">WooCommerce</div>
                  <div className="text-sm text-gray-400 mt-1">
                    {variant.woo}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
