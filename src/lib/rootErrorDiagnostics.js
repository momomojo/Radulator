const ROOT_ERROR_CODE = "RADULATOR_RENDER_ERROR";

const reportRootError = () => {
  console.error(ROOT_ERROR_CODE);
};

export const ROOT_ERROR_OPTIONS = Object.freeze({
  onCaughtError: reportRootError,
  onUncaughtError: reportRootError,
  onRecoverableError: reportRootError,
});
