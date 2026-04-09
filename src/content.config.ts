import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        week: z.number().int().positive().optional(),
        section: z
          .enum(['core', 'growth', 'cycles', 'nominal-policy', 'heterogeneity'])
          .optional(),
        estimatedTime: z.string().optional(),
        prerequisites: z.array(z.string()).optional(),
        learningGoals: z.array(z.string()).optional(),
        keywords: z.array(z.string()).optional(),
        datasets: z.array(z.string()).optional(),
        widgets: z.array(z.string()).optional(),
        status: z.enum(['draft', 'ready', 'published']).optional(),
      }),
    }),
  }),
};
