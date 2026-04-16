import { useMemo, useState } from 'react';
import styles from './HouseholdChoiceWidgets.module.css';
import { argmaxGrid, buildPath, crraUtility, formatNumber, marginalUtility, sampleRange } from './householdChoiceShared';
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
const meanIncome = 1.1;
const minConsumption = 0.03;
const boundaryTolerance = 0.005;

type Solution = {
  saving: number;
  c1: number;
  c2Good: number;
  c2Bad: number;
  expectedUtility: number;
};

function makeScale(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number) {
  return (value: number) => rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
}

function scaleBand(index: number) {
  return plot.marginLeft + 16 + index * 30;
}

function stateIncomes(risk: number, badProb: number) {
  const yBad = Math.max(0.15, meanIncome - risk);
  const yGood = (meanIncome - badProb * yBad) / Math.max(1 - badProb, 1e-6);
  return { yGood, yBad };
}

function lowerBoundWithBorrowing(r: number, yBad: number) {
  return (minConsumption - yBad) / (1 + r);
}

function solveChoice(
  r: number,
  y1: number,
  beta: number,
  sigma: number,
  risk: number,
  badProb: number,
  options?: { allowBorrowing?: boolean },
): Solution {
  const { yGood, yBad } = stateIncomes(risk, badProb);
  const allowBorrowing = options?.allowBorrowing ?? false;
  const lower = allowBorrowing ? lowerBoundWithBorrowing(r, yBad) : 0;
  const upper = y1 - minConsumption;

  const best = argmaxGrid(lower, upper, 900, (saving) => {
    const c1 = y1 - saving;
    const c2Good = yGood + (1 + r) * saving;
    const c2Bad = yBad + (1 + r) * saving;
    if (c1 <= minConsumption || c2Good <= minConsumption || c2Bad <= minConsumption) {
      return Number.NEGATIVE_INFINITY;
    }

    return crraUtility(c1, sigma) + beta * ((1 - badProb) * crraUtility(c2Good, sigma) + badProb * crraUtility(c2Bad, sigma));
  });

  return {
    saving: best.x,
    c1: y1 - best.x,
    c2Good: yGood + (1 + r) * best.x,
    c2Bad: yBad + (1 + r) * best.x,
    expectedUtility: best.value,
  };
}

export default function UncertainSavingWidget() {
  const [r, setR] = useState(0.2);
  const [y1, setY1] = useState(1.35);
  const [beta, setBeta] = useState(0.96);
  const [sigma, setSigma] = useState(2.0);
  const [risk, setRisk] = useState(0.32);
  const [badProb, setBadProb] = useState(0.3);

  const incomes = useMemo(() => stateIncomes(risk, badProb), [risk, badProb]);
  const lowRisk = Math.max(0.06, risk * 0.35);

  const solution = useMemo(() => solveChoice(r, y1, beta, sigma, risk, badProb), [r, y1, beta, sigma, risk, badProb]);
  const unconstrainedSolution = useMemo(
    () => solveChoice(r, y1, beta, sigma, risk, badProb, { allowBorrowing: true }),
    [r, y1, beta, sigma, risk, badProb],
  );
  const lowRiskSolution = useMemo(() => solveChoice(r, y1, beta, sigma, lowRisk, badProb), [r, y1, beta, sigma, lowRisk, badProb]);

  const currentLhs = marginalUtility(solution.c1, sigma);
  const currentRhs = beta * (1 + r) * ((1 - badProb) * marginalUtility(solution.c2Good, sigma) + badProb * marginalUtility(solution.c2Bad, sigma));
  const kktGap = currentLhs - currentRhs;
  const borrowingConstraintBinds = solution.saving <= boundaryTolerance && unconstrainedSolution.saving < -boundaryTolerance;
  const isInterior = solution.saving > boundaryTolerance;

  const eulerDomainMin = useMemo(() => {
    if (!borrowingConstraintBinds) {
      return 0;
    }
    return Math.min(lowerBoundWithBorrowing(r, incomes.yBad), unconstrainedSolution.saving * 1.15 - 0.01);
  }, [borrowingConstraintBinds, r, incomes.yBad, unconstrainedSolution.saving]);

  const eulerGrid = useMemo(
    () =>
      sampleRange(eulerDomainMin, y1 - minConsumption, 220).map((saving) => {
        const c1 = y1 - saving;
        const c2Good = incomes.yGood + (1 + r) * saving;
        const c2Bad = incomes.yBad + (1 + r) * saving;
        return {
          saving,
          lhs: marginalUtility(c1, sigma),
          rhs: beta * (1 + r) * ((1 - badProb) * marginalUtility(c2Good, sigma) + badProb * marginalUtility(c2Bad, sigma)),
        };
      }),
    [eulerDomainMin, y1, incomes, r, sigma, beta, badProb],
  );

  const maxEulerY = Math.max(...eulerGrid.map((point) => Math.max(point.lhs, point.rhs))) * 1.05;
  const eulerScaleX = makeScale(eulerDomainMin, y1, plot.marginLeft, plot.marginLeft + plotWidth);
  const eulerScaleY = makeScale(0, maxEulerY, plot.height - plot.marginBottom, plot.marginTop);
  const lhsPath = buildPath(
    eulerGrid.map((point) => ({ x: point.saving, y: point.lhs })),
    eulerScaleX,
    eulerScaleY,
  );
  const rhsPath = buildPath(
    eulerGrid.map((point) => ({ x: point.saving, y: point.rhs })),
    eulerScaleX,
    eulerScaleY,
  );

  const supplyCurveHigh = useMemo(
    () =>
      sampleRange(0.01, 0.8, 70).map((rate) => {
        const result = solveChoice(rate, y1, beta, sigma, risk, badProb);
        return { x: result.saving, y: rate };
      }),
    [y1, beta, sigma, risk, badProb],
  );

  const supplyCurveLow = useMemo(
    () =>
      sampleRange(0.01, 0.8, 70).map((rate) => {
        const result = solveChoice(rate, y1, beta, sigma, lowRisk, badProb);
        return { x: result.saving, y: rate };
      }),
    [y1, beta, sigma, lowRisk, badProb],
  );

  const savingScaleX = makeScale(0, y1, plot.marginLeft, plot.marginLeft + plotWidth);
  const rateScaleY = makeScale(0, 0.8, plot.height - plot.marginBottom, plot.marginTop);
  const supplyPathHigh = buildPath(supplyCurveHigh, savingScaleX, rateScaleY);
  const supplyPathLow = buildPath(supplyCurveLow, savingScaleX, rateScaleY);

  const barScaleY = makeScale(0, Math.max(solution.c2Good, solution.c2Bad, 2.0), plot.height - plot.marginBottom, plot.marginTop);
  const zeroEulerX = eulerScaleX(0);
  const zeroSavingX = savingScaleX(0);
  const unconstrainedVisibleX = borrowingConstraintBinds ? eulerScaleX(unconstrainedSolution.saving) : null;

  return (
    <section className={`${styles.widget} not-content`} aria-label="不確実性下の消費貯蓄選択と借入制約">
      <header className={styles.header}>
        <div>
          <h3>不確実性下の 2 期間問題: 借入制約つきの期待 Euler 条件</h3>
          <p>
            借入制約 <MathInline math="a \ge 0" /> があると、無制約なら借り入れを選ぶ家計でも、最適点は境界
            <MathInline math="a=0" /> に張り付きます。そのとき期待 Euler 方程式（期待オイラー方程式）は等号ではなく不等号になります。
          </p>
        </div>
        <span className={styles.badge}>借入制約あり</span>
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
              <input type="range" min="0.01" max="0.8" step="0.01" value={r} onChange={(event) => setR(Number(event.target.value))} />
            </label>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>第1期所得 <MathInline math="y_1" /></span>
                <span className={styles.sliderValue}>{formatNumber(y1)}</span>
              </span>
              <input type="range" min="0.8" max="1.9" step="0.01" value={y1} onChange={(event) => setY1(Number(event.target.value))} />
            </label>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>リスク水準</span>
                <span className={styles.sliderValue}>{formatNumber(risk)}</span>
              </span>
              <input type="range" min="0.06" max="0.45" step="0.01" value={risk} onChange={(event) => setRisk(Number(event.target.value))} />
            </label>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>悪い状態の確率</span>
                <span className={styles.sliderValue}>{formatNumber(badProb)}</span>
              </span>
              <input type="range" min="0.15" max="0.45" step="0.01" value={badProb} onChange={(event) => setBadProb(Number(event.target.value))} />
            </label>
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>選好</legend>
          <div className={styles.sliderStack}>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>割引因子 <MathInline math="\beta" /></span>
                <span className={styles.sliderValue}>{formatNumber(beta)}</span>
              </span>
              <input type="range" min="0.55" max="1.05" step="0.01" value={beta} onChange={(event) => setBeta(Number(event.target.value))} />
            </label>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>危険回避度 <MathInline math="\sigma" /></span>
                <span className={styles.sliderValue}>{formatNumber(sigma)}</span>
              </span>
              <input type="range" min="1" max="4" step="0.05" value={sigma} onChange={(event) => setSigma(Number(event.target.value))} />
            </label>
          </div>
          <p className={styles.smallNote}>
            平均的な第2期所得は一定（<MathInline math={`E[y_2]=${formatNumber(meanIncome)}`} />）に保ち、リスクだけを動かしています。負の貯蓄は許していません。
          </p>
        </fieldset>
      </div>

      <div className={styles.chartGrid3}>
        <article className={styles.chartPanel}>
          <h4>状態別の第2期消費</h4>
          <p>最適貯蓄のもとで、良い状態（good state）と悪い状態（bad state）で明日の消費がどう分かれるかを見ます。</p>
          <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="状態別の第2期消費">
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
            <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>状態</text>
            <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>第2期消費</text>
            <rect className={styles.barGood} x={scaleBand(0)} y={barScaleY(solution.c2Good)} width={18} height={plot.height - plot.marginBottom - barScaleY(solution.c2Good)} rx="2" />
            <rect className={styles.barBad} x={scaleBand(1)} y={barScaleY(solution.c2Bad)} width={18} height={plot.height - plot.marginBottom - barScaleY(solution.c2Bad)} rx="2" />
            <text className={styles.barLabel} x={scaleBand(0) + 9} y={plot.height - 6} textAnchor="middle">good</text>
            <text className={styles.barLabel} x={scaleBand(1) + 9} y={plot.height - 6} textAnchor="middle">bad</text>
            <text className={styles.pointLabel} x={scaleBand(0) + 9} y={barScaleY(solution.c2Good) - 2} textAnchor="middle">{formatNumber(solution.c2Good)}</text>
            <text className={styles.pointLabel} x={scaleBand(1) + 9} y={barScaleY(solution.c2Bad) - 2} textAnchor="middle">{formatNumber(solution.c2Bad)}</text>
          </svg>
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}>
              <span className={`${styles.legendBar} ${styles.primarySwatch}`} />
              良い状態（good state）
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendBar} ${styles.secondarySwatch}`} />
              悪い状態（bad state）
            </span>
          </div>
        </article>

        <article className={styles.chartPanel}>
          <h4>期待 Euler 条件と借入制約</h4>
          <p>
            交点が <MathInline math="a=0" /> の右にあれば内部解です。交点が左の借入領域にあるときは、実際の最適点は境界
            <MathInline math="a=0" /> になり、期待 Euler 不等式（期待オイラー不等式）が成り立ちます。
          </p>
          <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="期待 Euler 条件と借入制約の図">
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
            <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>貯蓄 a</text>
            <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>限界効用</text>
            {borrowingConstraintBinds ? (
              <rect
                x={plot.marginLeft}
                y={plot.marginTop}
                width={Math.max(0, zeroEulerX - plot.marginLeft)}
                height={plotHeight}
                rx="1"
                style={{ fill: 'rgba(234, 88, 12, 0.08)' }}
              />
            ) : null}
            <path className={styles.primaryCurve} d={lhsPath} />
            <path className={styles.secondaryCurve} d={rhsPath} />
            <line className={styles.zeroAxis} x1={zeroEulerX} y1={plot.height - plot.marginBottom} x2={zeroEulerX} y2={plot.marginTop} />
            <text className={styles.pointLabel} x={zeroEulerX + 1.8} y={plot.marginTop + 6}>a = 0</text>
            {borrowingConstraintBinds && unconstrainedVisibleX !== null ? (
              <>
                <circle className={styles.currentPoint} cx={unconstrainedVisibleX} cy={eulerScaleY(marginalUtility(unconstrainedSolution.c1, sigma))} r="1.9" />
                <text className={styles.pointLabel} x={unconstrainedVisibleX + 2} y={eulerScaleY(marginalUtility(unconstrainedSolution.c1, sigma)) - 3}>
                  無制約ならここ
                </text>
              </>
            ) : null}
            <line className={styles.zeroAxis} x1={eulerScaleX(solution.saving)} y1={plot.height - plot.marginBottom} x2={eulerScaleX(solution.saving)} y2={eulerScaleY(currentLhs)} />
            <circle className={styles.currentPointAlt} cx={eulerScaleX(solution.saving)} cy={eulerScaleY(currentLhs)} r="2.35" />
            <text className={styles.pointLabel} x={eulerScaleX(solution.saving) + 2.3} y={eulerScaleY(currentLhs) - 3}>
              {borrowingConstraintBinds ? '境界解 a*=0' : '最適 a*'}
            </text>
          </svg>
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.primarySwatch}`} />
              <MathInline math="u'(c_1)" />
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.secondarySwatch}`} />
              <MathInline math="\beta(1+r)E[u'(c_2)]" />
            </span>
            {borrowingConstraintBinds ? (
              <span className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles.tertiarySwatch}`} />
                無制約最適点
              </span>
            ) : null}
          </div>
        </article>

        <article className={styles.chartPanel}>
          <h4>市場空間: リスクで動く貯蓄供給</h4>
          <p>低リスクと現在のリスクを比べると、同じ利子率でも望ましい貯蓄量が変わります。借入制約があるので、曲線は <MathInline math="a=0" /> に張り付くことがあります。</p>
          <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="リスクでシフトする貯蓄供給曲線">
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
            <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>貯蓄 a</text>
            <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>利子率 r</text>
            <path className={styles.guideCurve} d={supplyPathLow} />
            <path className={styles.primaryCurve} d={supplyPathHigh} />
            <line className={styles.zeroAxis} x1={zeroSavingX} y1={plot.height - plot.marginBottom} x2={zeroSavingX} y2={plot.marginTop} />
            <text className={styles.pointLabel} x={zeroSavingX + 1.8} y={plot.marginTop + 6}>借入不可</text>
            <line className={styles.zeroAxis} x1={savingScaleX(solution.saving)} y1={plot.height - plot.marginBottom} x2={savingScaleX(solution.saving)} y2={rateScaleY(r)} />
            <circle className={styles.currentPointAlt} cx={savingScaleX(solution.saving)} cy={rateScaleY(r)} r="2.35" />
            <circle className={styles.currentPoint} cx={savingScaleX(lowRiskSolution.saving)} cy={rateScaleY(r)} r="1.9" />
          </svg>
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.primarySwatch}`} />
              現在のリスク
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendLine} style={{ background: '#93c5fd' }} />
              低リスク
            </span>
          </div>
        </article>
      </div>

      <section className={styles.summaryBox} aria-live="polite">
        <p className={styles.summaryLead}>
          {borrowingConstraintBinds ? (
            <>
              借入制約 <MathInline math="a \ge 0" /> が有効なので、最適点は境界 <MathInline math="a^*=0" /> にあります。無制約なら借り入れを選びたいので、
              <MathInline math="u'(c_1) > \beta(1+r)E[u'(c_2(s))]" /> という期待 Euler 不等式（期待オイラー不等式）が成り立ちます。
            </>
          ) : (
            <>
              借入制約は緩んでおり、最適点は内部にあります。このときは <MathInline math="u'(c_1) = \beta(1+r)E[u'(c_2(s))]" /> という期待 Euler 方程式（期待オイラー方程式）の等号が成り立ちます。
            </>
          )}
        </p>
        <div className={`${styles.metricGrid} ${styles.metricGrid3}`}>
          <div className={styles.metricCard}>
            <h4>現在の状態</h4>
            <dl>
              <div><dt>最適貯蓄 <MathInline math="a^*" /></dt><dd>{formatNumber(solution.saving)}</dd></div>
              <div><dt>無制約なら</dt><dd>{formatNumber(unconstrainedSolution.saving)}</dd></div>
              <div><dt>制約の状態</dt><dd>{borrowingConstraintBinds ? 'binding（有効）' : isInterior ? 'slack（非有効）' : '境界だが等号に近い'}</dd></div>
            </dl>
          </div>
          <div className={styles.metricCard}>
            <h4>KKT 条件（Karush-Kuhn-Tucker conditions）</h4>
            <dl>
              <div><dt><MathInline math="u'(c_1)" /></dt><dd>{formatNumber(currentLhs)}</dd></div>
              <div><dt><MathInline math="\beta(1+r)E[u'(c_2)]" /></dt><dd>{formatNumber(currentRhs)}</dd></div>
              <div><dt><MathInline math="\mu" /> の大きさ</dt><dd>{formatNumber(Math.max(0, kktGap))}</dd></div>
            </dl>
          </div>
          <div className={styles.metricCard}>
            <h4>状態別所得</h4>
            <dl>
              <div><dt><MathInline math="y_2(\mathrm{good})" /></dt><dd>{formatNumber(incomes.yGood)}</dd></div>
              <div><dt><MathInline math="y_2(\mathrm{bad})" /></dt><dd>{formatNumber(incomes.yBad)}</dd></div>
              <div><dt><MathInline math="\Pr(\mathrm{bad})" /></dt><dd>{formatNumber(badProb)}</dd></div>
            </dl>
          </div>
        </div>
        <p className={styles.note}>
          {borrowingConstraintBinds ? (
            <>
              KKT 条件（Karush-Kuhn-Tucker conditions）の直感はシンプルです。無制約ならもっと左、つまり <MathInline math="a<0" /> に動きたいのに、今回はその方向が許されません。そのため最適点は境界 <MathInline math="a=0" /> に止まり、右へ少し動くと効用が下がるので、
              <MathInline math="u'(c_1) > \beta(1+r)E[u'(c_2(s))]" /> という不等号が残ります。
            </>
          ) : (
            <>
              ここでは制約が緩んでいるので、家計は貯蓄を少し増やす方向にも減らす方向にも動けます。そのため最適点では限界条件がちょうど釣り合い、期待 Euler 方程式（期待オイラー方程式）の等号が成り立ちます。
            </>
          )}
        </p>
      </section>
    </section>
  );
}
