"""
National PAIMANA reference statistics.

These are macro reference figures quoted in SIH problem statement SIH26103
(April 2026). They describe the NATIONAL PAIMANA portfolio.

They are NOT computed from, and must never be conflated with, the projects
loaded inside this application - whether synthetic demo data or an imported
PAIMANA extract. Every surface that renders these numbers must display the
source label alongside them.
"""

NATIONAL_REFERENCE = {
    "label": "National PAIMANA reference statistics - April 2026",
    "source": "SIH 2026 problem statement SIH26103",
    "as_of": "April 2026",
    "is_application_data": False,
    "note": (
        "Macro reference figures quoted in the problem statement. These are not "
        "derived from the dataset loaded in this application and are shown for "
        "national context only."
    ),
    "metrics": {
        "projects": {
            "label": "Projects",
            "value": 1981,
            "display": "1,981",
            "unit": "count",
        },
        "original_approved_cost": {
            "label": "Original Approved Cost",
            "value_lakh_crore": 37.13,
            "display": "~ Rs 37.13 Lakh Cr",
            "unit": "lakh crore",
            "approximate": True,
        },
        "revised_cost": {
            "label": "Revised Cost",
            "value_lakh_crore": 42.78,
            "display": "~ Rs 42.78 Lakh Cr",
            "unit": "lakh crore",
            "approximate": True,
        },
        "cumulative_expenditure": {
            "label": "Cumulative Expenditure",
            "value_lakh_crore": 20.36,
            "display": "~ Rs 20.36 Lakh Cr",
            "unit": "lakh crore",
            "approximate": True,
        },
        "ministries": {
            "label": "Ministries",
            "value": 17,
            "display": "17",
            "unit": "count",
        },
        "sectors": {
            "label": "Sectors",
            "value": 22,
            "display": "22",
            "unit": "count",
        },
    },
}


def get_national_reference():
    return NATIONAL_REFERENCE
