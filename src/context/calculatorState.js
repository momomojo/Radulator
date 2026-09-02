const ACTIONS = {
  SELECT_CALCULATOR: "SELECT_CALCULATOR",
  UPDATE_FIELD: "UPDATE_FIELD",
  BATCH_UPDATE_FIELDS: "BATCH_UPDATE_FIELDS",
  RESET_CALCULATOR: "RESET_CALCULATOR",
  SET_RESULTS: "SET_RESULTS",
  CLEAR_RESULTS: "CLEAR_RESULTS",
  SET_MRE_ROWS: "SET_MRE_ROWS",
  ADD_MRE_ROW: "ADD_MRE_ROW",
  REMOVE_MRE_ROW: "REMOVE_MRE_ROW",
  UPDATE_MRE_ROW: "UPDATE_MRE_ROW",
  SET_IPSS_ROWS: "SET_IPSS_ROWS",
  ADD_IPSS_ROW: "ADD_IPSS_ROW",
  REMOVE_IPSS_ROW: "REMOVE_IPSS_ROW",
  UPDATE_IPSS_ROW: "UPDATE_IPSS_ROW",
};

const initialMreRow = { kpa: "", area: "" };
const initialIpssRow = {
  time: "",
  leftACTH: "",
  rightACTH: "",
  periphACTH: "",
  leftPRL: "",
  rightPRL: "",
  periphPRL: "",
};

function createInitialState(defaultCalculatorId) {
  return {
    active: defaultCalculatorId,
    vals: {},
    out: null,
    mreRows: [{ ...initialMreRow }],
    ipssRows: [{ ...initialIpssRow }],
  };
}

function calculatorReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SELECT_CALCULATOR:
      return {
        ...state,
        active: action.id,
        vals: {},
        out: null,
        mreRows: [{ ...initialMreRow }],
        ipssRows: [{ ...initialIpssRow }],
      };

    case ACTIONS.UPDATE_FIELD:
      return {
        ...state,
        vals: { ...state.vals, [action.field]: action.value },
        out: null,
      };

    case ACTIONS.BATCH_UPDATE_FIELDS:
      return {
        ...state,
        vals: { ...state.vals, ...action.updates },
        out: null,
      };

    case ACTIONS.RESET_CALCULATOR:
      return {
        ...state,
        vals: {},
        out: null,
        mreRows: [{ ...initialMreRow }],
        ipssRows: [{ ...initialIpssRow }],
      };

    case ACTIONS.SET_RESULTS:
      return { ...state, out: action.results };

    case ACTIONS.CLEAR_RESULTS:
      return { ...state, out: null };

    case ACTIONS.SET_MRE_ROWS:
      return { ...state, mreRows: action.rows, out: null };

    case ACTIONS.ADD_MRE_ROW:
      return {
        ...state,
        mreRows: [...state.mreRows, { ...initialMreRow }],
        out: null,
      };

    case ACTIONS.REMOVE_MRE_ROW:
      if (state.mreRows.length <= 1) return state;
      return {
        ...state,
        mreRows: state.mreRows.filter((_, idx) => idx !== action.index),
        out: null,
      };

    case ACTIONS.UPDATE_MRE_ROW:
      return {
        ...state,
        mreRows: state.mreRows.map((row, idx) =>
          idx === action.index ? { ...row, ...action.data } : row,
        ),
        out: null,
      };

    case ACTIONS.SET_IPSS_ROWS:
      return { ...state, ipssRows: action.rows, out: null };

    case ACTIONS.ADD_IPSS_ROW:
      return {
        ...state,
        ipssRows: [...state.ipssRows, { ...initialIpssRow }],
        out: null,
      };

    case ACTIONS.REMOVE_IPSS_ROW:
      if (state.ipssRows.length <= 1) return state;
      return {
        ...state,
        ipssRows: state.ipssRows.filter((_, idx) => idx !== action.index),
        out: null,
      };

    case ACTIONS.UPDATE_IPSS_ROW:
      return {
        ...state,
        ipssRows: state.ipssRows.map((row, idx) =>
          idx === action.index ? { ...row, ...action.data } : row,
        ),
        out: null,
      };

    default:
      return state;
  }
}

export { ACTIONS, calculatorReducer, createInitialState };
