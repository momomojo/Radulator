import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Buffer } from 'node:buffer';

const source = await readFile(new URL('../src/components/calculators/RadiationDoseConverter.jsx', import.meta.url), 'utf8');
const { RadiationDoseConverter } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const compute = RadiationDoseConverter.compute;
const absorbed = { conversion_mode: 'absorbed', absorbed_unit: 'Gy', input_value: '1' };
const ct = { include_ct_dose: true, ctdi_vol: '10', scan_length: '10', body_region: 'head', patient_age: 'adult', ct_phantom: '16' };
const errorOnly = (input) => {
  const result = compute(input);
  assert.equal(typeof result.Error, 'string', JSON.stringify({ input, result }));
  assert.deepEqual(Object.keys(result), ['Error'], 'invalid selected operation must not return a partial success');
};

test('NIST same-quantity anchors preserve useful conversions and explicit zero', () => {
  const gy = compute(absorbed);
  assert.equal(gy['rad'], '100 rad');
  assert.equal(gy['milligray (mGy)'], '1000 mGy');
  const ci = compute({ conversion_mode: 'activity', activity_unit: 'Ci', input_value: '1' });
  assert.equal(ci['gigabecquerel (GBq)'], '37 GBq');
  assert.equal(ci['megabecquerel (MBq)'], '37000 MBq');
  assert.equal(ci['millicurie (mCi)'], '1000 mCi');
  const sv = compute({ conversion_mode: 'equivalent', equivalent_unit: 'Sv', input_value: '1' });
  assert.equal(sv['rem'], '100 rem');
  assert.equal(sv['millisievert (mSv)'], '1000 mSv');
  assert.equal(compute({ ...absorbed, input_value: '0' })['Gray (Gy)'], '0 Gy');
});

test('rejects incomplete decimals, coercion and invalid selected conversion values', () => {
  for (const input_value of ['', ' ', '1garbage', '0x10', '1,000', '-1', 'Infinity', 'NaN', '1e309', true, [], null]) {
    errorOnly({ ...absorbed, input_value });
  }
});

test('unknown mode and unit cannot silently default to a physical quantity', () => {
  errorOnly({ ...absorbed, conversion_mode: 'unknown' });
  for (const [conversion_mode, field] of [['absorbed', 'absorbed_unit'], ['equivalent', 'equivalent_unit'], ['activity', 'activity_unit']]) {
    for (const unit of ['', 'unknown']) errorOnly({ conversion_mode, [field]: unit, input_value: '1' });
  }
  errorOnly({ input_value: '1' });
  errorOnly({});
});

test('finite source values cannot overflow or silently underflow a reported conversion', () => {
  for (const input_value of ['1e308', '1e-400']) errorOnly({ ...absorbed, input_value });
  errorOnly({ conversion_mode: 'equivalent', equivalent_unit: 'mrem', input_value: '5e-324' });
  errorOnly({ conversion_mode: 'activity', activity_unit: 'Bq', input_value: '5e-324' });
  const small = compute({ ...absorbed, input_value: '1e-12' });
  assert.match(small['Gray (Gy)'], /e-12/);
});

test('CT-only works but invalid selected conversion cannot hide behind valid CT', () => {
  assert.equal(compute(ct)['DLP (Dose Length Product)'], '100.0 mGy·cm');
  errorOnly({ ...ct, ...absorbed, input_value: 'oops' });
  errorOnly({ ...ct, ...absorbed, input_value: '' });
  errorOnly({ ...ct, input_value: '1' });
  errorOnly({ ...absorbed, include_ct_dose: 'false' });
});

test('selected CT validates every required quantity and enum before any successful report', () => {
  for (const field of ['ctdi_vol', 'scan_length']) {
    for (const value of ['', '0', '-1', '1foo', 'Infinity', '1e-400']) errorOnly({ ...absorbed, ...ct, [field]: value });
  }
  for (const field of ['patient_age', 'body_region', 'ct_phantom']) {
    for (const value of ['', 'invalid']) errorOnly({ ...absorbed, ...ct, [field]: value });
  }
  errorOnly({ ...ct, ctdi_vol: '1e308', scan_length: '10' });
  errorOnly({ ...ct, ctdi_vol: '5e-324', scan_length: '0.1' });
});

test('AAPM96 region-age cells replace the universal age multiplier', () => {
  // DLP100, independently transcribed Table3 products in mSv, not runtime factors.
  const expected = {
    head: [1.1, .67, .4, .32, .21], neck: [1.7, 1.2, 1.1, .79, .59],
    chest: [3.9, 2.6, 1.8, 1.3, 1.4], abdomen: [4.9, 3, 2, 1.5, 1.5],
    pelvis: [4.9, 3, 2, 1.5, 1.5], trunk: [4.4, 2.8, 1.9, 1.4, 1.5],
  };
  for (const [body_region, doses] of Object.entries(expected)) {
    for (const [index, patient_age] of ['0yr', '1yr', '5yr', '10yr', 'adult'].entries()) {
      const ct_phantom = patient_age !== 'adult' || ['head', 'neck'].includes(body_region) ? '16' : '32';
      const result = compute({ ...ct, body_region, patient_age, ct_phantom });
      assert.equal(Number.parseFloat(result['Estimated Effective Dose']), doses[index], `${body_region}/${patient_age}`);
      assert.match(JSON.stringify(result), /AAPM.*96/i);
      assert.equal(result['Age Adjustment'], undefined);
      assert.equal(result['Assessment'], undefined, 'a population estimate is not a patient-specific normal/abnormal assessment');
    }
  }
});

test('unknown or mismatched phantom preserves DLP but withholds unsupported effective dose', () => {
  for (const ct_phantom of ['unknown', '32']) {
    const result = compute({ ...ct, patient_age: '0yr', ct_phantom });
    assert.equal(result.Error, undefined);
    assert.equal(result['DLP (Dose Length Product)'], '100.0 mGy·cm');
    assert.equal(result['Estimated Effective Dose'], undefined);
    assert.match(result['CT estimate limitation'] ?? '', /phantom/i);
  }
});

test('CT positive results must not format as zero or underflow silently', () => {
  const small = compute({ ...ct, ctdi_vol: '.000001', scan_length: '1' });
  assert.ok(Number.parseFloat(small['DLP (Dose Length Product)']) > 0);
  assert.ok(Number.parseFloat(small['Estimated Effective Dose']) > 0);
  errorOnly({ ...ct, ctdi_vol: '5e-324', scan_length: '1' });
});

test('the CT form exposes phantom confirmation without misleading universal age multipliers', () => {
  const phantom = RadiationDoseConverter.fields.find((field) => field.id === 'ct_phantom');
  assert.ok(phantom, 'clinician must be able to enter the required phantom basis');
  assert.equal(phantom.showIf({ include_ct_dose: true }), true);
  assert.equal(phantom.showIf({ include_ct_dose: false }), false);
  assert.deepEqual(phantom.opts.map((option) => option.value), ['16', '32', 'unknown']);
  const age = RadiationDoseConverter.fields.find((field) => field.id === 'patient_age');
  assert.doesNotMatch(JSON.stringify(age.opts), /[0-9]x|multiplier/i);
  const region = RadiationDoseConverter.fields.find((field) => field.id === 'body_region');
  assert.doesNotMatch(JSON.stringify(region.opts), /k =/);
});

const equivalent = { conversion_mode: 'equivalent', equivalent_unit: 'Sv', input_value: '1' };
test('Sv conversion cannot silently become organ dose or effective-dose risk advice', () => {
  const unconfirmed = compute({ ...equivalent, radiation_type: 'alpha' });
  assert.equal(unconfirmed['Corresponding Absorbed Dose'], undefined);
  assert.equal(unconfirmed['Equivalent Chest X-rays (PA)'], undefined);
  assert.doesNotMatch(JSON.stringify(unconfirmed), /exceeds annual|approaching annual|days of natural background/i);
  const confirmed = compute({ ...equivalent, input_is_organ_equivalent: true, radiation_type: 'alpha' });
  assert.equal(confirmed['Corresponding Absorbed Dose'], '0.05 Gy');
  assert.match(confirmed['Organ dose assumptions'] ?? '', /single radiation|one radiation/i);
});

test('organ-dose inverse validates consent, radiation and neutron energy without defaults', () => {
  errorOnly({ ...equivalent, input_is_organ_equivalent: 'false' });
  for (const radiation_type of ['', 'unknown', 'neutron_med']) {
    errorOnly({ ...equivalent, input_is_organ_equivalent: true, radiation_type });
  }
  for (const neutron_energy_mev of ['', '0', '-1', '1foo', 'Infinity']) {
    errorOnly({ ...equivalent, input_is_organ_equivalent: true, radiation_type: 'neutron', neutron_energy_mev });
  }
});

test('IAEA115 neutron-energy weighting covers all three source branches', () => {
  const fixtures = [[.1, 10.02154755744613], [.999999, 20.69999999999697], [1, 20.69179307706779], [10, 8.809424145952329], [50, 5.495897812701171], [50.000001, 5.499901603812235], [100, 4.859271740927569]];
  for (const [neutron_energy_mev, expected] of fixtures) {
    const result = compute({ ...equivalent, input_is_organ_equivalent: true, radiation_type: 'neutron', neutron_energy_mev });
    assert.equal(result.Error, undefined);
    assert.ok(Math.abs(Number.parseFloat(result['wR Factor']) - expected) < .0001, JSON.stringify(result));
  }
  for (const [radiation_type, expected] of [['photon', 1], ['beta', 1], ['proton', 2], ['alpha', 20]]) {
    const result = compute({ ...equivalent, input_is_organ_equivalent: true, radiation_type });
    assert.equal(Number.parseFloat(result['wR Factor']), expected);
  }
});

test('unit-only output does not invent an administered-activity assessment or Gy-to-effective-dose equivalence', () => {
  const activity = compute({ conversion_mode: 'activity', activity_unit: 'MBq', input_value: '185' });
  assert.equal(activity['Clinical Context'], undefined);
  assert.doesNotMatch(JSON.stringify(activity), /below typical|typical.*dose|therapeutic.*range/i);
  assert.match(activity['Activity limitation'] ?? '', /activity alone/i);
  const gy = compute(absorbed);
  assert.equal(gy['Note (wR = 1)'], undefined);
  assert.match(gy['Quantity limitation'] ?? '', /tissue/i);
});

test('organ-dose and neutron form controls require explicit applicable inputs', () => {
  const fields = RadiationDoseConverter.fields;
  const confirmation = fields.find((f) => f.id === 'input_is_organ_equivalent');
  assert.ok(confirmation);
  assert.equal(confirmation.showIf(equivalent), true);
  assert.equal(confirmation.showIf(absorbed), false);
  const radiation = fields.find((f) => f.id === 'radiation_type');
  assert.equal(radiation.showIf(equivalent), false);
  assert.equal(radiation.showIf({ ...equivalent, input_is_organ_equivalent: true }), true);
  assert.ok(radiation.opts.some((option) => option.value === 'neutron'));
  const energy = fields.find((f) => f.id === 'neutron_energy_mev');
  assert.ok(energy);
  assert.equal(energy.showIf({ ...equivalent, input_is_organ_equivalent: true, radiation_type: 'neutron' }), true);
  assert.equal(energy.showIf({ ...equivalent, input_is_organ_equivalent: false, radiation_type: 'neutron' }), false);
});

test('every offered unit independently resolves to the NIST reference quantity', () => {
  const cases = [
    ['absorbed','Gy',1,'Gray (Gy)',1], ['absorbed','mGy',1000,'Gray (Gy)',1],
    ['absorbed','cGy',100,'Gray (Gy)',1], ['absorbed','rad',100,'Gray (Gy)',1],
    ['equivalent','Sv',1,'Sievert (Sv)',1], ['equivalent','mSv',1000,'Sievert (Sv)',1],
    ['equivalent','uSv',1e6,'Sievert (Sv)',1], ['equivalent','rem',100,'Sievert (Sv)',1],
    ['equivalent','mrem',1e5,'Sievert (Sv)',1],
    ['activity','Bq',37e9,'gigabecquerel (GBq)',37], ['activity','kBq',37e6,'gigabecquerel (GBq)',37],
    ['activity','MBq',37000,'gigabecquerel (GBq)',37], ['activity','GBq',37,'gigabecquerel (GBq)',37],
    ['activity','Ci',1,'gigabecquerel (GBq)',37], ['activity','mCi',1000,'gigabecquerel (GBq)',37],
    ['activity','uCi',1e6,'gigabecquerel (GBq)',37],
  ];
  for (const [conversion_mode, unit, input_value, output, expected] of cases) {
    assert.equal(Number.parseFloat(compute({ conversion_mode, [`${conversion_mode}_unit`]: unit, input_value })[output]), expected);
  }
});

test('optional organ confirmation rejects non-booleans and the inverse rejects underflow', () => {
  errorOnly({ ...equivalent, input_is_organ_equivalent: null });
  errorOnly({ ...equivalent, input_is_organ_equivalent: 1 });
  errorOnly({ ...equivalent, input_value: '5e-324', input_is_organ_equivalent: true, radiation_type: 'alpha' });
  const high = compute({ ...equivalent, input_is_organ_equivalent: true, radiation_type: 'neutron', neutron_energy_mev: '1e308' });
  assert.equal(Number.parseFloat(high['wR Factor']), 2.5);
  assert.equal(high['Corresponding Absorbed Dose'], '0.4 Gy');
});

test('CT-only reports emphasize the calculation with informational rather than clinical-success styling', () => {
  const supported = compute(ct);
  assert.equal(Object.keys(supported)[0], 'Estimated Effective Dose');
  assert.equal(supported._severity, 'info');
  const unknown = compute({ ...ct, ct_phantom: 'unknown' });
  assert.equal(Object.keys(unknown)[0], 'DLP (Dose Length Product)');
  assert.equal(unknown._severity, 'info');
});

test('enum lookup cannot coerce arrays or objects into a mode, unit or radiation type', () => {
  errorOnly({ ...absorbed, conversion_mode: ['absorbed'], input_is_organ_equivalent: true, radiation_type: 'alpha' });
  for (const value of [['Gy'], { toString: () => 'Gy' }, true, 1]) errorOnly({ ...absorbed, absorbed_unit: value });
  for (const value of [['alpha'], { toString: () => 'alpha' }, true, 1]) {
    errorOnly({ ...equivalent, input_is_organ_equivalent: true, radiation_type: value });
  }
});

test('nontrivial unit round trips retain independently calculated values within display precision', () => {
  // Catches premature input rounding or reversed unit factors. The return leg
  // deliberately uses the displayed value, as a clinician copying it would.
  const cases = [
    ['absorbed', 'Gy', '1.23456', 'milligray (mGy)', '1234.56 mGy', 'mGy', 'Gray (Gy)', '1.2346 Gy'],
    ['equivalent', 'Sv', '.0123456', 'rem', '1.2346 rem', 'rem', 'Sievert (Sv)', '0.012346 Sv'],
    ['activity', 'MBq', '37.123', 'millicurie (mCi)', '1.0033 mCi', 'mCi', 'megabecquerel (MBq)', '37.1221 MBq'],
  ];
  for (const [mode, unit, value, out, displayed, backUnit, backOut, expected] of cases) {
    const forward = compute({ conversion_mode: mode, [`${mode}_unit`]: unit, input_value: value });
    assert.equal(forward[out], displayed);
    const back = compute({ conversion_mode: mode, [`${mode}_unit`]: backUnit, input_value: displayed.split(' ')[0] });
    assert.equal(back[backOut], expected);
  }
});
