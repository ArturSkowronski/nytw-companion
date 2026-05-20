import { z } from 'zod'

export const ConciergeRequestSchema = z.object({
  profile_text: z.string().min(10).max(1000),
  existing_event_ids: z.array(z.string()).max(500),
})

export const ProposalSchema = z.object({
  event_id: z.string(),
  reasoning: z.string(),
  priority: z.enum(['must-attend', 'high', 'medium']),
  is_stretch: z.boolean(),
})

export const ClaudeResponseSchema = z.object({
  proposals: z.array(ProposalSchema).min(0).max(10),
  notes: z.string().nullable().optional(),
})

export type ConciergeRequest = z.infer<typeof ConciergeRequestSchema>
export type Proposal = z.infer<typeof ProposalSchema>
export type ClaudeResponse = z.infer<typeof ClaudeResponseSchema>
