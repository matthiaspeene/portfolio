(() => {
  const projects = Array.isArray(window.PORTFOLIO_PROJECTS) ? window.PORTFOLIO_PROJECTS : [];
  const projectList = document.querySelector("#project-list");
  const searchInput = document.querySelector("#project-search");
  const facetSelect = document.querySelector("#facet-select");
  const activeFiltersElement = document.querySelector("#active-filters");
  const popularFiltersElement = document.querySelector("#popular-filters");
  const resultCount = document.querySelector("#result-count");
  const emptyState = document.querySelector("#empty-state");
  const clearButton = document.querySelector("#clear-filters");
  const selectedFacets = new Map();

  const facetDefinitions = [
    ["projects", "Projects"],
    ["disciplines", "Disciplines"],
    ["skills", "Skills"],
    ["technologies", "Technologies"],
    ["tools", "Tools"],
  ];

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const facetKey = (category, value) => `${category}:${value}`;

  const facetValues = (project, category) => category === "projects"
    ? [project.title]
    : (project[category] || []);

  const getFacetGroups = () => facetDefinitions.map(([category, label]) => {
    const counts = new Map();
    projects.forEach((project) => {
      facetValues(project, category).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    });
    return {
      category,
      label,
      values: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    };
  });

  const facetGroups = getFacetGroups();
  const facetLookup = new Map();
  facetGroups.forEach((group) => group.values.forEach(([value, count]) => {
    facetLookup.set(facetKey(group.category, value), { category: group.category, categoryLabel: group.label, value, count });
  }));

  function buildFacetPicker() {
    facetGroups.forEach((group) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label;
      group.values.forEach(([value, count]) => {
        const option = document.createElement("option");
        option.value = facetKey(group.category, value);
        option.textContent = `${value} (${count})`;
        optgroup.append(option);
      });
      facetSelect.append(optgroup);
    });

    const preferred = ["Unity", "Sound Design", "Audio Programming", "Game Audio", "Wwise", "Reaper"];
    const available = [];
    preferred.forEach((name) => {
      const entry = [...facetLookup.values()].find((facet) => facet.value === name);
      if (entry && !available.some((facet) => facet.value === name)) available.push(entry);
    });

    available.slice(0, 6).forEach((facet) => {
      const button = document.createElement("button");
      button.className = "filter-chip";
      button.type = "button";
      button.dataset.facet = facetKey(facet.category, facet.value);
      button.setAttribute("aria-pressed", "false");
      button.textContent = `${facet.value} · ${facet.count}`;
      popularFiltersElement.append(button);
    });
  }

  function matches(project, query) {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (normalizedQuery) {
      const searchable = [
        project.title,
        project.description,
        project.context,
        project.role,
        ...project.disciplines,
        ...project.skills,
        ...project.technologies,
        ...project.tools,
        ...project.concepts,
      ].join(" ").toLocaleLowerCase();
      if (!searchable.includes(normalizedQuery)) return false;
    }

    return [...selectedFacets.values()].every((facet) => facetValues(project, facet.category).includes(facet.value));
  }

  function mediaMarkup(project) {
    const media = [...project.videos, ...project.images];
    if (!media.length) {
      const label = project.disciplines[0] || project.collection || "Project";
      return `
        <div class="media-frame">
          <div class="project-placeholder"><span>${escapeHtml(label)}</span></div>
        </div>
        <div class="media-controls"><span class="media-controls__label">Evidence available on request</span></div>`;
    }

    const item = media[0];
    const controls = media.length > 1 ? `
      <span class="media-controls__count"><span data-media-current>1</span> / ${media.length}</span>
      <button type="button" data-media-previous aria-label="Previous evidence">←</button>
      <button type="button" data-media-next aria-label="Next evidence">→</button>` : "";

    return `
      <div class="media-frame" data-media-frame>${mediaFrameMarkup(item)}</div>
      <div class="media-controls">
        <span class="media-controls__label" data-media-label>${escapeHtml(item.label)}</span>
        ${controls}
      </div>
      `;
  }

  function mediaFrameMarkup(item) {
    if (item.type === "image") {
      return `
        <img class="media-frame__image" src="${escapeHtml(item.url)}" alt="${escapeHtml(item.label)}" loading="lazy" decoding="async">
        <span class="media-frame__kind">Image</span>`;
    }

    return `
      <img class="media-frame__thumbnail" src="https://i.ytimg.com/vi/${escapeHtml(item.youtubeId)}/hqdefault.jpg" alt="" loading="lazy" decoding="async">
      <span class="media-frame__kind">Video</span>
      <button class="media-frame__play" type="button" data-play-video aria-label="Play ${escapeHtml(item.label)}"></button>`;
  }

  function filterButton(category, value, className = "project-card__tag") {
    return `<button class="${className}" type="button" data-add-facet="${escapeHtml(facetKey(category, value))}">${escapeHtml(value)}</button>`;
  }

  function projectMarkup(project, index) {
    const skills = project.skills.map((skill) => `<li>${filterButton("skills", skill)}</li>`).join("");
    const stack = [
      ...project.technologies.map((value) => ["technologies", value]),
      ...project.tools.map((value) => ["tools", value]),
    ];
    const links = [
      ...project.videos.map((link) => ({ ...link, label: `${link.label} ↗` })),
      ...project.links.map((link) => ({ ...link, label: `${link.label} ↗` })),
    ];
    const meta = [project.role, ...project.disciplines.slice(0, 2)].filter(Boolean);
    const description = project.hasMoreDescription ? `
      <div class="project-card__description" data-description>
        <p class="project-card__summary">${project.descriptionSummaryHtml}</p>
        <button class="project-card__read-more" type="button" data-expand-description aria-expanded="false">Read more <span aria-hidden="true">↓</span></button>
        <div class="project-card__description-full" data-description-full hidden>${project.descriptionHtml}</div>
      </div>` : `<div class="project-card__description"><p class="project-card__summary">${project.descriptionSummaryHtml}</p></div>`;

    return `
      <article class="project-card reveal" id="${escapeHtml(project.id)}" style="--delay: ${Math.min(index, 7) * 45}ms" data-project-id="${escapeHtml(project.id)}">
        <div class="project-card__content">
          <p class="project-card__index">${String(index + 1).padStart(2, "0")}</p>
          <h3>${escapeHtml(project.title)}</h3>
          <div class="project-card__meta">${meta.map((item, itemIndex) => `${itemIndex ? "<i aria-hidden=\"true\"></i>" : ""}<span>${escapeHtml(item)}</span>`).join("")}</div>
          ${description}
          ${skills ? `<div class="project-card__skills"><p>Demonstrated skills</p><ul>${skills}</ul></div>` : ""}
          ${stack.length ? `<div class="project-card__stack"><p>Technology & tools</p><div>${stack.map(([category, value]) => filterButton(category, value, "")).join("")}</div></div>` : ""}
        </div>
        <div class="project-card__visual">
          <div data-media-root>${mediaMarkup(project)}</div>
          ${links.length ? `<div class="project-links">${links.map((link) => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noreferrer">${escapeHtml(link.label)}</a>`).join("")}</div>` : ""}
        </div>
      </article>`;
  }

  function renderActiveFilters() {
    activeFiltersElement.innerHTML = [...selectedFacets.entries()].map(([key, facet]) => `
      <button class="filter-chip active-filter" type="button" data-remove-facet="${escapeHtml(key)}" aria-label="Remove ${escapeHtml(facet.value)} filter">
        ${escapeHtml(facet.categoryLabel)}: ${escapeHtml(facet.value)}
      </button>`).join("");

    popularFiltersElement.querySelectorAll("[data-facet]").forEach((button) => {
      button.setAttribute("aria-pressed", String(selectedFacets.has(button.dataset.facet)));
    });
  }

  function updateUrl() {
    const params = new URLSearchParams();
    if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
    selectedFacets.forEach((_, key) => params.append("filter", key));
    const query = params.toString();
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
  }

  function render() {
    const filtered = projects.filter((project) => matches(project, searchInput.value));
    projectList.innerHTML = filtered.map(projectMarkup).join("");
    if (resultCount) resultCount.textContent = filtered.length;
    projectList.hidden = filtered.length === 0;
    emptyState.hidden = filtered.length !== 0;
    clearButton.hidden = !(searchInput.value.trim() || selectedFacets.size);
    renderActiveFilters();
    updateUrl();
  }

  function addFacet(key) {
    const facet = facetLookup.get(key);
    if (!facet) return;
    if (selectedFacets.has(key)) selectedFacets.delete(key);
    else selectedFacets.set(key, facet);
    render();
  }

  function clearFilters() {
    selectedFacets.clear();
    searchInput.value = "";
    facetSelect.value = "";
    render();
    searchInput.focus();
  }

  function updateMedia(root, project, index) {
    const media = [...project.videos, ...project.images];
    const safeIndex = (index + media.length) % media.length;
    root.dataset.mediaIndex = String(safeIndex);
    const item = media[safeIndex];
    const frame = root.querySelector("[data-media-frame]");
    frame.innerHTML = mediaFrameMarkup(item);
    root.querySelector("[data-media-label]").textContent = item.label;
    const current = root.querySelector("[data-media-current]");
    if (current) current.textContent = String(safeIndex + 1);
  }

  projectList.addEventListener("click", (event) => {
    const facetButton = event.target.closest("[data-add-facet]");
    if (facetButton) {
      addFacet(facetButton.dataset.addFacet);
      document.querySelector(".filter-section").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const readMoreButton = event.target.closest("[data-expand-description]");
    if (readMoreButton) {
      const description = readMoreButton.closest("[data-description]");
      description.querySelector(".project-card__summary").hidden = true;
      description.querySelector("[data-description-full]").hidden = false;
      readMoreButton.setAttribute("aria-expanded", "true");
      readMoreButton.hidden = true;
      readMoreButton.closest("[data-project-id]").classList.add("project-card--expanded");
      return;
    }

    const card = event.target.closest("[data-project-id]");
    const root = event.target.closest("[data-media-root]");
    if (!card || !root) return;
    const project = projects.find((item) => item.id === card.dataset.projectId);
    const media = project ? [...project.videos, ...project.images] : [];
    if (!media.length) return;
    const currentIndex = Number(root.dataset.mediaIndex || 0);

    if (event.target.closest("[data-media-previous]")) updateMedia(root, project, currentIndex - 1);
    if (event.target.closest("[data-media-next]")) updateMedia(root, project, currentIndex + 1);
    if (event.target.closest("[data-play-video]")) {
      const video = media[currentIndex];
      if (video.type !== "youtube") return;
      const frame = root.querySelector("[data-media-frame]");
      frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(video.youtubeId)}?autoplay=1&rel=0" title="${escapeHtml(video.label)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    }
  });

  facetSelect.addEventListener("change", () => {
    if (facetSelect.value) addFacet(facetSelect.value);
    facetSelect.value = "";
  });
  popularFiltersElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-facet]");
    if (button) addFacet(button.dataset.facet);
  });
  activeFiltersElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove-facet]");
    if (button) addFacet(button.dataset.removeFacet);
  });
  searchInput.addEventListener("input", render);
  clearButton.addEventListener("click", clearFilters);
  emptyState.querySelector("[data-clear-filters]").addEventListener("click", clearFilters);

  const params = new URLSearchParams(location.search);
  searchInput.value = params.get("q") || "";
  params.getAll("filter").forEach((key) => {
    const separatorIndex = key.indexOf(":");
    const normalizedKey = separatorIndex === -1
      ? key
      : facetKey(key.slice(0, separatorIndex).toLocaleLowerCase(), key.slice(separatorIndex + 1));
    const facet = facetLookup.get(normalizedKey);
    if (facet) selectedFacets.set(normalizedKey, facet);
  });

  buildFacetPicker();
  render();

  if (location.hash) {
    requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView());
  }
})();
