/**
 * Calculator Context - Centralized state management for calculator operations
 * Uses useReducer for predictable state updates
 */
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
} from "react";

// Action types
const ACTIONS = {
  SELECT_CALCULATOR: "SELECT_CALCULATOR",
  UPDATE_FIELD: "UPDATE_FIELD",
  BATCH_UPDATE_FIELDS: "BATCH_UPDATE_FIELDS",
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

// Initial state
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

const createInitialState = (defaultCalculatorId) => ({
  active: defaultCalculatorId,
  vals: {},
  out: null,
  mreRows: [{ ...initialMreRow }],
  ipssRows: [{ ...initialIpssRow }],
});

// Reducer function
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
      };

    case ACTIONS.BATCH_UPDATE_FIELDS:
      return {
        ...state,
        vals: { ...state.vals, ...action.updates },
      };

    case ACTIONS.SET_RESULTS:
      return { ...state, out: action.results };

    case ACTIONS.CLEAR_RESULTS:
      return { ...state, out: null };

    // MRE Row management
    case ACTIONS.SET_MRE_ROWS:
      return { ...state, mreRows: action.rows };

    case ACTIONS.ADD_MRE_ROW:
      return { ...state, mreRows: [...state.mreRows, { ...initialMreRow }] };

    case ACTIONS.REMOVE_MRE_ROW:
      if (state.mreRows.length <= 1) return state;
      return {
        ...state,
        mreRows: state.mreRows.filter((_, idx) => idx !== action.index),
      };

    case ACTIONS.UPDATE_MRE_ROW:
      return {
        ...state,
        mreRows: state.mreRows.map((row, idx) =>
          idx === action.index ? { ...row, ...action.data } : row,
        ),
      };

    // IPSS Row management
    case ACTIONS.SET_IPSS_ROWS:
      return { ...state, ipssRows: action.rows };

    case ACTIONS.ADD_IPSS_ROW:
      return { ...state, ipssRows: [...state.ipssRows, { ...initialIpssRow }] };

    case ACTIONS.REMOVE_IPSS_ROW:
      if (state.ipssRows.length <= 1) return state;
      return {
        ...state,
        ipssRows: state.ipssRows.filter((_, idx) => idx !== action.index),
      };

    case ACTIONS.UPDATE_IPSS_ROW:
      return {
        ...state,
        ipssRows: state.ipssRows.map((row, idx) =>
          idx === action.index ? { ...row, ...action.data } : row,
        ),
      };

    default:
      return state;
  }
}

// Create context
const CalculatorContext = createContext(null);

/**
 * Calculator Provider component
 * Wraps app to provide calculator state to all children
 */
export function CalculatorProvider({ children, defaultCalculatorId }) {
  const [state, dispatch] = useReducer(
    calculatorReducer,
    defaultCalculatorId,
    createInitialState,
  );

  // Memoized action creators
  const selectCalculator = useCallback((id) => {
    dispatch({ type: ACTIONS.SELECT_CALCULATOR, id });
  }, []);

  const updateField = useCallback((field, value) => {
    dispatch({ type: ACTIONS.UPDATE_FIELD, field, value });
  }, []);

  const batchUpdateFields = useCallback((updates) => {
    dispatch({ type: ACTIONS.BATCH_UPDATE_FIELDS, updates });
  }, []);

  const setResults = useCallback((results) => {
    dispatch({ type: ACTIONS.SET_RESULTS, results });
  }, []);

  const clearResults = useCallback(() => {
    dispatch({ type: ACTIONS.CLEAR_RESULTS });
  }, []);

  // MRE row actions
  const addMreRow = useCallback(() => {
    dispatch({ type: ACTIONS.ADD_MRE_ROW });
  }, []);

  const removeMreRow = useCallback((index) => {
    dispatch({ type: ACTIONS.REMOVE_MRE_ROW, index });
  }, []);

  const updateMreRow = useCallback((index, data) => {
    dispatch({ type: ACTIONS.UPDATE_MRE_ROW, index, data });
  }, []);

  // IPSS row actions
  const addIpssRow = useCallback(() => {
    dispatch({ type: ACTIONS.ADD_IPSS_ROW });
  }, []);

  const removeIpssRow = useCallback((index) => {
    dispatch({ type: ACTIONS.REMOVE_IPSS_ROW, index });
  }, []);

  const updateIpssRow = useCallback((index, data) => {
    dispatch({ type: ACTIONS.UPDATE_IPSS_ROW, index, data });
  }, []);

  const value = {
    // State
    ...state,
    // Actions
    selectCalculator,
    updateField,
    batchUpdateFields,
    setResults,
    clearResults,
    addMreRow,
    removeMreRow,
    updateMreRow,
    addIpssRow,
    removeIpssRow,
    updateIpssRow,
  };

  return (
    <CalculatorContext.Provider value={value}>
      {children}
    </CalculatorContext.Provider>
  );
}

/**
 * Hook to access calculator context
 * @throws {Error} if used outside of CalculatorProvider
 */
export function useCalculator() {
  const context = useContext(CalculatorContext);
  if (!context) {
    throw new Error("useCalculator must be used within a CalculatorProvider");
  }
  return context;
}

export { ACTIONS };
