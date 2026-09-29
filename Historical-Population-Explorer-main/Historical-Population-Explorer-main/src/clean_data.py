import pandas as pd
import os

# Paths
a = os.path.join
RAW_CSV    = a("data", "raw", "population.csv")
CLEAN_JSON = a("data", "clean", "population_clean.json")

# 1) Load & skip metadata (skip first 4 rows of header)
df = pd.read_csv(RAW_CSV, skiprows=4)

# 2) Drop unwanted columns if they exist
for col in ("2024", "Unnamed: 69"):
    if col in df.columns:
        df.drop(columns=col, inplace=True)

# 3) Melt to long form
years   = [c for c in df.columns if c.isdigit()]
df_long = df.melt(
    id_vars=["Country Name","Country Code"],
    value_vars=years,
    var_name="Year",
    value_name="Population"
)

# 4) Cast & filter
df_long["Year"] = df_long["Year"].astype(int)
df_long = df_long.query("1960 <= Year <= 2020")

# 5) Handle missing data
df_long.dropna(subset=["Population"], inplace=True)
# Optional interpolation:
# df_long["Population"] = (
#     df_long.groupby("Country Code")["Population"]
#            .transform(lambda s: s.interpolate())
# )

# 6) Derived metrics
df_long["Pct_Change"] = df_long.groupby("Country Code")["Population"].pct_change() * 100
df_long["Rolling5Y"]  = (
    df_long.groupby("Country Code")["Population"]
           .rolling(5, min_periods=1)
           .mean()
           .reset_index(level=0, drop=True)
)

# 7) Export to JSON
os.makedirs(os.path.dirname(CLEAN_JSON), exist_ok=True)
df_long.to_json(CLEAN_JSON, orient="records", indent=2)
print(f"✅ Cleaned {len(df_long)} rows → {CLEAN_JSON}")