import { useMemo } from 'react';
import katex from 'katex';
import styles from './HouseholdChoiceWidgets.module.css';

type MathInlineProps = {
  math: string;
};

export default function MathInline({ math }: MathInlineProps) {
  const html = useMemo(
    () =>
      katex.renderToString(math, {
        throwOnError: false,
        strict: false,
      }),
    [math],
  );

  return <span className={styles.mathInline} dangerouslySetInnerHTML={{ __html: html }} />;
}
