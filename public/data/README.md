# Lecture 5 data

`us_business_cycle_hp.csv` is the CSV read by `BusinessCycleFactsWidget.tsx`.

The publishable CSV should be generated from public US macro data:

- GDP, consumption, investment, and hours: FRED CSV endpoints.
- TFP: San Francisco Fed Fernald quarterly TFP workbook, using the headline
  measured TFP growth column `dtfp`.

The widget intentionally uses measured TFP rather than the utilization-adjusted
`dtfp_util` series. The utilization-adjusted series removes cyclical utilization,
so it is useful for thinking about cleaner technology shocks but can have a weak
or negative contemporaneous correlation with HP-filtered GDP. For the basic
business-cycle facts chart, measured TFP better matches the "TFP moves with
output" teaching point.

To regenerate the CSV, first install the data-only Python dependencies:

```bash
python -m pip install -r requirements-data.txt
```

Then run:

```bash
python scripts/build_us_business_cycle_data.py
```

The script applies the HP filter with `lambda = 1600` and overwrites this CSV. By default it fails if the Fernald TFP workbook cannot be parsed. For development previews only, `--allow-proxy-tfp` can create a Solow-residual proxy, but that proxy should be disclosed before classroom use.
