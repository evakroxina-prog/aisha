(() => {
  const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  const REW_INDICES = Array.from({ length: 20 }, (_, i) => i + 1);
  const ASSET_PATH_PREFIXES = ["", "images/", "img/", "photos/", "works/", "assets/"];

  function masterPhotoCandidates() {
    const names = ["master", "master1"];
    const exts = ["png", "PNG", "jpg", "JPG"];
    const paths = [];
    for (const name of names) {
      for (const ext of exts) {
        paths.push(`${name}.${ext}`);
      }
    }
    return paths;
  }

  function assetCandidatePaths(stem) {
    const aliasMap = {
      master: ["Master", "Master1"],
      hero2: ["hero", "Hero2", "hero1"],
      logo_aisha: ["logo", "Logo_aisha", "logo-aisha"],
      rewiev1: ["review1", "rewiew1", "Rewiev1"],
      rewiev2: ["review2", "rewiew2", "Rewiev2"],
      rewiev3: ["review3", "rewiew3", "Rewiev3"],
    };
    const stems = [stem, ...(aliasMap[stem] || [])];
    const paths = [];
    for (const s of stems) {
      for (const prefix of ASSET_PATH_PREFIXES) {
        for (const ext of ["png", "PNG", "jpg", "JPG", "jpeg", "JPEG", "webp", "WEBP"]) {
          paths.push(`${prefix}${s}.${ext}`);
        }
      }
    }
    return paths;
  }

  function rewCandidatePaths(n) {
    const stem = `rew${n}`;
    const paths = [];
    for (const ext of ["jpg", "JPG", "jpeg", "JPEG"]) {
      paths.push(`${stem}.${ext}`);
    }
    for (const prefix of ASSET_PATH_PREFIXES) {
      if (!prefix) continue;
      for (const ext of ["jpg", "JPG", "jpeg", "JPEG"]) {
        paths.push(`${prefix}${stem}.${ext}`);
      }
    }
    return paths;
  }

  function wireImageCandidates(img, paths) {
    const initial = (img.getAttribute("src") || "").trim();
    const ordered = [];
    if (initial) ordered.push(initial);
    for (const p of paths) {
      if (!ordered.includes(p)) ordered.push(p);
    }
    if (ordered.length <= 1) return;

    let nextIdx = 1;
    const tryNext = () => {
      while (nextIdx < ordered.length) {
        const candidate = ordered[nextIdx];
        nextIdx += 1;
        if (candidate !== img.getAttribute("src")) {
          img.src = candidate;
          return;
        }
      }
    };

    img.addEventListener("error", tryNext);

    // Уже упавшая загрузка (до attach listener) — пробуем следующий путь
    if (img.complete && img.naturalWidth === 0) {
      tryNext();
    }
  }

  function initStaticImageFallbacks() {
    document.querySelectorAll("img[src]").forEach((img) => {
      if (img.closest("#container") || img.closest(".hero-circular-gallery")) return;
      const src = img.getAttribute("src");
      if (!src || /^https?:/i.test(src) || src.startsWith("data:")) return;

      if (img.closest(".about-photo")) {
        wireImageCandidates(img, masterPhotoCandidates());
        return;
      }

      const stem = src.split("/").pop().replace(/\.[^.]+$/, "");
      if (!stem) return;
      wireImageCandidates(img, assetCandidatePaths(stem));
    });
  }

  function preloadFirstUrl(paths) {
    return new Promise((resolve, reject) => {
      let i = 0;
      const im = new Image();
      const tryNext = () => {
        if (i >= paths.length) {
          reject(new Error("not found"));
          return;
        }
        im.src = paths[i++];
      };
      im.onload = () => resolve(im.currentSrc || im.src);
      im.onerror = tryNext;
      tryNext();
    });
  }

  function prefetchPortfolioImages() {
    const add = () => {
      REW_INDICES.forEach((n) => {
        const href = rewCandidatePaths(n)[0];
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.as = "image";
        link.href = href;
        document.head.appendChild(link);
      });
    };
    if ("requestIdleCallback" in window) {
      requestIdleCallback(add, { timeout: 3500 });
    } else {
      setTimeout(add, 400);
    }
  }

  function shuffleStable(arr, seedStr) {
    const s = [...arr];
    let h = 0;
    for (let i = 0; i < seedStr.length; i++) {
      h = (Math.imul(31, h) + seedStr.charCodeAt(i)) >>> 0;
    }
    for (let i = s.length - 1; i > 0; i--) {
      h = (h * 48271 + 1) >>> 0;
      const j = h % (i + 1);
      [s[i], s[j]] = [s[j], s[i]];
    }
    return s;
  }

  function preloadImage(src) {
    return preloadFirstUrl([src]);
  }

  function seededTilt(i, seed) {
    let h = 2166136261;
    const s = seed + ":" + i;
    for (let k = 0; k < s.length; k++) {
      h = Math.imul(h ^ s.charCodeAt(k), 16777619);
    }
    const u = (h >>> 0) / 4294967296;
    return Math.round((u - 0.5) * 5 * 10) / 10;
  }

  async function buildHeroCircularGallery() {
    const root = document.getElementById("hero-circular-root");
    if (!root) return;

    const settled = await Promise.allSettled(
      REW_INDICES.map((n) => preloadFirstUrl(rewCandidatePaths(n))),
    );
    const slides = REW_INDICES
      .map((n, i) =>
        settled[i].status === "fulfilled" ? { n, src: settled[i].value } : null,
      )
      .filter(Boolean);

    if (!slides.length) return;

    const section = document.createElement("section");
    section.className = "hero-circular-gallery";
    section.style.setProperty("--count", String(slides.length));
    section.setAttribute("aria-label", "Примеры работ");

    const rotator = document.createElement("div");
    rotator.className = "hero-circular-gallery__rotator";

    slides.forEach((slide, idx) => {
      const card = document.createElement("article");
      card.className = "hero-circular-gallery__item";
      card.id = `hero-gallery-${slide.n}`;
      card.style.setProperty("--i", String(idx + 1));

      const a = document.createElement("a");
      a.href = "#works";
      a.className = "hero-circular-gallery__link";
      const img = document.createElement("img");
      img.src = slide.src;
      img.alt = "";
      img.loading = idx < 5 ? "eager" : "lazy";
      img.decoding = "async";
      if (idx < 3) img.fetchPriority = "high";
      a.appendChild(img);
      card.appendChild(a);
      rotator.appendChild(card);
    });

    section.appendChild(rotator);
    root.appendChild(section);
  }

  function createWorksTile(src, i) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "works-tile";
    tile.style.setProperty("--works-tilt", seededTilt(i, "aisha-tilt") + "deg");
    tile.setAttribute("aria-label", "Открыть фото в полный экран");
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.width = 320;
    img.height = 420;
    img.loading = i < 6 ? "eager" : "lazy";
    img.decoding = "async";
    if (i < 4) {
      img.fetchPriority = "high";
    }
    tile.appendChild(img);
    return tile;
  }

  async function buildWorksGallery() {
    const container = document.getElementById("container");
    const loadingEl = document.getElementById("loading");
    const uiEl = document.getElementById("ui");
    if (!container || !loadingEl) return;

    const indices = shuffleStable([...REW_INDICES], "works-wall-v2");
    const settled = await Promise.allSettled(
      indices.map((n) => preloadFirstUrl(rewCandidatePaths(n))),
    );
    const ok = settled
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    if (ok.length === 0) {
      loadingEl.textContent = "Не удалось загрузить фото. Проверьте соединение и обновите страницу.";
      return;
    }

    loadingEl.hidden = true;
    loadingEl.setAttribute("aria-hidden", "true");

    if (mqReduce.matches) {
      ok.forEach((src, i) => {
        container.appendChild(createWorksTile(src, i));
      });
    } else {
      container.classList.add("works-marquee--active");
      const strip = document.createElement("div");
      strip.className = "works-marquee-strip";
      const cycle = [...ok, ...ok];
      const duration = Math.max(36, cycle.length * 2.15);
      strip.style.animationDuration = duration + "s";
      cycle.forEach((src, i) => {
        strip.appendChild(createWorksTile(src, i));
      });
      container.appendChild(strip);
    }

    container.classList.add("is-ready");

    if (uiEl) {
      uiEl.hidden = false;
    }
  }

  function initServicesRowMotion() {
    const section = document.getElementById("services");
    const rows = section?.querySelectorAll(".service-row");
    if (!(section instanceof HTMLElement) || !rows?.length) return;

    if (mqReduce.matches) {
      rows.forEach((row) => row.classList.add("service-row--visible"));
      return;
    }

    section.classList.add("services--rows-pending");

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("service-row--visible");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.13, rootMargin: "0px 0px -7% 0px" },
    );

    rows.forEach((row) => io.observe(row));
  }

  function initMobileNav() {
    const burger = document.getElementById("burger");
    const drawer = document.getElementById("drawer");
    const overlay = document.getElementById("drawer-overlay");

    function setOpen(open) {
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      drawer.hidden = !open;
      overlay.hidden = !open;
    }

    if (!burger || !drawer || !overlay) return;

    burger.addEventListener("click", () => {
      setOpen(drawer.hidden);
    });
    overlay.addEventListener("click", () => setOpen(false));
    drawer.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setOpen(false)));
  }

  function initLightbox() {
    const lb = document.getElementById("lightbox");
    const imgEl = document.getElementById("lightbox-img");
    const btnClose = document.getElementById("lightbox-close");
    if (!lb || !imgEl || !btnClose) return;

    function close() {
      lb.classList.remove("is-open");
      lb.setAttribute("aria-hidden", "true");
      imgEl.removeAttribute("src");
    }

    document.body.addEventListener("click", (e) => {
      const t = e.target;
      const opener =
        t && t.closest && (t.closest("#container .works-tile") || t.closest(".hero-circular-gallery .hero-circular-gallery__link"));
      if (!opener) return;
      if (opener.classList.contains("hero-circular-gallery__link")) {
        e.preventDefault();
      }
      const shot = opener.querySelector("img");
      if (!(shot instanceof HTMLImageElement)) return;
      imgEl.src = shot.currentSrc || shot.src;
      imgEl.alt = shot.alt || "Просмотр";
      lb.classList.add("is-open");
      lb.setAttribute("aria-hidden", "false");
    });

    btnClose.addEventListener("click", close);
    lb.addEventListener("click", (e) => {
      if (e.target === lb) close();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  function initScrollMotion() {
    if (mqReduce.matches) return;

    const nodes = document.querySelectorAll(".motion-section");
    if (!nodes.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("motion-section--visible");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -5% 0px" },
    );

    nodes.forEach((el) => io.observe(el));
  }

  function initHeaderScroll() {
    const header = document.querySelector(".site-header");
    if (!header) return;
    let scrolled = false;

    const sync = () => {
      const now = window.scrollY > 22;
      if (now === scrolled) return;
      scrolled = now;
      header.classList.toggle("site-header--scrolled", now);
    };

    window.addEventListener("scroll", sync, { passive: true });
    sync();
  }

  function initBookingForm() {
    const form = document.getElementById("booking-form");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
    });
  }

  initStaticImageFallbacks();
  initScrollMotion();
  initHeaderScroll();

  initServicesRowMotion();

  buildHeroCircularGallery();

  buildWorksGallery();

  prefetchPortfolioImages();

  window.addEventListener("load", () => {
    initMobileNav();
    initLightbox();
    initBookingForm();
  });
})();
