const DEFAULT_RELEASE_CONTROL_FILE = "release-control.json";

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function institutionalAllowlist(edition) {
  return Array.isArray(edition.calculatorAllowlist)
    ? edition.calculatorAllowlist
    : [];
}

export function validateReleaseControlPayload(payload, edition) {
  if (!isPlainObject(payload)) {
    throw new Error("release control must be a JSON object");
  }
  if (payload.releaseVersion !== edition.releaseVersion) {
    throw new Error("release control releaseVersion does not match this build");
  }
  if (typeof payload.disabled !== "boolean") {
    throw new Error("release control disabled must be boolean");
  }
  if (!Array.isArray(payload.disabledCalculators)) {
    throw new Error("release control disabledCalculators must be an array");
  }
  if (
    payload.message !== undefined &&
    typeof payload.message !== "string"
  ) {
    throw new Error("release control message must be a string when present");
  }

  const allowlist = new Set(institutionalAllowlist(edition));
  const disabledCalculatorIds = [...new Set(payload.disabledCalculators)];
  for (const id of disabledCalculatorIds) {
    if (typeof id !== "string" || id.trim() === "") {
      throw new Error("release control disabled calculator ids must be strings");
    }
    if (!allowlist.has(id)) {
      throw new Error(
        `release control disabled calculator id "${id}" is not in the allowlist`,
      );
    }
  }

  return {
    releaseVersion: payload.releaseVersion,
    disabled: payload.disabled,
    disabledCalculatorIds,
    message: payload.message || "",
  };
}

export function getReleaseControlUrl(edition, origin = window.location.origin) {
  const releaseControlFile =
    edition.releaseControlFile || DEFAULT_RELEASE_CONTROL_FILE;
  const url = new URL(releaseControlFile, `${origin}/`);
  if (url.origin !== origin) {
    throw new Error("release control must be served from the first-party origin");
  }
  return url;
}

export async function fetchInstitutionalReleaseControl(edition) {
  const url = getReleaseControlUrl(edition);
  const response = await fetch(url.href, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`release control request failed with HTTP ${response.status}`);
  }
  const payload = await response.json();
  return validateReleaseControlPayload(payload, edition);
}
