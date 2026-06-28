'use client';

import { useState } from 'react';
import { PageHeader } from './_components/page-header';
import { DesignTabs } from './_components/design-tabs';
import { ButtonsSection } from './_components/buttons-section';
import { BadgesSection } from './_components/badges-section';
import { ColorsSection } from './_components/colors-section';
import { InputsSection } from './_components/inputs-section';
import { SelectsSection } from './_components/selects-section';
import { CardsSection } from './_components/cards-section';
import { ModalsSection } from './_components/modals-section';
import { TablesSection } from './_components/tables-section';
import { TypographySection } from './_components/typography-section';
import { FormsSection } from './_components/forms-section';
import { AccessibilitySection } from './_components/accessibility-section';

export default function DesignSystemPage() {
  const [activeTab, setActiveTab] = useState('buttons');

  return (
    <div className="min-h-screen bg-wl-bg-root">
      {/* Header */}
      <PageHeader />

      {/* Navigation Tabs */}
      <DesignTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        {activeTab === 'buttons' && <ButtonsSection />}
        {activeTab === 'badges' && <BadgesSection />}
        {activeTab === 'colors' && <ColorsSection />}
        {activeTab === 'inputs' && <InputsSection />}
        {activeTab === 'selects' && <SelectsSection />}
        {activeTab === 'cards' && <CardsSection />}
        {activeTab === 'modals' && <ModalsSection />}
        {activeTab === 'tables' && <TablesSection />}
        {activeTab === 'typography' && <TypographySection />}
        {activeTab === 'forms' && <FormsSection />}
        {activeTab === 'a11y' && <AccessibilitySection />}
      </div>
    </div>
  );
}
