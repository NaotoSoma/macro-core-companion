import { useMemo, useState } from 'react';
import styles from './HouseholdChoiceWidgets.module.css';
import { buildPath, formatNumber, safeLog, sampleRange } from './householdChoiceShared';
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
const leisureMin = 0.04;
const leisureMax = 0.98;
const totalTime = 1;
const wageMin = 0.45;
const wageMax = 2.1;

type Choice = {
  leisure: number;
  labor: number;
  consumption: number;
  utility: number;
};

function scaleX(x: number) {
  return plot.marginLeft + (x / totalTime) * plotWidth;
}

function makeScaleY(maxY: number) {
  return (y: number) => plot.height - plot.marginBottom - (y / maxY) * plotHeight;
}

function utility(consumption: number, leisure: number, psi: number) {
  return safeLog(consumption) + psi * safeLog(leisure);
}

function feasibleLeisureMax(wage: number, nonLaborIncome: number) {
  return Math.min(totalTime, Math.max(0, totalTime + nonLaborIncome / wage));
}

function solveChoice(wage: number, nonLaborIncome: number, psi: number): Choice {
  const interiorLabor = (wage - psi * nonLaborIncome) / (wage * (1 + psi));
  const lowerLaborBound = Math.max(0, -nonLaborIncome / wage);
  const labor = Math.min(totalTime - leisureMin, Math.max(lowerLaborBound, interiorLabor));
  const leisure = totalTime - labor;
  const consumption = wage * labor + nonLaborIncome;
  const utilityValue = consumption > 0 ? utility(consumption, leisure, psi) : Number.NEGATIVE_INFINITY;

  return {
    leisure,
    labor,
    consumption,
    utility: utilityValue,
  };
}

function budgetLinePoints(wage: number, nonLaborIncome: number): Point[] {
  const maxFeasibleLeisure = feasibleLeisureMax(wage, nonLaborIncome);

  return sampleRange(0, maxFeasibleLeisure, 120).map((leisure) => ({
    x: leisure,
    y: Math.max(0, wage * (totalTime - leisure) + nonLaborIncome),
  }));
}

function indifferenceCurve(level: number, psi: number, yMax: number): Point[] {
  return sampleRange(leisureMin, leisureMax, 160)
    .map((leisure) => {
      const consumption = Math.exp(level - psi * Math.log(leisure));
      return { x: leisure, y: consumption };
    })
    .filter((point) => Number.isFinite(point.y) && point.y > 0 && point.y <= yMax * 1.02);
}

export default function IntratemporalChoiceWidget() {
  const [wage, setWage] = useState(1.15);
  const [nonLaborIncome, setNonLaborIncome] = useState(0.35);
  const [psi, setPsi] = useState(1.15);
  const [showContours, setShowContours] = useState(true);
  const [traceSupply, setTraceSupply] = useState(true);

  const choice = useMemo(() => solveChoice(wage, nonLaborIncome, psi), [wage, nonLaborIncome, psi]);

  const yMax = Math.max(wageMax + nonLaborIncome, nonLaborIncome, 1.35);
  const scaleY = useMemo(() => makeScaleY(yMax), [yMax]);
  const budgetEndpoint = useMemo(() => {
    if (nonLaborIncome >= 0) {
      return {
        x: totalTime,
        y: nonLaborIncome,
        label: 'c = T',
      };
    }

    return {
      x: feasibleLeisureMax(wage, nonLaborIncome),
      y: 0,
      label: 'c = 0',
    };
  }, [wage, nonLaborIncome]);

  const budgetPath = useMemo(
    () => buildPath(budgetLinePoints(wage, nonLaborIncome), scaleX, scaleY),
    [wage, nonLaborIncome, scaleY],
  );

  const contourLevels = useMemo(() => [choice.utility - 0.45, choice.utility - 0.2, choice.utility], [choice.utility]);
  const contourPaths = useMemo(
    () => contourLevels.map((level) => buildPath(indifferenceCurve(level, psi, yMax), scaleX, scaleY)).filter(Boolean),
    [contourLevels, psi, yMax, scaleY],
  );

  const supplyPoints = useMemo(
    () =>
      sampleRange(wageMin, wageMax, 90).map((currentWage) => {
        const result = solveChoice(currentWage, nonLaborIncome, psi);
        return { x: result.labor, y: currentWage };
      }),
    [nonLaborIncome, psi],
  );

  const interiorSupplyPoints = useMemo(() => supplyPoints.filter((point) => point.x > 0.001), [supplyPoints]);
  const cornerSupplyPoints = useMemo(() => {
    if (nonLaborIncome <= 0) {
      return [];
    }

    const reservationWage = psi * nonLaborIncome;
    if (reservationWage <= wageMin) {
      return [];
    }

    return [
      { x: 0, y: wageMin },
      { x: 0, y: Math.min(wageMax, reservationWage) },
    ];
  }, [nonLaborIncome, psi]);

  const supplyScaleY = (value: number) => plot.height - plot.marginBottom - ((value - wageMin) / (wageMax - wageMin)) * plotHeight;
  const supplyScaleX = (value: number) => plot.marginLeft + (value / totalTime) * plotWidth;
  const supplyPath = useMemo(() => buildPath(interiorSupplyPoints, supplyScaleX, supplyScaleY), [interiorSupplyPoints]);
  const cornerSupplyPath = useMemo(() => buildPath(cornerSupplyPoints, supplyScaleX, supplyScaleY), [cornerSupplyPoints]);
  const currentMRS = (psi * choice.consumption) / Math.max(choice.leisure, 1e-6);

  return (
    <section className={`${styles.widget} not-content`} aria-label="期内選択と労働供給曲線の対応">
      <header className={styles.header}>
        <div>
          <h3>1期間の家計問題: 期内選択から労働供給曲線へ</h3>
          <p>左で最適点を、右でその最適点を賃金ごとに並べた労働供給曲線を見ます。</p>
        </div>
        <span className={styles.badge}>intratemporal choice</span>
      </header>

      <div className={styles.controlsGrid}>
        <fieldset className={styles.fieldset}>
          <legend>パラメータ</legend>
          <div className={styles.sliderStack}>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>賃金 <MathInline math="w" /></span>
                <span className={styles.sliderValue}>{formatNumber(wage)}</span>
              </span>
              <input type="range" min="0.45" max="2.1" step="0.01" value={wage} onChange={(event) => setWage(Number(event.target.value))} />
            </label>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>非労働所得 <MathInline math="T" /></span>
                <span className={styles.sliderValue}>{formatNumber(nonLaborIncome)}</span>
              </span>
              <input type="range" min="-0.35" max="1.1" step="0.01" value={nonLaborIncome} onChange={(event) => setNonLaborIncome(Number(event.target.value))} />
            </label>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>余暇選好 <MathInline math="\psi" /></span>
                <span className={styles.sliderValue}>{formatNumber(psi)}</span>
              </span>
              <input type="range" min="0.4" max="2.4" step="0.01" value={psi} onChange={(event) => setPsi(Number(event.target.value))} />
            </label>
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>表示</legend>
          <div className={styles.choiceGroup}>
            <label className={styles.choiceLabel}>
              <input type="checkbox" checked={showContours} onChange={() => setShowContours((current) => !current)} />
              <span>無差別曲線を表示</span>
            </label>
            <label className={styles.choiceLabel}>
              <input type="checkbox" checked={traceSupply} onChange={() => setTraceSupply((current) => !current)} />
              <span>労働供給曲線をたどる</span>
            </label>
          </div>
          <p className={styles.smallNote}>
            この widget では <MathInline math="u(c,l)=\log c+\psi \log l" />、
            <MathInline math="c=w(1-l)+T" /> を数値的に解いています。<MathInline math="T>0" /> なら
            <MathInline math="l=1" /> でも <MathInline math="c=T" />、<MathInline math="T<0" /> なら
            消費が非負になる範囲だけが実行可能です。
          </p>
        </fieldset>
      </div>

      <div className={styles.chartGrid2}>
        <article className={styles.chartPanel}>
          <h4>選択空間: 消費と余暇</h4>
          <p>最適点では、余暇 1 単位の限界価値と、それを働いて消費に変える価値がつり合います。</p>
          <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="消費と余暇の図">
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
            <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>余暇 l</text>
            <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>消費 c</text>

            {showContours
              ? contourPaths.map((path, index) => (
                  <path key={`contour-${contourLevels[index]}`} className={index === contourPaths.length - 1 ? styles.secondaryCurve : styles.tertiaryCurve} d={path} />
                ))
              : null}

            <path className={styles.constraintLine} d={budgetPath} />
            {nonLaborIncome > 0 ? (
              <line
                className={styles.budgetIncomeGuide}
                x1={scaleX(totalTime)}
                y1={plot.height - plot.marginBottom}
                x2={scaleX(totalTime)}
                y2={scaleY(nonLaborIncome)}
              />
            ) : null}
            <circle className={styles.budgetEndpoint} cx={scaleX(budgetEndpoint.x)} cy={scaleY(budgetEndpoint.y)} r="1.9" />
            <text
              className={styles.pointLabel}
              x={scaleX(budgetEndpoint.x) - 2.2}
              y={scaleY(budgetEndpoint.y) - 3}
              textAnchor="end"
            >
              {budgetEndpoint.label}
            </text>
            <circle className={styles.currentPoint} cx={scaleX(choice.leisure)} cy={scaleY(choice.consumption)} r="2.25" />
            <text className={styles.pointLabel} x={scaleX(choice.leisure) + 2.4} y={scaleY(choice.consumption) - 3}>最適点</text>
          </svg>
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.secondarySwatch}`} />
              無差別曲線
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendLine} style={{ background: 'color-mix(in srgb, var(--sl-color-text) 55%, white)' }} />
              予算線
            </span>
            <span className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: 'color-mix(in srgb, var(--sl-color-text) 90%, black)' }} />
              最適点
            </span>
          </div>
        </article>

        <article className={styles.chartPanel}>
          <h4>市場空間: 労働供給曲線</h4>
          <p>
            右の各点は「その賃金で家計が何時間働くか」を表しています。横軸は余暇ではなく、<MathInline math="n=1-l" /> です。
            <MathInline math="T" /> が大きいと、低い賃金では働かない端点解 <MathInline math="n=0" /> が出ます。
          </p>
          <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="労働供給曲線の図">
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
            <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>労働時間 n</text>
            <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>賃金 w</text>

            {traceSupply ? (
              <>
                <path className={styles.primaryCurve} d={supplyPath} />
                {cornerSupplyPath ? <path className={styles.cornerSupplyCurve} d={cornerSupplyPath} /> : null}
                {cornerSupplyPath ? (
                  <text className={styles.pointLabel} x={supplyScaleX(0) + 2.2} y={supplyScaleY(cornerSupplyPoints.at(-1)?.y ?? wageMin) - 2}>
                    n = 0
                  </text>
                ) : null}
              </>
            ) : null}
            <line className={styles.zeroAxis} x1={supplyScaleX(choice.labor)} y1={plot.height - plot.marginBottom} x2={supplyScaleX(choice.labor)} y2={supplyScaleY(wage)} />
            <line className={styles.zeroAxis} x1={plot.marginLeft} y1={supplyScaleY(wage)} x2={supplyScaleX(choice.labor)} y2={supplyScaleY(wage)} />
            <circle className={styles.currentPointAlt} cx={supplyScaleX(choice.labor)} cy={supplyScaleY(wage)} r="2.35" />
            <text className={styles.pointLabel} x={supplyScaleX(choice.labor) + 2.4} y={supplyScaleY(wage) - 3}>現在の w</text>
          </svg>
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.primarySwatch}`} />
              労働供給曲線
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
          FOC の中身は <MathInline math="\mathrm{MRS}_{l,c}=w" /> です。左の最適点を賃金ごとに並べ直すと、右の労働供給曲線が得られます。
        </p>
        <div className={`${styles.metricGrid} ${styles.metricGrid3}`}>
          <div className={styles.metricCard}>
            <h4>現在の最適配分</h4>
            <dl>
              <div><dt>労働時間 <MathInline math="n^*" /></dt><dd>{formatNumber(choice.labor)}</dd></div>
              <div><dt>余暇 <MathInline math="l^*" /></dt><dd>{formatNumber(choice.leisure)}</dd></div>
              <div><dt>消費 <MathInline math="c^*" /></dt><dd>{formatNumber(choice.consumption)}</dd></div>
            </dl>
          </div>
          <div className={styles.metricCard}>
            <h4>FOC の両辺</h4>
            <dl>
              <div><dt><MathInline math="\mathrm{MRS}_{l,c}" /></dt><dd>{formatNumber(currentMRS)}</dd></div>
              <div><dt>賃金 <MathInline math="w" /></dt><dd>{formatNumber(wage)}</dd></div>
            </dl>
          </div>
          <div className={styles.metricCard}>
            <h4>読み取り</h4>
            <dl>
              <div><dt>非労働所得 <MathInline math="T" /></dt><dd>{formatNumber(nonLaborIncome)}</dd></div>
              <div><dt>余暇選好 <MathInline math="\psi" /></dt><dd>{formatNumber(psi)}</dd></div>
            </dl>
          </div>
        </div>
        <p className={styles.note}>この図で見たいのは、「最適化の解が 1 点」で終わらず、価格ごとに解き直すと市場で使う曲線になる、という対応関係です。</p>
      </section>
    </section>
  );
}
