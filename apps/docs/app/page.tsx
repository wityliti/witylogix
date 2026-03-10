import { Button } from 'fumadocs-ui/components/button';
import Link from 'next/link';
import { ArrowRight, BookOpen, Code, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-wl-bg-primary via-wl-bg-secondary to-wl-bg-primary">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="inline-block mb-6 px-4 py-2 bg-wl-accent/10 rounded-full border border-wl-accent/30">
            <span className="text-sm font-medium text-wl-accent">
              Documentation for Developers
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold mb-6 text-wl-text">
            Witylogix Platform
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-wl-accent via-wl-accent-light to-wl-accent mt-2">
              Developer Docs
            </span>
          </h1>

          <p className="text-xl text-wl-text-secondary mb-8 max-w-2xl mx-auto">
            Everything you need to integrate with the Witylogix delivery logistics platform.
            APIs, guides, SDKs, and more.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/docs/getting-started">
              <Button className="w-full sm:w-auto">
                Get Started
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/docs/api-reference">
              <Button variant="outline" className="w-full sm:w-auto">
                View API Reference
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          <FeatureCard
            icon={<BookOpen className="w-8 h-8" />}
            title="Comprehensive Guides"
            description="Step-by-step guides for integration, authentication, webhooks, and deployment."
          />
          <FeatureCard
            icon={<Code className="w-8 h-8" />}
            title="API Documentation"
            description="Complete REST API reference with request/response examples and error codes."
          />
          <FeatureCard
            icon={<Zap className="w-8 h-8" />}
            title="AI-Powered Search"
            description="Intelligent search that understands your questions and provides contextual answers."
          />
        </div>

        {/* Quick Links */}
        <div className="bg-wl-bg-secondary rounded-lg border border-wl-border p-8 mb-20">
          <h2 className="text-2xl font-bold text-wl-text mb-8">Quick Navigation</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <QuickLink
              href="/docs/getting-started"
              title="Getting Started"
              description="First time here? Start with our quick setup guide."
            />
            <QuickLink
              href="/docs/api-reference/rest"
              title="REST API"
              description="Complete API endpoint reference with examples."
            />
            <QuickLink
              href="/docs/guides/webhooks"
              title="Webhooks"
              description="Real-time event notifications for your application."
            />
            <QuickLink
              href="/docs/guides/authentication"
              title="Authentication"
              description="Learn how to securely authenticate requests."
            />
            <QuickLink
              href="/docs/architecture/overview"
              title="Architecture"
              description="Understand platform design and data models."
            />
            <QuickLink
              href="/docs/troubleshooting"
              title="Troubleshooting"
              description="Common issues and how to resolve them."
            />
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-wl-accent/20 to-wl-accent-light/20 rounded-lg border border-wl-accent/30 p-12 text-center">
          <h2 className="text-3xl font-bold text-wl-text mb-4">
            Ready to build?
          </h2>
          <p className="text-lg text-wl-text-secondary mb-8">
            Join thousands of developers integrating Witylogix into their platforms.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/docs/getting-started/installation">
              <Button size="lg">
                Start Building
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <a href="https://dashboard.witylogix.com/signup" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline">
                Create Free Account
              </Button>
            </a>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-20 pt-12 border-t border-wl-border text-center text-sm text-wl-text-secondary">
          <p>
            Need help? Check our{' '}
            <Link href="/docs/troubleshooting" className="text-wl-accent hover:text-wl-accent-light transition-colors">
              troubleshooting guide
            </Link>
            {' '}or join our{' '}
            <a href="https://discord.gg/witylogix" className="text-wl-accent hover:text-wl-accent-light transition-colors">
              Discord community
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="rounded-lg border border-wl-border bg-wl-bg-secondary p-6 hover:border-wl-accent/50 transition-colors">
      <div className="text-wl-accent mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-wl-text mb-2">{title}</h3>
      <p className="text-wl-text-secondary">{description}</p>
    </div>
  );
}

interface QuickLinkProps {
  href: string;
  title: string;
  description: string;
}

function QuickLink({ href, title, description }: QuickLinkProps) {
  return (
    <Link href={href}>
      <div className="group rounded-lg border border-wl-border bg-wl-bg-primary p-4 hover:border-wl-accent hover:bg-wl-bg-secondary transition-all cursor-pointer">
        <h3 className="font-semibold text-wl-text group-hover:text-wl-accent transition-colors mb-1">
          {title}
        </h3>
        <p className="text-sm text-wl-text-secondary">{description}</p>
      </div>
    </Link>
  );
}
