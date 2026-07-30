import { useMemo, useState } from 'react';
import styles from './HouseholdChoiceWidgets.module.css';
import { buildPath, formatNumber, safeLog, sampleRange } from './householdChoiceShared';
import MathInline from './MathInline';

type RbcSolution = {
  n1: number;
  n2: number;
  k2: number;
  c1: number;
  c2: number;
  i1: number;
  y1: number;
  y2: number;
  utility: number;
};

type ResponseKey = 'y1' | 'c1' | 'i1' | 'n1' | 'k2';

type ResponseItem = {
  key: ResponseKey;
  label: string;
  current: number;
  baseline: number;
  changePercent: number;
};

const plot = {
  width: 100,
  height: 100,
  marginTop: 10,
  marginRight: 8,
  marginBottom: 16,
  marginLeft: 15,
};

const plotWidth = plot.width - plot.marginLeft - plot.marginRight;
const plotHeight = plot.height - plot.marginTop - plot.marginBottom;
const k1 = 0.15;
const nMin = 0.06;
const nMax = 0.94;
const minConsumption = 0.035;
const a1SliderMin = 0.7;
const a1SliderMax = 1.3;

function makeScale(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number) {
  if (Math.abs(domainMax - domainMin) < 1e-10) {
    return () => (rangeMin + rangeMax) / 2;
  }

  return (value: number) => rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
}

function production(a: number, k: number, n: number, alpha: number) {
  return a * Math.max(k, 1e-8) ** alpha * Math.max(n, 1e-8) ** (1 - alpha);
}

function mpl(a: number, k: number, n: number, alpha: number) {
  return a * (1 - alpha) * Math.max(k, 1e-8) ** alpha * Math.max(n, 1e-8) ** -alpha;
}

function mpk(a: number, k: number, n: number, alpha: number) {
  return a * alpha * Math.max(k, 1e-8) ** (alpha - 1) * Math.max(n, 1e-8) ** (1 - alpha);
}

function laborDisutility(n: number, chi: number, eta: number) {
  return (chi * Math.max(n, 0) ** (1 + eta)) / (1 + eta);
}

function marginalLaborDisutility(n: number, chi: number, eta: number) {
  return chi * Math.max(n, 1e-8) ** eta;
}

function utility(c: number, n: number, chi: number, eta: number) {
  if (c <= 0 || n <= 0 || n >= 1) {
    return Number.NEGATIVE_INFINITY;
  }

  return safeLog(c) - laborDisutility(n, chi, eta);
}

function solveRbc(a1: number, a2: number, alpha: number, beta: number, delta: number, chi: number, eta: number): RbcSolution {
  const nGrid = sampleRange(nMin, nMax, 42);
  const maxY1 = production(a1, k1, nMax, alpha);
  const k2Min = Math.max(0.02, (1 - delta) * k1);
  const k2Max = Math.max(k2Min + 0.1, (1 - delta) * k1 + maxY1 - minConsumption);
  const kGrid = sampleRange(k2Min, k2Max, 64);

  let best: RbcSolution = {
    n1: nMin,
    n2: nMin,
    k2: k2Min,
    c1: minConsumption,
    c2: minConsumption,
    i1: 0,
    y1: minConsumption,
    y2: minConsumption,
    utility: Number.NEGATIVE_INFINITY,
  };

  for (const n1 of nGrid) {
    const y1 = production(a1, k1, n1, alpha);

    for (const k2 of kGrid) {
      const i1 = k2 - (1 - delta) * k1;
      const c1 = y1 - i1;

      if (c1 <= minConsumption) {
        continue;
      }

      const period1Utility = utility(c1, n1, chi, eta);

      for (const n2 of nGrid) {
        const y2 = production(a2, k2, n2, alpha);
        const c2 = y2 + (1 - delta) * k2;
        const totalUtility = period1Utility + beta * utility(c2, n2, chi, eta);

        if (totalUtility > best.utility) {
          best = { n1, n2, k2, c1, c2, i1, y1, y2, utility: totalUtility };
        }
      }
    }
  }

  return best;
}

function maxFinite(values: number[], fallback: number) {
  const finiteValues = values.filter(Number.isFinite);
  return finiteValues.length > 0 ? Math.max(...finiteValues) : fallback;
}

function percentChange(current: number, baseline: number) {
  if (Math.abs(baseline) < 1e-8) {
    return 0;
  }
  return ((current - baseline) / Math.abs(baseline)) * 100;
}

function responseItems(current: RbcSolution, baseline: RbcSolution): ResponseItem[] {
  return [
    { key: 'y1', label: '産出', current: current.y1, baseline: baseline.y1, changePercent: percentChange(current.y1, baseline.y1) },
    { key: 'c1', label: '消費', current: current.c1, baseline: baseline.c1, changePercent: percentChange(current.c1, baseline.c1) },
    { key: 'i1', label: '投資', current: current.i1, baseline: baseline.i1, changePercent: percentChange(current.i1, baseline.i1) },
    { key: 'n1', label: '労働', current: current.n1, baseline: baseline.n1, changePercent: percentChange(current.n1, baseline.n1) },
    { key: 'k2', label: '次期資本', current: current.k2, baseline: baseline.k2, changePercent: percentChange(current.k2, baseline.k2) },
  ];
}

export default function TwoPeriodRBCWidget() {
  const [a1, setA1] = useState(1.0);
  const [a2, setA2] = useState(1.0);
  const [alpha, setAlpha] = useState(0.33);
  const [beta, setBeta] = useState(0.96);
  const [delta, setDelta] = useState(0.08);
  const [chi, setChi] = useState(2.0);
  const [eta, setEta] = useState(1.5);

  const solution = useMemo(() => solveRbc(a1, a2, alpha, beta, delta, chi, eta), [a1, a2, alpha, beta, delta, chi, eta]);
  const baseline = useMemo(() => solveRbc(1.0, a2, alpha, beta, delta, chi, eta), [a2, alpha, beta, delta, chi, eta]);
  const lowShockReference = useMemo(() => solveRbc(a1SliderMin, a2, alpha, beta, delta, chi, eta), [a2, alpha, beta, delta, chi, eta]);
  const highShockReference = useMemo(() => solveRbc(a1SliderMax, a2, alpha, beta, delta, chi, eta), [a2, alpha, beta, delta, chi, eta]);
  const responses = useMemo(() => responseItems(solution, baseline), [solution, baseline]);
  const showShockComparison = Math.abs(a1 - 1.0) > 0.015;

  const resourceMax = Math.max(
    solution.y1,
    solution.c1,
    solution.i1,
    baseline.y1,
    baseline.c1,
    baseline.i1,
    lowShockReference.y1,
    lowShockReference.c1,
    lowShockReference.i1,
    highShockReference.y1,
    highShockReference.c1,
    highShockReference.i1,
    0.1,
  ) * 1.16;
  const resourceY = makeScale(0, resourceMax, plot.height - plot.marginBottom, plot.marginTop);

  const laborGrid = useMemo(() => {
    const investment = solution.i1;
    return sampleRange(nMin, nMax, 150)
      .map((n) => {
        const y = production(a1, k1, n, alpha);
        const c = y - investment;
        if (c <= minConsumption) {
          return { n, mrs: Number.NaN, mpl: Number.NaN };
        }
        return {
          n,
          mrs: marginalLaborDisutility(n, chi, eta) * c,
          mpl: mpl(a1, k1, n, alpha),
        };
      });
  }, [solution.i1, a1, alpha, chi, eta]);

  const baselineLaborGrid = useMemo(() => {
    const investment = baseline.i1;
    return sampleRange(nMin, nMax, 150)
      .map((n) => {
        const y = production(1.0, k1, n, alpha);
        const c = y - investment;
        if (c <= minConsumption) {
          return { n, mrs: Number.NaN };
        }
        return {
          n,
          mrs: marginalLaborDisutility(n, chi, eta) * c,
        };
      });
  }, [baseline.i1, alpha, chi, eta]);

  const laborScaleReferenceGrid = useMemo(() => {
    return [
      { a: a1SliderMin, investment: lowShockReference.i1 },
      { a: 1.0, investment: baseline.i1 },
      { a: a1SliderMax, investment: highShockReference.i1 },
    ].flatMap(({ a, investment }) => sampleRange(nMin, nMax, 150)
      .map((n) => {
        const y = production(a, k1, n, alpha);
        const c = y - investment;
        if (c <= minConsumption) {
          return { mrs: Number.NaN, mpl: Number.NaN };
        }
        return {
          mrs: marginalLaborDisutility(n, chi, eta) * c,
          mpl: mpl(a, k1, n, alpha),
        };
      }));
  }, [lowShockReference.i1, baseline.i1, highShockReference.i1, alpha, chi, eta]);

  const laborYMax = maxFinite(laborScaleReferenceGrid.flatMap((point) => [point.mrs, point.mpl]), 2) * 1.1;
  const laborScaleX = makeScale(0, 1, plot.marginLeft, plot.marginLeft + plotWidth);
  const laborScaleY = makeScale(0, laborYMax, plot.height - plot.marginBottom, plot.marginTop);
  const laborCostPath = buildPath(laborGrid.map((point) => ({ x: point.n, y: point.mrs })), laborScaleX, laborScaleY);
  const baselineLaborCostPath = buildPath(baselineLaborGrid.map((point) => ({ x: point.n, y: point.mrs })), laborScaleX, laborScaleY);
  const laborBenefitPath = buildPath(laborGrid.map((point) => ({ x: point.n, y: point.mpl })), laborScaleX, laborScaleY);
  const currentMpl = mpl(a1, k1, solution.n1, alpha);
  const currentMrs = marginalLaborDisutility(solution.n1, chi, eta) * solution.c1;

  const capitalDomain = useMemo(() => {
    const minK2 = Math.max(0.02, (1 - delta) * k1);
    const lowShockY1 = production(a1SliderMin, k1, lowShockReference.n1, alpha);
    const baselineY1 = production(1.0, k1, baseline.n1, alpha);
    const highShockY1 = production(a1SliderMax, k1, highShockReference.n1, alpha);
    const lowShockMaxK2 = Math.max(minK2 + 0.1, (1 - delta) * k1 + lowShockY1 - minConsumption);
    const baselineMaxK2 = Math.max(minK2 + 0.1, (1 - delta) * k1 + baselineY1 - minConsumption);
    const highShockMaxK2 = Math.max(minK2 + 0.1, (1 - delta) * k1 + highShockY1 - minConsumption);

    return {
      minK2,
      maxK2: Math.max(lowShockMaxK2, baselineMaxK2, highShockMaxK2),
    };
  }, [alpha, delta, lowShockReference.n1, baseline.n1, highShockReference.n1]);

  const capitalGrid = useMemo(() => {
    const y1AtOptimalLabor = production(a1, k1, solution.n1, alpha);

    return sampleRange(capitalDomain.minK2, capitalDomain.maxK2, 170).map((k2) => {
      const i1 = k2 - (1 - delta) * k1;
      const c1 = y1AtOptimalLabor - i1;
      const y2 = production(a2, k2, solution.n2, alpha);
      const c2 = y2 + (1 - delta) * k2;
      return {
        k2,
        lhs: c1 > minConsumption ? 1 / c1 : Number.NaN,
        rhs: c2 > minConsumption ? beta * (1 / c2) * (mpk(a2, k2, solution.n2, alpha) + 1 - delta) : Number.NaN,
      };
    });
  }, [a1, a2, alpha, beta, delta, solution.n1, solution.n2, capitalDomain]);

  const baselineCapitalGrid = useMemo(() => {
    return sampleRange(capitalDomain.minK2, capitalDomain.maxK2, 170).map((k2) => {
      const y2 = production(a2, k2, baseline.n2, alpha);
      const c2 = y2 + (1 - delta) * k2;
      if (c2 <= minConsumption) {
        return { k2, rhs: Number.NaN };
      }
      return {
        k2,
        rhs: beta * (1 / c2) * (mpk(a2, k2, baseline.n2, alpha) + 1 - delta),
      };
    });
  }, [a2, alpha, beta, delta, baseline.n1, baseline.n2, capitalDomain]);

  const capitalScaleReferenceGrid = useMemo(() => {
    return [
      { a: a1SliderMin, solution: lowShockReference },
      { a: 1.0, solution: baseline },
      { a: a1SliderMax, solution: highShockReference },
    ].flatMap(({ a, solution: referenceSolution }) => {
      const y1AtReferenceLabor = production(a, k1, referenceSolution.n1, alpha);

      return sampleRange(capitalDomain.minK2, capitalDomain.maxK2, 170).map((k2) => {
        const i1 = k2 - (1 - delta) * k1;
        const c1 = y1AtReferenceLabor - i1;
        const y2 = production(a2, k2, referenceSolution.n2, alpha);
        const c2 = y2 + (1 - delta) * k2;
        return {
          lhs: c1 > minConsumption ? 1 / c1 : Number.NaN,
          rhs: c2 > minConsumption ? beta * (1 / c2) * (mpk(a2, k2, referenceSolution.n2, alpha) + 1 - delta) : Number.NaN,
        };
      });
    });
  }, [a2, alpha, beta, delta, lowShockReference, baseline, highShockReference, capitalDomain]);

  const capitalYMax = maxFinite(capitalScaleReferenceGrid.flatMap((point) => [point.lhs, point.rhs]), 2) * 1.1;
  const kMin = Math.min(...capitalGrid.map((point) => point.k2));
  const kMax = Math.max(...capitalGrid.map((point) => point.k2));
  const capitalScaleX = makeScale(kMin, kMax, plot.marginLeft, plot.marginLeft + plotWidth);
  const capitalScaleY = makeScale(0, capitalYMax, plot.height - plot.marginBottom, plot.marginTop);
  const capitalLhsPath = buildPath(capitalGrid.map((point) => ({ x: point.k2, y: point.lhs })), capitalScaleX, capitalScaleY);
  const capitalRhsPath = buildPath(capitalGrid.map((point) => ({ x: point.k2, y: point.rhs })), capitalScaleX, capitalScaleY);
  const baselineCapitalRhsPath = buildPath(baselineCapitalGrid.map((point) => ({ x: point.k2, y: point.rhs })), capitalScaleX, capitalScaleY);
  const currentCapitalLhs = 1 / solution.c1;
  const currentCapitalRhs = beta * (1 / solution.c2) * (mpk(a2, solution.k2, solution.n2, alpha) + 1 - delta);

  const responseMax = Math.max(5, ...responses.map((item) => Math.abs(item.changePercent))) * 1.15;
  const responseScaleY = makeScale(-responseMax, responseMax, plot.height - plot.marginBottom, plot.marginTop);
  const responseZeroY = responseScaleY(0);

  const resourceBarWidth = 12;
  const resourceYBase = plot.height - plot.marginBottom;
  const outputX = plot.marginLeft + 18;
  const consumptionX = plot.marginLeft + 42;
  const investmentX = plot.marginLeft + 66;

  return (
    <section className={`${styles.widget} not-content`} aria-label="2期間RBCモデルの生産性ショック">
      <header className={styles.header}>
        <div>
          <h3>2期間RBCモデル: 生産性ショックの波及</h3>
          <p>第1期の生産性を動かし、産出・消費・投資・労働・次期資本が同時にどう反応するかを確認します。</p>
        </div>
        <span className={styles.badge}>two-period RBC</span>
      </header>

      <div className={styles.controlsGrid}>
        <fieldset className={styles.fieldset}>
          <legend>生産性ショック</legend>
          <div className={styles.sliderStack}>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}><span>第1期生産性 <MathInline math="A_1" /></span><span className={styles.sliderValue}>{formatNumber(a1)}</span></span>
              <input type="range" min={a1SliderMin} max={a1SliderMax} step="0.01" value={a1} onChange={(event) => setA1(Number(event.target.value))} />
            </label>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}><span>第2期生産性 <MathInline math="A_2" /></span><span className={styles.sliderValue}>{formatNumber(a2)}</span></span>
              <input type="range" min="0.7" max="1.3" step="0.01" value={a2} onChange={(event) => setA2(Number(event.target.value))} />
            </label>
          </div>
          <div className={styles.presetButtons}>
            <button className={styles.presetButton} type="button" onClick={() => setA1(1.0)}>ショックを戻す</button>
            <button className={styles.presetButton} type="button" onClick={() => setA1(1.15)}>高生産性</button>
            <button className={styles.presetButton} type="button" onClick={() => setA1(0.85)}>低生産性</button>
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>技術と選好</legend>
          <div className={styles.sliderStack}>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}><span>資本分配率 <MathInline math="\alpha" /></span><span className={styles.sliderValue}>{formatNumber(alpha)}</span></span>
              <input type="range" min="0.25" max="0.45" step="0.01" value={alpha} onChange={(event) => setAlpha(Number(event.target.value))} />
            </label>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}><span>割引因子 <MathInline math="\beta" /></span><span className={styles.sliderValue}>{formatNumber(beta)}</span></span>
              <input type="range" min="0.8" max="1" step="0.01" value={beta} onChange={(event) => setBeta(Number(event.target.value))} />
            </label>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}><span>減耗率 <MathInline math="\delta" /></span><span className={styles.sliderValue}>{formatNumber(delta)}</span></span>
              <input type="range" min="0.02" max="0.2" step="0.01" value={delta} onChange={(event) => setDelta(Number(event.target.value))} />
            </label>
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>労働供給の反応</legend>
          <div className={styles.sliderStack}>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}><span>労働不効用の重み <MathInline math="\chi" /></span><span className={styles.sliderValue}>{formatNumber(chi)}</span></span>
              <input type="range" min="0.5" max="4" step="0.05" value={chi} onChange={(event) => setChi(Number(event.target.value))} />
            </label>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}><span>労働不効用の曲率 <MathInline math="\eta" /></span><span className={styles.sliderValue}>{formatNumber(eta)}</span></span>
              <input type="range" min="0.5" max="4" step="0.05" value={eta} onChange={(event) => setEta(Number(event.target.value))} />
            </label>
          </div>
          <p className={styles.smallNote}>労働反応は、MPL（労働の限界生産物）の上昇と所得効果のバランスに依存します。</p>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>モデルの読み方</legend>
          <p className={styles.smallNote}>
            家計・企業・市場清算からなる競争均衡として読みます。初期資本は <MathInline math="k_1=0.15" /> に固定し、内部計算では同じ配分を与える計画者問題を使っています。
          </p>
        </fieldset>
      </div>

      <div className={styles.chartGrid2}>
        <article className={styles.chartPanel}>
          <h4>第1期の資源配分</h4>
          <p>第1期の産出 <MathInline math="y_1" /> が、消費 <MathInline math="c_1" /> と投資 <MathInline math="i_1" /> にどう分かれるかを見ます。</p>
          <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="第1期の資源配分">
            <line className={styles.axis} x1={plot.marginLeft} y1={resourceYBase} x2={plot.width - plot.marginRight} y2={resourceYBase} />
            <line className={styles.axis} x1={plot.marginLeft} y1={resourceYBase} x2={plot.marginLeft} y2={plot.marginTop} />
            <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>資源</text>
            <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>量</text>
            <rect className={styles.barGood} x={outputX} y={resourceY(solution.y1)} width={resourceBarWidth} height={resourceYBase - resourceY(solution.y1)} />
            <rect className={styles.barGood} x={consumptionX} y={resourceY(solution.c1)} width={resourceBarWidth} height={resourceYBase - resourceY(solution.c1)} />
            <rect className={styles.barBad} x={investmentX} y={resourceY(solution.i1)} width={resourceBarWidth} height={resourceYBase - resourceY(solution.i1)} />
            <text className={styles.barLabel} x={outputX + resourceBarWidth / 2} y={plot.height - 6} textAnchor="middle">y</text>
            <text className={styles.barLabel} x={consumptionX + resourceBarWidth / 2} y={plot.height - 6} textAnchor="middle">c</text>
            <text className={styles.barLabel} x={investmentX + resourceBarWidth / 2} y={plot.height - 6} textAnchor="middle">i</text>
            <text className={styles.pointLabel} x={outputX + resourceBarWidth / 2} y={resourceY(solution.y1) - 2} textAnchor="middle">{formatNumber(solution.y1)}</text>
            <text className={styles.pointLabel} x={consumptionX + resourceBarWidth / 2} y={resourceY(solution.c1) - 2} textAnchor="middle">{formatNumber(solution.c1)}</text>
            <text className={styles.pointLabel} x={investmentX + resourceBarWidth / 2} y={resourceY(solution.i1) - 2} textAnchor="middle">{formatNumber(solution.i1)}</text>
          </svg>
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}><span className={`${styles.legendBar} ${styles.primarySwatch}`} />産出・消費</span>
            <span className={styles.legendItem}><span className={`${styles.legendBar} ${styles.secondarySwatch}`} />投資</span>
          </div>
        </article>

        <article className={styles.chartPanel}>
          <h4>第1期の労働選択</h4>
          <p><MathInline math="k_2" /> を最適値で固定し、<MathInline math="v'(n_1)/u'(c_1)" /> と <MathInline math="MPL_1" /> が一致するところを見ています。点線はショック前の家計側条件を固定した部分均衡の線です。</p>
          <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="RBCモデルの労働選択">
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
            <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>労働 n₁</text>
            <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>限界価値</text>
            {showShockComparison ? <path className={`${styles.primaryCurve} ${styles.partialCurve}`} d={baselineLaborCostPath} /> : null}
            <path className={styles.primaryCurve} d={laborCostPath} />
            <path className={styles.secondaryCurve} d={laborBenefitPath} />
            <line className={styles.zeroAxis} x1={laborScaleX(solution.n1)} y1={plot.height - plot.marginBottom} x2={laborScaleX(solution.n1)} y2={laborScaleY(Math.max(currentMrs, currentMpl))} />
            <circle className={styles.currentPointAlt} cx={laborScaleX(solution.n1)} cy={laborScaleY(currentMpl)} r="2.4" />
            <text className={styles.pointLabel} x={laborScaleX(solution.n1) + 2.4} y={laborScaleY(currentMpl) - 3}>n₁*</text>
          </svg>
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}><span className={`${styles.legendLine} ${styles.primarySwatch}`} />限界不効用 / 限界効用</span>
            {showShockComparison ? <span className={styles.legendItem}><span className={`${styles.legendLine} ${styles.dashedPrimarySwatch}`} />ショック前の家計側条件</span> : null}
            <span className={styles.legendItem}><span className={`${styles.legendLine} ${styles.secondarySwatch}`} />MPL</span>
          </div>
        </article>

        <article className={styles.chartPanel}>
          <h4>投資と次期資本の選択</h4>
          <p><MathInline math="n_1,n_2" /> を最適値で固定し、今日の消費を減らす限界費用と明日の資本収益の限界便益を比較します。点線はショック前の将来収益側です。<MathInline math="A_1" /> だけを動かすと、この右辺は直接には動かず、実線と重なることがあります。</p>
          <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="RBCモデルの投資選択">
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
            <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>次期資本 k₂</text>
            <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>限界価値</text>
            <path className={styles.primaryCurve} d={capitalLhsPath} />
            {showShockComparison ? <path className={`${styles.secondaryCurve} ${styles.partialCurve}`} d={baselineCapitalRhsPath} /> : null}
            <path className={styles.secondaryCurve} d={capitalRhsPath} />
            <line className={styles.zeroAxis} x1={capitalScaleX(solution.k2)} y1={plot.height - plot.marginBottom} x2={capitalScaleX(solution.k2)} y2={capitalScaleY(Math.max(currentCapitalLhs, currentCapitalRhs))} />
            <circle className={styles.currentPointAlt} cx={capitalScaleX(solution.k2)} cy={capitalScaleY(currentCapitalLhs)} r="2.35" />
            <text className={styles.pointLabel} x={capitalScaleX(solution.k2) + 2.4} y={capitalScaleY(currentCapitalLhs) - 3}>k₂*</text>
          </svg>
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}><span className={`${styles.legendLine} ${styles.primarySwatch}`} />u'(c₁)</span>
            <span className={styles.legendItem}><span className={`${styles.legendLine} ${styles.secondarySwatch}`} />βu'(c₂)(MPK₂+1-δ)</span>
            {showShockComparison ? <span className={styles.legendItem}><span className={`${styles.legendLine} ${styles.dashedSecondarySwatch}`} />ショック前の将来収益側</span> : null}
          </div>
        </article>

        <article className={styles.chartPanel}>
          <h4>生産性ショックへの反応</h4>
          <p><MathInline math="A_1=1" /> の基準解と比べた変化率です。</p>
          <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="生産性ショックに対する変数の反応">
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
            <line className={styles.zeroAxis} x1={plot.marginLeft} y1={responseZeroY} x2={plot.width - plot.marginRight} y2={responseZeroY} />
            <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>変化率（%）</text>
            {responses.map((item, index) => {
              const x = plot.marginLeft + 8 + index * 14;
              const y = responseScaleY(item.changePercent);
              const top = Math.min(y, responseZeroY);
              const height = Math.abs(responseZeroY - y);
              return (
                <g key={item.key}>
                  <rect className={item.changePercent >= 0 ? styles.barGood : styles.barBad} x={x} y={top} width={8} height={Math.max(height, 0.8)} />
                  <text className={styles.barLabel} x={x + 4} y={plot.height - 6} textAnchor="middle">{item.label}</text>
                  <text className={styles.pointLabel} x={x + 4} y={top - 2} textAnchor="middle">{item.changePercent.toFixed(1)}</text>
                </g>
              );
            })}
          </svg>
          <p className={styles.smallNote}>投資は消費より大きく動きやすく、RBCモデルが景気循環の共変動を説明する核になります。</p>
        </article>
      </div>

      <section className={styles.summaryBox} aria-live="polite">
        <p className={styles.summaryLead}>
          現在の解: <MathInline math={`y_1=${formatNumber(solution.y1)}`} />、<MathInline math={`c_1=${formatNumber(solution.c1)}`} />、<MathInline math={`i_1=${formatNumber(solution.i1)}`} />、<MathInline math={`n_1=${formatNumber(solution.n1)}`} />、<MathInline math={`k_2=${formatNumber(solution.k2)}`} />。
        </p>
        <div className={`${styles.metricGrid} ${styles.metricGrid3}`}>
          <div className={styles.metricCard}>
            <h4>第1期</h4>
            <dl>
              <div><dt>産出 <MathInline math="y_1" /></dt><dd>{formatNumber(solution.y1)}</dd></div>
              <div><dt>消費 <MathInline math="c_1" /></dt><dd>{formatNumber(solution.c1)}</dd></div>
              <div><dt>投資 <MathInline math="i_1" /></dt><dd>{formatNumber(solution.i1)}</dd></div>
            </dl>
          </div>
          <div className={styles.metricCard}>
            <h4>労働と資本</h4>
            <dl>
              <div><dt>労働 <MathInline math="n_1" /></dt><dd>{formatNumber(solution.n1)}</dd></div>
              <div><dt>次期資本 <MathInline math="k_2" /></dt><dd>{formatNumber(solution.k2)}</dd></div>
              <div><dt>第2期労働 <MathInline math="n_2" /></dt><dd>{formatNumber(solution.n2)}</dd></div>
            </dl>
          </div>
          <div className={styles.metricCard}>
            <h4>FOCの確認</h4>
            <dl>
              <div><dt><MathInline math="v'(n_1)/u'(c_1)" /></dt><dd>{formatNumber(currentMrs)}</dd></div>
              <div><dt><MathInline math="MPL_1" /></dt><dd>{formatNumber(currentMpl)}</dd></div>
              <div><dt>投資条件の差</dt><dd>{formatNumber(currentCapitalLhs - currentCapitalRhs)}</dd></div>
            </dl>
          </div>
        </div>
        <p className={styles.note}>この2期間版は、無限期間RBCモデルの全体を再現するものではありません。ここでは、生産性ショックが実物変数を同時に動かすメカニズムだけを取り出しています。</p>
      </section>
    </section>
  );
}
