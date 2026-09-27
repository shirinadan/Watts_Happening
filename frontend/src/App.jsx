import { useMemo, useState } from "react";
import OpportunityMap from "./components/OpportunityMap.jsx";
import { mapReferenceAreas, opportunities } from "./data/opportunities.js";
import "./App.css";

function projectKey(project) {
  return `${project.utility}:${project.title}`;
}

function normalizeSearchText(value) {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const allProjects = Array.from(
  new Map(
    opportunities.flatMap((opportunity) =>
      [opportunity.descProject, opportunity.gpcProject].map((project) => [
        projectKey(project),
        project,
      ]),
    ),
  ).values(),
);
const rankedOpportunities = opportunities.filter(
  (opportunity) => opportunity.score !== null,
);
const defaultOpportunity = rankedOpportunities[0] ?? opportunities[0];

function formatDate(value) {
  if (!value) return "Not source-verified";

  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDistance(value) {
  return value === null ? "Unavailable" : `${value.toFixed(1)} mi*`;
}

function formatGap(value) {
  return value === null ? "Unavailable" : `${value} days`;
}

function ProjectComparison({ project, comparisonClass }) {
  const verified = project.plannedDate !== null;

  return (
    <article className={`utility-comparison ${comparisonClass}`}>
      <span className="comparison-label">{project.utility}</span>
      <h3>{project.title}</h3>
      <dl>
        <div>
          <dt>Area</dt>
          <dd>{project.area}</dd>
        </div>
        <div>
          <dt>Planned date</dt>
          <dd>{formatDate(project.plannedDate)}</dd>
        </div>
        <div>
          <dt>Source check</dt>
          <dd className={verified ? "source-verified" : "source-pending"}>
            {project.sourceStatus}
          </dd>
        </div>
        {project.sourceProjectId && (
          <div>
            <dt>Project ID</dt>
            <dd>{project.sourceProjectId}</dd>
          </div>
        )}
      </dl>
      <p className="source-file">{project.sourceFile}</p>
    </article>
  );
}

function App() {
  const [selectedId, setSelectedId] = useState(defaultOpportunity.id);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectKey, setSelectedProjectKey] = useState(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const normalizedQuery = normalizeSearchText(searchQuery);
  const projectSuggestions = normalizedQuery
    ? allProjects.filter((project) => {
        const searchValues = [
          project.title,
          project.utility,
          project.area,
          project.sourceProjectId,
          ...(project.aliases ?? []),
        ]
          .filter(Boolean)
          .map(normalizeSearchText);
        return searchValues.some((value) => value.includes(normalizedQuery));
      })
    : [];
  const selectedProject = allProjects.find(
    (project) => projectKey(project) === selectedProjectKey,
  );
  const filteredOpportunities = useMemo(
    () =>
      selectedProject
        ? opportunities.filter(
            (opportunity) =>
              projectKey(opportunity.descProject) === selectedProjectKey ||
              projectKey(opportunity.gpcProject) === selectedProjectKey,
          )
        : opportunities,
    [selectedProjectKey, selectedProject],
  );
  const selectedOpportunity =
    opportunities.find((opportunity) => opportunity.id === selectedId) ??
    defaultOpportunity;
  const highlightedOpportunityIds = useMemo(
    () =>
      selectedProject
        ? filteredOpportunities.map((opportunity) => opportunity.id)
        : [selectedOpportunity.id],
    [selectedProject, filteredOpportunities, selectedOpportunity.id],
  );
  const verifiedDateCount = allProjects.filter(
    (project) => project.plannedDate !== null,
  ).length;

  function chooseProject(project) {
    const key = projectKey(project);
    const firstRelatedOpportunity = opportunities.find(
      (opportunity) =>
        projectKey(opportunity.descProject) === key ||
        projectKey(opportunity.gpcProject) === key,
    );

    setSearchQuery(project.title);
    setSelectedProjectKey(key);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(0);
    if (firstRelatedOpportunity) setSelectedId(firstRelatedOpportunity.id);
  }

  function clearProjectSearch() {
    setSearchQuery("");
    setSelectedProjectKey(null);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(0);
    setSelectedId(defaultOpportunity.id);
  }

  function handleSearchKeyDown(event) {
    if (event.key === "Escape") {
      setSuggestionsOpen(false);
      return;
    }
    if (event.key === "ArrowDown" && suggestionsOpen && projectSuggestions.length) {
      event.preventDefault();
      setActiveSuggestionIndex((index) => (index + 1) % projectSuggestions.length);
      return;
    }
    if (event.key === "ArrowUp" && suggestionsOpen && projectSuggestions.length) {
      event.preventDefault();
      setActiveSuggestionIndex(
        (index) => (index - 1 + projectSuggestions.length) % projectSuggestions.length,
      );
      return;
    }
    if (event.key === "Enter" && suggestionsOpen && projectSuggestions.length) {
      event.preventDefault();
      chooseProject(projectSuggestions[activeSuggestionIndex]);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <p className="brand-kicker">Sperry Tech × Shell Hacks 2026</p>
          <h1>Watts Happening</h1>
          <p className="brand-description">
            Regional view of utility planning projects
          </p>
        </div>
        <div className="nav-actions">
          <div className="project-search">
            <label className="visually-hidden" htmlFor="project-search-input">
              Search a project or candidate
            </label>
            <span className="search-icon" aria-hidden="true" />
            <input
              id="project-search-input"
              type="search"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={suggestionsOpen && Boolean(searchQuery.trim())}
              aria-controls="project-search-suggestions"
              aria-activedescendant={
                suggestionsOpen && projectSuggestions[activeSuggestionIndex]
                  ? `project-suggestion-${activeSuggestionIndex}`
                  : undefined
              }
              autoComplete="off"
              placeholder="Search a project or candidate…"
              value={searchQuery}
              onFocus={() => {
                if (searchQuery.trim()) setSuggestionsOpen(true);
              }}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSelectedProjectKey(null);
                setSuggestionsOpen(true);
                setActiveSuggestionIndex(0);
              }}
              onKeyDown={handleSearchKeyDown}
            />
            {searchQuery && (
              <button
                className="search-clear"
                type="button"
                onClick={clearProjectSearch}
                aria-label="Clear search"
                title="Clear search"
              >
                ×
              </button>
            )}
            {suggestionsOpen && searchQuery.trim() && (
              <div
                className="search-suggestions"
                id="project-search-suggestions"
                role="listbox"
              >
                {projectSuggestions.length ? (
                  projectSuggestions.map((project, index) => (
                    <button
                      className={`search-suggestion ${
                        index === activeSuggestionIndex ? "active-suggestion" : ""
                      }`}
                      id={`project-suggestion-${index}`}
                      key={projectKey(project)}
                      type="button"
                      role="option"
                      aria-selected={index === activeSuggestionIndex}
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                      onClick={() => chooseProject(project)}
                    >
                      <span className="suggestion-project-name">{project.title}</span>
                      <span className="suggestion-project-meta">
                        {project.utility} · {project.area}
                        {project.sourceProjectId && ` · ID ${project.sourceProjectId}`}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="no-search-results">No matching projects found.</p>
                )}
              </div>
            )}
          </div>
          <div className="status-chip">
            <span className="status-light" />
            Source review in progress
          </div>
        </div>
      </header>

      <section className="insight-strip" aria-label="Source and ranking summary">
        <article className="insight-card">
          <span>Candidate pairings</span>
          <strong>{opportunities.length}</strong>
          <small>From the prototype list</small>
        </article>
        <article className="insight-card">
          <span>Project dates verified</span>
          <strong>{verifiedDateCount} / {allProjects.length}</strong>
          <small>Against the provided PDFs</small>
        </article>
        <article className="insight-card">
          <span>Pairings with a score</span>
          <strong>{rankedOpportunities.length}</strong>
          <small>All score inputs available</small>
        </article>
        <article className="insight-card">
          <span>Selected reference gap</span>
          <strong>{formatDistance(selectedOpportunity.referenceDistanceMiles)}</strong>
          <small>Between regional reference points</small>
        </article>
      </section>

      <section className="dashboard-grid">
        <section className="map-panel" aria-label="Regional reference map">
          <div className="map-heading">
            <div>
              <p className="eyebrow">Regional overview</p>
              <h2>South Carolina · Georgia</h2>
            </div>
            <span>Municipality references</span>
          </div>
          <OpportunityMap
            opportunity={selectedOpportunity}
            referenceAreas={mapReferenceAreas}
            opportunities={opportunities}
            highlightedOpportunityIds={highlightedOpportunityIds}
            selectedOpportunityId={selectedOpportunity.id}
            onSelectOpportunity={setSelectedId}
          />
          <div className="map-legend" aria-label="Map legend">
            <div className="map-legend-item">
              <span className="legend-reference legend-reference-selected" />
              Selected area reference
            </div>
            <div className="map-legend-item">
              <span className="legend-reference legend-reference-other" />
              Other area reference
            </div>
            <div className="map-legend-item">
              <span className="legend-pairing-dot" />
              Other opportunity
            </div>
            <div className="map-legend-item">
              <span className="legend-related-dot" />
              Search match
            </div>
            <div className="map-legend-item">
              <span className="legend-selected-dot" />
              Selected pairing
            </div>
            <div className="map-legend-item">
              <span className="legend-line" />
              Reference distance
            </div>
          </div>
          <p className="map-note">
            Pins show public city or county reference areas, not substations,
            transmission lines, or project sites. The dashed connector is an
            area-reference comparison only.
          </p>
        </section>

        <aside className="side-panel">
          <section className="description-card">
            {selectedProject && (
              <div className="selected-project-banner">
                <span>Selected project</span>
                <strong>{selectedProject.title}</strong>
              </div>
            )}
            <div className="card-topline">
              <p className="eyebrow">Selected candidate</p>
              <span
                className={`overlap-badge ${
                  selectedOpportunity.score === null ? "overlap-badge-pending" : ""
                }`}
              >
                {selectedOpportunity.score === null
                  ? "Needs source review"
                  : `Score ${selectedOpportunity.score} / 100`}
              </span>
            </div>
            <div className="comparison-header">
              <h2>{selectedOpportunity.location}</h2>
              <p>
                Reference gap {formatDistance(selectedOpportunity.referenceDistanceMiles)}
                {" · Timeline gap "}
                {formatGap(selectedOpportunity.daysApart)}
              </p>
            </div>
            <div className="comparison-grid">
              <ProjectComparison
                project={selectedOpportunity.descProject}
                comparisonClass="desc-comparison"
              />
              <ProjectComparison
                project={selectedOpportunity.gpcProject}
                comparisonClass="gpc-comparison"
              />
            </div>
            <div className="coordination-note">
              <span className="note-label">Screening method</span>
              <strong>
                {selectedOpportunity.score === null
                  ? "This pairing is not ranked yet"
                  : "Timeline and regional proximity heuristic"}
              </strong>
              <p>
                Score = 60% date fit within five years + 40% reference-point fit
                within 25 miles. Missing or unverified inputs leave a pairing
                unranked; this is not a construction recommendation.
              </p>
            </div>
          </section>
        </aside>
      </section>

      <section className="opportunities-card">
        {selectedProject && (
          <p className="active-project-filter">
            Coordination pairings for: <strong>{selectedProject.title}</strong>
          </p>
        )}
        <div className="section-heading">
          <div>
            <p className="eyebrow">Calculated from local records</p>
            <h2>Candidate Coordination Pairings</h2>
          </div>
          <p className="threshold">
            Ranked only when both planned dates and two distinct regional
            references are available
          </p>
        </div>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Dominion Energy SC project</th>
                <th>Georgia Power project</th>
                <th>DESC date</th>
                <th>Georgia Power date</th>
                <th>Reference gap</th>
                <th>Timeline gap</th>
                <th>Score</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody>
              {filteredOpportunities.map((opportunity) => (
                <tr
                  className={
                    `${selectedOpportunity.id === opportunity.id ? "active-row " : ""}selectable-row`
                  }
                  key={opportunity.id}
                  onClick={() => setSelectedId(opportunity.id)}
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedId(opportunity.id);
                    }
                  }}
                >
                  <td>
                    <span className="rank-number">
                      {opportunity.rank ?? "—"}
                    </span>
                  </td>
                  <td>
                    <strong>{opportunity.descProject.title}</strong>
                    <small className="table-area">{opportunity.location}</small>
                  </td>
                  <td>{opportunity.gpcProject.title}</td>
                  <td>{formatDate(opportunity.descProject.plannedDate)}</td>
                  <td>{formatDate(opportunity.gpcProject.plannedDate)}</td>
                  <td>{formatDistance(opportunity.referenceDistanceMiles)}</td>
                  <td>{formatGap(opportunity.daysApart)}</td>
                  <td>{opportunity.score ?? "Not ranked"}</td>
                  <td>
                    <button
                      className="view-button"
                      onClick={() => setSelectedId(opportunity.id)}
                      aria-label={`View ${opportunity.location}`}
                    >
                      View details <span aria-hidden="true">→</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="data-disclaimer">
          * Distances are calculated between public municipality or regional
          reference points, not between utility assets. Dominion matches verified
          here: project IDs 6809E and 6808S. The Georgia Power source PDF is marked
          CEII; confirm distribution permissions before publishing its details.
          Unmatched dates and titles are intentionally left unverified.
        </p>
      </section>
    </main>
  );
}

export default App;