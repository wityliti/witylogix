import Link from 'next/link';
import { Hero } from '@/components/hero';

export const metadata = {
  title: 'Witylogix - Open-Source Delivery Logistics',
  description:
    'Ship faster. Track everything. Own your stack. Open-source delivery logistics platform for e-commerce.',
};

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: string;
}

function FeatureCard({ icon, title, description, delay }: FeatureCardProps) {
  return (
    <div
      className="group relative bg-wl-bg-secondary/50 border border-wl-border rounded-lg p-6 hover:border-wl-accent/50 transition-all duration-300 hover:shadow-lg"
      style={{
        animation: `slideUp 0.6s ease-out ${delay}`,
        animationFillMode: 'both',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-wl-accent/5 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10">
        <div className="text-4xl mb-4">{icon}</div>
        <h3 className="text-lg font-bold text-wl-text mb-2">{title}</h3>
        <p className="text-sm text-wl-text-secondary leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl sm:text-4xl font-bold text-wl-accent">{value}</div>
      <div className="text-sm sm:text-base text-wl-text-secondary mt-2">{label}</div>
    </div>
  );
}

export default function HomePage() {
  const features = [
    {
      icon: '🛍️',
      title: 'Multi-Platform',
      description:
        'Seamless integration with Shopify, WooCommerce, Magento, and custom e-commerce platforms.',
      delay: '0.1s',
    },
    {
      icon: '📍',
      title: 'Real-Time Tracking',
      description:
        'Live package tracking with GPS, delivery confirmation, and customer notifications.',
      delay: '0.2s',
    },
    {
      icon: '🗺️',
      title: 'Route Optimization',
      description:
        'AI-powered route planning, dynamic dispatch, and delivery window management.',
      delay: '0.3s',
    },
    {
      icon: '🔒',
      title: 'Self-Hosted',
      description:
        'Full control over your data. Deploy on-premises or private cloud. No vendor lock-in.',
      delay: '0.4s',
    },
  ];

  return (
    <main className="min-h-screen bg-wl-bg-primary">
      {/* Hero Section */}
      <Hero />

      {/* Features Section */}
      <section className="relative py-24 bg-wl-bg-primary">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-wl-text mb-4">
              Enterprise-Grade Features
            </h2>
            <p className="text-lg text-wl-text-secondary max-w-2xl mx-auto">
              Built for scale, designed for developers. Everything you need to manage delivery logistics
              at any size.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                delay={feature.delay}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative py-20 bg-gradient-to-b from-wl-bg-primary to-wl-bg-secondary border-y border-wl-border">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            <StatItem value="350K+" label="Lines of Code" />
            <StatItem value="180+" label="Test Suites" />
            <StatItem value="73" label="API Endpoints" />
            <StatItem value="4" label="Platform Adapters" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 bg-wl-bg-primary">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-wl-text mb-6">
            Ready to Ship?
          </h2>
          <p className="text-lg text-wl-text-secondary mb-12">
            Get started in minutes. Comprehensive documentation and API reference to build with Witylogix.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/docs/getting-started"
              className="group relative px-8 py-4 text-center font-semibold text-wl-bg-primary bg-wl-accent rounded-lg hover:bg-wl-accent-light transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-wl-accent to-wl-accent-light opacity-0 group-hover:opacity-100 transition-opacity" />
              <span className="relative">Get Started</span>
            </Link>
            <Link
              href="/docs/api"
              className="group relative px-8 py-4 text-center font-semibold text-wl-accent border-2 border-wl-accent rounded-lg hover:bg-wl-accent/10 transition-all duration-300"
            >
              View API Reference
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-wl-border bg-wl-bg-secondary/50 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-wl-text mb-4">Platform</h3>
              <ul className="space-y-2 text-sm text-wl-text-secondary">
                <li>
                  <Link href="/docs" className="hover:text-wl-text transition-colors">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="/docs/api" className="hover:text-wl-text transition-colors">
                    API Reference
                  </Link>
                </li>
                <li>
                  <Link href="/docs/components" className="hover:text-wl-text transition-colors">
                    Components
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-wl-text mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-primary-400">
                <li>
                  <a
                    href="https://github.com/witylogix"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-wl-text transition-colors"
                  >
                    GitHub
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/witylogix/witylogix/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-wl-text transition-colors"
                  >
                    Issues
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/witylogix/witylogix/discussions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-wl-text transition-colors"
                  >
                    Discussions
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-wl-text mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-primary-400">
                <li>
                  <a
                    href="#"
                    className="hover:text-wl-text transition-colors"
                  >
                    About
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-wl-text transition-colors"
                  >
                    Blog
                  </a>
                </li>
                <li>
                  <a
                    href="#"
                    className="hover:text-wl-text transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-wl-text mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-primary-400">
                <li>
                  <a href="#" className="hover:text-wl-text transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-wl-text transition-colors">
                    Terms
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-wl-text transition-colors">
                    License
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-wl-border pt-8 flex flex-col sm:flex-row justify-between items-center">
            <div className="flex items-center gap-2 mb-4 sm:mb-0">
              <div className="w-6 h-6 rounded-lg bg-wl-accent flex items-center justify-center">
                <span className="font-bold text-wl-bg-primary text-xs">W</span>
              </div>
              <span className="font-bold text-wl-text">Witylogix</span>
            </div>
            <p className="text-sm text-wl-text-secondary">
              © 2024 Witylogix. Open-source delivery logistics platform.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
