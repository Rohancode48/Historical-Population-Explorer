from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import json
import os

# ── Create FastAPI app and enable CORS ────────────────────────────────────────────
app = FastAPI(title="Historical Data Explorer API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],    # Allow all origins during development
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load cleaned population data ─────────────────────────────────────────────────
DATA_PATH = os.path.join("data", "clean", "population_clean.json")
with open(DATA_PATH, "r", encoding="utf-8") as f:
    POP_DATA = json.load(f)

ALL_CODES = {r["Country Code"] for r in POP_DATA}

# ── Pydantic model for data records ───────────────────────────────────────────────
class DataRecord(BaseModel):
    country_name: str           = Field(..., alias="Country Name")
    country_code: str           = Field(..., alias="Country Code")
    year: int                   = Field(..., alias="Year")
    population: float           = Field(..., alias="Population")
    pct_change: Optional[float] = Field(None,   alias="Pct_Change")
    rolling5y: float            = Field(..., alias="Rolling5Y")

    class Config:
        model_config = {
            "populate_by_name": True,
            "populate_by_alias": True
        }

# ── Endpoints ────────────────────────────────────────────────────────────────────

@app.get("/topics", response_model=List[str])
def list_topics():
    return ["population"]


@app.get("/countries", response_model=List[dict])
def list_countries():
    """
    Returns a list of all countries available in POP_DATA.
    Each entry is { code: "USA", name: "United States" }.
    """
    output = []
    for code in sorted(ALL_CODES):
        name = next(r["Country Name"] for r in POP_DATA if r["Country Code"] == code)
        output.append({"code": code, "name": name})
    return output


@app.get("/data", response_model=List[DataRecord], response_model_by_alias=True)
def get_data(
    topic: str = Query(..., regex="^population$"),
    country: Optional[List[str]] = Query(None),
    start: int = Query(1960, ge=1960, le=2020),
    end:   int = Query(2020, ge=1960, le=2020),
):
    if country:
        invalid = [c for c in country if c not in ALL_CODES]
        if invalid:
            raise HTTPException(400, f"Invalid code(s): {invalid}")

    filtered = [
        r for r in POP_DATA
        if (start <= r["Year"] <= end) and (country is None or r["Country Code"] in country)
    ]
    return filtered


@app.get("/summary")
def get_summary(
    topic: str = Query(..., regex="^population$"),
    country: Optional[List[str]] = Query(None),
    start: int = Query(1960, ge=1960, le=2020),
    end:   int = Query(2020, ge=1960, le=2020),
):
    # Filter down to only the requested years (we’ll ignore the rest)
    filtered = [
        r for r in POP_DATA
        if (start <= r["Year"] <= end) and (country is None or r["Country Code"] in country)
    ]
    if not filtered:
        raise HTTPException(404, "No data for given parameters")

    # Helper: sum population for a given year & optional country list
    def total_for(year: int, codes: Optional[List[str]]) -> float:
        return sum(
            r["Population"]
            for r in POP_DATA
            if r["Year"] == year and (codes is None or r["Country Code"] in codes)
        )

    # Compute “first” and “last” totals
    first_total = total_for(start, country)
    last_total  = total_for(end,   country)

    if first_total == 0:
        raise HTTPException(400, "Cannot compute summary: zero population at start year")

    pct_change = (last_total - first_total) / first_total * 100

    # Build a human-readable summary string
    # If filtering by a single country, show that country code in the text.
    if country and len(country) == 1:
        label = f"{country[0]}"
    elif country and len(country) > 1:
        label = f"{len(country)} selected countries"
    else:
        label = "World"

    summary_text = (
        f"Between {start} and {end}, {label} population grew "
        f"from {first_total:,.0f} to {last_total:,.0f}, "
        f"a {pct_change:.1f}% increase."
    )

    return {"summary": summary_text}