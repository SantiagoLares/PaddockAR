(function () {
  const BASE_URL = 'https://paddockar.com.ar';

  function ensureAbsoluteUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return BASE_URL + url;
    return BASE_URL + '/' + url;
  }

  function setMeta(name, content) {
    if (!name || !content) return;
    let meta = document.querySelector(`meta[name="${name}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', name);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', String(content));
  }

  function setProperty(property, content) {
    if (!property || !content) return;
    let meta = document.querySelector(`meta[property="${property}"]`);
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('property', property);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', String(content));
  }

  function setCanonical(url) {
    if (!url) return;
    const absoluteUrl = ensureAbsoluteUrl(url);
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', absoluteUrl);
  }

  function updatePageSeo(config = {}) {
    const {
      title,
      description,
      url,
      type = 'website',
      image = '/assets/img/og-paddockar.png',
      siteName = 'PaddockAR',
    } = config;

    if (title) {
      document.title = title;
      setProperty('og:title', title);
      setMeta('twitter:title', title);
    }

    if (description) {
      setMeta('description', description);
      setProperty('og:description', description);
      setMeta('twitter:description', description);
    }

    if (url) {
      const absoluteUrl = ensureAbsoluteUrl(url);
      setProperty('og:url', absoluteUrl);
      setCanonical(absoluteUrl);
    }

    setProperty('og:type', type);
    setProperty('og:site_name', siteName);

    if (image) {
      const absoluteImage = ensureAbsoluteUrl(image);
      setProperty('og:image', absoluteImage);
      setMeta('twitter:image', absoluteImage);
    }

    setMeta('twitter:card', 'summary_large_image');
  }

  window.PaddockARSeo = {
    setMeta,
    setProperty,
    setCanonical,
    updatePageSeo,
    BASE_URL,
    ensureAbsoluteUrl,
  };
})();
