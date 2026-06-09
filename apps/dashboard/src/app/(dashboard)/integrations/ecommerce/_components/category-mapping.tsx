'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Grid, ChevronRight } from 'lucide-react';

export function CategoryMapping() {
  return (
    <Card className="bg-wl-bg-elevated border-wl-border-default">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Grid className="w-5 h-5" />
          Category Mapping
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[
            {
              shopify: 'Electronics > Computers',
              woo: 'Technology > Laptops',
              amazon: 'Computers & Accessories',
            },
            {
              shopify: 'Clothing > T-Shirts',
              woo: "Apparel > Men's Shirts",
              amazon: 'Clothing, Shoes & Jewelry',
            },
            {
              shopify: 'Home > Kitchen',
              woo: 'Home & Garden > Kitchen',
              amazon: 'Home, Kitchen & Dining',
            },
          ].map((mapping, idx) => (
            <div
              key={idx}
              className="p-4 bg-wl-bg-surface rounded-lg border border-wl-border-default"
            >
              <div className="grid grid-cols-3 gap-4 items-center">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    Shopify
                  </div>
                  <div className="text-sm font-medium text-white mt-1">
                    {mapping.shopify}
                  </div>
                </div>
                <div className="flex justify-center">
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">
                    External
                  </div>
                  <div className="text-sm font-medium text-white mt-1">
                    {mapping.woo} / {mapping.amazon}
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
