import assert from "node:assert/strict";
import {
  ACTIONS,
  calculatorReducer,
  createInitialState,
} from "../src/context/calculatorState.js";

const result = { Recommendation: "stale" };

function stateWithResult(overrides = {}) {
  return {
    ...createInitialState("test-calculator"),
    out: result,
    ...overrides,
  };
}

function assertInputMutationClearsResults(action, overrides) {
  const next = calculatorReducer(stateWithResult(overrides), action);
  assert.equal(next.out, null, `${action.type} must invalidate current results`);
}

assertInputMutationClearsResults({
  type: ACTIONS.UPDATE_FIELD,
  field: "value",
  value: "1",
});
assertInputMutationClearsResults({
  type: ACTIONS.BATCH_UPDATE_FIELDS,
  updates: { first: "1", second: "2" },
});

assertInputMutationClearsResults({
  type: ACTIONS.SET_MRE_ROWS,
  rows: [{ kpa: "2.8", area: "50" }],
});
assertInputMutationClearsResults({ type: ACTIONS.ADD_MRE_ROW });
assertInputMutationClearsResults(
  { type: ACTIONS.REMOVE_MRE_ROW, index: 1 },
  { mreRows: [{ kpa: "2", area: "10" }, { kpa: "3", area: "20" }] },
);
assertInputMutationClearsResults({
  type: ACTIONS.UPDATE_MRE_ROW,
  index: 0,
  data: { kpa: "3.1" },
});

assertInputMutationClearsResults({
  type: ACTIONS.SET_IPSS_ROWS,
  rows: [{ time: "3", leftACTH: "100" }],
});
assertInputMutationClearsResults({ type: ACTIONS.ADD_IPSS_ROW });
assertInputMutationClearsResults(
  { type: ACTIONS.REMOVE_IPSS_ROW, index: 1 },
  { ipssRows: [{ time: "3" }, { time: "6" }] },
);
assertInputMutationClearsResults({
  type: ACTIONS.UPDATE_IPSS_ROW,
  index: 0,
  data: { leftACTH: "120" },
});

console.log("Calculator context invalidates results for every input mutation.");
