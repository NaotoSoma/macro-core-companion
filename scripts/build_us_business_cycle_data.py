#!/usr/bin/env python3
"""Build the CSV used by Lecture 5's business-cycle facts widget.

The website reads `public/data/us_business_cycle_hp.csv` at runtime. This script is
intended to be run manually before publishing when internet access is available.

Data sources:
- FRED CSV endpoint for GDPC1, PCECC96, GPDIC1, and HOANBS.
- San Francisco Fed Fernald quarterly TFP workbook if it can be parsed. The
  published CSV uses the headline measured TFP growth column (`dtfp`) for the
  business-cycle facts widget. The utilization-adjusted column (`dtfp_util`) is
  closer to a cleaned technology-shock measure, but it intentionally removes
  cyclical utilization and can therefore be weakly or negatively correlated with
  GDP over HP-filtered samples.

By default the script fails if the Fernald workbook cannot be parsed, because Lecture 5
uses the generated CSV as a real-data teaching artifact. For development only, pass
`--allow-proxy-tfp` to fall back to a simple Solow-residual proxy computed from GDP,
investment-implied capital, and hours.
"""

from __future__ import annotations

import argparse
from io import BytesIO
from pathlib import Path
from typing import Iterable
from urllib.request import urlopen

import numpy as np
import pandas as pd

FRED_SERIES = {
    "gdp": "GDPC1",
    "consumption": "PCECC96",
    "investment": "GPDIC1",
    "hours": "HOANBS",
}

FRED_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
FERNALD_TFP_URL = "https://www.frbsf.org/wp-content/uploads/quarterly_tfp.xlsx"
DEFAULT_OUTPUT = Path("public/data/us_business_cycle_hp.csv")


def read_fred_series(series_id: str, name: str) -> pd.DataFrame:
    url = FRED_URL.format(series_id=series_id)
    df = pd.read_csv(url)
    date_column = "DATE" if "DATE" in df.columns else df.columns[0]
    value_column = series_id if series_id in df.columns else df.columns[1]
    df = df[[date_column, value_column]].rename(columns={date_column: "date", value_column: name})
    df["date"] = pd.to_datetime(df["date"])
    df[name] = pd.to_numeric(df[name], errors="coerce")
    return df.dropna()


def fred_panel() -> pd.DataFrame:
    frames = [read_fred_series(series_id, name) for name, series_id in FRED_SERIES.items()]
    panel = frames[0]
    for frame in frames[1:]:
        panel = panel.merge(frame, on="date", how="inner")
    return panel.sort_values("date")


def hp_filter(log_series: Iterable[float], smoothing: float = 1600.0) -> tuple[np.ndarray, np.ndarray]:
    """Return trend and cycle from the Hodrick-Prescott filter.

    The trend solves min_tau sum_t (x_t - tau_t)^2 + lambda sum_t
    [(tau_{t+1}-tau_t) - (tau_t-tau_{t-1})]^2.
    """

    x = np.asarray(list(log_series), dtype=float)
    n = len(x)
    if n < 4:
        raise ValueError("HP filter needs at least four observations")

    identity = np.eye(n)
    second_difference = np.zeros((n - 2, n))
    for row in range(n - 2):
        second_difference[row, row] = 1.0
        second_difference[row, row + 1] = -2.0
        second_difference[row, row + 2] = 1.0

    trend = np.linalg.solve(identity + smoothing * second_difference.T @ second_difference, x)
    return trend, x - trend


def quarter_to_timestamp(value: object) -> pd.Timestamp | None:
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None

    for separator in (":Q", "Q", "q"):
        if separator in text:
            parts = text.replace(":", "").replace("q", "Q").split("Q")
            if len(parts) == 2:
                try:
                    year = int(float(parts[0]))
                    quarter = int(float(parts[1]))
                    month = (quarter - 1) * 3 + 1
                    return pd.Timestamp(year=year, month=month, day=1)
                except ValueError:
                    return None

    try:
        return pd.to_datetime(text)
    except Exception:
        return None


def try_parse_fernald_tfp() -> pd.DataFrame | None:
    """Try to parse the latest FRBSF Fernald TFP workbook.

    The workbook has changed layout across vintages. We therefore search for a sheet
    with a quarter/date column and a plausible TFP growth column. If the file cannot be
    parsed robustly, return None and let the caller build a Solow-residual proxy.
    """

    try:
        content = urlopen(FERNALD_TFP_URL, timeout=30).read()
    except Exception:
        return None

    try:
        excel = pd.ExcelFile(BytesIO(content))
    except Exception:
        return None

    for sheet_name in excel.sheet_names:
        for header in range(0, 12):
            try:
                frame = pd.read_excel(excel, sheet_name=sheet_name, header=header)
            except Exception:
                continue

            if frame.empty:
                continue

            frame = frame.dropna(how="all")
            normalized_columns = [str(column).strip().lower() for column in frame.columns]
            date_index = next(
                (index for index, column in enumerate(normalized_columns) if column in {"date", "quarter", "qtr", "time"} or "quarter" in column),
                None,
            )
            tfp_index = next((index for index, column in enumerate(normalized_columns) if column == "dtfp"), None)
            if tfp_index is None:
                tfp_index = next((index for index, column in enumerate(normalized_columns) if column == "tfp"), None)

            if date_index is None or tfp_index is None:
                continue

            parsed = pd.DataFrame(
                {
                    "date": [quarter_to_timestamp(value) for value in frame.iloc[:, date_index]],
                    "tfp_growth": pd.to_numeric(frame.iloc[:, tfp_index], errors="coerce"),
                }
            ).dropna()

            if len(parsed) < 40:
                continue

            # Fernald growth rates are generally annualized percent rates. Convert to
            # approximate quarterly log-level changes.
            parsed = parsed.sort_values("date")
            growth = parsed["tfp_growth"].to_numpy(dtype=float)
            if np.nanmedian(np.abs(growth)) > 0.2:
                quarterly_log_change = growth / 400.0
            else:
                quarterly_log_change = growth / 4.0
            parsed["tfp"] = np.exp(np.cumsum(quarterly_log_change))
            return parsed[["date", "tfp"]]

    return None


def solow_residual_proxy(panel: pd.DataFrame, alpha: float = 0.33, delta_quarterly: float = 0.025) -> pd.Series:
    investment = panel["investment"].to_numpy(dtype=float)
    capital = np.empty_like(investment)
    capital[0] = investment[0] / max(delta_quarterly, 1e-6)
    for index in range(1, len(investment)):
        capital[index] = (1 - delta_quarterly) * capital[index - 1] + investment[index]

    log_tfp = np.log(panel["gdp"].to_numpy(dtype=float)) - alpha * np.log(capital) - (1 - alpha) * np.log(panel["hours"].to_numpy(dtype=float))
    return pd.Series(np.exp(log_tfp - log_tfp[0]), index=panel.index, name="tfp")


def build_dataset(output: Path, smoothing: float = 1600.0, allow_proxy_tfp: bool = False) -> tuple[pd.DataFrame, str]:
    panel = fred_panel()
    fernald = try_parse_fernald_tfp()

    if fernald is not None:
        panel = panel.merge(fernald, on="date", how="inner")
        tfp_source = "Fernald TFP"
    else:
        if not allow_proxy_tfp:
            raise RuntimeError(
                "Could not fetch or parse the Fernald TFP workbook. "
                "Fix the parser/source before publishing, or rerun with "
                "--allow-proxy-tfp only for development previews."
            )
        panel["tfp"] = solow_residual_proxy(panel)
        tfp_source = "Solow residual proxy"

    panel = panel.dropna().sort_values("date").reset_index(drop=True)

    output_frame = pd.DataFrame({"date": panel["date"].dt.to_period("Q").astype(str)})
    for column in ["gdp", "consumption", "investment", "hours", "tfp"]:
        values = panel[column].astype(float).to_numpy()
        trend, cycle = hp_filter(np.log(values), smoothing=smoothing)
        output_frame[column] = values
        output_frame[f"{column}_trend"] = np.exp(trend)
        output_frame[f"{column}_cycle"] = cycle * 100.0

    output.parent.mkdir(parents=True, exist_ok=True)
    output_frame.to_csv(output, index=False, float_format="%.6f")
    return output_frame, tfp_source


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--lambda", dest="smoothing", type=float, default=1600.0)
    parser.add_argument(
        "--allow-proxy-tfp",
        action="store_true",
        help="Use a Solow-residual proxy if the Fernald TFP workbook cannot be parsed. Do not use for final classroom data without noting the proxy.",
    )
    args = parser.parse_args()

    frame, tfp_source = build_dataset(args.output, smoothing=args.smoothing, allow_proxy_tfp=args.allow_proxy_tfp)
    print(f"Wrote {len(frame)} rows to {args.output}")
    print(f"TFP source: {tfp_source}")


if __name__ == "__main__":
    main()
