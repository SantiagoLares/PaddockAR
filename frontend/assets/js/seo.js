(function initPaddockARSeo(window, document) {
  const seo = window.PaddockARSeo || {};

  function getOrCreateMeta(selector, attributes = {}) {
    let element = document.querySelector(selector);
    if (element) return element;

    element = document.createElement("meta");
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    document.head.appendChild(element);
    return element;
  }

  function setMeta(name, content) {
    if (!name || typeof content !== "string") return null;
    const meta = getOrCreateMeta(`meta[name="${name}"]`, { name });
    meta.setAttribute("content", content);
    return meta;
  }

  function setProperty(property, content) {
    if (!property || typeof content !== "string") return null;
    const meta = getOrCreateMeta(`meta[property="${property}"]`, { property });
    meta.setAttribute("content", content);
    return meta;
  }

  function setCanonical(url) {
    if (!url || typeof url !== "string") return null;

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }

    canonical.setAttribute("href", url);
    return canonical;
  }

  function updatePageSeo({
    title,
    description,
    canonical,
    robots,
    ogTitle,
    ogDescription,
    ogUrl,
    twitterTitle,
    twitterDescription,
    twitterCard,
  } = {}) {
    if (typeof title === "string" && title) {
      document.title = title;
      setProperty("og:title", ogTitle || title);
      setMeta("twitter:title", twitterTitle || ogTitle || title);
    }

    if (typeof description === "string" && description) {
      setMeta("description", description);
      setProperty("og:description", ogDescription || description);
      setMeta("twitter:description", twitterDescription || ogDescription || description);
    }

    if (typeof robots === "string" && robots) {
      setMeta("robots", robots);
    }

    if (typeof canonical === "string" && canonical) {
      setCanonical(canonical);
      setProperty("og:url", ogUrl || canonical);
    } else if (typeof ogUrl === "string" && ogUrl) {
      setProperty("og:url", ogUrl);
    }

    if (typeof twitterCard === "string" && twitterCard) {
      setMeta("twitter:card", twitterCard);
    }
  }

  seo.setMeta = setMeta;
  seo.setProperty = setProperty;
  seo.setCanonical = setCanonical;
  seo.updatePageSeo = updatePageSeo;

  window.PaddockARSeo = seo;

  const canonical = document.querySelector('link[rel="canonical"]');
  const ogUrl = document.querySelector('meta[property="og:url"]');

  if (!canonical || !ogUrl) return;

  try {
    const publicUrl = new URL(canonical.href, window.location.origin).toString();
    canonical.href = publicUrl;
    ogUrl.setAttribute("content", publicUrl);
  } catch (_error) {
    // Keep server-rendered metadata if URL normalization fails.
  }
})(window, document);
