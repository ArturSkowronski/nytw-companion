// Site-wide JSON-LD: Organization, WebSite (with SearchAction), FAQPage.
// Renders inline on every page so AI search crawlers (which score whole sites,
// not per-route) capture structured data even when entering through /events,
// /now, /my-plan, etc.
import { SITE_URL } from '@/lib/site-url'
import { BUILD_INFO } from '@/lib/build-time'

const author = {
  '@type': 'Person',
  '@id': `${SITE_URL}#author`,
  name: 'Artur Skowroński',
  url: 'https://www.linkedin.com/in/arturskowronski/',
  jobTitle: 'Director of Technology',
  worksFor: {
    '@type': 'Organization',
    name: 'VirtusLab',
    url: 'https://virtuslab.com',
  },
  sameAs: [
    'https://www.linkedin.com/in/arturskowronski/',
    'https://github.com/ArturSkowronski',
    'https://x.com/ArturSkowronski',
  ],
}

const organization = {
  '@type': 'Organization',
  '@id': `${SITE_URL}#organization`,
  name: 'NYTW Engineer\'s Companion',
  url: SITE_URL,
  logo: `${SITE_URL}/icons/icon-512.png`,
  founder: { '@id': `${SITE_URL}#author` },
  author: { '@id': `${SITE_URL}#author` },
  sameAs: [
    'https://github.com/ArturSkowronski/nytw-companion',
    'https://virtuslab.com',
  ],
}

const website = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}#website`,
  url: SITE_URL,
  name: 'NYTW Engineer\'s Companion',
  description:
    'Curated companion for Tech Week NYC 2026 — 379 engineering-relevant events curated from a 1,390-event scrape, browsable by humans (web UI) and AI agents (MCP server at /mcp).',
  inLanguage: 'en-US',
  dateModified: BUILD_INFO.iso,
  publisher: { '@id': `${SITE_URL}#organization` },
  author: { '@id': `${SITE_URL}#author` },
  creator: { '@id': `${SITE_URL}#author` },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/events?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
}

const faqPage = {
  '@type': 'FAQPage',
  '@id': `${SITE_URL}#faq`,
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Do you RSVP to events for me?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          "No. The companion is a planner and discovery tool. You click through to Luma or Partiful to RSVP yourself, then mark the status here. Luma and Partiful don't expose RSVP write APIs to third parties.",
      },
    },
    {
      '@type': 'Question',
      name: 'How are the events curated?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          '1,390 events were scraped from tech-week.com and enriched with descriptions from each partiful.com page. We ran two Claude Sonnet 4.5 passes over the full set — pass 1 on titles/hosts, pass 2 on descriptions — to drop wellness, faith-based, beauty, lifestyle, generic-networking, and crypto-trading events. The 379 survivors are what the web UI shows.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can AI agents use this?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          "Yes. We ship an MCP server at /mcp that exposes the full 1,390-event catalogue (not the human-curated subset) so agents can filter on their own. Tools: list_events, search_events, get_event, next_up, catalogue_stats. We also publish /.well-known/mcp.json, /.well-known/agent-card.json, and llms.txt for discovery.",
      },
    },
    {
      '@type': 'Question',
      name: 'Do you track me or sell my data?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          "No. Plans are stored in your browser (localStorage). Email-only magic link is opt-in if you want plan recovery across devices. We use Vercel Analytics (privacy-friendly, no cookies). MCP traffic from agents is not logged.",
      },
    },
    {
      '@type': 'Question',
      name: 'Is this affiliated with a16z or Tech Week?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'No. Built independently by VirtusLab. Tech Week NYC is presented by a16z; this tool is not endorsed by or affiliated with them. We link to other Tech Week aggregators (Yorkseed, GarysGuide, Andrew Yeung, Vibecal, Carly, Tech Week Official) on /beyond.',
      },
    },
  ],
}

const graph = {
  '@context': 'https://schema.org',
  '@graph': [author, organization, website, faqPage],
}

export function SiteJsonLd() {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  )
}
