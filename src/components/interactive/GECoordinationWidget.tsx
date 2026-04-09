import { useId, useMemo, useState } from 'react';
import styles from './GECoordinationWidget.module.css';

type WidgetMode = 'curves' | 'partial' | 'general';
type MarketKey = 'goods' | 'labor' | 'assets';
type ActorKey = 'household' | 'firm' | 'government';
type LineKind = 'demand' | 'supply';

type VisibilityState = {
  household: boolean;
  firm: boolean;
  government: boolean;
};

type DisplayOptions = {
  showIntersections: boolean;
  showGuides: boolean;
  showLabels: boolean;
};

type LineDef = {
  id: string;
  label: string;
  actor: Exclude<ActorKey, 'government'>;
  market: MarketKey;
  a: number;
  b: number;
  visible: boolean;
  kind: LineKind;
  labelX: number;
  labelY: number;
  labelAnchor?: 'start' | 'middle' | 'end';
  shiftNote?: string;
  shiftNoteOffsetPx?: number;
};

type EquilibriumPoint = {
  x: number;
  y: number;
  visible: boolean;
};

type MarketDefinition = {
  key: MarketKey;
  title: string;
  subtitle: string;
  xLabel: string;
  yLabel: string;
};

type MarketPanelProps = {
  market: MarketDefinition;
  mode: WidgetMode;
  isDimmed: boolean;
  isFocused: boolean;
  lines: LineDef[];
  equilibrium: EquilibriumPoint | null;
  display: DisplayOptions;
};

type EquilibriumSummaryProps = {
  mode: WidgetMode;
  focusMarket: MarketKey;
  equilibria: Record<MarketKey, EquilibriumPoint | null>;
  hasFullGeneralEquilibrium: boolean;
};

const markets: MarketDefinition[] = [
  {
    key: 'goods',
    title: '財市場',
    subtitle: '家計の財需要と企業の財供給が向き合う市場',
    xLabel: '財の量',
    yLabel: '財の価格',
  },
  {
    key: 'labor',
    title: '労働市場',
    subtitle: '家計の労働供給と企業の労働需要',
    xLabel: '労働量',
    yLabel: '実質賃金',
  },
  {
    key: 'assets',
    title: '資産市場',
    subtitle: '家計の貯蓄と企業の資金需要',
    xLabel: '資金量',
    yLabel: '利子率',
  },
];

const marketMeta: Record<
  MarketKey,
  {
    priceLabel: string;
    quantityLabel: string;
  }
> = {
  goods: {
    priceLabel: '価格',
    quantityLabel: '量',
  },
  labor: {
    priceLabel: '実質賃金',
    quantityLabel: '労働量',
  },
  assets: {
    priceLabel: '利子率',
    quantityLabel: '資金量',
  },
};

const baseLines = {
  goodsDemand: { a: 78, b: -0.6 },
  goodsSupply: { a: 18, b: 0.55 },
  laborSupply: { a: 16, b: 0.62 },
  laborDemand: { a: 82, b: -0.58 },
  assetsSupply: { a: 22, b: 0.5 },
  assetsDemand: { a: 76, b: -0.52 },
};

const shiftAmount = {
  goodsDemandX: 10,
  assetsDemandX: 8,
};

const initialVisibility: VisibilityState = {
  household: false,
  firm: false,
  government: false,
};

const initialDisplayOptions: DisplayOptions = {
  showIntersections: true,
  showGuides: true,
  showLabels: true,
};

const plot = {
  width: 100,
  height: 100,
  marginTop: 10,
  marginRight: 8,
  marginBottom: 14,
  marginLeft: 14,
};

const plotWidth = plot.width - plot.marginLeft - plot.marginRight;
const plotHeight = plot.height - plot.marginTop - plot.marginBottom;

function withShiftX(line: { a: number; b: number }, shiftX: number) {
  return {
    a: line.a - line.b * shiftX,
    b: line.b,
  };
}

function buildMarketLines(visibility: VisibilityState): Record<MarketKey, LineDef[]> {
  const goodsDemand = visibility.government
    ? withShiftX(baseLines.goodsDemand, shiftAmount.goodsDemandX)
    : baseLines.goodsDemand;

  const assetsDemand = visibility.government
    ? withShiftX(baseLines.assetsDemand, shiftAmount.assetsDemandX)
    : baseLines.assetsDemand;

  return {
    goods: [
      {
        id: 'goods-demand',
        label: '家計の財需要',
        actor: 'household',
        market: 'goods',
        a: goodsDemand.a,
        b: goodsDemand.b,
        visible: visibility.household,
        kind: 'demand',
        labelX: 21,
        labelY: 48,
        labelAnchor: 'middle',
        shiftNote: visibility.government ? '政府需要あり' : undefined,
        shiftNoteOffsetPx: 5,
      },
      {
        id: 'goods-supply',
        label: '企業の財供給',
        actor: 'firm',
        market: 'goods',
        a: baseLines.goodsSupply.a,
        b: baseLines.goodsSupply.b,
        visible: visibility.firm,
        kind: 'supply',
        labelX: 69,
        labelY: 69,
        labelAnchor: 'middle',
      },
    ],
    labor: [
      {
        id: 'labor-supply',
        label: '家計の労働供給',
        actor: 'household',
        market: 'labor',
        a: baseLines.laborSupply.a,
        b: baseLines.laborSupply.b,
        visible: visibility.household,
        kind: 'supply',
        labelX: 45,
        labelY: 73,
        labelAnchor: 'start',
      },
      {
        id: 'labor-demand',
        label: '企業の労働需要',
        actor: 'firm',
        market: 'labor',
        a: baseLines.laborDemand.a,
        b: baseLines.laborDemand.b,
        visible: visibility.firm,
        kind: 'demand',
        labelX: 46,
        labelY: 26,
        labelAnchor: 'start',
      },
    ],
    assets: [
      {
        id: 'assets-supply',
        label: '家計の貯蓄供給',
        actor: 'household',
        market: 'assets',
        a: baseLines.assetsSupply.a,
        b: baseLines.assetsSupply.b,
        visible: visibility.household,
        kind: 'supply',
        labelX: 45,
        labelY: 70,
        labelAnchor: 'start',
      },
      {
        id: 'assets-demand',
        label: '企業の資金需要',
        actor: 'firm',
        market: 'assets',
        a: assetsDemand.a,
        b: assetsDemand.b,
        visible: visibility.firm,
        kind: 'demand',
        labelX: 51,
        labelY: 22,
        labelAnchor: 'start',
        shiftNote: visibility.government ? '政府の資金需要あり' : undefined,
        shiftNoteOffsetPx: 5,
      },
    ],
  };
}

function intersectLines(line1: LineDef, line2: LineDef): EquilibriumPoint | null {
  const denominator = line1.b - line2.b;
  if (Math.abs(denominator) < 1e-9) {
    return null;
  }

  const x = (line2.a - line1.a) / denominator;
  const y = line1.a + line1.b * x;

  if (Number.isNaN(x) || Number.isNaN(y)) {
    return null;
  }

  return {
    x,
    y,
    visible: x >= 0 && x <= 100 && y >= 0 && y <= 100,
  };
}

function computeEquilibria(linesByMarket: Record<MarketKey, LineDef[]>) {
  const entries = Object.entries(linesByMarket).map(([key, lines]) => {
    const visibleLines = lines.filter((line) => line.visible);
    const demand = visibleLines.find((line) => line.kind === 'demand');
    const supply = visibleLines.find((line) => line.kind === 'supply');

    if (!demand || !supply) {
      return [key, null] as const;
    }

    return [key, intersectLines(demand, supply)] as const;
  });

  return Object.fromEntries(entries) as Record<MarketKey, EquilibriumPoint | null>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function scaleX(x: number) {
  return plot.marginLeft + (x / 100) * plotWidth;
}

function scaleY(y: number) {
  return plot.height - plot.marginBottom - (y / 100) * plotHeight;
}

function linePath(line: LineDef) {
  const x1 = 0;
  const x2 = 100;
  const y1 = line.a + line.b * x1;
  const y2 = line.a + line.b * x2;
  return `M ${scaleX(x1)} ${scaleY(y1)} L ${scaleX(x2)} ${scaleY(y2)}`;
}

function lineLabelPosition(line: LineDef) {
  const x = clamp(line.labelX, 7, 95);
  const y = clamp(line.labelY, 7, 95);
  return {
    x: scaleX(x),
    y: scaleY(y),
    anchor: line.labelAnchor ?? 'start',
  };
}

function formatValue(value: number) {
  return value.toFixed(1);
}

function modeDescription(mode: WidgetMode) {
  if (mode === 'curves') {
    return 'いまは、家計や企業の意思決定が各市場でどのような線として現れるかを見ています。';
  }

  if (mode === 'partial') {
    return 'いまは 1 つの市場だけに注目しています。この市場だけを見た交点が部分均衡です。';
  }

  return 'いまは 3 つの市場を同時に見ています。各市場の交点の組が一般均衡です。';
}

function MarketPanel({
  market,
  mode,
  isDimmed,
  isFocused,
  lines,
  equilibrium,
  display,
}: MarketPanelProps) {
  const clipSuffix = useId().replace(/:/g, '');
  const clipId = `ge-clip-${market.key}-${clipSuffix}`;
  const pointVisible =
    mode !== 'curves' &&
    !isDimmed &&
    display.showIntersections &&
    equilibrium !== null &&
    equilibrium.visible;
  const pointLabel = mode === 'partial' ? '部分均衡' : null;
  const visibleLineCount = lines.filter((line) => line.visible).length;

  return (
    <article
      className={[
        styles.marketPanel,
        isDimmed ? styles.marketPanelDimmed : '',
        isFocused ? styles.marketPanelFocused : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${market.title}の図`}
    >
      <div className={styles.marketHeader}>
        <div>
          <h4>{market.title}</h4>
          <p>{market.subtitle}</p>
        </div>
        {mode === 'partial' && isFocused ? <span className={styles.focusBadge}>注目市場</span> : null}
        {mode === 'partial' && isDimmed ? <span className={styles.givenBadge}>今は所与</span> : null}
      </div>

      <div className={styles.marketMeta}>
        <span>{visibleLineCount} 本の線を表示中</span>
        <span>
          {market.yLabel} × {market.xLabel}
        </span>
      </div>

      <svg
        className={styles.marketSvg}
        viewBox={`0 0 ${plot.width} ${plot.height}`}
        role="img"
        aria-label={`${market.title}の価格と量の図`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect
              x={plot.marginLeft}
              y={plot.marginTop}
              width={plotWidth}
              height={plotHeight}
              rx="1"
            />
          </clipPath>
        </defs>

        <line
          className={styles.axis}
          x1={plot.marginLeft}
          y1={plot.height - plot.marginBottom}
          x2={plot.width - plot.marginRight}
          y2={plot.height - plot.marginBottom}
        />
        <line
          className={styles.axis}
          x1={plot.marginLeft}
          y1={plot.height - plot.marginBottom}
          x2={plot.marginLeft}
          y2={plot.marginTop}
        />

        <text className={styles.axisLabelX} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>
          {market.xLabel}
        </text>
        <text
          className={styles.axisLabelY}
          x={5}
          y={plot.marginTop + plotHeight / 2}
          transform={`rotate(-90 5 ${plot.marginTop + plotHeight / 2})`}
        >
          {market.yLabel}
        </text>

        <g clipPath={`url(#${clipId})`}>
          {lines.map((line) => {
            if (!line.visible) {
              return null;
            }

            const labelPosition = lineLabelPosition(line);
            const lineClass =
              line.actor === 'household' ? styles.householdLine : styles.firmLine;
            const labelClass =
              line.actor === 'household' ? styles.householdLabel : styles.firmLabel;

            return (
              <g key={line.id}>
                <path className={`${styles.marketLine} ${lineClass}`} d={linePath(line)} />
                {display.showLabels ? (
                  <g>
                    <text
                      className={`${styles.lineLabel} ${labelClass}`}
                      x={labelPosition.x}
                      y={labelPosition.y}
                      textAnchor={labelPosition.anchor}
                    >
                      {line.label}
                    </text>
                    {line.shiftNote ? (
                      <text
                        className={`${styles.lineNote} ${styles.governmentLabel}`}
                        x={labelPosition.x}
                        y={labelPosition.y + (line.shiftNoteOffsetPx ?? 5)}
                        textAnchor={labelPosition.anchor}
                      >
                        {line.shiftNote}
                      </text>
                    ) : null}
                  </g>
                ) : null}
              </g>
            );
          })}

          {pointVisible && equilibrium ? (
            <g>
              {display.showGuides ? (
                <g>
                  <line
                    className={styles.guideLine}
                    x1={scaleX(equilibrium.x)}
                    y1={scaleY(equilibrium.y)}
                    x2={scaleX(equilibrium.x)}
                    y2={plot.height - plot.marginBottom}
                  />
                  <line
                    className={styles.guideLine}
                    x1={plot.marginLeft}
                    y1={scaleY(equilibrium.y)}
                    x2={scaleX(equilibrium.x)}
                    y2={scaleY(equilibrium.y)}
                  />
                </g>
              ) : null}
              <circle
                className={styles.equilibriumPoint}
                cx={scaleX(equilibrium.x)}
                cy={scaleY(equilibrium.y)}
                r="2.2"
              />
              {display.showLabels && pointLabel ? (
                <text
                  className={styles.pointLabel}
                  x={scaleX(equilibrium.x) + (mode === 'partial' ? 7.0 : 2.8)}
                  y={scaleY(equilibrium.y) + (mode === 'partial' ? 1 : -3)}
                >
                  {pointLabel}
                </text>
              ) : null}
            </g>
          ) : null}
        </g>
      </svg>

      <div className={styles.marketFooter}>
        <span>家計の線: {lines.some((line) => line.actor === 'household' && line.visible) ? '表示' : '非表示'}</span>
        <span>企業の線: {lines.some((line) => line.actor === 'firm' && line.visible) ? '表示' : '非表示'}</span>
      </div>
    </article>
  );
}

function EquilibriumSummary({
  mode,
  focusMarket,
  equilibria,
  hasFullGeneralEquilibrium,
}: EquilibriumSummaryProps) {
  if (mode === 'curves') {
    return (
      <section className={styles.summaryBox} aria-live="polite">
        <p className={styles.summaryLead}>
          まだ交点には注目していません。まずは主体を ON にして、どの市場にどんな線が現れるかを確認してください。
        </p>
        <div className={styles.summaryText}>
          家計は財市場では需要、労働市場では供給、資産市場では貯蓄供給として現れます。企業は財市場では供給、労働市場では需要、資産市場では資金需要として現れます。
        </div>
      </section>
    );
  }

  if (mode === 'partial') {
    const equilibrium = equilibria[focusMarket];
    const meta = marketMeta[focusMarket];
    const market = markets.find((item) => item.key === focusMarket);

    return (
      <section className={styles.summaryBox} aria-live="polite">
        <p className={styles.summaryLead}>
          この市場だけを見た価格と量の組が部分均衡です。他の市場との整合性はまだ確認していません。
        </p>

        {equilibrium && equilibrium.visible ? (
          <div className={styles.summaryCards}>
            <div className={styles.summaryCard}>
              <h4>{market?.title}</h4>
              <dl>
                <div>
                  <dt>{meta.priceLabel}</dt>
                  <dd>{formatValue(equilibrium.y)}</dd>
                </div>
                <div>
                  <dt>{meta.quantityLabel}</dt>
                  <dd>{formatValue(equilibrium.x)}</dd>
                </div>
              </dl>
            </div>
            <div className={styles.summaryAside}>
              <strong>他の市場は未確認</strong>
              <p>いまは所与として扱っています。一般均衡では、これらも同時に整合している必要があります。</p>
            </div>
          </div>
        ) : (
          <div className={styles.summaryText}>
            この市場で部分均衡を確認するには、家計と企業の両方の線が見えている必要があります。
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={styles.summaryBox} aria-live="polite">
      <div className={styles.summaryTopRow}>
        <p className={styles.summaryLead}>
          {hasFullGeneralEquilibrium
            ? '3つの市場で同時に整合する価格と量の組を一般均衡と呼びます。'
            : '一般均衡を確認するには、各市場で両側の線が見えている必要があります。'}
        </p>
        {hasFullGeneralEquilibrium ? <span className={styles.generalBadge}>一般均衡が成立</span> : null}
      </div>

      <div className={styles.summaryCards}>
        {markets.map((market) => {
          const equilibrium = equilibria[market.key];
          const meta = marketMeta[market.key];

          return (
            <div key={market.key} className={styles.summaryCard}>
              <h4>{market.title}</h4>
              {equilibrium && equilibrium.visible ? (
                <dl>
                  <div>
                    <dt>{meta.priceLabel}</dt>
                    <dd>{formatValue(equilibrium.y)}</dd>
                  </div>
                  <div>
                    <dt>{meta.quantityLabel}</dt>
                    <dd>{formatValue(equilibrium.x)}</dd>
                  </div>
                </dl>
              ) : (
                <p className={styles.missingText}>両側の線が必要です。</p>
              )}
            </div>
          );
        })}
      </div>

      <p className={styles.summaryNote}>
        一般均衡は 1 つの巨大な交点ではなく、財市場・労働市場・資産市場の交点の組を同時に見る考え方です。
      </p>
    </section>
  );
}

export default function GECoordinationWidget() {
  const [mode, setMode] = useState<WidgetMode>('curves');
  const [focusMarket, setFocusMarket] = useState<MarketKey>('goods');
  const [visibility, setVisibility] = useState<VisibilityState>(initialVisibility);
  const [display, setDisplay] = useState<DisplayOptions>(initialDisplayOptions);

  const linesByMarket = useMemo(() => buildMarketLines(visibility), [visibility]);
  const equilibria = useMemo(() => computeEquilibria(linesByMarket), [linesByMarket]);
  const hasFullGeneralEquilibrium = useMemo(
    () =>
      (Object.keys(equilibria) as MarketKey[]).every(
        (key) => equilibria[key] !== null && equilibria[key]?.visible,
      ),
    [equilibria],
  );

  return (
    <section className={`${styles.widget} not-content`} aria-label="部分均衡と一般均衡を見比べる図">
      <header className={styles.header}>
        <div>
          <h3>部分均衡と一般均衡を見比べる</h3>
          <p>線 → 交点 → 同時整合性、の順に見てください。</p>
        </div>
        <button
          type="button"
          className={styles.resetButton}
          onClick={() => {
            setMode('curves');
            setFocusMarket('goods');
            setVisibility(initialVisibility);
            setDisplay(initialDisplayOptions);
          }}
        >
          初期状態に戻す
        </button>
      </header>

      <div className={styles.legend} aria-hidden="true">
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.householdSwatch}`} />家計
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.firmSwatch}`} />企業
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendSwatch} ${styles.governmentSwatch}`} />政府の寄与
        </span>
      </div>

      <div className={styles.controlsPanel}>
        <fieldset className={styles.fieldset}>
          <legend>表示モード</legend>
          <div className={styles.choiceGroup} role="radiogroup" aria-label="表示モード">
            {[
              ['curves', '曲線'],
              ['partial', '部分均衡'],
              ['general', '一般均衡'],
            ].map(([value, label]) => (
              <label key={value} className={styles.choiceLabel}>
                <input
                  type="radio"
                  name="ge-mode"
                  value={value}
                  checked={mode === value}
                  onChange={() => setMode(value as WidgetMode)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>表示する主体</legend>
          <div className={styles.choiceGroup}>
            {[
              ['household', '家計'],
              ['firm', '企業'],
              ['government', '政府'],
            ].map(([key, label]) => (
              <label key={key} className={styles.choiceLabel}>
                <input
                  type="checkbox"
                  checked={visibility[key as keyof VisibilityState]}
                  onChange={() =>
                    setVisibility((current) => ({
                      ...current,
                      [key]: !current[key as keyof VisibilityState],
                    }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.fieldset} disabled={mode !== 'partial'}>
          <legend>フォーカス市場</legend>
          <div className={styles.choiceGroup} role="radiogroup" aria-label="フォーカス市場">
            {markets.map((market) => (
              <label key={market.key} className={styles.choiceLabel}>
                <input
                  type="radio"
                  name="focus-market"
                  value={market.key}
                  checked={focusMarket === market.key}
                  onChange={() => setFocusMarket(market.key)}
                />
                <span>{market.title}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>補助表示</legend>
          <div className={styles.choiceGroup}>
            {[
              ['showIntersections', '交点を表示'],
              ['showGuides', '補助線を表示'],
              ['showLabels', 'ラベルを表示'],
            ].map(([key, label]) => (
              <label key={key} className={styles.choiceLabel}>
                <input
                  type="checkbox"
                  checked={display[key as keyof DisplayOptions]}
                  onChange={() =>
                    setDisplay((current) => ({
                      ...current,
                      [key]: !current[key as keyof DisplayOptions],
                    }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <p className={styles.modeDescription}>{modeDescription(mode)}</p>

      <div className={styles.marketGrid}>
        {markets.map((market) => (
          <MarketPanel
            key={market.key}
            market={market}
            mode={mode}
            isDimmed={mode === 'partial' && focusMarket !== market.key}
            isFocused={mode === 'partial' && focusMarket === market.key}
            lines={linesByMarket[market.key]}
            equilibrium={equilibria[market.key]}
            display={display}
          />
        ))}
      </div>

      <EquilibriumSummary
        mode={mode}
        focusMarket={focusMarket}
        equilibria={equilibria}
        hasFullGeneralEquilibrium={hasFullGeneralEquilibrium}
      />

      <div className={styles.footerNote}>
        <strong>見方のポイント:</strong> 1つの市場の交点が部分均衡であり、3つの市場の交点の組を同時に確認したものが一般均衡です。
        政府を ON にすると、財市場と資産市場で需要側の線がシフトします。
      </div>
    </section>
  );
}
