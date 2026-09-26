/**
 * Analytics compatibility surface.
 *
 * Application analytics are paused for the privacy baseline. Keep the named
 * exports so existing UI callers remain behaviorally unchanged, but do not
 * forward event names or parameters to a destination, browser global, or log.
 */
const noop = () => {};

export const trackCalculatorSelected = noop;
export const trackCalculation = noop;
export const trackCSVDownload = noop;
export const trackOutboundLink = noop;
export const trackFeedbackSubmission = noop;
export const trackResultsCopied = noop;
export const trackResultViewed = noop;
export const trackOnboarding = noop;
export const trackSearch = noop;
