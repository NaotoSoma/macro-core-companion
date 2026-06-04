import { useMemo, useState } from 'react';
import styles from './HouseholdChoiceWidgets.module.css';
import { buildPath, clamp, formatNumber, sampleRange } from './householdChoiceShared';

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
const laborAxisMax = 1;
const baselineProductivity = 1.0;
const productivityMax = 2.0;
const wageRatioMin = 0.82;
const wageRatioMax = 1.25;
const goodsPriceMin = 0.35;
const goodsPriceMax = 2.25;

type LaborPlan = {
  wage: number;
  laborSupply: number;
  laborDemand: number;
  profit: number;
  consumption: number;
  output: number;
  laborGap: number;
  goodsGap: number;
};

function makeScale(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number) {
  return (value: number) => {
    if (Math.abs(domainMax - domainMin) < 1e-9) {
      return (rangeMin + rangeMax) / 2;
    }
    return rangeMin + ((value - domainMin) / (domainMax - domainMin)) * (rangeMax - rangeMin);
  };
}

function production(n: number, productivity: number, alpha: number) {
  return productivity * Math.pow(Math.max(n, 0), alpha);
}

function marginalProduct(n: number, productivity: number, alpha: number) {
  return productivity * alpha * Math.pow(Math.max(n, 1e-8), alpha - 1);
}

function firmLaborDemand(wage: number, productivity: number, alpha: number) {
  return Math.pow(Math.max((productivity * alpha) / Math.max(wage, 1e-8), 1e-8), 1 / (1 - alpha));
}

function firmProfit(wage: number, laborDemand: number, productivity: number, alpha: number) {
  return production(laborDemand, productivity, alpha) - wage * laborDemand;
}

function householdLaborSupply(wage: number, profitDistribution: number, leisureWeight: number) {
  const raw = (wage - leisureWeight * profitDistribution) / ((1 + leisureWeight) * wage);
  return clamp(raw, 0, 0.985);
}

function equilibrium(productivity: number, alpha: number, leisureWeight: number) {
  const labor = alpha / (alpha + leisureWeight);
  const output = production(labor, productivity, alpha);
  const wage = marginalProduct(labor, productivity, alpha);
  const profit = output - wage * labor;
  return {
    labor,
    output,
    wage,
    profit,
    consumption: output,
  };
}

function planAtWage(wage: number, productivity: number, alpha: number, leisureWeight: number): LaborPlan {
  const laborDemand = firmLaborDemand(wage, productivity, alpha);
  const profit = firmProfit(wage, laborDemand, productivity, alpha);
  const laborSupply = householdLaborSupply(wage, profit, leisureWeight);
  const consumption = wage * laborSupply + profit;
  const output = production(laborDemand, productivity, alpha);

  return {
    wage,
    laborSupply,
    laborDemand,
    profit,
    consumption,
    output,
    laborGap: laborSupply - laborDemand,
    goodsGap: consumption - output,
  };
}

function statusText(clears: boolean) {
  return clears ? '清算' : '未清算';
}

function gapDirection(gap: number, positiveLabel: string, negativeLabel: string) {
  if (Math.abs(gap) < 0.015) {
    return 'ほぼ一致';
  }
  return gap > 0 ? positiveLabel : negativeLabel;
}

function findRootOrClosest(fn: (value: number) => number, min: number, max: number) {
  const samples = sampleRange(min, max, 220);
  let best = samples[0] ?? min;
  let bestAbs = Math.abs(fn(best));

  for (let index = 1; index < samples.length; index += 1) {
    const left = samples[index - 1];
    const right = samples[index];
    const leftValue = fn(left);
    const rightValue = fn(right);
    const rightAbs = Math.abs(rightValue);

    if (rightAbs < bestAbs) {
      best = right;
      bestAbs = rightAbs;
    }

    if (leftValue === 0) return left;
    if (leftValue * rightValue <= 0) {
      let low = left;
      let high = right;
      let lowValue = leftValue;

      for (let step = 0; step < 34; step += 1) {
        const mid = (low + high) / 2;
        const midValue = fn(mid);

        if (Math.abs(midValue) < 1e-6) return mid;
        if (lowValue * midValue <= 0) {
          high = mid;
        } else {
          low = mid;
          lowValue = midValue;
        }
      }

      return (low + high) / 2;
    }
  }

  return best;
}

export default function StaticGeneralEquilibriumWidget() {
  const [productivity, setProductivity] = useState(1.0);
  const [alpha, setAlpha] = useState(0.65);
  const [leisureWeight, setLeisureWeight] = useState(1.0);
  const [wageRatio, setWageRatio] = useState(1.0);
  const [showLaborSupply, setShowLaborSupply] = useState(true);
  const [showLaborDemand, setShowLaborDemand] = useState(true);
  const [showGoodsMarket, setShowGoodsMarket] = useState(true);
  const [showPlanner, setShowPlanner] = useState(true);
  const [showWalras, setShowWalras] = useState(true);

  const eq = useMemo(() => equilibrium(productivity, alpha, leisureWeight), [productivity, alpha, leisureWeight]);
  const trialWage = eq.wage * wageRatio;
  const current = useMemo(() => planAtWage(trialWage, productivity, alpha, leisureWeight), [trialWage, productivity, alpha, leisureWeight]);

  const laborClears = Math.abs(current.laborGap) < 0.015;
  const goodsClears = Math.abs(current.goodsGap) < 0.02;
  const generalEquilibrium = laborClears && goodsClears;
  const baseEq = useMemo(() => equilibrium(baselineProductivity, alpha, leisureWeight), [alpha, leisureWeight]);
  const scaleEq = useMemo(() => equilibrium(productivityMax, alpha, leisureWeight), [alpha, leisureWeight]);
  const laborSupplyTransfer = baseEq.profit;
  const geIncomeTransfer = eq.profit;
  const showBaselineComparison = Math.abs(productivity - baselineProductivity) > 0.015;

  const wageMax = scaleEq.wage * wageRatioMax * 1.08;
  const laborScaleX = makeScale(0, laborAxisMax, plot.marginLeft, plot.marginLeft + plotWidth);
  const wageScaleY = makeScale(0, wageMax, plot.height - plot.marginBottom, plot.marginTop);

  const laborCurves = useMemo(() => {
    const wages = sampleRange(wageMax * 0.05, wageMax, 150);
    return wages.map((wage) => {
      const laborDemand = firmLaborDemand(wage, productivity, alpha);
      return {
        wage,
        partialSupply: clamp(householdLaborSupply(wage, laborSupplyTransfer, leisureWeight), 0, laborAxisMax),
        geSupply: clamp(householdLaborSupply(wage, geIncomeTransfer, leisureWeight), 0, laborAxisMax),
        demand: clamp(laborDemand, 0, laborAxisMax),
      };
    });
  }, [wageMax, productivity, alpha, leisureWeight, laborSupplyTransfer, geIncomeTransfer]);

  const baselineLaborCurves = useMemo(() => {
    const wages = sampleRange(wageMax * 0.05, wageMax, 150);
    return wages.map((wage) => ({
      wage,
      demand: clamp(firmLaborDemand(wage, baselineProductivity, alpha), 0, laborAxisMax),
    }));
  }, [wageMax, alpha]);

  const partialLaborSupplyPath = useMemo(
    () => buildPath(laborCurves.map((point) => ({ x: point.partialSupply, y: point.wage })), laborScaleX, wageScaleY),
    [laborCurves, laborScaleX, wageScaleY],
  );

  const geLaborSupplyPath = useMemo(
    () => buildPath(laborCurves.map((point) => ({ x: point.geSupply, y: point.wage })), laborScaleX, wageScaleY),
    [laborCurves, laborScaleX, wageScaleY],
  );

  const laborDemandPath = useMemo(
    () => buildPath(laborCurves.map((point) => ({ x: point.demand, y: point.wage })), laborScaleX, wageScaleY),
    [laborCurves, laborScaleX, wageScaleY],
  );
  const baselineLaborDemandPath = useMemo(
    () => buildPath(baselineLaborCurves.map((point) => ({ x: point.demand, y: point.wage })), laborScaleX, wageScaleY),
    [baselineLaborCurves, laborScaleX, wageScaleY],
  );

  const eqLaborX = laborScaleX(eq.labor);
  const eqWageY = wageScaleY(eq.wage);
  const baseEqLaborX = laborScaleX(baseEq.labor);
  const baseEqWageY = wageScaleY(baseEq.wage);
  const partialLaborEqWage = useMemo(
    () =>
      findRootOrClosest(
        (wage) => householdLaborSupply(wage, laborSupplyTransfer, leisureWeight) - firmLaborDemand(wage, productivity, alpha),
        wageMax * 0.05,
        wageMax,
      ),
    [wageMax, productivity, alpha, leisureWeight, laborSupplyTransfer],
  );
  const partialLaborEq = clamp(firmLaborDemand(partialLaborEqWage, productivity, alpha), 0, laborAxisMax);
  const partialLaborEqX = laborScaleX(partialLaborEq);
  const partialLaborEqY = wageScaleY(partialLaborEqWage);

  const partialNominalWageForGoods = baseEq.wage * wageRatio;
  const geNominalWageForGoods = eq.wage * wageRatio;
  const goodsCurves = useMemo(() => {
    return sampleRange(goodsPriceMin, goodsPriceMax, 150).map((price) => {
      const partialRealWage = partialNominalWageForGoods / price;
      const geRealWage = geNominalWageForGoods / price;
      const partialLaborSupply = householdLaborSupply(partialRealWage, laborSupplyTransfer, leisureWeight);
      const geLaborSupply = householdLaborSupply(geRealWage, geIncomeTransfer, leisureWeight);
      const laborDemand = firmLaborDemand(geRealWage, productivity, alpha);
      return {
        price,
        partialDemand: partialRealWage * partialLaborSupply + laborSupplyTransfer,
        geDemand: geRealWage * geLaborSupply + geIncomeTransfer,
        supply: production(laborDemand, productivity, alpha),
      };
    });
  }, [partialNominalWageForGoods, geNominalWageForGoods, productivity, alpha, leisureWeight, laborSupplyTransfer, geIncomeTransfer]);

  const baselineGoodsSupplyCurves = useMemo(() => {
    return sampleRange(goodsPriceMin, goodsPriceMax, 150).map((price) => {
      const realWage = partialNominalWageForGoods / price;
      const laborDemand = firmLaborDemand(realWage, baselineProductivity, alpha);
      return {
        price,
        supply: production(laborDemand, baselineProductivity, alpha),
      };
    });
  }, [partialNominalWageForGoods, alpha]);

  const goodsMax = useMemo(() => {
    const maxNominalWage = scaleEq.wage * wageRatioMax;
    const scalePlans = sampleRange(goodsPriceMin, goodsPriceMax, 120).map((price) =>
      planAtWage(maxNominalWage / price, productivityMax, alpha, leisureWeight),
    );
    return Math.max(
      scaleEq.output,
      production(laborAxisMax, productivityMax, alpha),
      ...scalePlans.flatMap((plan) => [plan.consumption, plan.output]),
      0.2,
    ) * 1.12;
  }, [scaleEq.wage, scaleEq.output, alpha, leisureWeight]);
  const goodsScaleX = makeScale(0, goodsMax, plot.marginLeft, plot.marginLeft + plotWidth);
  const goodsPriceScaleY = makeScale(goodsPriceMin, goodsPriceMax, plot.height - plot.marginBottom, plot.marginTop);
  const normalizedGoodsPriceY = goodsPriceScaleY(1);
  const partialGoodsDemandPath = useMemo(
    () => buildPath(goodsCurves.map((point) => ({ x: point.partialDemand, y: point.price })), goodsScaleX, goodsPriceScaleY),
    [goodsCurves, goodsScaleX, goodsPriceScaleY],
  );
  const geGoodsDemandPath = useMemo(
    () => buildPath(goodsCurves.map((point) => ({ x: point.geDemand, y: point.price })), goodsScaleX, goodsPriceScaleY),
    [goodsCurves, goodsScaleX, goodsPriceScaleY],
  );
  const goodsSupplyPath = useMemo(
    () => buildPath(goodsCurves.map((point) => ({ x: point.supply, y: point.price })), goodsScaleX, goodsPriceScaleY),
    [goodsCurves, goodsScaleX, goodsPriceScaleY],
  );
  const baselineGoodsSupplyPath = useMemo(
    () => buildPath(baselineGoodsSupplyCurves.map((point) => ({ x: point.supply, y: point.price })), goodsScaleX, goodsPriceScaleY),
    [baselineGoodsSupplyCurves, goodsScaleX, goodsPriceScaleY],
  );
  const eqGoodsX = goodsScaleX(eq.output);
  const baseEqGoodsX = goodsScaleX(baseEq.output);
  const eqGoodsPriceY = goodsPriceScaleY(geNominalWageForGoods / eq.wage);
  const baseEqGoodsPriceY = goodsPriceScaleY(partialNominalWageForGoods / baseEq.wage);
  const partialGoodsEqPrice = useMemo(
    () =>
      findRootOrClosest((price) => {
        const partialRealWage = partialNominalWageForGoods / price;
        const geRealWage = geNominalWageForGoods / price;
        const partialLaborSupply = householdLaborSupply(partialRealWage, laborSupplyTransfer, leisureWeight);
        const laborDemand = firmLaborDemand(geRealWage, productivity, alpha);
        const demand = partialRealWage * partialLaborSupply + laborSupplyTransfer;
        const supply = production(laborDemand, productivity, alpha);
        return demand - supply;
      }, goodsPriceMin, goodsPriceMax),
    [partialNominalWageForGoods, geNominalWageForGoods, productivity, alpha, leisureWeight, laborSupplyTransfer],
  );
  const partialGoodsEqRealWage = partialNominalWageForGoods / partialGoodsEqPrice;
  const partialGoodsEqLaborSupply = householdLaborSupply(partialGoodsEqRealWage, laborSupplyTransfer, leisureWeight);
  const partialGoodsEqQuantity = partialGoodsEqRealWage * partialGoodsEqLaborSupply + laborSupplyTransfer;
  const partialGoodsEqX = goodsScaleX(partialGoodsEqQuantity);
  const partialGoodsEqY = goodsPriceScaleY(partialGoodsEqPrice);

  const productionMax = production(laborAxisMax, productivityMax, alpha) * 1.08;
  const productionScaleX = makeScale(0, laborAxisMax, plot.marginLeft, plot.marginLeft + plotWidth);
  const productionScaleY = makeScale(0, productionMax, plot.height - plot.marginBottom, plot.marginTop);
  const productionPath = useMemo(
    () => buildPath(sampleRange(0.001, laborAxisMax, 160).map((n) => ({ x: n, y: production(n, productivity, alpha) })), productionScaleX, productionScaleY),
    [productivity, alpha, productionScaleX, productionScaleY],
  );

  const currentProductionN = clamp(current.laborDemand, 0, laborAxisMax);
  const currentProductionY = production(currentProductionN, productivity, alpha);
  const trialWageIncome = current.wage * current.laborSupply;
  const walrasRightSide = current.wage * current.laborGap;

  return (
    <section className={`${styles.widget} not-content`} aria-label="代表的家計と代表的企業の静学的一般均衡">
      <header className={styles.header}>
        <div>
          <h3>静学的一般均衡: 市場清算を探す</h3>
          <p>試行賃金を動かしながら、家計の労働供給、企業の労働需要、財市場の整合性を同時に確認します。</p>
        </div>
        <span className={styles.badge}>static GE</span>
      </header>

      <div className={styles.controlsGrid}>
        <fieldset className={styles.fieldset}>
          <legend>技術と選好</legend>
          <div className={styles.sliderStack}>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>生産性 A</span>
                <span className={styles.sliderValue}>{formatNumber(productivity)}</span>
              </span>
              <input type="range" min="0.6" max="2.0" step="0.01" value={productivity} onChange={(event) => setProductivity(Number(event.target.value))} />
            </label>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>生産関数の曲率 α</span>
                <span className={styles.sliderValue}>{formatNumber(alpha)}</span>
              </span>
              <input type="range" min="0.25" max="0.85" step="0.01" value={alpha} onChange={(event) => setAlpha(Number(event.target.value))} />
            </label>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>余暇の重み ψ</span>
                <span className={styles.sliderValue}>{formatNumber(leisureWeight)}</span>
              </span>
              <input type="range" min="0.4" max="3.0" step="0.01" value={leisureWeight} onChange={(event) => setLeisureWeight(Number(event.target.value))} />
            </label>
          </div>
          <p className={styles.smallNote}>可視化では U(c,1-n)=log c + ψ log(1-n), F(n)=A n^α を使っています。</p>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>試行賃金</legend>
          <div className={styles.sliderStack}>
            <label className={styles.sliderRow}>
              <span className={styles.sliderLabel}>
                <span>試行賃金 w / w*</span>
                <span className={styles.sliderValue}>{formatNumber(wageRatio)}</span>
              </span>
              <input type="range" min={wageRatioMin} max={wageRatioMax} step="0.005" value={wageRatio} onChange={(event) => setWageRatio(Number(event.target.value))} />
            </label>
            <button type="button" className={styles.choiceLabel} onClick={() => setWageRatio(1.0)}>
              均衡賃金に合わせる
            </button>
          </div>
          <p className={styles.smallNote}>現在の試行賃金は w={formatNumber(current.wage)}、均衡賃金は w*={formatNumber(eq.wage)} です。</p>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend>表示する要素</legend>
          <div className={styles.choiceGroup}>
            <label className={styles.choiceLabel}>
              <input type="checkbox" checked={showLaborSupply} onChange={() => setShowLaborSupply((value) => !value)} />
              <span>家計の労働供給</span>
            </label>
            <label className={styles.choiceLabel}>
              <input type="checkbox" checked={showLaborDemand} onChange={() => setShowLaborDemand((value) => !value)} />
              <span>企業の労働需要</span>
            </label>
            <label className={styles.choiceLabel}>
              <input type="checkbox" checked={showGoodsMarket} onChange={() => setShowGoodsMarket((value) => !value)} />
              <span>財市場</span>
            </label>
            <label className={styles.choiceLabel}>
              <input type="checkbox" checked={showWalras} onChange={() => setShowWalras((value) => !value)} />
              <span>Walras' law（ワルラス法則）</span>
            </label>
            <label className={styles.choiceLabel}>
              <input type="checkbox" checked={showPlanner} onChange={() => setShowPlanner((value) => !value)} />
              <span>社会計画者解</span>
            </label>
          </div>
        </fieldset>
      </div>

      <div className={styles.chartGrid2}>
        <article className={styles.chartPanel}>
          <h4>労働市場: 労働供給と労働需要</h4>
          <p>点線は所得を固定した部分均衡の線、実線は利潤分配まで反映した一般均衡の線です。A が変わると、実線の供給側にも所得フィードバックが現れます。</p>
          <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="労働市場の清算図">
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
            <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>労働量 n</text>
            <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>実質賃金 w</text>
            {showLaborSupply ? <path className={`${styles.primaryCurve} ${styles.partialCurve}`} d={partialLaborSupplyPath} /> : null}
            {showLaborSupply ? <path className={styles.primaryCurve} d={geLaborSupplyPath} /> : null}
            {showLaborDemand && showBaselineComparison ? <path className={`${styles.secondaryCurve} ${styles.partialCurve}`} d={baselineLaborDemandPath} /> : null}
            {showLaborDemand ? <path className={styles.secondaryCurve} d={laborDemandPath} /> : null}
            {showPlanner ? (
              <g>
                {showBaselineComparison ? (
                  <g>
                    <line className={styles.zeroAxis} x1={baseEqLaborX} y1={plot.height - plot.marginBottom} x2={baseEqLaborX} y2={baseEqWageY} />
                    <circle className={styles.unconstrainedPoint} cx={baseEqLaborX} cy={baseEqWageY} r="2.05" />
                    <text className={styles.pointLabel} x={baseEqLaborX + 2.3} y={baseEqWageY + 5}>A=1</text>
                  </g>
                ) : null}
                <line className={styles.zeroAxis} x1={eqLaborX} y1={plot.height - plot.marginBottom} x2={eqLaborX} y2={eqWageY} />
                <line className={styles.zeroAxis} x1={plot.marginLeft} y1={eqWageY} x2={eqLaborX} y2={eqWageY} />
                <circle className={styles.newGeneralPoint} cx={eqLaborX} cy={eqWageY} r="2.4" />
                <text className={styles.pointLabel} x={eqLaborX + 2.4} y={eqWageY - 3}>GE</text>
              </g>
            ) : null}
            {showLaborSupply && showLaborDemand ? (
              <g>
                <line className={styles.zeroAxis} x1={partialLaborEqX} y1={plot.height - plot.marginBottom} x2={partialLaborEqX} y2={partialLaborEqY} />
                <line className={styles.zeroAxis} x1={plot.marginLeft} y1={partialLaborEqY} x2={partialLaborEqX} y2={partialLaborEqY} />
                <circle className={styles.newPartialPoint} cx={partialLaborEqX} cy={partialLaborEqY} r="2.25" />
              </g>
            ) : null}
          </svg>
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.primarySwatch}`} />
              一般均衡の労働供給
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.dashedPrimarySwatch}`} />
              部分均衡の労働供給
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.secondarySwatch}`} />
              労働需要 nᵈ(w;A)
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.dashedSecondarySwatch}`} />
              A=1 の労働需要
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.tertiarySwatch}`} />
              A=1 の一般均衡
            </span>
          </div>
        </article>

        <article className={styles.chartPanel}>
          <h4>財市場: 消費と生産</h4>
          <p>点線は名目賃金 W と家計所得 Π を固定した部分均衡の線、実線は所得フィードバック込みの一般均衡の線です。A が変わると、実線の財需要も動きます。</p>
          <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="財市場の需要曲線と供給曲線">
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
            <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>財の量</text>
            <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>財価格 p</text>
            {showGoodsMarket ? (
              <g>
                <path className={`${styles.primaryCurve} ${styles.partialCurve}`} d={partialGoodsDemandPath} />
                <path className={styles.primaryCurve} d={geGoodsDemandPath} />
                {showBaselineComparison ? <path className={`${styles.secondaryCurve} ${styles.partialCurve}`} d={baselineGoodsSupplyPath} /> : null}
                <path className={styles.secondaryCurve} d={goodsSupplyPath} />
                <line className={styles.zeroAxis} x1={plot.marginLeft} y1={normalizedGoodsPriceY} x2={plot.width - plot.marginRight} y2={normalizedGoodsPriceY} />
                <text className={styles.pointLabel} x={plot.marginLeft + 2} y={normalizedGoodsPriceY - 3}>p=1</text>
                {showPlanner ? (
                  <g>
                    {showBaselineComparison ? (
                      <g>
                        <line className={styles.zeroAxis} x1={baseEqGoodsX} y1={plot.height - plot.marginBottom} x2={baseEqGoodsX} y2={baseEqGoodsPriceY} />
                        <circle className={styles.unconstrainedPoint} cx={baseEqGoodsX} cy={baseEqGoodsPriceY} r="2.05" />
                        <text className={styles.pointLabel} x={baseEqGoodsX + 2.3} y={baseEqGoodsPriceY + 5}>A=1</text>
                      </g>
                    ) : null}
                    <line className={styles.zeroAxis} x1={eqGoodsX} y1={plot.height - plot.marginBottom} x2={eqGoodsX} y2={eqGoodsPriceY} />
                    <circle className={styles.newGeneralPoint} cx={eqGoodsX} cy={eqGoodsPriceY} r="2.4" />
                    <text className={styles.pointLabel} x={eqGoodsX + 2.4} y={eqGoodsPriceY - 3}>GE</text>
                  </g>
                ) : null}
                <line className={styles.zeroAxis} x1={partialGoodsEqX} y1={plot.height - plot.marginBottom} x2={partialGoodsEqX} y2={partialGoodsEqY} />
                <line className={styles.zeroAxis} x1={plot.marginLeft} y1={partialGoodsEqY} x2={partialGoodsEqX} y2={partialGoodsEqY} />
                <circle className={styles.newPartialPoint} cx={partialGoodsEqX} cy={partialGoodsEqY} r="2.25" />
              </g>
            ) : null}
          </svg>
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.primarySwatch}`} />
              一般均衡の財需要
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.dashedPrimarySwatch}`} />
              部分均衡の財需要
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.secondarySwatch}`} />
              財供給 yˢ(p;W,A)
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.dashedSecondarySwatch}`} />
              A=1 の財供給
            </span>
          </div>
        </article>

        <article className={styles.chartPanel}>
          <h4>生産関数と所得分配</h4>
          <p>企業の生産は労働需要から決まり、生産物は賃金所得と利潤に分かれて家計へ戻ります。</p>
          <svg className={styles.chartSvg} viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="生産関数と労働投入">
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.width - plot.marginRight} y2={plot.height - plot.marginBottom} />
            <line className={styles.axis} x1={plot.marginLeft} y1={plot.height - plot.marginBottom} x2={plot.marginLeft} y2={plot.marginTop} />
            <text className={styles.axisLabel} x={plot.marginLeft + plotWidth / 2} y={plot.height - 3}>労働量 n</text>
            <text className={styles.axisLabel} x={6} y={plot.marginTop + plotHeight / 2} transform={`rotate(-90 6 ${plot.marginTop + plotHeight / 2})`}>生産 y</text>
            <path className={styles.primaryCurve} d={productionPath} />
            <line className={styles.zeroAxis} x1={productionScaleX(currentProductionN)} y1={plot.height - plot.marginBottom} x2={productionScaleX(currentProductionN)} y2={productionScaleY(currentProductionY)} />
            <circle className={styles.newPartialPoint} cx={productionScaleX(currentProductionN)} cy={productionScaleY(currentProductionY)} r="2.25" />
            {showPlanner ? (
              <g>
                <line className={styles.zeroAxis} x1={productionScaleX(eq.labor)} y1={plot.height - plot.marginBottom} x2={productionScaleX(eq.labor)} y2={productionScaleY(eq.output)} />
                <circle className={styles.newGeneralPoint} cx={productionScaleX(eq.labor)} cy={productionScaleY(eq.output)} r="2.15" />
              </g>
            ) : null}
          </svg>
          <div className={styles.legend} aria-hidden="true">
            <span className={styles.legendItem}>
              <span className={`${styles.legendLine} ${styles.primarySwatch}`} />
              F(n)=A n^α
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.tertiarySwatch}`} />
              社会計画者解
            </span>
          </div>
        </article>

        <article className={styles.chartPanel}>
          <h4>均衡チェックリスト</h4>
          <p>個別最適化は各価格のもとで成立します。一般均衡には、市場清算も必要です。</p>
          <div className={`${styles.metricGrid} ${styles.metricGrid2}`}>
            <div className={styles.metricCard}>
              <h4>個別最適化</h4>
              <dl>
                <div><dt>家計最適化</dt><dd>OK</dd></div>
                <div><dt>企業最適化</dt><dd>OK</dd></div>
                <div><dt>利潤分配</dt><dd>OK</dd></div>
              </dl>
            </div>
            <div className={styles.metricCard}>
              <h4>市場清算</h4>
              <dl>
                <div><dt>労働市場</dt><dd>{statusText(laborClears)}</dd></div>
                <div><dt>財市場</dt><dd>{statusText(goodsClears)}</dd></div>
                <div><dt>一般均衡</dt><dd>{generalEquilibrium ? '成立' : '未成立'}</dd></div>
              </dl>
            </div>
          </div>
          <p className={styles.note}>
            労働市場は {gapDirection(current.laborGap, '労働供給超過', '労働需要超過')}、財市場は {gapDirection(current.goodsGap, '消費超過', '生産超過')} です。
          </p>
        </article>
      </div>

      <section className={styles.summaryBox} aria-live="polite">
        <p className={styles.summaryLead}>
          {generalEquilibrium
            ? 'この賃金では、家計の計画、企業の計画、労働市場清算、財市場清算が同時に成立しています。これが静学的一般均衡です。'
            : 'いまの賃金では、家計と企業はそれぞれ最適化していますが、市場全体としてはまだ整合していません。'}
        </p>
        <div className={`${styles.metricGrid} ${styles.metricGrid3}`}>
          <div className={styles.metricCard}>
            <h4>現在の試行賃金</h4>
            <dl>
              <div><dt>賃金 w</dt><dd>{formatNumber(current.wage)}</dd></div>
              <div><dt>労働供給 nˢ</dt><dd>{formatNumber(current.laborSupply)}</dd></div>
              <div><dt>労働需要 nᵈ</dt><dd>{formatNumber(current.laborDemand)}</dd></div>
            </dl>
          </div>
          <div className={styles.metricCard}>
            <h4>財市場</h4>
            <dl>
              <div><dt>消費 c</dt><dd>{formatNumber(current.consumption)}</dd></div>
              <div><dt>生産 y</dt><dd>{formatNumber(current.output)}</dd></div>
              <div><dt>c-y</dt><dd>{formatNumber(current.goodsGap)}</dd></div>
            </dl>
          </div>
          <div className={styles.metricCard}>
            <h4>均衡値と所得分配</h4>
            <dl>
              <div><dt>n*</dt><dd>{formatNumber(eq.labor)}</dd></div>
              <div><dt>賃金所得 wn</dt><dd>{formatNumber(trialWageIncome)}</dd></div>
              <div><dt>利潤 π</dt><dd>{formatNumber(current.profit)}</dd></div>
            </dl>
          </div>
        </div>
        {showWalras ? (
          <p className={styles.note}>
            Walras' law（ワルラス法則）の確認: c-y={formatNumber(current.goodsGap)}、w(nˢ-nᵈ)={formatNumber(walrasRightSide)}。このモデルでは、予算制約と利潤分配により、財市場の不均衡は労働市場の不均衡と連動します。
          </p>
        ) : null}
        {showPlanner ? (
          <p className={styles.note}>
            社会計画者解は n*={formatNumber(eq.labor)}、y*={formatNumber(eq.output)}、w*={formatNumber(eq.wage)} です。摩擦のないこの静学モデルでは、分権均衡と社会計画者解が一致します。
          </p>
        ) : null}
      </section>
    </section>
  );
}
