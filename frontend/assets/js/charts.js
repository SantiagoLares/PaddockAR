(function () {
  const common = window.PaddockARCommon || {};
  const logger = common.createLogger ? common.createLogger("PaddockARCharts") : console;
  const ChartLib = window.Chart;

  const palette = [
    "#4db8ff",
    "#ff4b45",
    "#41d6cf",
    "#f59e0b",
    "#8da0ff",
    "#5ee18f",
    "#dce5ef",
  ];

  function isAvailable() {
    return typeof ChartLib === "function";
  }

  function getSeriesColor(index = 0) {
    return palette[index % palette.length];
  }

  function normalizeDataset(dataset = {}, index = 0) {
    const color = dataset.borderColor || dataset.backgroundColor || getSeriesColor(index);
    return {
      borderColor: color,
      backgroundColor: dataset.fill ? `${color}22` : color,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.28,
      ...dataset,
    };
  }

  function createBaseChartOptions({
    title = "",
    legend = true,
    stacked = false,
    yBeginAtZero = true,
  } = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      animation: {
        duration: 240,
      },
      plugins: {
        legend: {
          display: legend,
          labels: {
            color: "#dce5ef",
            boxWidth: 10,
            boxHeight: 10,
            useBorderRadius: true,
          },
        },
        title: {
          display: Boolean(title),
          text: title,
          color: "#f8fafc",
          font: {
            size: 13,
            weight: "700",
          },
        },
        tooltip: {
          backgroundColor: "#111820",
          borderColor: "rgba(255,255,255,0.08)",
          borderWidth: 1,
          titleColor: "#f8fafc",
          bodyColor: "#dce5ef",
          displayColors: true,
          padding: 10,
        },
      },
      scales: {
        x: {
          stacked,
          ticks: {
            color: "#9eafc2",
          },
          grid: {
            color: "rgba(255,255,255,0.05)",
            drawBorder: false,
          },
        },
        y: {
          stacked,
          beginAtZero: yBeginAtZero,
          ticks: {
            color: "#9eafc2",
          },
          grid: {
            color: "rgba(255,255,255,0.06)",
            drawBorder: false,
          },
        },
      },
    };
  }

  function createLineChartConfig({
    labels = [],
    datasets = [],
    title = "",
    options = {},
  } = {}) {
    return {
      type: "line",
      data: {
        labels,
        datasets: datasets.map(normalizeDataset),
      },
      options: {
        ...createBaseChartOptions({ title }),
        ...options,
      },
    };
  }

  function createBarChartConfig({
    labels = [],
    datasets = [],
    title = "",
    stacked = false,
    options = {},
  } = {}) {
    return {
      type: "bar",
      data: {
        labels,
        datasets: datasets.map((dataset, index) => ({
          borderRadius: 6,
          maxBarThickness: 28,
          ...normalizeDataset(dataset, index),
        })),
      },
      options: {
        ...createBaseChartOptions({ title, stacked }),
        ...options,
      },
    };
  }

  function createChart(canvas, config) {
    if (!isAvailable()) {
      logger.error("Chart.js no esta disponible en esta pagina.");
      return null;
    }
    return new ChartLib(canvas, config);
  }

  function destroyChart(chartInstance) {
    if (chartInstance?.destroy) chartInstance.destroy();
  }

  window.PaddockARCharts = {
    isAvailable,
    palette,
    getSeriesColor,
    createBaseChartOptions,
    createLineChartConfig,
    createBarChartConfig,
    createChart,
    destroyChart,
  };
})();
