d3.json("tree_map.json").then(data => {
    const tooltip = d3.select("#tooltip");
    const yearSelect = d3.select("#year-select");
    const regionButtons = d3.select("#region-buttons");
    const legend = d3.select("#legend");

    const regionColors = {
      AMR: { color: "#1f77b4", fullName: "Americas" },
      EUR: { color: "#ff7f0e", fullName: "Europe" },
      EMR: { color: "#2ca02c", fullName: "Eastern Mediterranean" },
      AFR: { color: "#d62728", fullName: "Africa" },
      SEA: { color: "#9467bd", fullName: "Southeast Asia" },
      WPR: { color: "#8c564b", fullName: "Western Pacific" }
    };

    const chartWidth = 950;
    const chartHeight = 540;
    const years = new Set();

    data.children.forEach(region => {
      region.children.forEach(yearData => {
        years.add(yearData.year);
      });
    });

    [...years].sort().forEach(year => {
      yearSelect.append("option")
        .attr("value", year)
        .text(year);
    });

    Object.entries(regionColors).forEach(([abbr, { color }]) => {
      regionButtons.append("button")
        .attr("class", "region-button")
        .attr("data-region", abbr)
        .style("background-color", color)
        .text(abbr);
    });

    Object.entries(regionColors).forEach(([abbr, { color, fullName }]) => {
        const legendItem = legend.append("div")
          .attr("class", "legend-item");

        legendItem.append("div")
          .attr("class", "legend-color")
          .style("background-color", color);

        legendItem.append("span").text(fullName);

        legendItem.on("click", function () {
          const isActive = activeRegions.includes(abbr);
          if (isActive) {
            activeRegions = activeRegions.filter(region => region !== abbr);
            legendItem.classed("active", false).style("opacity", 1);
          } else {
            activeRegions.push(abbr);
            legendItem.classed("active", true).style("opacity", 0.7);
          }
          updateTreemap();
        });
      });

    let selectedYear = [...years][0];
    let activeRegions = [];
    let highlightedNode = null;

    const svg = d3.select("#treemap")
      .append("svg")
      .attr("width", chartWidth)
      .attr("height", chartHeight);

    const g = svg.append("g");

    const zoom = d3.zoom()
      .scaleExtent([1, 7])
      .on("zoom", function (event) {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    d3.select("#resetZoom").on("click", function () {
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    });

    function updateTreemap() {
      const filteredData = {
        name: "Root",
        children: data.children
          .filter(region => activeRegions.length === 0 || activeRegions.includes(region.region))
          .map(region => ({
            name: region.region,
            children: region.children
              .filter(yearData => yearData.year === selectedYear)
              .flatMap(yearData => yearData.children.map(country => ({
                name: country.country,
                value: country.total_prevalence_ex_HIV
              })))
          }))
      };

      const hierarchy = d3.hierarchy(filteredData)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);

      g.selectAll("*").remove();

      const treemap = d3.treemap()
        .size([chartWidth, chartHeight])
        .padding(1)
        .round(true);

      treemap(hierarchy);

      const nodes = g.selectAll(".node")
        .data(hierarchy.leaves())
        .join("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.x0},${d.y0})`)
        .on("click", function (event, d) {
          if (highlightedNode === d) {
            highlightedNode = null;
            resetHighlight(g);
          } else {
            highlightedNode = d;
            applyHighlight(g, d);
          }
        });

      nodes.append("rect")
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .attr("fill", d => regionColors[d.parent.data.name]?.color || "#ccc")
        .attr("opacity", 1)
        .on("mouseover", (event, d) => {
          const regionName = d.parent ? d.parent.data.name : "Unknown Region";
          tooltip.style("display", "block")
            .html(`Country: ${d.data.name}<br>Region: ${regionName}<br>Prevalence Excluding HIV: ${d.data.value}`);
        })
        .on("mousemove", event => {
          tooltip.style("top", `${event.pageY + 10}px`)
            .style("left", `${event.pageX + 10}px`);
        })
        .on("mouseout", () => {
          tooltip.style("display", "none");
        });

      nodes.append("text")
        .attr("x", 3)
        .attr("y", 15)
        .text(d => d.data.name)
        .style("font-size", d => Math.min((d.x1 - d.x0) / 6, 12));

      function applyHighlight(g, targetNode) {
        g.selectAll("rect").attr("opacity", d => (d === targetNode ? 1 : 0.3));
      }

      function resetHighlight(g) {
        g.selectAll("rect").attr("opacity", 1);
      }
    }

    yearSelect.on("change", function () {
      selectedYear = +this.value;
      updateTreemap();
    });

    regionButtons.selectAll(".region-button").on("click", function () {
      const region = this.getAttribute("data-region");
      const button = d3.select(this);
      const isActive = activeRegions.includes(region);
      if (isActive) {
        activeRegions = activeRegions.filter(r => r !== region);
        button.classed("active", false).style("opacity", 1);
      } else {
        activeRegions.push(region);
        button.classed("active", true).style("opacity", 0.7);
      }
      updateTreemap();
    });

    updateTreemap();
  }).catch(err => console.error("Error loading data:", err));