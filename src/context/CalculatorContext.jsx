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
import {
  ACTIONS,
  calculatorReducer,
  createInitialState,
} from "./calculatorState.js";

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

  const resetCalculator = useCallback(() => {
    dispatch({ type: ACTIONS.RESET_CALCULATOR });
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
    resetCalculator,
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
