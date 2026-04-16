import { useMemo, useState } from 'react';
import styles from './HouseholdChoiceWidgets.module.css';
import { argmaxGrid, buildPath, formatNumber, safeLog, sampleRange } from './householdChoiceShared';
import type { Point } from './householdChoiceShared';
import MathInline from './MathInline';

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
const rMin = 0.01;
const rMax = 0.8;
const y1Min = 0.7;
const y1Max = 1.8;
const y2Min = 0.6;
const y2Max = 1.8;
const borrowingLimit = 0.85;
const c1AxisMax = y1Max + borrowingLimit + 0.1;
const c2AxisMax = y2Max + (1 + rMax) * (y1Max - 0.04) + 0.2;

type Solution = {
  saving: number;
  c1: number;
  c2: number;
  utility: number;
};

function makeScale(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number) {
  return (value: number) => rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
}

function utility(c1: number, c2: number, beta: number) {
  return safeLog(c1) + beta * safeLog(c2);
}

function solveChoice(r: number, y1: number, y2: number, beta: number, allowBorrowing: boolean): Solution {
  const aMin = allowBorrowing ? Math.max(-borrowingLimit, -y2 / (1 + r) + 0.03) : 0;
  const aMax = y1 - 0.03;

  const best = argmaxGrid(aMin, aMax, 600, (saving) => {
    const c1 = y1 - saving;
    const c2 = y2 + (1 + r) * saving;
    if (c1 <= 0 || c2 <= 0) {
      return Number.NEGATIVE_INFINITY;
    }
    return utility(c1, c2, beta);
  });

  return {
    saving: best.x,
    c1: y1 - best.x,
    c2: y2 + (1 + r) * best.x,
    utility: best.value,
  };
}

function budgetLine(y1: number, y2: number, r: number, allowBorrowing: boolean): Point[] {
  const aMin = allowBorrowing ? Math.max(-borrowingLimit, -y2 / (1 + r) + 0.03) : 0;
  const c1Max = y1 - aMin;
  return sampleRange(0.04, c1Max, 160)
    .map((c1) => ({ x: c1, y: y2 + (1 + r) * (y1 - c1) }))
    .filter((point) => point.y > 0);
}

function indifferenceCurve(level: number, beta: number, xMax: number, yMax: number): Point[] {
  return sampleRange(0.04, xMax, 160)
    .map((c1) => ({ x: c1, y: Math.exp((level - Math.log(c1)) / beta) }))
    .filter((point) => Number.isFinite(point.y) && point.y > 0 && point.y <= yMax * 1.03);
}

export default function IntertemporalChoiceWidget() {
  const [r, setR] = useState(0.2);
  const [y1, setY1] = useState(1.25);
  const [y2, setY2] = useState(1.05);
  const [beta, setBeta] = useState(0.95);
  const [allowBorrowing, setAllowBorrowing] = useState(true);
  const [showContours, setShowContours] = useState(true);
  const [traceCurve, setTraceCurve] = useState(true);

  const setBorrowingCase = () => {
    setAllowBorrowing(true);
    setR(0.08);
    setY1(0.8);
    setY2(1.65);
    setBeta(0.98);
  };

  const setSavingCase = () => {
    setAllowBorrowing(true);
    setR(0.2);
    setY1(1.55);
    setY2(0.8);
    setBeta(0.92);
  };

  const solution = useMemo(() => solveChoice(r, y1, y2, beta, allowBorrowing), [r, y1, y2, beta, allowBorrowing]);
  const budgetPoints = useMemo(() => budgetLine(y1, y2, r, allowBorrowing), [y1, y2, r, allowBorrowing]);

  const xMax = c1AxisMax;
  const yMax = c2AxisMax;

  const scaleX = useMemo(() => makeScale(0, xMax, plot.marginLeft, plot.marginLeft + plotWidth), [xMax]);
  const scaleY = useMemo(() => makeScale(0, yMax, plot.height - plot.marginBottom, plot.marginTop), [yMax]);
  const budgetPath = useMemo(() => buildPath(budgetPoints, scaleX, scaleY), [budgetPoints, scaleX, scaleY]);

  const contourLevels = useMemo(() => [solution.utility - 0.45, solution.utility - 0.18, solution.utility], [solution.utility]);
  const contourPaths = useMemo(
    () => contourLevels.map((level) => buildPath(indifferenceCurve(level, beta, xMax, yMax), scaleX, scaleY)).filter(Boolean),
    [contourLevels, beta, xMax, yMax, scaleX, scaleY],
  );

  const savingMin = allowBorrowing ? -borrowingLimit : 0;
  const savingMax = Math.max(1.45, y1);
  const savingScaleX = makeScale(savingMin, savingMax, plot.marginLeft, plot.marginLeft + plotWidth);
  const rateScaleY = makeScale(0, 0.8, plot.height - plot.marginBottom, plot.marginTop);

  const savingCurve = useMemo(
    () =>
      sampleRange(rMin, rMax, 70).map((rate) => {
        const result = solveChoice(rate, y1, y2, beta, allowBorrowing);
        return { x: result.saving, y: rate };
      }),
    [y1, y2, beta, allowBorrowing],
  );

  const savingPath = useMemo(() => buildPath(savingCurve, savingScaleX, rateScaleY), [savingCurve]);
  const lhs = 1 / Math.max(solution.c1, 1e-8);
  const rhs = (beta * (1 + r)) / Math.max(solution.c2, 1e-8);

  return (
    <section className={`${styles.widget} not-content`} aria-label="期間間選択と貯蓄供給曲線の対応">
      <header className={styles.header}>
        <div>
          <h3>2期間の家計問題: Euler 方程式から貯蓄供給曲線へ</h3>
          <p>左は今日と明日の消費配分、右は利子率ごとの最適貯蓄を並べた貯蓄供給曲線です。</p>
        </div>
        <span className={styles.badge}>intertemporal choice</span>
      </header>

      <div className={styles.controlsGrid}>
        <fieldset className={styles.fieldset}>
          <legend>パラメータ</legend>
          <div className={styles.sliderStack}>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>利子率 <MathInline math="r" /></span>
                <span className={styles.sliderValue}>{formatNumber(r)}</span>
              </span>
              <input type="range" min={rMin} max={rMax} step="0.01" value={r} onChange={(event) => setR(Number(event.target.value))} />
            </label>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>第1期所得 <MathInline math="y_1" /></span>
                <span className={styles.sliderValue}>{formatNumber(y1)}</span>
              </span>
              <input type="range" min={y1Min} max={y1Max} step="0.01" value={y1} onChange={(event) => setY1(Number(event.target.value))} />
            </label>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>第2期所得 <MathInline math="y_2" /></span>
                <span className={styles.sliderValue}>{formatNumber(y2)}</span>
              </span>
              <input type="range" min={y2Min} max={y2Max} step="0.01" value={y2} onChange={(event) => setY2(Number(event.target.value))} />
            </label>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>割引因子 <MathInline math="\beta" /></span>
                <span className={styles.sliderValue}>{formatNumber(beta)}</span>
              </span>
              <input type="range" min="0.5" max="1.05" step="0.01" value={beta} onChange={(event) => setBeta(Number(event.target.value))} />
            </label>
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>表示</legend>
          <div className={styles.choiceGroup}>
            <label className={styles.choiceLabel}>
              <input type="checkbox" checked={allowBorrowing} onChange={() => setAllowBorrowing((current) => !current)} />
              <span>借入を許す</span>
            </label>
            <label className={styles.choiceLabel}>
              <input type="checkbox" checked={showContours} onChange={() => setShowContours((current) => !current)} />
              <span>無差別曲線を表示</span>
            </label>
            <label className={styles.choiceLabel}>
              <input type="checkbox" checked={traceCurve} onChange={() => setTraceCurve((current) => !current)} />
              <span>貯蓄供給曲線をたどる</span>
            </label>
          </div>
          <p className={styles.smallNote}>
            左では <MathInline math="u(c_1)+\beta u(c_2)" />、右では利子率ごとに最適な <MathInline math="a" /> を数値的に解いています。
            <MathInline math="a<0" /> は借入、<MathInline math="a>0" /> は貯蓄です。
          </p>
          <div className={styles.presetButtons} aria-label="2期間選択の例を切り替える">
            <button type="button" className={styles.presetButton} onClick={setBorrowingCase}>
              借入ケース
            </button>
            <button type="button" className={styles.presetButton} onClick={setSavingCase}>
              貯蓄ケース
            </button>
          </div>
        </fieldset>
      </div>

      <div className={styles.chartGrid2}>
        <article className={styles.chartPanel}>
          <h4>選択空間: <MathInline math="c_1" /> と <MathInline math="c_2" /></h4>
          <p>
            <MathInline math="y_2" /> は予算線を上に動かし、<MathInline math="y_1" /> は所得点を右に動かします。
            <MathInline math="r" /> は所得点 <MathInline math="(y_1,y_2)" /> を支点に傾きを変えます。
            <MathInline math="y_1" /> を下げると、<MathInline math="y_2" /> そのものではなく縦軸切片
            <MathInline math="y_2+(1+r)y_1" /> が下がります。
          </p>
          <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="2期間の消費配分">
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
            {allowBorrowing ? (
              <>
                <rect
                  className={styles.borrowingRegion}
                  x={scaleX(y1)}
                  y={plot.marginTop}
                  width={scaleX(c1AxisMax) - scaleX(y1)}
                  height={plotHeight}
                />
                <line className={styles.zeroAxis} x1={scaleX(y1)} y1={plot.height - plot.marginBottom} x2={scaleX(y1)} y2={plot.marginTop} />
                <text className={styles.pointLabel} x={scaleX(y1) + 2.2} y={plot.marginTop + 5}>
                  a &lt; 0
                </text>
              </>
            ) : null}
            <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>第1期消費 c1</text>
            <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>第2期消費 c2</text>
            {showContours
              ? contourPaths.map((path, index) => (
                  <path key={`contour-${index}`} className={index === contourPaths.length - 1 ? styles.secondaryCurve : styles.tertiaryCurve} d={path} />
                ))
              : null}
            <path className={styles.constraintLine} d={budgetPath} />
            <line className={styles.endowmentGuide} x1={plot.marginLeft} y1={scaleY(y2)} x2={scaleX(y1)} y2={scaleY(y2)} />
            <line className={styles.endowmentGuide} x1={scaleX(y1)} y1={plot.height - plot.marginBottom} x2={scaleX(y1)} y2={scaleY(y2)} />
            <text className={styles.pointLabel} x={plot.marginLeft + 1.8} y={scaleY(y2) - 2}>
              c2 = y2
            </text>
            <circle className={styles.endowmentPoint} cx={scaleX(y1)} cy={scaleY(y2)} r="2" />
            <text className={styles.pointLabel} x={scaleX(y1) + 2.3} y={scaleY(y2) + 4}>初期点</text>
            <circle className={styles.currentPoint} cx={scaleX(solution.c1)} cy={scaleY(solution.c2)} r="2.25" />
            <text className={styles.pointLabel} x={scaleX(solution.c1) + 2.3} y={scaleY(solution.c2) - 3}>最適点</text>
          </svg>
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.secondarySwatch}`} />
              無差別曲線
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendLine} style={{ background: 'color-mix(in srgb, var(--sl-color-text) 55%, white)' }} />
              生涯予算線
            </span>
          </div>
        </article>

        <article className={styles.chartPanel}>
          <h4>市場空間: 家計の貯蓄供給</h4>
          <p>各点は「その利子率で家計がどれだけ貯蓄したいか」を表します。</p>
          <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="貯蓄供給曲線">
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
            {allowBorrowing ? <line className={styles.zeroAxis} x1={savingScaleX(0)} y1={plot.height - plot.marginBottom} x2={savingScaleX(0)} y2={plot.marginTop} /> : null}
            {allowBorrowing ? (
              <rect
                className={styles.borrowingRegion}
                x={plot.marginLeft}
                y={plot.marginTop}
                width={savingScaleX(0) - plot.marginLeft}
                height={plotHeight}
              />
            ) : null}
            <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>貯蓄 a</text>
            <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>利子率 r</text>
            {traceCurve ? <path className={styles.primaryCurve} d={savingPath} /> : null}
            <line className={styles.zeroAxis} x1={savingScaleX(solution.saving)} y1={plot.height - plot.marginBottom} x2={savingScaleX(solution.saving)} y2={rateScaleY(r)} />
            <line className={styles.zeroAxis} x1={plot.marginLeft} y1={rateScaleY(r)} x2={savingScaleX(solution.saving)} y2={rateScaleY(r)} />
            <circle className={styles.currentPointAlt} cx={savingScaleX(solution.saving)} cy={rateScaleY(r)} r="2.35" />
            <text className={styles.pointLabel} x={savingScaleX(solution.saving) + 2.4} y={rateScaleY(r) - 3}>現在の r</text>
          </svg>
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.primarySwatch}`} />
              貯蓄供給曲線
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.tertiarySwatch}`} />
              現在の点
            </span>
          </div>
        </article>
      </div>

      <section className={styles.summaryBox} aria-live="polite">
        <p className={styles.summaryLead}>
          FOC は <MathInline math="u'(c_1)=\beta(1+r)u'(c_2)" /> です。左の最適点を利子率ごとに解き直すと、右の貯蓄供給曲線になります。
        </p>
        <div className={`${styles.metricGrid} ${styles.metricGrid3}`}>
          <div className={styles.metricCard}>
            <h4>現在の最適配分</h4>
            <dl>
              <div><dt><MathInline math="c_1^*" /></dt><dd>{formatNumber(solution.c1)}</dd></div>
              <div><dt><MathInline math="c_2^*" /></dt><dd>{formatNumber(solution.c2)}</dd></div>
              <div><dt>貯蓄 <MathInline math="a^*" /></dt><dd>{formatNumber(solution.saving)}</dd></div>
            </dl>
          </div>
          <div className={styles.metricCard}>
            <h4>Euler 方程式の両辺</h4>
            <dl>
              <div><dt><MathInline math="u'(c_1)" /></dt><dd>{formatNumber(lhs)}</dd></div>
              <div><dt><MathInline math="\beta(1+r)u'(c_2)" /></dt><dd>{formatNumber(rhs)}</dd></div>
            </dl>
          </div>
          <div className={styles.metricCard}>
            <h4>パラメータ</h4>
            <dl>
              <div><dt><MathInline math="y_1" /></dt><dd>{formatNumber(y1)}</dd></div>
              <div><dt><MathInline math="y_2" /></dt><dd>{formatNumber(y2)}</dd></div>
              <div><dt><MathInline math="\beta" /></dt><dd>{formatNumber(beta)}</dd></div>
            </dl>
          </div>
        </div>
        <p className={styles.note}>利子率は期間間の相対価格です。高い利子率は「今の消費を先送りする見返り」を大きくし、その結果として最適貯蓄が変わります。</p>
      </section>
    </section>
  );
}
