import { z } from 'zod';
export const username = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, 'Use 3–24 letras, números ou _');
export const credentials = z.object({ username, password: z.string().min(10).max(128) });
export const profile = z.object({ display_name: z.string().trim().min(1).max(50), bio: z.string().max(300), status: z.enum(['online','away','busy','invisible']), dm_policy: z.enum(['everyone','friends','nobody']), read_receipts: z.boolean(), avatar_id: z.string().uuid().nullable().optional() });
export const messageInput = z.object({ body: z.string().trim().max(4000).default(''), reply_id: z.string().uuid().nullable().optional(), attachment_id: z.string().uuid().nullable().optional() }).refine(x => x.body.length || x.attachment_id, 'Mensagem vazia');
export const roomInput = z.object({ name: z.string().trim().min(1).max(60), kind: z.enum(['dm','group','text','voice','temporary']), users: z.array(username).max(15).default([]), server_id: z.string().uuid().optional(), category_id: z.string().uuid().nullable().optional() });
export const permissions = ['manage_channels','manage_members','manage_messages','manage_roles','invite','send'] as const;
