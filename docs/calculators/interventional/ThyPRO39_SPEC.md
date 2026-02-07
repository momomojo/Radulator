# ThyPRO-39 Scoring Specification

## Scope

This specification defines the scoring contract for `src/components/calculators/ThyPRO39.jsx`.
It is the source of truth for:

- Item-to-subscale mapping
- Normalization and composite formulas
- Delta interpretation for longitudinal TAE follow-up

## Version

- Spec version: `thypro39-spec-v1`
- Calculator id: `thypro-39`

## Instrument Model

- Total items: `39`
- Response scale for each item: `0..4`
- Response anchors:
  - `0 = Not at all`
  - `1 = A little`
  - `2 = Some`
  - `3 = Quite a bit`
  - `4 = Very much`
- Higher score indicates worse thyroid-related quality of life.

## Subscale Mapping

- `Goiter Symptoms`: `gs1..gs3` (3 items)
- `Hyperthyroid Symptoms`: `hy1..hy4` (4 items)
- `Hypothyroid Symptoms`: `ho1..ho4` (4 items)
- `Eye Symptoms`: `ey1..ey3` (3 items)
- `Tiredness`: `ti1..ti3` (3 items)
- `Cognitive Problems`: `co1..co3` (3 items)
- `Anxiety`: `an1..an3` (3 items)
- `Depression`: `de1..de3` (3 items)
- `Emotional Susceptibility`: `em1..em3` (3 items)
- `Impaired Social Life`: `sl1..sl3` (3 items)
- `Impaired Daily Life`: `dl1..dl3` (3 items)
- `Cosmetic Complaints`: `cc1..cc3` (3 items)
- `Overall QoL`: `qol1` (1 item)

## Scoring Formula

For each subscale:

- `raw_sum = sum(item responses in subscale)`
- `max_sum = item_count * 4`
- `normalized_score = (raw_sum / max_sum) * 100`

Output format in UI:

- `"{score.toFixed(1)} / 100"`

## Composite Definition

Composite includes:

- `Tiredness`
- `Cognitive Problems`
- `Anxiety`
- `Depression`
- `Emotional Susceptibility`
- `Impaired Social Life`
- `Impaired Daily Life`
- `Overall QoL`

Equivalent index set in `SUBSCALES`:

- `[4, 5, 6, 7, 8, 9, 10, 12]`

Composite formula:

- `composite_raw_sum = sum(raw item values over included scales)`
- `composite_max_sum = sum(max item values over included scales)`
- `composite_score = (composite_raw_sum / composite_max_sum) * 100`

## App Severity Buckets (UI Convention)

The following labels are app-level interpretation buckets:

- `0..25`: `Minimal impact`
- `>25..50`: `Moderate impact`
- `>50..75`: `Significant impact`
- `>75..100`: `Severe impact`

These buckets are implementation conventions for readability and not a formal instrument standard.

## Longitudinal (Baseline vs Follow-up) Delta Convention

- Delta is computed as: `follow_up - baseline`
- Negative delta indicates improvement
- Positive delta indicates worsening

Primary TAE reporting targets:

- `Goiter Symptoms`
- `Hyperthyroid Symptoms`
- `Cosmetic Complaints`
- `Overall QoL`
- `Composite Score`

MIC context (for interpretive support only):

- Group MIC range reported for ThyPRO scales: `6.3..14.3`
- Individual MIC range reported: `8.0..21.1`

## Validation Rules

- Single assessment mode: all `39` items required.
- Baseline-vs-follow-up mode: all `78` items required (39 baseline + 39 follow-up).

## Provenance

- Watt T, et al. Development of a short version of the ThyPRO. Thyroid. 2015;25(10):1069-79. DOI: `10.1089/thy.2015.0209`
- Watt T, et al. Responsiveness of ThyPRO. J Clin Endocrinol Metab. 2014;99(7):2325-32. DOI: `10.1210/jc.2014-1322`
- Watt T, et al. Minimal important change for ThyPRO. Eur Thyroid J. 2021. PMID: `33617467`
- Singh R, et al. TAE outcomes with ThyPRO-39 in nodular/multinodular goiter. Cardiovasc Intervent Radiol. 2025;48:1021-1029. DOI: `10.1007/s00270-025-04055-1`

## Licensing and Use Note

Questionnaire wording and scoring usage should remain aligned with instrument governance/licensing requirements. This repository implementation is intended for clinical decision support and outcome tracking, not as a replacement for formal licensing guidance.
