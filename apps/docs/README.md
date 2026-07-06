# Witylogix Documentation

The official developer documentation for the Witylogix delivery logistics platform, built with [Fumadocs](https://fumadocs.vercel.app/) and [Next.js 15](https://nextjs.org/).

## Features

- **Comprehensive API Reference** - Auto-generated from OpenAPI 3.0 specification
- **AI-Powered Search** - Semantic search using Anthropic Claude API with RAG (Retrieval-Augmented Generation)
- **Beautiful Dark Theme** - Custom Witylogix color scheme optimized for readability
- **Fast & Responsive** - Built with Next.js for optimal performance
- **MDX Support** - Write documentation in Markdown with React components
- **Mobile-First** - Fully responsive design for all devices

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn

### Installation

```bash
npm install
```

### Development

Start the development server on port 3003:

```bash
npm run dev
```

Then open [http://localhost:3003](http://localhost:3003) in your browser.

### Building

Build for production:

```bash
npm run build
```

Start production server:

```bash
npm start
```

## Project Structure

```
apps/docs/
├── app/
│   ├── api/
│   │   └── search/
│   │       └── route.ts          # AI-powered search endpoint
│   ├── components/
│   │   └── search-dialog.tsx     # Search UI component
│   ├── [[...slug]]/
│   │   └── page.tsx              # Docs page catch-all
│   ├── page.tsx                  # Landing page
│   ├── layout.tsx                # Root layout
│   └── global.css                # Global styles with theme
├── content/
│   ├── docs/                     # MDX documentation files
│   └── api/                      # OpenAPI specifications
├── public/                       # Static assets
├── tailwind.config.ts            # Tailwind CSS config
├── tsconfig.json                 # TypeScript config
├── next.config.mjs               # Next.js config
├── source.config.ts              # Fumadocs configuration
├── postcss.config.js             # PostCSS config
└── package.json                  # Dependencies

content/docs/
├── getting-started/
│   ├── index.mdx
│   ├── installation.mdx
│   ├── authentication.mdx
│   ├── first-shipment.mdx
│   └── environment-setup.mdx
├── guides/
│   ├── webhooks.mdx
│   ├── batch-operations.mdx
│   ├── rate-limiting.mdx
│   ├── error-handling.mdx
│   └── deployment.mdx
├── architecture/
│   ├── overview.mdx
│   ├── data-model.mdx
│   ├── authorization.mdx
│   ├── scaling.mdx
│   └── adr-index.mdx
├── api-reference/
│   ├── rest-api.mdx              # Auto-generated from OpenAPI
│   ├── graphql.mdx
│   ├── webhooks.mdx
│   └── error-codes.mdx
└── troubleshooting/
    ├── common-errors.mdx
    ├── debugging.mdx
    └── performance.mdx
```

## Writing Documentation

### Creating a New Page

Create a new `.mdx` file in the `content/docs/` directory:

```mdx
---
title: Page Title
description: Brief description for search and metadata
---

# Page Title

Content goes here...

## Section Header

More content...
```

### Metadata

Each MDX file requires frontmatter:

```yaml
---
title: Page Title
description: Used in search results and metadata
---
```

### Using React Components

MDX supports React components:

```mdx
<div className="bg-wl-bg-secondary p-4 rounded-lg border border-wl-border">
  Custom component
</div>
```

## Environment Variables

Create a `.env.local` file for development:

```bash
ANTHROPIC_API_KEY=sk-ant-...    # Required for AI search
NEXT_PUBLIC_DOCS_URL=http://localhost:3003
```

## API Search

The search endpoint at `/api/search` uses Claude for semantic search:

### Request

```bash
curl -X POST http://localhost:3003/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I authenticate?"}'
```

### Response

```json
{
  "answer": "To authenticate with the Witylogix API...",
  "citations": [
    {
      "title": "Authentication",
      "section": "API Keys & OAuth",
      "url": "/docs/getting-started/authentication",
      "content": "..."
    }
  ],
  "followUpQuestions": [
    "How do I create an API key?",
    "What auth methods are supported?"
  ]
}
```

## Deployment

### Vercel (Recommended)

```bash
vercel deploy
```

Automatically deploys on push to main branch.

### Docker

```bash
docker build -t witylogix-docs .
docker run -p 3003:3003 witylogix-docs
```

### Self-Hosted

```bash
npm install
npm run build
npm start
```

Environment variables:

- `ANTHROPIC_API_KEY` - Required for search functionality
- `NEXT_PUBLIC_DOCS_URL` - Public docs URL
- `NODE_ENV` - Set to `production`

## OpenAPI Integration

Docs auto-generates API reference from `content/api/openapi.json`:

1. Update your OpenAPI 3.0 specification
2. Docs rebuild automatically (during development, via CI/CD in production)
3. API reference appears at `/docs/api-reference/rest`

## Theme Customization

Witylogix color scheme defined in:

- `app/global.css` - CSS custom properties
- `tailwind.config.ts` - Tailwind color definitions

Modify `--wl-*` variables to customize theme.

## Troubleshooting

### Search not working

- Check `ANTHROPIC_API_KEY` is set
- Check API key has sufficient quota
- Check console for errors: `npm run dev`

### Docs not building

- Clear `.next` directory: `rm -rf .next`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check MDX frontmatter syntax

### Styling issues

- Clear Tailwind cache: `rm -rf .next`
- Run: `npm run build`

## Contributing

To add or update documentation:

1. Create/edit `.mdx` file in `content/docs/`
2. Test locally: `npm run dev`
3. Submit PR with changes
4. Deploy via CI/CD pipeline

## Support

- GitHub Issues: [witylogix/docs](https://github.com/witylogix/docs/issues)
- Discord: [discord.gg/witylogix](https://discord.gg/witylogix)
- Email: docs@witylogix.com

## License

Copyright (c) 2026 Witylogix. All rights reserved.
