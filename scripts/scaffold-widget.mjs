#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const name = getArg('--name');

if (!name) {
  console.error('Usage: node scripts/scaffold-widget.mjs --name BudgetConstraintWidget');
  process.exit(1);
}

if (!/^[A-Z][A-Za-z0-9]+Widget$/.test(name)) {
  console.error('Widget name must be PascalCase and end with Widget, e.g. BudgetConstraintWidget');
  process.exit(1);
}

const targetFile = path.join(process.cwd(), 'src', 'components', 'interactive', `${name}.tsx`);

if (fs.existsSync(targetFile)) {
  console.error(`File already exists: ${targetFile}`);
  process.exit(1);
}

const content = `import { useState } from 'react';

/**
 * TODO: Explain the educational purpose of this widget.
 * TODO: List the lecture page(s) where this widget is used.
 */
export default function ${name}() {
  const [enabled, setEnabled] = useState(false);

  return (
    <section className="widget-shell" aria-label="${name}">
      <div className="widget-header">
        <h3>${name}</h3>
        <button type="button" onClick={() => setEnabled((value) => !value)}>
          {enabled ? '表示を戻す' : '表示を切り替える'}
        </button>
      </div>
      <p>
        TODO: Replace this placeholder with the actual teaching interaction.
      </p>
      {enabled ? <p>TODO: Alternative state.</p> : <p>TODO: Default state.</p>}
    </section>
  );
}
`;

fs.writeFileSync(targetFile, content, 'utf8');
console.log(`Created: ${targetFile}`);
