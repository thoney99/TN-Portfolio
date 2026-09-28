async function loadJSON() {
  const response = await fetch("src/projects.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  return json.Projects;
}

let heightCellValue = 200;
let explorationCount = 0;
const main = document.getElementById("main");
const previewImg = document.getElementById("preview-img");
const previewLabel = document.getElementById("preview-label-container");
const previewTitle = document.getElementById("preview-title-container");
const accordionContainer = document.getElementById("accordion-container");
const tableContainer = document.getElementById("table-container");
const gridContainer = document.getElementById("grid-container");
const grid = document.getElementById("grid");
const header = document.getElementById("header");
const floatBtn = document.getElementById("float-btn");
const indexBtn = document.getElementById("index-btn");
const gridBtn = document.getElementById("grid-btn");
const indexTable = document.getElementById("index-table");
const overlay = document.getElementById("overlay");
const overlayContent = document.getElementById("overlay-content");
const dotsContainer = document.getElementById("dots-container");
const explorationTrailSvg = document.getElementById("exploration-trail");
const explorationTrailLine = explorationTrailSvg.querySelector("polyline");
const screensaverTrailSvg = document.getElementById("screensaver-trail");
const screensaverTrailPath = screensaverTrailSvg.querySelector("path");
const screensaverBackdrop = document.getElementById("screensaver-backdrop");
const screensaverClock = document.getElementById("screensaver-clock");
const screensaverIllustrations = document.getElementById("screensaver-illustrations");
let viewWidth = window.innerWidth;

let projectsById = {};
let layoutBeforeOverlay = "float";
let spiralCoordsByProjectId = {};
let spiralOrder = [];
let exploredTrail = [];

function getProjectCategories(project) {
  const raw = project.categoryIDs ?? project.categoryID;
  return Array.isArray(raw) ? raw : [raw];
}

function getPrimaryCategory(project) {
  return getProjectCategories(project)[0];
}

function getPrimaryCategoryName(project) {
  const raw = project.categoryNames ?? project.categoryName;
  return Array.isArray(raw) ? raw[0] : raw;
}

function getCategoryNames(project) {
  const raw = project.categoryNames ?? project.categoryName;
  const names = Array.isArray(raw) ? raw : [raw];
  return names.join(", ");
}

// Matches the duration of --transition-fast in style.css so the header
// content is fully removed from layout (display: none) only once its
// opacity fade-out has finished, keeping every element fading at the same
// speed instead of some snapping away instantly.
const HEADER_BIO_TRANSITION_MS = 300;
let headerBioCollapseTimeout;

function setHeaderBioOpen(isOpen) {
  const bio = document.getElementById("bio");
  const educationExperience = document.getElementById("education-experience");

  clearTimeout(headerBioCollapseTimeout);

  if (isOpen) {
    // Re-enter the layout first (still invisible via .bio-hidden), then
    // fade opacity in on the next frame so the transition actually plays.
    bio.classList.remove("bio-collapsed");
    educationExperience.classList.remove("bio-collapsed");

    requestAnimationFrame(() => {
      bio.classList.add("bio-revealed");
      educationExperience.classList.add("bio-revealed");
      header.classList.add("open");
    });
  } else {
    bio.classList.remove("bio-revealed");
    educationExperience.classList.remove("bio-revealed");
    header.classList.remove("open");

    headerBioCollapseTimeout = setTimeout(() => {
      bio.classList.add("bio-collapsed");
      educationExperience.classList.add("bio-collapsed");
    }, HEADER_BIO_TRANSITION_MS);
  }
}

function closeHeaderImmediately() {
  const bio = document.getElementById("bio");
  const educationExperience = document.getElementById("education-experience");

  header.classList.remove("open");
  bio.classList.remove("bio-revealed");
  educationExperience.classList.remove("bio-revealed");
  bio.classList.add("bio-collapsed");
  educationExperience.classList.add("bio-collapsed");
}

function closeBio() {
    main.addEventListener("click", (event) => {
      if (event.target.closest("footer")) return;

      setHeaderBioOpen(false);
    });
}

function renderDots(projects) {
  projects.forEach((project, i) => {
    const dot = document.createElement("div");
    dot.classList.add("dot");
    dot.dataset.projectId = project.id;
    const categories = getProjectCategories(project);
    dot.dataset.categories = categories.join(" ");
    categories.forEach((cat) => dot.classList.add(`is-${cat}`));

    // SPIRAL DISPLAY OF DOTS
    const { x, y, top } = spiralPosition(i, projects.length);
    spiralCoordsByProjectId[project.id] = { x, y };
    spiralOrder.push(project.id);
    dot.style.left = `${x * 100}%`;
    dot.style.top = top;

    if(!window.matchMedia("(pointer: coarse)").matches) {
        dot.addEventListener("mouseenter", () => showPreview(project, dot));
        dot.addEventListener("mouseleave", () => hidePreview(dot));
        }
    dot.addEventListener("click", () => showProjectPage(project, dot));

    dotsContainer.appendChild(dot);
  });
}

function syncVisitedDots() {
  const visitedSet = new Set(exploredTrail);
  document.querySelectorAll(".dot").forEach((dot) => {
    dot.classList.toggle("is-visited", visitedSet.has(dot.dataset.projectId));
  });
}

// THIS ONE IS A.I.
function applyFilter(categoryId) {
  document.querySelectorAll(".dot").forEach((dot) => {
    const categories = dot.dataset.categories.split(" ");
    const matches = categoryId === null || categories.includes(categoryId);

    dot.classList.toggle("is-hidden", !matches);
    dot.classList.toggle("matches-filter", categoryId !== null && matches);
  });
}

const categoryLinks = {
  type: document.getElementById("type-link"),
  graphic: document.getElementById("graphic-link"),
  experience: document.getElementById("experience-link"),
};

let activeFilter = null;

function bindCategoryLinks() {
  Object.entries(categoryLinks).forEach(([id, link]) => {
    link.addEventListener("mouseenter", () => {
      if (activeFilter === null) applyFilter(id); // preview only when nothing is sticky
    });

    link.addEventListener("mouseleave", () => {
      if (activeFilter === null) applyFilter(null); // revert to default
    });

    link.addEventListener("click", () => {
      if (activeFilter === id) {
        // clicking the same word: unstick
        activeFilter = null;
        link.classList.remove("is-active");
        applyFilter(null);
      } else {
        // switching from one filter to another (or no filter to one)
        if (activeFilter)
          categoryLinks[activeFilter].classList.remove("is-active");
        activeFilter = id;
        link.classList.add("is-active");
        applyFilter(id);
      }
    });
  });
}

function revealBio() {
  const bio = document.getElementById("bio");
  const name = document.getElementById("name-header");
  name.addEventListener("click", () => {
    const isOpen = bio.classList.contains("bio-revealed");
    setHeaderBioOpen(!isOpen);
  });
}

// THIS ONE IS A.I.
function spiralPosition(i, total) {
  // SUNFLOWER SPIRAL POSITION
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const spread = 0.2; // ← smaller = tighter
  const angle = i * goldenAngle;
  const r = Math.sqrt(i / total);
  const x = 0.5 + Math.cos(angle) * r * spread;
  const y = 0.5 + Math.sin(angle) * r * spread;
  const top =
    viewWidth <= 767
      ? `calc(${y * 50}% + 25svh)`
      : `${y * 100}%`;

  return { x, y, top };
}

// Maps spiral y to 0–1 SVG space (matches dot top in .dots-container)
function spiralTrailY(y) {
  return viewWidth <= 767 ? y * 0.5 + 0.25 : y;
}

// MOUSE ENTER FUNCTION
function showPreview(project, dot) {
  dot.querySelector(".project-card")?.remove(); // clear any existing card first

  previewLabel.classList.add("visible");
  var titleSrc = project.title;
  var imgSrc = project.coverImg;
  var imgsArray = project.images;
  var labelSrc = project.label;
  // previewImg.src=imgSrc;
  previewLabel.innerHTML = labelSrc;
  // previewTitle.innerHTML = titleSrc;

  dot.classList.add("is-hovered");
  dot.style.zIndex = "100";

  const coverImgSrc = project.coverImg;
  const coverMedia = project.coverVideo
    ? `<video src="${project.coverVideo}" poster="${coverImgSrc}" autoplay muted loop playsinline></video>`
    : `<img src="${coverImgSrc}">`;
  const accordionImgs = [imgSrc, ...imgsArray.slice(0, 3)];
  // const accordionHTML = accordionImgs
  //   .map((src, i) => {
  //     const className = i === 0 ? 'accordion-cover' : 'accordion-queue';
  //     const zIndex = accordionImgs.length - i;  // first = highest
  //     return `
  //     <div class="${className}" style="z-index: ${zIndex}">
  //         <img src="${src}">
  //     </div>`;
  //   })
  //   .join('');
  const accordionHTML = `<div class="accordion-cover">
      ${coverMedia}
    </div>`;
  accordionContainer.innerHTML = `
      <div class="project-accordion">${accordionHTML}</div>`;
}

// MOUSE LEAVE FUNCTION
function hidePreview(dot) {
  dot.classList.remove("is-hovered");
  dot.style.zIndex = "2";

  previewLabel.classList.remove("visible");

  const accordion = document.querySelector(".project-accordion");

  if (!accordion) return;
  accordion.style.animation = "fadeOut 0.3s ease";
  setTimeout(() => accordion.remove(), 250);
  setTimeout(() => {
    previewLabel.innerHTML = "";
  }, 250);
}

const projectTitleEl = document.getElementById("project-title");
const projectDescriptionEl = document.getElementById("project-description");
const projectIntroImgEl = document.getElementById("project-intro-img");
const projectIntroVideoEl = document.getElementById("project-intro-video");
const projectFooterTitleEl = document.getElementById("project-footer-title");
const projectYearEl = document.getElementById("project-year");
const projectTypeEl = document.getElementById("project-type");
const projectTechnicalEl = document.getElementById("project-technical");

function overlayLineSpacing(total, rowSize, isMobile) {
  const preferred = 48;
  if (!isMobile || total < 2) return preferred;

  const closeBtn = document.getElementById("close-btn");
  const rightLimit = closeBtn
    ? closeBtn.getBoundingClientRect().left - 8
    : window.innerWidth - 16;
  const center = window.innerWidth / 2;
  const halfLimit = Math.min(center - 16, rightLimit - center);
  const endUnits = (Math.min(rowSize, total) - 1) / 2;
  if (endUnits <= 0) return preferred;

  const fitted = (halfLimit - 6) / endUnits;
  return Math.min(preferred, Math.max(20, fitted));
}

function dotsIntoLine(dots) {
  const total = dots.length;
  const isMobile = window.innerWidth <= 767;
  const rowSize = Math.ceil(total / (isMobile ? 2 : 1)) || 1;
  const spacing = overlayLineSpacing(total, rowSize, isMobile);
  const rowGap = 24;

  dots.forEach((dot, i) => {
    const row = Math.floor(i / rowSize);
    const indexInRow = i % rowSize;
    const countInRow = Math.min(rowSize, total - row * rowSize);
    const middle = (countInRow - 1) / 2;
    dot.style.left = `calc(50% + ${(indexInRow - middle) * spacing}px)`;
    dot.style.top = `${24 + row * rowGap}px`;
  });
}

function dotsIntoSpiral(dots) {
  dots.forEach((dot, i) => {
    dot.classList.remove("line");
    dot.style.display = "block";
    const { x, y, top } = spiralPosition(i, dots.length);
    dot.style.left = `${x * 100}%`;
    dot.style.top = top;
  });
}

function dotsIntoIndex(dots) {
  dots.forEach((dot, i) => {
    dot.style.display = "block";
    dot.style.left = `18px`;
    dot.style.top = `calc(33svh + (${i * heightCellValue}px) + 21px)`;
  });
}

function dotsIntoGrid(dots) {
    var gridItem = document.querySelector(".grid-item");
    var gridItems = document.querySelectorAll(".grid-item");
    if (!gridItem) return;

    var elWidth = gridItem.offsetWidth + 48;
    var elHeight = gridItem.offsetHeight + 48;
    var firstRowY = gridItem.getBoundingClientRect().top;
    var rowHeight =
      gridItems[4]?.getBoundingClientRect().top != null
        ? gridItems[4].getBoundingClientRect().top - firstRowY
        : elHeight;

    dots.forEach((dot, i) => {
        dot.style.display = "block";
        if (viewWidth > 767) {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const rowAnchor = gridItems[row * 4];
          const rowY =
            rowAnchor?.getBoundingClientRect().top ?? firstRowY + row * rowHeight;

          // getBoundingClientRect() is viewport-relative, but .dots-container
          // (and therefore .dot) is position: absolute against the document,
          // not position: fixed against the viewport. Without adding the
          // current scroll offset back in, dots end up shifted by whatever
          // the page had scrolled when this ran — which is exactly what
          // happened after the screensaver (idle-triggered, so it could fire
          // at any scroll position) called this via restoreDotsLayout().
          dot.style.left = `calc(48px + ((${col * elWidth}px)))`;
          dot.style.top = `${rowY + window.scrollY}px`;
        } else if (viewWidth <= 767) {
          dot.style.left = `18px`;
          dot.style.top = `calc(${elHeight - 13}px + ${i * (elHeight - 24)}px)`;
        }
    });
}

function dotsIntoCircle(dots) {
  const n = dots.length;
  if (n === 0) return;
  const container = dotsContainer; // already in scope in main.js
  const centerX = container.offsetWidth / 2;
  const centerY = container.offsetHeight / 2;
  // Pick a radius (adjust to taste / responsive rules)
  const radius = Math.min(centerX, centerY) * 0.35;
  const angleStep = (2 * Math.PI) / n; // perimeter/n => equal angles
  const startAngle = -Math.PI / 2;     // first dot at top (12 o'clock)
  dots.forEach((dot, i) => {
    dot.style.display = "block";
    const angle = startAngle + i * angleStep;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
  });
}


function isFloatViewVisible() {
  return (
    floatBtn.classList.contains("active") &&
    !overlay.classList.contains("active")
  );
}

function updateTrailVisibility() {
  explorationTrailSvg.classList.toggle("is-visible", isFloatViewVisible());
}

let headerLayerTimeout;

function syncHeaderLayer() {
  clearTimeout(headerLayerTimeout);

  if (overlay.classList.contains("active")) {
    header.classList.add("project-open");
  } else {
    headerLayerTimeout = setTimeout(() => {
      header.classList.remove("project-open");
    }, 300);
  }
}

function recordExploration(projectId) {
  const last = exploredTrail[exploredTrail.length - 1];
  if (last === projectId) return;

  exploredTrail.push(projectId);
  syncVisitedDots();
  renderExplorationTrail();
}

function renderExplorationTrail() {
  const points = exploredTrail
    .map((id) => spiralCoordsByProjectId[id])
    .filter(Boolean)
    .map(({ x, y }) => `${x},${spiralTrailY(y)}`)
    .join(" ");

  explorationTrailLine.setAttribute("points", points);
  updateTrailVisibility();
}

function projectMedia(entry) {
  if (entry && typeof entry === "object") {
    if (entry.video) {
      return { kind: "video", src: entry.video, poster: entry.poster || "" };
    }
    return { kind: "image", src: entry.image || entry.src || "" };
  }

  const src = String(entry ?? "");
  if (/\.(mp4|webm|mov)(?:$|[?#])/i.test(src)) {
    return { kind: "video", src, poster: "" };
  }
  return { kind: "image", src };
}

function projectColumnItemHTML(entry) {
  const media = projectMedia(entry);
  if (media.kind === "video") {
    const poster = media.poster ? ` poster="${media.poster}"` : "";
    return `<div class="project-image"><video src="${media.src}"${poster} muted loop playsinline></video></div>`;
  }
  return `<div class="project-image"><img src="${media.src}"></div>`;
}

function setProjectColumnVideosPlaying(playing) {
  document.querySelectorAll(".project-images video").forEach((video) => {
    if (playing) {
      const playPromise = video.play();
      if (playPromise) playPromise.catch(() => {});
    } else {
      video.pause();
    }
  });
}

function showProjectIntro(project) {
  if (project.coverVideo) {
    projectIntroImgEl.hidden = true;
    projectIntroVideoEl.hidden = false;
    projectIntroVideoEl.poster = project.coverImg;
    if (projectIntroVideoEl.getAttribute("src") !== project.coverVideo) {
      projectIntroVideoEl.src = project.coverVideo;
    }
    const playPromise = projectIntroVideoEl.play();
    if (playPromise) playPromise.catch(() => {});
    return;
  }

  hideProjectIntroVideo();
  projectIntroImgEl.hidden = false;
  projectIntroImgEl.src = project.coverImg;
}

function hideProjectIntroVideo() {
  projectIntroVideoEl.pause();
  projectIntroVideoEl.hidden = true;
  projectIntroVideoEl.removeAttribute("src");
  projectIntroVideoEl.load();
}

function setGridCoverVideosPlaying(playing) {
  grid.querySelectorAll("video").forEach((video) => {
    if (playing) {
      const playPromise = video.play();
      if (playPromise) playPromise.catch(() => {});
    } else {
      video.pause();
    }
  });
}

function restoreFloatLayout() {
  hideProjectIntroVideo();
  setProjectColumnVideosPlaying(false);
  setGridCoverVideosPlaying(false);
  overlay.classList.remove("active");
  document.documentElement.classList.remove("overlay-open");
  syncHeaderLayer();
  dotsContainer.classList.remove("line");
  tableContainer.style.display = "none";
  previewLabel.style.display = "block";
  accordionContainer.style.display = "block";
  gridContainer.classList.remove("active");
  grid.classList.remove("active");
  indexTable.classList.remove("active");
  dotsIntoSpiral(document.querySelectorAll(".dot"));
  floatBtn.classList.add("active");
  indexBtn.classList.remove("active");
  gridBtn.classList.remove("active");
  setTimeout(() => {
    updateProjectPage(null);
  }, 605);
  setTimeout(() => {
    updateTrailVisibility();
  }, 900);
}

function restoreIndexLayout() {
  hideProjectIntroVideo();
  setProjectColumnVideosPlaying(false);
  setGridCoverVideosPlaying(false);
  overlay.classList.remove("active");
  document.documentElement.classList.remove("overlay-open");
  syncHeaderLayer();
  dotsContainer.classList.remove("line");
  accordionContainer.style.display = "none";
  previewLabel.style.display = "none";
  tableContainer.style.display = "block";
  gridContainer.classList.remove("active");
  grid.classList.remove("active");
  indexTable.classList.add("active");
  dotsIntoIndex(document.querySelectorAll(".dot"));
  indexBtn.classList.add("active");
  floatBtn.classList.remove("active");
  gridBtn.classList.remove("active");
  setTimeout(() => {
    updateProjectPage(null);
  }, 605);
  updateTrailVisibility();
}

function restoreGridLayout() {
  hideProjectIntroVideo();
  setProjectColumnVideosPlaying(false);
  overlay.classList.remove("active");
  document.documentElement.classList.remove("overlay-open");
  syncHeaderLayer();
  dotsContainer.classList.remove("line");
  accordionContainer.style.display = "none";
  previewLabel.style.display = "none";
  tableContainer.style.display = "none";
  gridContainer.classList.add("active");
  grid.classList.add("active");
  indexTable.classList.remove("active");
  dotsIntoGrid(document.querySelectorAll(".dot"));
  gridBtn.classList.add("active");
  floatBtn.classList.remove("active");
  indexBtn.classList.remove("active");
  setGridCoverVideosPlaying(true);
  setTimeout(() => {
    updateProjectPage(null);
  }, 605);
  updateTrailVisibility();
}

function scrollProjectPageToTop() {
  overlay.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
}

// Resolves once `target`'s smooth scroll settles (via the native "scrollend"
// event), or after `timeoutMs` — whichever comes first. The timeout is a
// safety net for scrollend not firing at all: that happens when the target
// was already at the destination (no scroll change to end), and it's also a
// fallback for any browser without scrollend support.
function waitForScrollEnd(target, timeoutMs = 500) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      target.removeEventListener("scrollend", finish);
      clearTimeout(timer);
      resolve();
    };
    target.addEventListener("scrollend", finish, { once: true });
    const timer = setTimeout(finish, timeoutMs);
  });
}

// Same scroll-to-top as above, but only calls `then` once both the overlay
// and the window have actually finished scrolling back to the top.
function scrollProjectPageToTopThen(then) {
  scrollProjectPageToTop();
  Promise.all([waitForScrollEnd(overlay), waitForScrollEnd(window)]).then(then);
}

function showProjectPage(project, dot) {
  // Clicking a dot while the overlay is already open means we're switching
  // from one project to another without closing it first (e.g. the "line"
  // of dots shown on top of a project page). In that case the old content
  // may still be scrolled far down, so swap the content in only once the
  // scroll-back-to-top has actually settled. When opening the overlay
  // fresh, there's nothing to wait for, so behaviour is unchanged.
  const isSwitchingProject = overlay.classList.contains("active");

  layoutBeforeOverlay = indexBtn.classList.contains("active")
    ? "index"
    : gridBtn.classList.contains("active")
      ? "grid"
      : "float";

  explorationCount++;
  // Un-comment this to remove all dots colours when clicking a project
  // document.querySelectorAll(".dot").forEach((d) => d.classList.remove("matches-filter"));

  function applyProjectContent() {
    projectTitleEl.textContent = project.title;
    // innerHTML (not textContent): project descriptions in projects.json can
    // contain inline markup — e.g. an <a> hyperlink to a collaborator's site.
    // Descriptions are our own authored content, not user input, so this is
    // safe.
    projectDescriptionEl.innerHTML = project.description;
    showProjectIntro(project);
    setGridCoverVideosPlaying(false);
    // projectFooterTitleEl.textContent = project.title;
    projectYearEl.textContent = project.year;
    projectTypeEl.textContent = getCategoryNames(project);
    projectTechnicalEl.textContent = project.technical;

    const imgContainer = document.querySelector(".project-images");
    imgContainer.innerHTML = project.images.map(projectColumnItemHTML).join("");
    setProjectColumnVideosPlaying(true);

    updateProjectPage(project);
  }

  overlay.classList.add("active");
  document.documentElement.classList.add("overlay-open");
  syncHeaderLayer();
  dotsIntoLine(document.querySelectorAll(".dot"));
  dotsContainer.classList.add("line");

  updateTrailVisibility();

  setTimeout(() => {
    recordExploration(project.id);
  }, 605);

  if (isSwitchingProject) {
    scrollProjectPageToTopThen(applyProjectContent);
  } else {
    applyProjectContent();
    scrollProjectPageToTop();
  }
}

function updateProjectPage(project) {
  overlayContent.classList.remove("crowlista", "schoolbook", "crowmono");

  if (!project) return;

  if (project.title === "Crowlista") {
    overlayContent.classList.add("crowlista");
  } else if (project.title === "Medway Schoolbook") {
    overlayContent.classList.add("schoolbook");
  } else if (project.title === "Yours to Play and Win") {
    overlayContent.classList.add("crowmono");
  }
}

function bindHeaderScrollBorder() {
  const updateHeaderScrolled = () => {
    header.classList.toggle("scrolled", window.scrollY > 0);
  };
  window.addEventListener("scroll", updateHeaderScrolled, { passive: true });
  updateHeaderScrolled(); // correct on load in case the page restores an existing scroll position
}

function bindProjectPageClose() {
  const closeBtn = document.getElementById("close-btn");
  closeBtn.addEventListener("click", () => {
    if (layoutBeforeOverlay === "index") {
      restoreIndexLayout();
    } else if (layoutBeforeOverlay === "grid") {
      restoreGridLayout();
    } else {
      restoreFloatLayout();
    }
    setTimeout(() => {
      scrollProjectPageToTop();
    }, 300);
  });
}

function renderTable(projects, i) {

  indexTable.innerHTML = projects
    .map((project) => {
      let categories = getProjectCategories(project);
      let classString = ""
      categories.forEach((cat) => {
        classString += `${cat}-row `
      });
      // console.log(classString);

      const thumbs = project.images
        .map((entry) => {
          const media = projectMedia(entry);
          return media.kind === "image" ? media.src : "";
        })
        .filter(Boolean)
        .slice(0, 4); // ← max 4
      const imgsHTML = thumbs
        .map((src, i) => {
          const zIndex = thumbs.length - i; // first = highest
          return `<span class="index-img-wrap" style="z-index: ${zIndex}">
                          <img src="${src}" class="index-img">
                        </span>`;
        })
        .join("");

      return `
            <tr class="${classString}" data-project-id="${project.id}">
                <td>${project.title}</td>
                <td class="index-imgs">${imgsHTML}</td>
                <td>${getCategoryNames(project)}</td>
                <td>${project.year}</td>
            </tr>
        `;
    })
    .join("");
}

// THIS ONE IS A.I.
function bindIndexRows() {
  indexTable.querySelectorAll("tr").forEach((row) => {
    const id = row.dataset.projectId;
    const project = projectsById[id];
    const dot = document.querySelector(`.dot[data-project-id="${id}"]`);
    if (!project || !dot) return;

    row.addEventListener("mouseenter", () => dot.classList.add("is-hovered"));
    row.addEventListener("mouseleave", () =>
      dot.classList.remove("is-hovered"),
    );
    row.addEventListener("click", () => showProjectPage(project, dot));
  });
}

function renderGrid(projects) {
  grid.innerHTML = projects
    .map((project) => {
      let categories = getProjectCategories(project);
      let classString = ""
      categories.forEach((cat) => {
        classString += `${cat}-row `
      });
        const coverMedia = project.coverVideo
          ? `<video src="${project.coverVideo}" poster="${project.coverImg}" muted loop playsinline></video>`
          : `<img src="${project.coverImg}">`;
        return `
            <div class="grid-item ${classString}" data-project-id="${project.id}">
                ${coverMedia}
                <h3>${project.title}</h3>
            </div>
        `;
    })
    .join("");
}

function bindGridItems() {
    grid.querySelectorAll(".grid-item").forEach((item) => {
      const id = item.dataset.projectId;
      const project = projectsById[id];
      const dot = document.querySelector(`.dot[data-project-id="${id}"]`);
      if (!project || !dot) return;
  
      function setGridPairHovered(hovered) {
        dot.classList.toggle("is-hovered", hovered);
        item.classList.toggle("is-hovered", hovered);
      }

      dot.addEventListener("mouseenter", () => setGridPairHovered(true));
      dot.addEventListener("mouseleave", () => setGridPairHovered(false));
      item.addEventListener("mouseenter", () => setGridPairHovered(true));
      item.addEventListener("mouseleave", () => setGridPairHovered(false));
      item.addEventListener("click", () => showProjectPage(project, item));
    });
  }

function makeIndex() {
  const dots = document.querySelectorAll(".dot");

  indexBtn.addEventListener("click", () => {
    setGridCoverVideosPlaying(false);

    if (
      explorationTrailSvg.classList.contains("is-visible") && 
      explorationCount >= 2
    ) {
        indexBtn.classList.add("active");
        floatBtn.classList.remove("active");
        gridBtn.classList.remove("active");
        updateTrailVisibility();
    
    
        setTimeout(() => {
            accordionContainer.style.display = "none";
            previewLabel.style.display = "none";
            tableContainer.style.display = "block";
        
            dotsIntoIndex(dots);
            gridContainer.classList.remove("active")
            grid.classList.remove("active")
            scrollProjectPageToTop()    
        }, 605);
    
        setTimeout(() => indexTable.classList.add("active"), 900);    
    } else {
        indexBtn.classList.add("active");
        floatBtn.classList.remove("active");
        gridBtn.classList.remove("active");
        updateTrailVisibility();
    
        accordionContainer.style.display = "none";
        previewLabel.style.display = "none";
        tableContainer.style.display = "block";
    
        dotsIntoIndex(dots);
        gridContainer.classList.remove("active")
        grid.classList.remove("active")
        scrollProjectPageToTop()    
    
        setTimeout(() => indexTable.classList.add("active"), 605);    
    }
  });
}

function makeGrid() {
    const dots = document.querySelectorAll(".dot");

    gridBtn.addEventListener("click", () => {

      if (
        explorationTrailSvg.classList.contains("is-visible") && 
        explorationCount >= 2
      ) {   
            gridBtn.classList.add("active");
            floatBtn.classList.remove("active");
            indexBtn.classList.remove("active");
            updateTrailVisibility();
            setTimeout(() => {
                accordionContainer.style.display = "none";
                previewLabel.style.display = "none";
                tableContainer.style.display = "none";
                gridContainer.classList.add("active");
                indexTable.classList.remove("active");
        
                dotsIntoGrid(dots);
                scrollProjectPageToTop()
                setGridCoverVideosPlaying(true);
                }, 605);
            setTimeout(() => grid.classList.add("active"), 900);    
        } else {
            gridBtn.classList.add("active");
            floatBtn.classList.remove("active");
            indexBtn.classList.remove("active");
            updateTrailVisibility();
                accordionContainer.style.display = "none";
                previewLabel.style.display = "none";
                tableContainer.style.display = "none";
                gridContainer.classList.add("active");
                indexTable.classList.remove("active");
        
                dotsIntoGrid(dots);
                scrollProjectPageToTop()
                setGridCoverVideosPlaying(true);
            setTimeout(() => grid.classList.add("active"), 605);
    
        }
      });
}

function makeFloat() {
  const dots = document.querySelectorAll(".dot");

  floatBtn.addEventListener("click", () => {
    setGridCoverVideosPlaying(false);
    indexTable.classList.remove("active"); // start fadeout NOW

    tableContainer.style.display = "none";
    previewLabel.style.display = "block";
    accordionContainer.style.display = "block";
    dotsIntoSpiral(dots);
    floatBtn.classList.add("active");
    gridBtn.classList.remove("active");
    indexBtn.classList.remove("active");
    gridContainer.classList.remove("active")
    grid.classList.remove("active")
    scrollProjectPageToTop()

    setTimeout(() => {
      updateTrailVisibility();
    }, 605);
  });
}

// SCREENSAVER
const SCREENSAVER_IDLE_MS = 60000; // 30 seconds
const SCREENSAVER_TIMEZONE = "Europe/Zurich"; // Lausanne
let lastActivityTime = Date.now();
let isScreensaverActive = false;
let screensaverClockInterval;

function restoreDotsLayout() {
  const dots = document.querySelectorAll(".dot");
  if (overlay.classList.contains("active")) {
    dotsIntoLine(dots);
  } else if (indexBtn.classList.contains("active")) {
    dotsIntoIndex(dots);
  } else if (gridBtn.classList.contains("active")) {
    dotsIntoGrid(dots);
  } else {
    dotsIntoSpiral(dots);
  }
}

// How strongly the trail bends between dots: this is the Catmull-Rom
// tension used to derive each Bézier handle's length as a fraction of the
// distance to neighbouring points. 0 = straight lines between points;
// ~0.167 (1/6) is the standard/subtle Catmull-Rom look; higher values
// (e.g. 0.56) pull the handles out further for a much more pronounced,
// looping curve.
const SCREENSAVER_TRAIL_CURVE_AMOUNT = 0.8;

// Smooth curve that passes exactly through every point (Catmull-Rom spline
// converted to cubic Bézier segments), so the line bends along the spiral
// while still hitting each dot, instead of just being pulled toward it.
function buildSmoothSpiralPath(points) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const cp1x = p1.x + (p2.x - p0.x) * SCREENSAVER_TRAIL_CURVE_AMOUNT;
    const cp1y = p1.y + (p2.y - p0.y) * SCREENSAVER_TRAIL_CURVE_AMOUNT;
    const cp2x = p2.x - (p3.x - p1.x) * SCREENSAVER_TRAIL_CURVE_AMOUNT;
    const cp2y = p2.y - (p3.y - p1.y) * SCREENSAVER_TRAIL_CURVE_AMOUNT;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}

function renderScreensaverTrail() {
  const points = spiralOrder
    .map((id) => spiralCoordsByProjectId[id])
    .filter(Boolean)
    .map(({ x, y }) => ({ x, y: spiralTrailY(y) }));

  screensaverTrailPath.setAttribute("d", buildSmoothSpiralPath(points));
}

function updateScreensaverClock() {
  const now = new Date();
  const timeStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCREENSAVER_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: SCREENSAVER_TIMEZONE,
      hour: "2-digit",
      hour12: false,
    }).format(now),
  );
  const isOnline = hour >= 9 && hour < 18;
  const statusText = isOnline
    ? "the studio might be online"
    : "the studio is probably offline";

  // screensaverClock.textContent = `It’s ${timeStr} in Lausanne, and ${statusText}.`;
  screensaverClock.textContent = `${timeStr}`;
}

function enterScreensaver() {
  if (isScreensaverActive) return;
  isScreensaverActive = true;

  document.body.classList.add("screensaver-active");
  screensaverBackdrop.classList.add("active");
  screensaverClock.classList.add("active");
  screensaverIllustrations.classList.add("active");

  dotsIntoSpiral(document.querySelectorAll(".dot"));
  renderScreensaverTrail();
  screensaverTrailSvg.classList.add("active");

  updateScreensaverClock();
  screensaverClockInterval = setInterval(updateScreensaverClock, 1000);
}

function exitScreensaver() {
  if (!isScreensaverActive) return;
  isScreensaverActive = false;

  clearInterval(screensaverClockInterval);
  document.body.classList.remove("screensaver-active");
  screensaverBackdrop.classList.remove("active");
  screensaverClock.classList.remove("active");
  screensaverIllustrations.classList.remove("active");
  screensaverTrailSvg.classList.remove("active");

  restoreDotsLayout();
}

function checkScreensaverIdle() {
  if (!isScreensaverActive && Date.now() - lastActivityTime >= SCREENSAVER_IDLE_MS) {
    enterScreensaver();
  }
}

function registerActivity() {
  lastActivityTime = Date.now();
  if (isScreensaverActive) exitScreensaver();
}

// Cmd+Tab / alt-tab back to the browser makes it fire a "landing" mousemove
// at the cursor's current position even though it never actually moved.
// Only count it as activity if the coordinates genuinely changed.
let lastMouseX = null;
let lastMouseY = null;

function registerMouseMoveActivity(event) {
  const moved = event.clientX !== lastMouseX || event.clientY !== lastMouseY;
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
  if (!moved) return;
  registerActivity();
}

function initScreensaver() {
  window.addEventListener("mousemove", registerMouseMoveActivity, { passive: true });
  window.addEventListener("mousedown", registerActivity, { passive: true });
  window.addEventListener("click", registerActivity, { passive: true });
  window.addEventListener("wheel", registerActivity, { passive: true });
  window.addEventListener("scroll", registerActivity, { passive: true, capture: true });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) checkScreensaverIdle();
  });

  setInterval(checkScreensaverIdle, 1000);
}

async function init() {
  if (window.innerWidth <= 767) closeHeaderImmediately();

  const projects = await loadJSON();
  projectsById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const windowsSizeManagerInstance = windowsSizeManager();
  windowsSizeManagerInstance.init();
  heightCellValue = windowsSizeManagerInstance.setHeightCellValue();
  console.log(heightCellValue);
  renderDots(projects);
  makeIndex();
  makeFloat();
  renderTable(projects);
  renderGrid(projects);
  bindCategoryLinks();
  bindIndexRows();
  closeBio();
  bindGridItems();
  revealBio();
  bindProjectPageClose();
  bindHeaderScrollBorder();
  makeGrid();
  initScreensaver();

  window.onresize = () => {
    heightCellValue = windowsSizeManagerInstance.setHeightCellValue();
    if (overlay.classList.contains("active")) {
      dotsIntoLine(document.querySelectorAll(".dot"));
    }
    if ((indexBtn.classList.contains("active")) && (!overlay.classList.contains("active"))) {
        dotsIntoIndex(document.querySelectorAll(".dot"));
    }
    if ((gridBtn.classList.contains("active")) && (!overlay.classList.contains("active"))) {
        dotsIntoGrid(document.querySelectorAll(".dot"));
    }
    if ((floatBtn.classList.contains("active")) && (!overlay.classList.contains("active"))) {
      dotsIntoSpiral(document.querySelectorAll(".dot"));
  }
  };
}

window.onload = init();
