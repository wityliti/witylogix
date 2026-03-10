import { Anthropic } from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Mock documentation index - in production, this would be built from actual docs during build time
const docsIndex = [
  {
    id: 'getting-started-1',
    title: 'Getting Started with Witylogix',
    section: 'Installation & Setup',
    content:
      'To get started with the Witylogix platform, first create a free account at dashboard.witylogix.com. Then install the SDK using npm install @witylogix/sdk.',
    url: '/docs/getting-started/installation',
  },
  {
    id: 'auth-1',
    title: 'Authentication',
    section: 'API Keys & OAuth',
    content:
      'The Witylogix API uses API keys for authentication. Generate a new API key from your dashboard under Settings > API Keys. Include it in the Authorization header as Bearer YOUR_API_KEY.',
    url: '/docs/getting-started/authentication',
  },
  {
    id: 'webhooks-1',
    title: 'Webhooks',
    section: 'Real-time Events',
    content:
      'Webhooks allow you to receive real-time notifications about shipment updates, delivery events, and status changes. Subscribe to webhook events in your dashboard and implement an endpoint to handle them.',
    url: '/docs/guides/webhooks',
  },
  {
    id: 'shipments-1',
    title: 'Creating Shipments',
    section: 'Core Functionality',
    content:
      'To create a shipment, use POST /api/v1/shipments with required fields: origin address, destination address, items, and pickup date. The API returns a shipment ID and tracking number.',
    url: '/docs/api-reference/rest#post-shipments',
  },
  {
    id: 'tracking-1',
    title: 'Tracking Shipments',
    section: 'Core Functionality',
    content:
      'Track shipments in real-time using GET /api/v1/shipments/{id}/tracking. Returns current status, location, and estimated delivery time based on the shipment ID.',
    url: '/docs/api-reference/rest#get-shipments-tracking',
  },
  {
    id: 'rate-limiting-1',
    title: 'Rate Limiting',
    section: 'API Best Practices',
    content:
      'The Witylogix API implements rate limiting at 1000 requests per minute per API key. When you exceed the limit, the API returns HTTP 429 with a Retry-After header.',
    url: '/docs/guides/rate-limiting',
  },
  {
    id: 'errors-1',
    title: 'Error Handling',
    section: 'Best Practices',
    content:
      'All errors include an error code, message, and details object. Common errors: 400 (Bad Request), 401 (Unauthorized), 404 (Not Found), 429 (Rate Limited), 500 (Server Error).',
    url: '/docs/guides/error-handling',
  },
  {
    id: 'deployment-1',
    title: 'Deployment',
    section: 'Production Guide',
    content:
      'Deploy your integration to production by setting environment variables for API keys, configuring webhooks endpoints, enabling monitoring, and testing failover scenarios.',
    url: '/docs/guides/deployment',
  },
];

interface SearchRequest {
  query: string;
}

interface SearchResult {
  answer: string;
  citations: Array<{
    title: string;
    section: string;
    url: string;
    content: string;
  }>;
  followUpQuestions: string[];
}

async function findRelevantDocs(
  query: string,
  topK: number = 5
): Promise<typeof docsIndex> {
  // Simple relevance scoring based on keyword matching
  // In production, use vector embeddings for semantic search
  const queryTerms = query.toLowerCase().split(/\s+/);

  const scored = docsIndex.map((doc) => {
    const content = `${doc.title} ${doc.section} ${doc.content}`.toLowerCase();
    const matches = queryTerms.filter((term) => content.includes(term)).length;
    return { doc, score: matches };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter((item) => item.score > 0)
    .map((item) => item.doc);
}

async function generateAnswer(
  query: string,
  relevantDocs: typeof docsIndex
): Promise<SearchResult> {
  const contextText = relevantDocs
    .map(
      (doc) =>
        `Title: ${doc.title}\nSection: ${doc.section}\nContent: ${doc.content}`
    )
    .join('\n\n---\n\n');

  const systemPrompt = `You are a helpful assistant for the Witylogix delivery logistics platform documentation.
Answer developer questions based on the provided documentation excerpts.
Be concise and practical. Include relevant code examples when appropriate.
Always cite the sources you used to answer the question.`;

  const userPrompt = `Documentation excerpts:\n\n${contextText}\n\nUser question: ${query}`;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const answer =
      message.content[0].type === 'text' ? message.content[0].text : '';

    // Generate follow-up questions
    const followUpMessage = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 256,
      system:
        'Generate 3 relevant follow-up questions based on the user query and answer. Return as JSON array of strings.',
      messages: [
        {
          role: 'user',
          content: `Original question: ${query}\n\nAnswer provided: ${answer}\n\nGenerate 3 follow-up questions as a JSON array.`,
        },
      ],
    });

    let followUpQuestions: string[] = [];
    try {
      const followUpText =
        followUpMessage.content[0].type === 'text'
          ? followUpMessage.content[0].text
          : '[]';
      const jsonMatch = followUpText.match(/\[.*\]/s);
      if (jsonMatch) {
        followUpQuestions = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Fallback follow-up questions if generation fails
      followUpQuestions = [
        'How do I implement webhooks?',
        'What are the rate limits?',
        'How do I handle errors?',
      ];
    }

    return {
      answer,
      citations: relevantDocs.map((doc) => ({
        title: doc.title,
        section: doc.section,
        url: doc.url,
        content: doc.content.substring(0, 200) + '...',
      })),
      followUpQuestions,
    };
  } catch (error) {
    console.error('Error calling Claude API:', error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json();
    const { query } = body;

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'API configuration missing' },
        { status: 500 }
      );
    }

    // Find relevant documentation
    const relevantDocs = await findRelevantDocs(query, 5);

    if (relevantDocs.length === 0) {
      return NextResponse.json(
        {
          answer:
            'I could not find relevant documentation for your query. Please try a different search or check our documentation index.',
          citations: [],
          followUpQuestions: [
            'How do I get started?',
            'Where can I find API examples?',
            'How do I authenticate?',
          ],
        },
        { status: 200 }
      );
    }

    // Generate answer using Claude
    const result = await generateAnswer(query, relevantDocs);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Search API error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Authentication failed. Check ANTHROPIC_API_KEY.' },
          { status: 401 }
        );
      }
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
