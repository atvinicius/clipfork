import { z } from "zod";

export const sceneSchema = z.object({
  type: z.enum([
    "talking_head",
    "product_broll",
    "text_overlay",
    "testimonial",
    "greenscreen",
  ]),
  duration_s: z.number().positive(),
  emotion: z.string().optional(),
  gesture: z.string().optional(),
  transition: z.string().optional(),
  text_overlay: z.union([z.boolean(), z.string()]).optional(),
});

export const templateStructureSchema = z.object({
  structure: z.object({
    hook: z.object({
      type: z.string(),
      duration_s: z.number().positive(),
      text_overlay: z.boolean().optional(),
    }),
    scenes: z.array(sceneSchema).min(1),
    cta: z.object({
      type: z.string(),
      duration_s: z.number().positive(),
      text_overlay: z.boolean().optional(),
    }),
  }),
  style: z.object({
    pacing: z.enum(["slow", "medium", "fast"]),
    music_mood: z.string(),
    caption_style: z.string(),
    color_tone: z.string(),
  }),
  format: z.object({
    aspect: z.string().default("9:16"),
    total_duration_s: z.number().positive(),
  }),
});

export type TemplateStructure = z.infer<typeof templateStructureSchema>;
export type Scene = z.infer<typeof sceneSchema>;
