#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function toSectionLabel(section) {
  switch (section) {
    case 'core':
      return 'core';
    case 'growth':
      return 'growth';
    case 'cycles':
      return 'cycles';
    case 'nominal-policy':
      return 'nominal-policy';
    case 'heterogeneity':
      return 'heterogeneity';
    default:
      return 'core';
  }
}

const week = getArg('--week');
const slug = getArg('--slug');
const title = getArg('--title');
const section = toSectionLabel(getArg('--section'));

if (!week || !slug || !title) {
  console.error('Usage: node scripts/scaffold-lecture.mjs --week 2 --slug two-period-household --title "第2回 2期間家計モデル" [--section core]');
  process.exit(1);
}

const dirName = `${String(week).padStart(2, '0')}-${slug}`;
const targetDir = path.join(process.cwd(), 'src', 'content', 'docs', 'lectures', dirName);
const targetFile = path.join(targetDir, 'index.mdx');

if (fs.existsSync(targetFile)) {
  console.error(`File already exists: ${targetFile}`);
  process.exit(1);
}

fs.mkdirSync(targetDir, { recursive: true });

const content = `---
title: ${title}
description: TODO: この回の到達点を1文で書く。
week: ${Number(week)}
section: ${section}
estimatedTime: 20-30分
prerequisites:
  - TODO
learningGoals:
  - TODO
keywords:
  - TODO
datasets:
  - TODO
widgets:
  - TODO
status: draft
sidebar:
  label: ${title.replace(/^第\d+回\s*/, '')}
---

import PlaceholderWidget from '../../../../components/interactive/GECoordinationWidget';

# 今日の問い

TODO

# 直感

TODO

# 最小モデル

TODO

# interactive widget（対話型部品）

<PlaceholderWidget client:load />

# データで確かめる

TODO

# 演習

1. TODO
2. TODO

# 一般化への橋渡し

TODO
`;

fs.writeFileSync(targetFile, content, 'utf8');
console.log(`Created: ${targetFile}`);
