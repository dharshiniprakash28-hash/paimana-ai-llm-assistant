"""
PAIMANA-AI Generator Calibration Configuration.

Grounded in published Ministry of Statistics and Programme Implementation (MoSPI)
Infrastructure and Project Monitoring Division (IPMD) Flash Reports.

Sources cited:
- MoSPI Flash Report on Central Sector Projects (April 2024 - April 2026):
  Total monitored projects (costing Rs 150 Cr and above): ~1,800 to 1,981 projects.
  Cost overrun base rate: ~23% to 27% of projects report cost escalation over original sanctioned cost.
  Schedule delay base rate: ~30% to 45% of projects report delay against original completion date.
  Sector concentration: Transport & Logistics (Road Transport & Highways, Railways,
  Ports, Shipping and Civil Aviation) account for ~65% to 70% of total project count and outlay.
- Delay taxonomy: Verbatim 8 core delay reasons reported in IPMD Flash Reports:
  1. Land acquisition delay
  2. Forest / environmental clearance delay
  3. Financing tie-up delay
  4. Contractor / tendering issues
  5. Law and order problems
  6. Geological surprises
  7. Utility shifting
  8. Lack of infrastructure linkages
"""

# Overall portfolio calibration targets
TARGET_COST_OVERRUN_RATE = 0.25      # ~25% base rate of cost overrun
TARGET_SCHEDULE_DELAY_RATE = 0.38    # ~38% base rate of schedule slippage

# Sector weighting: Transport & Logistics heavily weighted (~65%)
SECTOR_WEIGHTINGS = {
    "Ministry of Road Transport and Highways (MoRTH)": 0.35,
    "Ministry of Railways": 0.22,
    "Ministry of Power": 0.09,
    "Ministry of Housing and Urban Affairs (MoHUA)": 0.08,
    "Ministry of Ports, Shipping and Waterways": 0.06,
    "Ministry of Petroleum and Natural Gas": 0.06,
    "Ministry of Coal": 0.04,
    "Ministry of Civil Aviation": 0.03,
    "Ministry of Jal Shakti": 0.03,
    "Ministry of New and Renewable Energy": 0.02,
    "Ministry of Steel": 0.01,
    "Department of Telecommunications": 0.01,
}

# Verbatim MoSPI Flash Report delay taxonomy
MOSPI_DELAY_TAXONOMY = [
    {
        "category": "Land acquisition delay",
        "description": "Right of way acquisition bottlenecks and compensation dispute settlements",
    },
    {
        "category": "Forest / environmental clearance delay",
        "description": "Pending Stage-I/II forest clearance or wildlife sanctuary board review",
    },
    {
        "category": "Financing tie-up delay",
        "description": "State equity contribution or multilateral funding tranche disbursement delay",
    },
    {
        "category": "Contractor / tendering issues",
        "description": "Disputes with primary EPC contractor, retendering, or slow mobilization",
    },
    {
        "category": "Law and order problems",
        "description": "Local agitation, security constraints, or regional disruptions",
    },
    {
        "category": "Geological surprises",
        "description": "Unforeseen strata conditions during tunneling, piling, or foundation excavation",
    },
    {
        "category": "Utility shifting",
        "description": "Pending relocation of high-tension powerlines, water mains, or gas pipelines",
    },
    {
        "category": "Lack of infrastructure linkages",
        "description": "Delay in power supply connection, road access, or water supply tie-ups",
    },
]

# Panel timeline configuration
DEFAULT_PANEL_MONTHS = 24             # 24 consecutive monthly reporting periods
PANEL_START_YEAR = 2024
PANEL_START_MONTH = 5                # May 2024 to April 2026
