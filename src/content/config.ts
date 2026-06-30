import { z, defineCollection } from "astro:content";

const blogCollection = defineCollection({
  schema: z.object({
    draft: z.boolean().default(false),
    title: z.string(),
    snippet: z.string(),
    url: z.string().optional(),
    image: z
      .object({
        src: z.string(),
        alt: z.string(),
      })
      .optional(),
    banner: z
      .object({
        src: z.string(),
        alt: z.string(),
      })
      .optional(),
    publishDate: z.string().transform((str) => new Date(str)),
    author: z.string().default("Navers lab"),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    links: z
      .array(
        z.object({
          label: z.string(),
          href: z.string(),
          style: z.enum(["primary", "outline"]).default("primary"),
        })
      )
      .default([]),
  }),
});

export const collections = {
  blog: blogCollection,
};
