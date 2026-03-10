import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { openAPIRoute } from 'fumadocs-openapi/server';

export const { docs, meta } = defineDocs({
  dir: 'content/docs',
});

export const apiReference = openAPIRoute({
  routes: [
    {
      id: 'rest-api',
      title: 'REST API',
      description: 'Core REST API endpoints for the Witylogix platform',
      file: 'content/api/openapi.json',
      baseUrl: '/docs/api-reference/rest',
    },
  ],
});

export default defineConfig({
  generateMap: true,
  baseUrl: 'https://docs.witylogix.com',
  contentDirs: {
    docs: 'content/docs',
  },
  meta: {
    description: 'Developer documentation for Witylogix delivery logistics platform',
    image: '/og-image.png',
    twitterHandle: '@witylogix',
  },
  mdxOptions: {
    jsx: true,
    jsxImportSource: 'react',
  },
  openapi: {
    routes: [
      {
        id: 'rest-api',
        title: 'REST API',
        description: 'Core REST API endpoints',
        file: 'content/api/openapi.json',
        baseUrl: '/docs/api-reference/rest',
      },
    ],
  },
});
