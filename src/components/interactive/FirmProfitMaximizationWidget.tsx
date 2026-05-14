import { useId, useMemo, useState } from 'react';
import styles from './HouseholdChoiceWidgets.module.css';
import { buildPath, clamp, formatNumber, sampleRange } from './householdChoiceShared';

type FirmMode = 'perfect' | 'monopolistic';

type FirmProfitMaximizationWidgetProps = {
  /** Which model this instance should display first. */
  initialMode?: FirmMode;
  /**
   * Set to true only when one widget should allow switching between both models.
   * Lecture pages normally render one widget per section, so the default is false.
   */
  showModeSwitch?: boolean;
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

function makeScale(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number) {
  return (value: number) => rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
}

function marginalCost(y: number, kappa: number, phi: number) {
  return kappa * Math.pow(Math.max(y, 1e-8), phi);
}

function variableCost(y: number, kappa: number, phi: number) {
  return (kappa / (1 + phi)) * Math.pow(Math.max(y, 0), 1 + phi);
}

function inverseDemand(y: number, demandScale: number, epsilon: number) {
  return demandScale * Math.pow(Math.max(y, 1e-8), -1 / epsilon);
}

function marginalRevenue(y: number, demandScale: number, epsilon: number) {
  return (1 - 1 / epsilon) * inverseDemand(y, demandScale, epsilon);
}

function perfectOutput(price: number, kappa: number, phi: number) {
  return Math.pow(Math.max(price / kappa, 1e-8), 1 / phi);
}

function competitiveDemandOutput(demandScale: number, epsilon: number, kappa: number, phi: number) {
  return Math.pow(Math.max(demandScale / kappa, 1e-8), 1 / (phi + 1 / epsilon));
}

function monopolisticOutput(demandScale: number, epsilon: number, kappa: number, phi: number) {
  return Math.pow(Math.max(((1 - 1 / epsilon) * demandScale) / kappa, 1e-8), 1 / (phi + 1 / epsilon));
}

function profit(price: number, y: number, kappa: number, phi: number) {
  return price * y - variableCost(y, kappa, phi);
}

function laborShareFromCostSlope(phi: number) {
  return 1 / (1 + phi);
}


function laborFromOutput(y: number, alpha: number) {
  return Math.pow(Math.max(y, 0), 1 / alpha);
}

function outputFromLabor(n: number, alpha: number) {
  return Math.pow(Math.max(n, 0), alpha);
}

function marginalProduct(n: number, alpha: number) {
  return alpha * Math.pow(Math.max(n, 1e-8), alpha - 1);
}

function valueMarginalProduct(n: number, price: number, alpha: number) {
  return price * marginalProduct(n, alpha);
}

function marginalRevenueProduct(n: number, demandScale: number, epsilon: number, alpha: number) {
  const y = outputFromLabor(n, alpha);
  return marginalRevenue(y, demandScale, epsilon) * marginalProduct(n, alpha);
}

function perfectLaborDemand(wage: number, price: number, alpha: number) {
  return Math.pow(Math.max((price * alpha) / Math.max(wage, 1e-8), 1e-8), 1 / (1 - alpha));
}

function monopolisticLaborDemand(wage: number, demandScale: number, epsilon: number, alpha: number) {
  const coefficient = alpha * (1 - 1 / epsilon) * demandScale;
  const denominator = 1 - alpha * (1 - 1 / epsilon);
  return Math.pow(Math.max(coefficient / Math.max(wage, 1e-8), 1e-8), 1 / denominator);
}

function competitiveProductLaborDemand(wage: number, demandScale: number, epsilon: number, alpha: number, phi: number) {
  const y = Math.pow(Math.max((demandScale * alpha) / Math.max(wage, 1e-8), 1e-8), 1 / (phi + 1 / epsilon));
  return laborFromOutput(y, alpha);
}

function formatMode(mode: FirmMode) {
  return mode === 'perfect' ? '完全競争' : '独占的競争';
}

export default function FirmProfitMaximizationWidget({ initialMode = 'perfect', showModeSwitch = false }: FirmProfitMaximizationWidgetProps) {
  const modeGroupName = useId().replace(/:/g, '');
  const [mode, setMode] = useState<FirmMode>(initialMode);
  const [price, setPrice] = useState(1.15);
  const [demandScale, setDemandScale] = useState(1.7);
  const [epsilon, setEpsilon] = useState(4.0);
  const [wage, setWage] = useState(0.38);
  const [phi, setPhi] = useState(1.25);
  const [showComparison, setShowComparison] = useState(true);

  const alpha = useMemo(() => laborShareFromCostSlope(phi), [phi]);
  const kappa = useMemo(() => wage / Math.max(alpha, 1e-8), [wage, alpha]);

  const perfectY = useMemo(() => perfectOutput(price, kappa, phi), [price, kappa, phi]);
  const perfectMC = marginalCost(perfectY, kappa, phi);
  const perfectProfit = profit(price, perfectY, kappa, phi);

  const monopolyY = useMemo(() => monopolisticOutput(demandScale, epsilon, kappa, phi), [demandScale, epsilon, kappa, phi]);
  const monopolyPrice = inverseDemand(monopolyY, demandScale, epsilon);
  const monopolyMC = marginalCost(monopolyY, kappa, phi);
  const markup = monopolyPrice / Math.max(monopolyMC, 1e-8);
  const markupFormula = epsilon / (epsilon - 1);
  const monopolyProfit = profit(monopolyPrice, monopolyY, kappa, phi);

  const competitiveY = useMemo(() => competitiveDemandOutput(demandScale, epsilon, kappa, phi), [demandScale, epsilon, kappa, phi]);
  const competitivePrice = inverseDemand(competitiveY, demandScale, epsilon);

  const perfectLabor = useMemo(() => perfectLaborDemand(wage, price, alpha), [wage, price, alpha]);
  const monopolyLabor = useMemo(() => monopolisticLaborDemand(wage, demandScale, epsilon, alpha), [wage, demandScale, epsilon, alpha]);
  const competitiveLabor = useMemo(() => competitiveProductLaborDemand(wage, demandScale, epsilon, alpha, phi), [wage, demandScale, epsilon, alpha, phi]);

  const yMax = Math.max(2.2, perfectY, monopolyY, competitiveY) * 1.28;
  const yMin = 0.12;
  const demandAtMin = inverseDemand(yMin, demandScale, epsilon);
  const priceMax = Math.max(price, demandAtMin, monopolyPrice, competitivePrice, marginalCost(yMax, kappa, phi)) * 1.05;

  const scaleX = useMemo(() => makeScale(0, yMax, plot.marginLeft, plot.marginLeft + plotWidth), [yMax]);
  const scaleY = useMemo(() => makeScale(0, priceMax, plot.height - plot.marginBottom, plot.marginTop), [priceMax]);

  const outputGrid = useMemo(() => sampleRange(yMin, yMax, 220), [yMax]);

  const mcPath = useMemo(
    () => buildPath(outputGrid.map((y) => ({ x: y, y: marginalCost(y, kappa, phi) })), scaleX, scaleY),
    [outputGrid, kappa, phi, scaleX, scaleY],
  );

  const demandPath = useMemo(
    () => buildPath(outputGrid.map((y) => ({ x: y, y: inverseDemand(y, demandScale, epsilon) })), scaleX, scaleY),
    [outputGrid, demandScale, epsilon, scaleX, scaleY],
  );

  const mrPath = useMemo(
    () => buildPath(outputGrid.map((y) => ({ x: y, y: marginalRevenue(y, demandScale, epsilon) })), scaleX, scaleY),
    [outputGrid, demandScale, epsilon, scaleX, scaleY],
  );

  const supplyCurve = useMemo(
    () =>
      sampleRange(0.15, priceMax * 0.92, 100).map((candidatePrice) => ({
        x: perfectOutput(candidatePrice, kappa, phi),
        y: candidatePrice,
      })),
    [priceMax, kappa, phi],
  );

  const supplyPath = useMemo(() => buildPath(supplyCurve, scaleX, scaleY), [supplyCurve, scaleX, scaleY]);
  const safePerfectY = clamp(perfectY, 0, yMax);
  const safeMonopolyY = clamp(monopolyY, 0, yMax);
  const safeCompetitiveY = clamp(competitiveY, 0, yMax);

  const laborNMin = 0.08;
  const lowWageForDemand = Math.max(wage * 0.35, 0.04);
  const highLaborAtLowWage = Math.max(
    perfectLaborDemand(lowWageForDemand, price, alpha),
    monopolisticLaborDemand(lowWageForDemand, demandScale, epsilon, alpha),
    competitiveProductLaborDemand(lowWageForDemand, demandScale, epsilon, alpha, phi),
  );
  const laborNMax = Math.max(1.8, perfectLabor, monopolyLabor, competitiveLabor, highLaborAtLowWage) * 1.12;
  const laborGrid = useMemo(() => sampleRange(laborNMin, laborNMax, 220), [laborNMax]);

  const laborWageMax = Math.max(
    wage * 2.4,
    valueMarginalProduct(laborNMin, price, alpha),
    marginalRevenueProduct(laborNMin, demandScale, epsilon, alpha),
  ) * 1.05;
  const laborScaleX = useMemo(() => makeScale(0, laborNMax, plot.marginLeft, plot.marginLeft + plotWidth), [laborNMax]);
  const laborScaleY = useMemo(() => makeScale(0, laborWageMax, plot.height - plot.marginBottom, plot.marginTop), [laborWageMax]);

  const valueMarginalProductPath = useMemo(
    () => buildPath(laborGrid.map((n) => ({ x: n, y: valueMarginalProduct(n, price, alpha) })), laborScaleX, laborScaleY),
    [laborGrid, price, alpha, laborScaleX, laborScaleY],
  );

  const marginalRevenueProductPath = useMemo(
    () => buildPath(laborGrid.map((n) => ({ x: n, y: marginalRevenueProduct(n, demandScale, epsilon, alpha) })), laborScaleX, laborScaleY),
    [laborGrid, demandScale, epsilon, alpha, laborScaleX, laborScaleY],
  );

  const perfectLaborDemandCurve = useMemo(
    () =>
      sampleRange(lowWageForDemand, laborWageMax * 0.92, 120).map((candidateWage) => ({
        x: perfectLaborDemand(candidateWage, price, alpha),
        y: candidateWage,
      })),
    [lowWageForDemand, laborWageMax, price, alpha],
  );

  const monopolyLaborDemandCurve = useMemo(
    () =>
      sampleRange(lowWageForDemand, laborWageMax * 0.92, 120).map((candidateWage) => ({
        x: monopolisticLaborDemand(candidateWage, demandScale, epsilon, alpha),
        y: candidateWage,
      })),
    [lowWageForDemand, laborWageMax, demandScale, epsilon, alpha],
  );

  const competitiveLaborDemandCurve = useMemo(
    () =>
      sampleRange(lowWageForDemand, laborWageMax * 0.92, 120).map((candidateWage) => ({
        x: competitiveProductLaborDemand(candidateWage, demandScale, epsilon, alpha, phi),
        y: candidateWage,
      })),
    [lowWageForDemand, laborWageMax, demandScale, epsilon, alpha, phi],
  );

  const perfectLaborDemandPath = useMemo(
    () => buildPath(perfectLaborDemandCurve, laborScaleX, laborScaleY),
    [perfectLaborDemandCurve, laborScaleX, laborScaleY],
  );
  const monopolyLaborDemandPath = useMemo(
    () => buildPath(monopolyLaborDemandCurve, laborScaleX, laborScaleY),
    [monopolyLaborDemandCurve, laborScaleX, laborScaleY],
  );
  const competitiveLaborDemandPath = useMemo(
    () => buildPath(competitiveLaborDemandCurve, laborScaleX, laborScaleY),
    [competitiveLaborDemandCurve, laborScaleX, laborScaleY],
  );

  const safePerfectLabor = clamp(perfectLabor, 0, laborNMax);
  const safeMonopolyLabor = clamp(monopolyLabor, 0, laborNMax);
  const safeCompetitiveLabor = clamp(competitiveLabor, 0, laborNMax);

  const activeSummary =
    mode === 'perfect'
      ? {
          title: '完全競争の最適点',
          output: perfectY,
          labor: perfectLabor,
          price,
          mc: perfectMC,
          profit: perfectProfit,
          condition: 'p = MC,  pF_n = w',
          interpretation: '価格を所与として受け取り、価格と限界費用が一致するところまで生産します。労働投入で見れば、労働の限界生産物価値と賃金を一致させます。',
        }
      : {
          title: '独占的競争の最適点',
          output: monopolyY,
          labor: monopolyLabor,
          price: monopolyPrice,
          mc: monopolyMC,
          profit: monopolyProfit,
          condition: '価格選択問題。数量空間では MR = MC,  MR·F_n = w',
          interpretation: '企業は価格を選び、需要曲線から販売量が決まります。その価格選択問題を数量空間で表すと、限界収入と限界費用が一致します。労働投入で見れば、限界収入生産物と賃金を一致させます。',
        };

  const headerTitle = mode === 'perfect' ? '完全競争企業の利潤最大化' : '独占的競争企業の利潤最大化';
  const headerDescription =
    mode === 'perfect'
      ? '価格を所与として受け取る企業について、財の供給曲線と労働需要曲線がどのように導かれるかを確認します。'
      : '需要曲線を意識して価格を設定する企業について、マークアップと労働需要がどう変わるかを確認します。';

  return (
    <section className={`${styles.widget} not-content`} aria-label={`${formatMode(mode)}の企業の利潤最大化`}>
      <header className={styles.header}>
        <div>
          <h3>{headerTitle}</h3>
          <p>{headerDescription}</p>
        </div>
        <span className={styles.badge}>{mode === 'perfect' ? 'perfect competition' : 'monopolistic competition'}</span>
      </header>

      <div className={styles.controlsGrid}>
        {showModeSwitch ? (
          <fieldset className={styles.fieldset}>
            <legend>表示モード</legend>
            <div className={styles.choiceGroup} role="radiogroup" aria-label="企業問題の表示モード">
              <label className={styles.choiceLabel}>
                <input type="radio" name={`firm-mode-${modeGroupName}`} value="perfect" checked={mode === 'perfect'} onChange={() => setMode('perfect')} />
                <span>完全競争</span>
              </label>
              <label className={styles.choiceLabel}>
                <input type="radio" name={`firm-mode-${modeGroupName}`} value="monopolistic" checked={mode === 'monopolistic'} onChange={() => setMode('monopolistic')} />
                <span>独占的競争</span>
              </label>
            </div>
            <p className={styles.smallNote}>完全競争では p = MC と pF_n = w、独占的競争では価格選択問題を数量空間に変換して MR = MC と MR·F_n = w を見ます。</p>
          </fieldset>
        ) : null}

        <fieldset className={styles.fieldset}>
          <legend>賃金と生産技術</legend>
          <div className={styles.sliderStack}>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>賃金 w</span>
                <span className={styles.sliderValue}>{formatNumber(wage)}</span>
              </span>
              <input type="range" min="0.08" max="1.2" step="0.01" value={wage} onChange={(event) => setWage(Number(event.target.value))} />
            </label>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>生産技術の曲率 φ</span>
                <span className={styles.sliderValue}>{formatNumber(phi)}</span>
              </span>
              <input type="range" min="0.45" max="2.2" step="0.01" value={phi} onChange={(event) => setPhi(Number(event.target.value))} />
            </label>
          </div>
          <p className={styles.smallNote}>
            労働側では生産関数 y=n^α を用い、α=1/(1+φ) とします。賃金 w が上がると、pF_n(n)=w または MR(F(n))F_n(n)=w の交点が左へ動き、労働需要が減ります。財側の限界費用はこの技術と賃金から MC(y)=(w/α)y^φ として描いています。
          </p>
        </fieldset>

        {mode === 'perfect' ? (
          <fieldset className={styles.fieldset}>
            <legend>完全競争の価格</legend>
            <div className={styles.sliderStack}>
              <label className={styles.sliderRow}>
                <span className={styles.sliderLabel}>
                  <span>市場価格 p</span>
                  <span className={styles.sliderValue}>{formatNumber(price)}</span>
                </span>
                <input type="range" min="0.25" max="2.2" step="0.01" value={price} onChange={(event) => setPrice(Number(event.target.value))} />
              </label>
            </div>
            <p className={styles.smallNote}>価格線と限界費用曲線の交点が、価格を所与とした企業の最適生産量です。</p>
          </fieldset>
        ) : (
          <fieldset className={styles.fieldset}>
            <legend>独占的競争の需要</legend>
            <div className={styles.sliderStack}>
              <label className={styles.sliderRow}>
                <span className={styles.sliderLabel}>
                  <span>需要水準 B</span>
                  <span className={styles.sliderValue}>{formatNumber(demandScale)}</span>
                </span>
                <input type="range" min="0.9" max="2.7" step="0.01" value={demandScale} onChange={(event) => setDemandScale(Number(event.target.value))} />
              </label>
              <label className={styles.sliderRow}>
                <span className={styles.sliderLabel}>
                  <span>需要の弾力性 ε</span>
                  <span className={styles.sliderValue}>{formatNumber(epsilon)}</span>
                </span>
                <input type="range" min="1.4" max="9" step="0.1" value={epsilon} onChange={(event) => setEpsilon(Number(event.target.value))} />
              </label>
              <label className={styles.choiceLabel}>
                <input type="checkbox" checked={showComparison} onChange={() => setShowComparison((current) => !current)} />
                <span>競争的ベンチマークを表示</span>
              </label>
            </div>
            <p className={styles.smallNote}>逆需要は p(y)=By^(-1/ε) として描いています。</p>
          </fieldset>
        )}
      </div>

      {mode === 'perfect' ? (
        <>
          <div className={styles.chartGrid2}>
            <article className={styles.chartPanel}>
              <h4>財の選択空間: 価格線と限界費用</h4>
              <p>価格を所与として受け取る企業は、p = MC(y) を満たすところまで生産します。</p>
              <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="完全競争企業の価格線と限界費用曲線">
                <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
                <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
                <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>生産量 y</text>
                <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>価格・限界費用</text>
                <path className={styles.primaryCurve} d={mcPath} />
                <line className={styles.secondaryCurve} x1={scaleX(0)} y1={scaleY(price)} x2={scaleX(yMax)} y2={scaleY(price)} />
                <line className={styles.zeroAxis} x1={scaleX(safePerfectY)} y1={plot.height - plot.marginBottom} x2={scaleX(safePerfectY)} y2={scaleY(price)} />
                <circle className={styles.currentPointAlt} cx={scaleX(safePerfectY)} cy={scaleY(price)} r="2.4" />
                <text className={styles.pointLabel} x={scaleX(safePerfectY) + 2.4} y={scaleY(price) - 3}>p = MC</text>
              </svg>
              <div className={styles.legend} aria-hidden="true">
                <span className={styles.legendItem}>
                  <span className={`${styles.legendLine} ${styles.primarySwatch}`} />
                  限界費用 MC(y)
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendLine} ${styles.secondarySwatch}`} />
                  市場価格 p
                </span>
              </div>
            </article>

            <article className={styles.chartPanel}>
              <h4>財市場空間: 供給曲線</h4>
              <p>価格を変えながら p = MC(y) を解き直すと、企業の供給曲線が得られます。</p>
              <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="完全競争企業の供給曲線">
                <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
                <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
                <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>生産量 y</text>
                <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>価格 p</text>
                <path className={styles.primaryCurve} d={supplyPath} />
                <line className={styles.zeroAxis} x1={scaleX(safePerfectY)} y1={plot.height - plot.marginBottom} x2={scaleX(safePerfectY)} y2={scaleY(price)} />
                <line className={styles.zeroAxis} x1={plot.marginLeft} y1={scaleY(price)} x2={scaleX(safePerfectY)} y2={scaleY(price)} />
                <circle className={styles.currentPointAlt} cx={scaleX(safePerfectY)} cy={scaleY(price)} r="2.35" />
                <text className={styles.pointLabel} x={scaleX(safePerfectY) + 2.4} y={scaleY(price) - 3}>現在の p</text>
              </svg>
              <div className={styles.legend} aria-hidden="true">
                <span className={styles.legendItem}>
                  <span className={`${styles.legendLine} ${styles.primarySwatch}`} />
                  供給曲線
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.tertiarySwatch}`} />
                  現在の選択
                </span>
              </div>
            </article>
          </div>

          <div className={styles.chartGrid2}>
            <article className={styles.chartPanel}>
              <h4>労働需要の選択空間: 限界生産物価値と賃金</h4>
              <p>労働投入で見ると、企業は pF_n(n)=w を満たすところまで労働を雇います。</p>
              <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="完全競争企業の労働投入選択">
                <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
                <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
                <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>労働投入 n</text>
                <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>限界生産物価値・賃金</text>
                <path className={styles.primaryCurve} d={valueMarginalProductPath} />
                <line className={styles.secondaryCurve} x1={laborScaleX(0)} y1={laborScaleY(wage)} x2={laborScaleX(laborNMax)} y2={laborScaleY(wage)} />
                <line className={styles.zeroAxis} x1={laborScaleX(safePerfectLabor)} y1={plot.height - plot.marginBottom} x2={laborScaleX(safePerfectLabor)} y2={laborScaleY(wage)} />
                <circle className={styles.currentPointAlt} cx={laborScaleX(safePerfectLabor)} cy={laborScaleY(wage)} r="2.4" />
                <text className={styles.pointLabel} x={laborScaleX(safePerfectLabor) + 2.4} y={laborScaleY(wage) - 3}>pF_n = w</text>
              </svg>
              <div className={styles.legend} aria-hidden="true">
                <span className={styles.legendItem}>
                  <span className={`${styles.legendLine} ${styles.primarySwatch}`} />
                  限界生産物価値 pF_n(n)
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendLine} ${styles.secondarySwatch}`} />
                  賃金 w
                </span>
              </div>
            </article>

            <article className={styles.chartPanel}>
              <h4>労働市場空間: 労働需要曲線</h4>
              <p>賃金を変えながら pF_n(n)=w を解き直すと、企業の労働需要曲線が得られます。</p>
              <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="完全競争企業の労働需要曲線">
                <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
                <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
                <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>労働量 n</text>
                <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>実質賃金 w</text>
                <path className={styles.primaryCurve} d={perfectLaborDemandPath} />
                <line className={styles.zeroAxis} x1={laborScaleX(safePerfectLabor)} y1={plot.height - plot.marginBottom} x2={laborScaleX(safePerfectLabor)} y2={laborScaleY(wage)} />
                <line className={styles.zeroAxis} x1={plot.marginLeft} y1={laborScaleY(wage)} x2={laborScaleX(safePerfectLabor)} y2={laborScaleY(wage)} />
                <circle className={styles.currentPointAlt} cx={laborScaleX(safePerfectLabor)} cy={laborScaleY(wage)} r="2.35" />
                <text className={styles.pointLabel} x={laborScaleX(safePerfectLabor) + 2.4} y={laborScaleY(wage) - 3}>現在の w</text>
              </svg>
              <div className={styles.legend} aria-hidden="true">
                <span className={styles.legendItem}>
                  <span className={`${styles.legendLine} ${styles.primarySwatch}`} />
                  労働需要曲線
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.tertiarySwatch}`} />
                  現在の雇用量
                </span>
              </div>
            </article>
          </div>
        </>
      ) : (
        <>
          <div className={styles.chartGrid2}>
            <article className={styles.chartPanel}>
              <h4>価格選択を数量空間で見る: 需要・限界収入・限界費用</h4>
              <p>独占的競争企業は価格 p を選びます。図では、その価格に対応する販売量 y を横軸にして、同じ最適点を MR = MC として表しています。</p>
              <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="独占的競争企業の需要、限界収入、限界費用">
                <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
                <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
                <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>生産量 y</text>
                <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>価格・収入・費用</text>
                <path className={styles.secondaryCurve} d={demandPath} />
                <path className={styles.tertiaryCurve} d={mrPath} />
                <path className={styles.primaryCurve} d={mcPath} />
                {showComparison ? (
                  <g>
                    <line className={styles.zeroAxis} x1={scaleX(safeCompetitiveY)} y1={plot.height - plot.marginBottom} x2={scaleX(safeCompetitiveY)} y2={scaleY(competitivePrice)} />
                    <circle className={styles.currentPoint} cx={scaleX(safeCompetitiveY)} cy={scaleY(competitivePrice)} r="1.9" />
                    <text className={styles.pointLabel} x={scaleX(safeCompetitiveY) + 2.2} y={scaleY(competitivePrice) + 5}>競争的</text>
                  </g>
                ) : null}
                <line className={styles.zeroAxis} x1={scaleX(safeMonopolyY)} y1={plot.height - plot.marginBottom} x2={scaleX(safeMonopolyY)} y2={scaleY(monopolyPrice)} />
                <line className={styles.zeroAxis} x1={plot.marginLeft} y1={scaleY(monopolyPrice)} x2={scaleX(safeMonopolyY)} y2={scaleY(monopolyPrice)} />
                <circle className={styles.currentPointAlt} cx={scaleX(safeMonopolyY)} cy={scaleY(monopolyPrice)} r="2.45" />
                <circle className={styles.currentPoint} cx={scaleX(safeMonopolyY)} cy={scaleY(monopolyMC)} r="1.8" />
                <text className={styles.pointLabel} x={scaleX(safeMonopolyY) + 2.3} y={scaleY(monopolyPrice) - 3}>p_M</text>
                <text className={styles.pointLabel} x={scaleX(safeMonopolyY) + 2.3} y={scaleY(monopolyMC) + 5}>MC</text>
              </svg>
              <div className={styles.legend} aria-hidden="true">
                <span className={styles.legendItem}>
                  <span className={`${styles.legendLine} ${styles.secondarySwatch}`} />
                  需要 p(y)
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendLine} ${styles.tertiarySwatch}`} />
                  限界収入 MR(y)
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendLine} ${styles.primarySwatch}`} />
                  限界費用 MC(y)
                </span>
              </div>
            </article>

            <article className={styles.chartPanel}>
              <h4>財市場の比較: マークアップと数量の歪み</h4>
              <p>独占的競争では、企業が選んだ価格に対して需要曲線上で販売量が決まります。最適価格は限界費用を上回り、対応する販売量は競争的な数量より少なくなります。</p>
              <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="独占的競争と競争的ベンチマークの比較">
                <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
                <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
                <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>生産量 y</text>
                <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>価格</text>
                <path className={styles.secondaryCurve} d={demandPath} />
                <path className={styles.primaryCurve} d={mcPath} />
                <line className={styles.zeroAxis} x1={scaleX(safeMonopolyY)} y1={scaleY(monopolyPrice)} x2={scaleX(safeMonopolyY)} y2={scaleY(monopolyMC)} />
                <circle className={styles.currentPointAlt} cx={scaleX(safeMonopolyY)} cy={scaleY(monopolyPrice)} r="2.35" />
                <circle className={styles.currentPoint} cx={scaleX(safeMonopolyY)} cy={scaleY(monopolyMC)} r="1.9" />
                {showComparison ? (
                  <g>
                    <circle className={styles.currentPoint} cx={scaleX(safeCompetitiveY)} cy={scaleY(competitivePrice)} r="2.0" />
                    <line className={styles.zeroAxis} x1={scaleX(safeMonopolyY)} y1={plot.height - plot.marginBottom} x2={scaleX(safeCompetitiveY)} y2={plot.height - plot.marginBottom} />
                    <text className={styles.pointLabel} x={scaleX(safeCompetitiveY) + 2.2} y={scaleY(competitivePrice) - 3}>競争的</text>
                  </g>
                ) : null}
                <text className={styles.pointLabel} x={scaleX(safeMonopolyY) + 2.3} y={scaleY(monopolyPrice) - 3}>独占的競争</text>
              </svg>
              <div className={styles.legend} aria-hidden="true">
                <span className={styles.legendItem}>
                  <span className={`${styles.legendLine} ${styles.secondarySwatch}`} />
                  需要曲線
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendLine} ${styles.primarySwatch}`} />
                  限界費用
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.tertiarySwatch}`} />
                  マークアップ
                </span>
              </div>
            </article>
          </div>

          <div className={styles.chartGrid2}>
            <article className={styles.chartPanel}>
              <h4>労働需要の選択空間: 限界収入生産物と賃金</h4>
              <p>独占的競争企業は、MR(F(n))F_n(n)=w を満たすところまで労働を雇います。</p>
              <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="独占的競争企業の労働投入選択">
                <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
                <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
                <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>労働投入 n</text>
                <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>限界収入生産物・賃金</text>
                <path className={styles.primaryCurve} d={marginalRevenueProductPath} />
                <line className={styles.secondaryCurve} x1={laborScaleX(0)} y1={laborScaleY(wage)} x2={laborScaleX(laborNMax)} y2={laborScaleY(wage)} />
                {showComparison ? (
                  <g>
                    <path className={styles.guideCurve} d={valueMarginalProductPath} />
                    <line className={styles.zeroAxis} x1={laborScaleX(safeCompetitiveLabor)} y1={plot.height - plot.marginBottom} x2={laborScaleX(safeCompetitiveLabor)} y2={laborScaleY(wage)} />
                    <circle className={styles.currentPoint} cx={laborScaleX(safeCompetitiveLabor)} cy={laborScaleY(wage)} r="1.8" />
                    <text className={styles.pointLabel} x={laborScaleX(safeCompetitiveLabor) + 2.2} y={laborScaleY(wage) + 5}>競争的</text>
                  </g>
                ) : null}
                <line className={styles.zeroAxis} x1={laborScaleX(safeMonopolyLabor)} y1={plot.height - plot.marginBottom} x2={laborScaleX(safeMonopolyLabor)} y2={laborScaleY(wage)} />
                <circle className={styles.currentPointAlt} cx={laborScaleX(safeMonopolyLabor)} cy={laborScaleY(wage)} r="2.4" />
                <text className={styles.pointLabel} x={laborScaleX(safeMonopolyLabor) + 2.4} y={laborScaleY(wage) - 3}>MR·F_n = w</text>
              </svg>
              <div className={styles.legend} aria-hidden="true">
                <span className={styles.legendItem}>
                  <span className={`${styles.legendLine} ${styles.primarySwatch}`} />
                  限界収入生産物 MR·F_n
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.legendLine} ${styles.secondarySwatch}`} />
                  賃金 w
                </span>
                {showComparison ? (
                  <span className={styles.legendItem}>
                    <span className={styles.legendLine} style={{ background: '#93c5fd' }} />
                    pF_n の参考線
                  </span>
                ) : null}
              </div>
            </article>

            <article className={styles.chartPanel}>
              <h4>労働市場空間: 独占的競争の労働需要曲線</h4>
              <p>賃金を変えながら MR(F(n))F_n(n)=w を解き直すと、独占的競争企業の労働需要曲線が得られます。</p>
              <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="独占的競争企業の労働需要曲線">
                <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
                <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
                <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>労働量 n</text>
                <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>実質賃金 w</text>
                {showComparison ? <path className={styles.guideCurve} d={competitiveLaborDemandPath} /> : null}
                <path className={styles.primaryCurve} d={monopolyLaborDemandPath} />
                {showComparison ? (
                  <g>
                    <circle className={styles.currentPoint} cx={laborScaleX(safeCompetitiveLabor)} cy={laborScaleY(wage)} r="1.9" />
                    <line className={styles.zeroAxis} x1={laborScaleX(safeMonopolyLabor)} y1={plot.height - plot.marginBottom} x2={laborScaleX(safeCompetitiveLabor)} y2={plot.height - plot.marginBottom} />
                  </g>
                ) : null}
                <line className={styles.zeroAxis} x1={laborScaleX(safeMonopolyLabor)} y1={plot.height - plot.marginBottom} x2={laborScaleX(safeMonopolyLabor)} y2={laborScaleY(wage)} />
                <line className={styles.zeroAxis} x1={plot.marginLeft} y1={laborScaleY(wage)} x2={laborScaleX(safeMonopolyLabor)} y2={laborScaleY(wage)} />
                <circle className={styles.currentPointAlt} cx={laborScaleX(safeMonopolyLabor)} cy={laborScaleY(wage)} r="2.35" />
                <text className={styles.pointLabel} x={laborScaleX(safeMonopolyLabor) + 2.4} y={laborScaleY(wage) - 3}>現在の w</text>
              </svg>
              <div className={styles.legend} aria-hidden="true">
                <span className={styles.legendItem}>
                  <span className={`${styles.legendLine} ${styles.primarySwatch}`} />
                  独占的競争の労働需要
                </span>
                {showComparison ? (
                  <span className={styles.legendItem}>
                    <span className={styles.legendLine} style={{ background: '#93c5fd' }} />
                    競争的ベンチマーク
                  </span>
                ) : null}
              </div>
            </article>
          </div>
        </>
      )}

      <section className={styles.summaryBox} aria-live="polite">
        <p className={styles.summaryLead}>{activeSummary.title}: {activeSummary.interpretation}</p>
        <div className={`${styles.metricGrid} ${styles.metricGrid3}`}>
          <div className={styles.metricCard}>
            <h4>FOC</h4>
            <dl>
              <div><dt>条件</dt><dd>{activeSummary.condition}</dd></div>
              <div><dt>生産量</dt><dd>{formatNumber(activeSummary.output)}</dd></div>
              <div><dt>労働投入</dt><dd>{formatNumber(activeSummary.labor)}</dd></div>
            </dl>
          </div>
          <div className={styles.metricCard}>
            <h4>価格・賃金・限界費用</h4>
            <dl>
              <div><dt>価格</dt><dd>{formatNumber(activeSummary.price)}</dd></div>
              <div><dt>限界費用</dt><dd>{formatNumber(activeSummary.mc)}</dd></div>
              <div><dt>賃金</dt><dd>{formatNumber(wage)}</dd></div>
              <div><dt>導出された κ=w/α</dt><dd>{formatNumber(kappa)}</dd></div>
            </dl>
          </div>
          {mode === 'perfect' ? (
            <div className={styles.metricCard}>
              <h4>完全競争の労働需要</h4>
              <dl>
                <div><dt>条件</dt><dd>pF_n = w</dd></div>
                <div><dt>技術パラメータ α</dt><dd>{formatNumber(alpha)}</dd></div>
                <div><dt>現在の労働需要</dt><dd>{formatNumber(perfectLabor)}</dd></div>
              </dl>
            </div>
          ) : (
            <div className={styles.metricCard}>
              <h4>独占的競争の比較</h4>
              <dl>
                <div><dt>マークアップ公式</dt><dd>{formatNumber(markupFormula)}</dd></div>
                <div><dt>実際の p/MC</dt><dd>{formatNumber(markup)}</dd></div>
                <div><dt>競争的労働量</dt><dd>{formatNumber(competitiveLabor)}</dd></div>
              </dl>
            </div>
          )}
        </div>
        <p className={styles.note}>
          {mode === 'perfect'
            ? '完全競争では企業が価格を所与として受け取るため、財の生産量は p = MC(y)、労働投入は pF_n(n)=w から決まります。'
            : '独占的競争では企業が価格 p を選び、需要曲線から販売量 y が決まります。価格選択問題を数量空間で表すと MR < p となり、対応する販売量は MR = MC、労働投入は MR(F(n))F_n(n)=w から決まります。'}
        </p>
      </section>
    </section>
  );
}
