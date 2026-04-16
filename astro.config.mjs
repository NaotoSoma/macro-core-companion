import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import starlight from '@astrojs/starlight';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

export default defineConfig({
  site: 'https://naotosoma.github.io',
  base: '/macro-core-companion',
  markdown: {
    remarkPlugins: [remarkMath],
    rehypePlugins: [rehypeKatex],
  },
  integrations: [
    react(),
    starlight({
      title: 'マクロ経済学研究',
      description: '小さいモデルとインタラクティブ講義ノートで学ぶ大学院マクロ経済学',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/NaotoSoma/macro-core-companion',
        },
      ],
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'スタート',
          items: ['index', 'course-architecture'],
        },
        {
          label: '講義ノート',
          items: ['lectures', 'lectures/01-general-equilibrium', 'lectures/02-household-choice'],
        },
      ],
    }),
  ],
});
