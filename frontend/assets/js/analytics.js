(function () {
  window.dataLayer = window.dataLayer || [];

  function safePush(obj) {
    try {
      window.dataLayer.push(obj);
    } catch (e) {
      // fail silently
    }
  }

  function trackPageView(pageName, extraData = {}) {
    safePush(Object.assign({ event: 'page_view', page: pageName }, extraData));
  }

  function trackEvent(eventName, extraData = {}) {
    safePush(Object.assign({ event: eventName }, extraData));
  }

  window.PaddockARAnalytics = {
    trackPageView,
    trackEvent,
  };
})();
