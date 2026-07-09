import { useEffect, useMemo, useState } from 'react';
import styles from './HouseholdChoiceWidgets.module.css';
import { buildPath, formatNumber } from './householdChoiceShared';
import MathInline from './MathInline';

type SeriesKey = 'gdp' | 'consumption' | 'investment' | 'hours' | 'tfp';

type CycleRow = {
  date: string;
  gdp: number;
  consumption: number;
  investment: number;
  hours: number;
  tfp: number;
};

type SeriesDefinition = {
  key: SeriesKey;
  label: string;
  shortLabel: string;
  column: keyof CycleRow;
  color: string;
};

const plot = {
  width: 100,
  height: 100,
  marginTop: 10,
  marginRight: 6,
  marginBottom: 15,
  marginLeft: 15,
};

const plotWidth = plot.width - plot.marginLeft - plot.marginRight;
const plotHeight = plot.height - plot.marginTop - plot.marginBottom;

const seriesDefinitions: SeriesDefinition[] = [
  { key: 'gdp', label: '実質GDP', shortLabel: 'GDP', column: 'gdp', color: '#60a5fa' },
  { key: 'consumption', label: '実質消費', shortLabel: '消費', column: 'consumption', color: '#fb923c' },
  { key: 'investment', label: '実質投資', shortLabel: '投資', column: 'investment', color: '#22c55e' },
  { key: 'hours', label: '労働時間', shortLabel: '労働時間', column: 'hours', color: '#a78bfa' },
  { key: 'tfp', label: 'TFP', shortLabel: 'TFP', column: 'tfp', color: '#f43f5e' },
];

const defaultSelected: Record<SeriesKey, boolean> = {
  gdp: true,
  consumption: true,
  investment: true,
  hours: true,
  tfp: true,
};

function makeScale(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number) {
  if (Math.abs(domainMax - domainMin) < 1e-10) {
    return () => (rangeMin + rangeMax) / 2;
  }

  return (value: number) => rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
}

function parseNumber(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseCsv(text: string): CycleRow[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  const header = lines[0].split(',').map((item) => item.trim());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(',').map((item) => item.trim());
    const record = Object.fromEntries(header.map((key, index) => [key, values[index]]));

    return {
      date: record.date ?? '',
      gdp: parseNumber(record.gdp_cycle),
      consumption: parseNumber(record.consumption_cycle),
      investment: parseNumber(record.investment_cycle),
      hours: parseNumber(record.hours_cycle),
      tfp: parseNumber(record.tfp_cycle),
    };
  });

  return rows.filter((row) => row.date && seriesDefinitions.every((series) => Number.isFinite(row[series.column])));
}

function mean(values: number[]) {
  if (values.length === 0) {
    return Number.NaN;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) {
    return Number.NaN;
  }
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function correlation(xs: number[], ys: number[]) {
  if (xs.length !== ys.length || xs.length <= 1) {
    return Number.NaN;
  }

  const xMean = mean(xs);
  const yMean = mean(ys);
  const numerator = xs.reduce((sum, x, index) => sum + (x - xMean) * (ys[index] - yMean), 0);
  const denominator = Math.sqrt(
    xs.reduce((sum, x) => sum + (x - xMean) ** 2, 0) * ys.reduce((sum, y) => sum + (y - yMean) ** 2, 0),
  );

  return denominator > 0 ? numerator / denominator : Number.NaN;
}

function formatCorrelation(value: number) {
  if (!Number.isFinite(value)) {
    return '-';
  }
  return value.toFixed(2);
}

export default function BusinessCycleFactsWidget() {
  const [rows, setRows] = useState<CycleRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<SeriesKey, boolean>>(defaultSelected);

  useEffect(() => {
    const controller = new AbortController();
    const baseUrl = import.meta.env.BASE_URL ?? '/';
    const dataUrl = `${baseUrl.replace(/\/$/, '')}/data/us_business_cycle_hp.csv`;

    fetch(dataUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`CSVを読み込めませんでした: ${response.status}`);
        }
        return response.text();
      })
      .then((text) => {
        const parsedRows = parseCsv(text);
        if (parsedRows.length === 0) {
          throw new Error('CSVに有効な循環成分がありません。');
        }
        setRows(parsedRows);
        setError(null);
      })
      .catch((caughtError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(caughtError instanceof Error ? caughtError.message : 'データの読み込みに失敗しました。');
      });

    return () => controller.abort();
  }, []);

  const activeSeries = useMemo(() => seriesDefinitions.filter((series) => selected[series.key]), [selected]);
  const isLoading = rows.length === 0 && error === null;
  const hasActiveSeries = activeSeries.length > 0;

  const chartScales = useMemo(() => {
    const values = rows.flatMap((row) => activeSeries.map((series) => row[series.column] as number));
    const minValue = values.length > 0 ? Math.min(...values, -1) : -1;
    const maxValue = values.length > 0 ? Math.max(...values, 1) : 1;
    const padding = Math.max((maxValue - minValue) * 0.12, 0.5);

    return {
      x: makeScale(0, Math.max(rows.length - 1, 1), plot.marginLeft, plot.marginLeft + plotWidth),
      y: makeScale(minValue - padding, maxValue + padding, plot.height - plot.marginBottom, plot.marginTop),
      yMin: minValue - padding,
      yMax: maxValue + padding,
    };
  }, [rows, activeSeries]);

  const stats = useMemo(() => {
    const gdpValues = rows.map((row) => row.gdp);
    const gdpStd = standardDeviation(gdpValues);

    return seriesDefinitions.map((series) => {
      const values = rows.map((row) => row[series.column] as number);
      const std = standardDeviation(values);
      return {
        ...series,
        correlationWithGdp: correlation(values, gdpValues),
        standardDeviation: std,
        relativeStd: gdpStd > 0 ? std / gdpStd : Number.NaN,
      };
    });
  }, [rows]);

  const dateRange = rows.length > 0 ? `${rows[0].date}〜${rows[rows.length - 1].date}` : '-';
  const zeroY = chartScales.y(0);

  return (
    <section className={`${styles.widget} not-content`} aria-label="米国景気循環成分のデータ表示">
      <header className={styles.header}>
        <div>
          <h3>米国データで見る景気循環の共変動</h3>
          <p>HP filter（HPフィルタ）で取り出した循環成分を重ねて、GDP・消費・投資・労働時間・TFPの連動を確認します。</p>
        </div>
        <span className={styles.badge}>business cycle facts</span>
      </header>

      <div className={styles.controlsGrid}>
        <fieldset className={styles.fieldset}>
          <legend>表示する系列</legend>
          <div className={styles.choiceGroup}>
            {seriesDefinitions.map((series) => (
              <label key={series.key} className={styles.choiceLabel}>
                <input
                  type="checkbox"
                  checked={selected[series.key]}
                  onChange={() =>
                    setSelected((current) => ({
                      ...current,
                      [series.key]: !current[series.key],
                    }))
                  }
                />
                <span>{series.label}</span>
              </label>
            ))}
          </div>
          <p className={styles.smallNote}>循環成分は対数系列からHP filter（HPフィルタ）でトレンドを除き、100倍してパーセント偏差として表示しています。</p>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>データ処理</legend>
          <p className={styles.smallNote}>
            四半期データに対して <MathInline math="\lambda=1600" /> を使います。投資の変動幅が大きく、消費の変動幅が小さいことも、RBCモデルが説明すべき事実です。
          </p>
          <p className={styles.smallNote}>出所: GDP・消費・投資・労働時間はFRED、TFPはSan Francisco FedのFernald系列です。</p>
          <p className={styles.smallNote}>表示期間: {dateRange}</p>
          {isLoading ? <p className={styles.smallNote}>CSVを読み込んでいます。</p> : null}
          {!hasActiveSeries ? <p className={styles.smallNote}>少なくとも1つの系列を選ぶと、時系列グラフが表示されます。</p> : null}
          {error ? <p className={styles.smallNote}>読み込みエラー: {error}</p> : null}
        </fieldset>
      </div>

      <div className={styles.chartGrid2}>
        <article className={styles.chartPanel}>
          <h4>時系列: HP filter（HPフィルタ）循環成分</h4>
          <p>ゼロより上はトレンドより高い時期、ゼロより下はトレンドより低い時期です。</p>
          <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="米国マクロ変数の循環成分">
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
            <line className={styles.zeroAxis} x1={plot.marginLeft} y1={zeroY} x2={plot.width - plot.marginRight} y2={zeroY} />
            <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>四半期</text>
            <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>循環成分（%）</text>
            {isLoading ? <text className={styles.pointLabel} x={50} y={50} textAnchor="middle">読み込み中</text> : null}
            {!isLoading && !hasActiveSeries ? <text className={styles.pointLabel} x={50} y={50} textAnchor="middle">系列を選択してください</text> : null}
            {activeSeries.map((series) => {
              const path = buildPath(
                rows.map((row, index) => ({ x: index, y: row[series.column] as number })),
                chartScales.x,
                chartScales.y,
              );
              return <path key={series.key} d={path} fill="none" stroke={series.color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
            })}
            {rows.length > 0 ? (
              <>
                <text className={styles.pointLabel} x={plot.marginLeft} y={plot.height - 6}>{rows[0].date}</text>
                <text className={styles.pointLabel} x={plot.width - plot.marginRight} y={plot.height - 6} textAnchor="end">{rows[rows.length - 1].date}</text>
              </>
            ) : null}
          </svg>
          <div className={styles.legend} aria-hidden="true">
            {seriesDefinitions.map((series) => (
              <span key={series.key} className={styles.legendItem}>
                <span className={styles.legendLine} style={{ background: series.color }} />
                {series.shortLabel}
              </span>
            ))}
          </div>
        </article>

        <article className={styles.chartPanel}>
          <h4>相関と変動幅</h4>
          <p>各変数の循環成分がGDPとどの程度一緒に動くかを確認します。</p>
          <div className={styles.metricGrid}>
            {stats.map((item) => (
              <div key={item.key} className={styles.metricCard}>
                <h4>{item.label}</h4>
                <dl>
                  <div><dt>GDPとの相関</dt><dd>{formatCorrelation(item.correlationWithGdp)}</dd></div>
                  <div><dt>標準偏差</dt><dd>{formatNumber(item.standardDeviation)}</dd></div>
                  <div><dt>GDP比</dt><dd>{formatNumber(item.relativeStd)}</dd></div>
                </dl>
              </div>
            ))}
          </div>
        </article>
      </div>

      <section className={styles.summaryBox} aria-live="polite">
        <p className={styles.summaryLead}>景気循環では、GDPだけでなく、消費・投資・労働時間・TFPが一緒に動く傾向があります。</p>
        <p className={styles.note}>
          RBCモデルは、この共変動を生産性ショックから説明しようとします。ただし、TFPは測定方法や稼働率調整に依存するため、モデル内の純粋な技術ショックと完全に同じものとは限りません。
        </p>
      </section>
    </section>
  );
}
