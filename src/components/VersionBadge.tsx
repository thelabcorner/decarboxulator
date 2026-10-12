/** Quiet version metadata shared by calculator navigation and discovery. */
export function VersionBadge({version}: {version:string}) {
  return <span className="calculator-version-badge" aria-hidden="true" title={`Decarboxulator ${version} release`}>{version}</span>;
}