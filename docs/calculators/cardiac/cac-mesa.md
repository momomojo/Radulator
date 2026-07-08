# CAC/MESA cardiac CT calculator

## Scope

This v1 calculator interprets a total Agatston coronary artery calcium (CAC)
score that has already been produced by CT workstation/software. It does not
calculate raw Agatston score from CT pixels, lesion area, HU bins, scanner
protocol, or slice data.

Outputs:

- Absolute CAC burden category: 0, 1-99, 100-299, 300-999, >=1000.
- CAC-DRS A category: A0 for 0, A1 for 1-99, A2 for 100-299, A3 for >=300.
- Optional CAC-DRS N modifier for 1-4 involved coronary vessels.
- MESA percentile context only for age 45-84, female/male, and the four MESA
  race/ethnicity categories.

The calculator is educational/radiology support only. It does not diagnose
obstructive CAD and does not provide medication or prevention-management
recommendations.

## MESA data provenance

The offline MESA lookup table is stored in
`src/data/mesaCacReference.js`. It was generated on 2026-07-08 by POSTing
non-PHI age/sex/race/score combinations to the official MESA CAC Score
Reference Values calculator:

- Official calculator: `https://tools.mesa-nhlbi.org/Calcium/input.aspx`
- Reference page: `https://mesa-nhlbi.org/researchers/tools/cac-score-reference-values`
- Primary paper: McClelland 2006, DOI `10.1161/CIRCULATIONAHA.105.580696`,
  PMID `16365194`

For each age/sex/race group, the generated file stores:

- Probability of nonzero CAC returned by the official calculator.
- 25th, 50th, 75th, and 90th percentile reference Agatston scores.
- Integer score thresholds for official observed percentiles 1-99.

TLS certificate verification was disabled during generation because the local
Python/curl runtime did not trust the `tools.mesa-nhlbi.org` certificate chain.
No patient data or PHI was sent. The app uses only the static generated table
and makes no runtime network calls.

## Required audited examples

These examples are preserved in Playwright coverage:

| Age | Sex | MESA group | Score | Vessels | Expected output |
| --- | --- | --- | ---: | ---: | --- |
| 55 | Male | White/Caucasian | 0 | 0 | 0th percentile; probability nonzero 56%; refs 0/6/68/234; A0 |
| 46 | Female | Chinese American | 35 | 1 | 97th percentile; probability nonzero 7%; refs 0/0/0/0; A1/N1 |
| 62 | Female | Black/African American | 120 | 2 | 91st percentile; probability nonzero 32%; refs 0/0/11/102; A2/N2 |
| 70 | Male | Hispanic | 450 | 3 | 84th percentile; probability nonzero 75%; refs 1/56/247/666; A3/N3 |
| 72 | Male | White/Caucasian | 1200 | 4 | 85th percentile; probability nonzero 86%; refs 32/180/641/1584; A3/N4 |

## References

- Agatston AS et al. J Am Coll Cardiol. 1990;15(4):827-832. DOI
  `10.1016/0735-1097(90)90282-T`, PMID `2407762`.
- McClelland RL et al. Circulation. 2006;113(1):30-37. DOI
  `10.1161/CIRCULATIONAHA.105.580696`, PMID `16365194`.
- MESA/NHLBI CAC Score Reference Values.
- Hecht HS et al. J Cardiovasc Comput Tomogr. 2018;12(3):185-191. DOI
  `10.1016/j.jcct.2018.03.008`, PMID `29793848`.
- Kumar P, Bhatia M. J Cardiovasc Imaging. 2023;31(1):1-17. DOI
  `10.4250/jcvi.2022.0029`, PMID `36693339`.
- Grundy SM et al. Circulation. 2019;139(25):e1082-e1143. DOI
  `10.1161/CIR.0000000000000625`, PMID `30586774`.
- Arnett DK et al. Circulation. 2019;140(11):e596-e646. DOI
  `10.1161/CIR.0000000000000678`, PMID `30879355`.
- Maron DJ et al. JACC Adv. 2024;3(11):101287. DOI
  `10.1016/j.jacadv.2024.101287`, PMID `39385944`.
