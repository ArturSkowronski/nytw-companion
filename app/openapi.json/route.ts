// /openapi.json — OpenAPI 3.1 spec for the read-only REST mirror of the MCP
// tools. Lets agents that don't speak MCP still discover and call the same
// endpoints over plain HTTP+JSON.
import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/site-url'

export const dynamic = 'force-static'

export function GET() {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: "NYTW Engineer's Companion API",
      version: '1.0.0',
      description:
        "Read-only REST surface mirroring the Model Context Protocol tools exposed at /mcp. Same data, same parameters — JSON over HTTPS for agents that don't speak MCP yet. The web UI consumes the same underlying data file (data/all-events.json on the deploy).",
      contact: {
        name: 'Artur Skowroński / VirtusLab',
        url: `${SITE_URL}/about`,
      },
      license: { name: 'MIT' },
    },
    servers: [{ url: SITE_URL, description: 'Production' }],
    paths: {
      '/api/events': {
        get: {
          operationId: 'list_events',
          summary: 'List events (full 1,390-event catalogue)',
          description:
            'Mirrors the MCP `list_events` tool. Returns the full Tech Week NYC 2026 catalogue with optional filters and pagination.',
          parameters: [
            { name: 'day', in: 'query', required: false, schema: { type: 'string', example: '2026-06-03' }, description: 'NYC-local date filter.' },
            { name: 'tag', in: 'query', required: false, schema: { type: 'string', example: 'ai-infra' } },
            { name: 'format', in: 'query', required: false, schema: { type: 'string', example: 'hackathon' } },
            { name: 'host_contains', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
            { name: 'offset', in: 'query', required: false, schema: { type: 'integer', minimum: 0, default: 0 } },
          ],
          responses: {
            '200': {
              description: 'Paginated event list.',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/EventListResponse' },
                },
              },
            },
          },
        },
      },
      '/api/events/{id}': {
        get: {
          operationId: 'get_event',
          summary: 'Get one event by id',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Event slug, e.g. "partiful-abc123".' },
          ],
          responses: {
            '200': { description: 'Event record.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } } },
            '404': { description: 'Not found.' },
          },
        },
      },
      '/api/events/search': {
        get: {
          operationId: 'search_events',
          summary: 'Fuzzy search events',
          parameters: [
            { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 50, default: 10 } },
          ],
          responses: {
            '200': {
              description: 'Top scoring events.',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/EventListResponse' } } },
            },
          },
        },
      },
      '/api/events/next-up': {
        get: {
          operationId: 'next_up',
          summary: 'Events starting in the next N hours (NYC time)',
          parameters: [
            { name: 'hours', in: 'query', required: false, schema: { type: 'number', minimum: 0.5, maximum: 48, default: 3 } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 20, default: 8 } },
          ],
          responses: {
            '200': {
              description: 'Upcoming events.',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/EventListResponse' } } },
            },
          },
        },
      },
      '/api/events/stats': {
        get: {
          operationId: 'catalogue_stats',
          summary: 'Counts by day, tag, and format',
          responses: {
            '200': {
              description: 'Catalogue summary.',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/CatalogueStats' } } },
            },
          },
        },
      },
      '/mcp': {
        post: {
          operationId: 'mcp_jsonrpc',
          summary: 'MCP JSON-RPC (streamable HTTP transport)',
          description:
            'Model Context Protocol endpoint. Accepts JSON-RPC 2.0 messages over POST. See /.well-known/mcp.json for tool list.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object', properties: { jsonrpc: { type: 'string', const: '2.0' }, id: {}, method: { type: 'string' }, params: { type: 'object' } }, required: ['jsonrpc', 'method'] },
              },
            },
          },
          responses: {
            '200': { description: 'JSON-RPC response (single-shot or SSE stream).', content: { 'text/event-stream': {}, 'application/json': {} } },
          },
        },
      },
    },
    components: {
      schemas: {
        Event: {
          type: 'object',
          required: ['id', 'title', 'host', 'starts_at', 'ends_at', 'rsvp_url'],
          properties: {
            id: { type: 'string', example: 'partiful-abc123' },
            title: { type: 'string' },
            description: { type: 'string' },
            host: { type: 'string' },
            starts_at: { type: 'string', format: 'date-time' },
            ends_at: { type: 'string', format: 'date-time' },
            neighborhood: { type: 'string', nullable: true },
            venue_name: { type: 'string', nullable: true },
            address: { type: 'string', nullable: true },
            lat: { type: 'number', nullable: true },
            lng: { type: 'number', nullable: true },
            tags: { type: 'array', items: { type: 'string' } },
            format: { type: 'string', nullable: true },
            rsvp_url: { type: 'string', format: 'uri' },
            rsvp_platform: { type: 'string', enum: ['luma', 'partiful', 'eventbrite', 'other'] },
            is_invite_only: { type: 'boolean' },
            image_url: { type: 'string', format: 'uri', nullable: true },
          },
        },
        EventListResponse: {
          type: 'object',
          required: ['events'],
          properties: {
            total: { type: 'integer' },
            offset: { type: 'integer' },
            limit: { type: 'integer' },
            count: { type: 'integer' },
            events: { type: 'array', items: { $ref: '#/components/schemas/Event' } },
          },
        },
        CatalogueStats: {
          type: 'object',
          properties: {
            total_events: { type: 'integer' },
            source: { type: 'string' },
            by_day: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, count: { type: 'integer' } } } },
            by_tag: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, count: { type: 'integer' } } } },
            by_format: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, count: { type: 'integer' } } } },
          },
        },
      },
    },
  }
  return NextResponse.json(spec, {
    headers: {
      'cache-control': 'public, max-age=3600',
      'content-type': 'application/json',
    },
  })
}
