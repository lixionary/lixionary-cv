import { z } from "zod";

/** Text fields accept a tiny Markdown subset: **bold** only. */
const text = z.string().min(1);

const role = z.object({
  title: text,
  /** Grey label after the title, e.g. "Backend" or "also Head of QA". */
  tag: z.string().optional(),
  start: text,
  end: text,
  bullets: z.array(text).default([]),
});

const company = z.object({
  name: text,
  location: z.string().optional(),
  /** Shown on the right of the company line; omit to hide. */
  period: z.string().optional(),
  /** Print "Role A → Role B → …" (oldest first) under the company line. */
  showPath: z.boolean().default(false),
  /** Newest role first. */
  roles: z.array(role).min(1),
});

export const cvSchema = z.object({
  meta: z
    .object({
      /** Accent colour for section labels, rule and highlight numbers. */
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#1D4E89"),
      /** Footer text on every PDF page. Defaults to "<name> · CV". */
      footer: z.string().optional(),
    })
    .default({}),
  basics: z.object({
    name: text,
    headline: z.string().optional(),
    location: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    links: z.array(z.object({ label: text, url: z.string().url() })).default([]),
  }),
  summary: z.string().optional(),
  /** The numbers strip under the summary. Up to 4 reads best. */
  highlights: z.array(z.object({ value: text, label: text })).max(6).default([]),
  skills: z.array(z.object({ name: text, items: text })).default([]),
  experience: z.array(company).default([]),
  education: z
    .array(
      z.object({
        school: text,
        degree: text,
        detail: z.string().optional(),
        start: text,
        end: text,
      }),
    )
    .default([]),
  talks: z.array(z.object({ title: text, venue: text, year: z.coerce.string() })).default([]),
});

export type CV = z.infer<typeof cvSchema>;
