d3.json("sun_burst.json").then(data => {
    const sizeMultiplier = 1.17;
    const width = Math.min(window.innerWidth, window.innerHeight) * 0.8;
    const radius = (width / 2) * sizeMultiplier;

    const regionColors = {
      AMR: { color: "#1f77b4", fullName: "Americas" },
      EUR: { color: "#ff7f0e", fullName: "Europe" },
      EMR: { color: "#2ca02c", fullName: "Eastern Mediterranean" },
      AFR: { color: "#d62728", fullName: "Africa" },
      SEA: { color: "#9467bd", fullName: "Southeast Asia" },
      WPR: { color: "#8c564b", fullName: "Western Pacific" }
    };

    const tooltip = d3.select("#tooltip");

    const partition = data => {
      const root = d3.hierarchy(data)
        .sum(d => d.value || 0)
        .sort((a, b) => b.value - a.value);
      return d3.partition().size([2 * Math.PI, 1])(root);
    };

    const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .innerRadius(d => d.y0 * radius)
      .outerRadius(d => d.y1 * radius);

    const zoom = d3.zoom()
      .scaleExtent([1, 10])
      .on("zoom", (event) => {
      svg.attr("transform", event.transform);
    });

    const svg = d3.select("#chart")
      .append("svg")
      .attr("viewBox", [-radius, -radius, radius * 2, radius * 2])
      .attr("width", radius * 2)
      .attr("height", radius * 2)
      .style("font", "12px sans-serif")
      .call(zoom)
      .append("g");

    d3.select("#resetZoom").on("click", () => {
      d3.select("#chart svg")
          .transition()
          .duration(750)
          .call(zoom.transform, d3.zoomIdentity);
    });

    let currentYear = 1990;
    let activeRegions = [];
    let selectedSegment = null;

    const renderChart = (filteredData) => {
      const root = partition(filteredData);
      root.each(d => (d.current = d));

      svg.selectAll("*").remove();

      const path = svg.append("g")
        .selectAll("path")
        .data(root.descendants())
        .join("path")
        .attr("fill", d => {
          const region = d.ancestors().find(a => a.depth === 1)?.data.name;
          return region && regionColors[region] ? regionColors[region].color : "#ccc";
        })
        .attr("d", arc)
        .attr("stroke", "#000")
        .attr("stroke-width", ".4px")
        .on("click", function (event, d) {
          if (selectedSegment === d) {
            selectedSegment = null;
            path.attr("opacity", 1);
          } else {
            selectedSegment = d;
            path.attr("opacity", node => (node === d || node.ancestors().includes(d) ? 1 : 0.3));
          }
        })
        .on("mouseover", function (event, d) {
          const region = d.ancestors().find(a => a.depth === 1)?.data.name || "All Regions";
          const country = d.data.name || "Unknown Country";
          const value = d.value || 0;
          const formatValue = d3.format(",.0f");

          tooltip
            .style("visibility", "visible")
            .style("top", `${event.pageY + 10}px`)
            .style("left", `${event.pageX + 10}px`)
            .html(`<strong>${country}</strong><br>Region: ${region}<br>Cases: ${formatValue(value)}`);
        })
        .on("mousemove", function (event) {
          tooltip
            .style("top", `${event.pageY + 10}px`)
            .style("left", `${event.pageX + 10}px`);
        })
        .on("mouseout", function () {
          tooltip.style("visibility", "hidden");
        });

      const labels = svg.append("g")
        .selectAll("text")
        .data(root.descendants().filter(d => d.depth && (d.x1 - d.x0) > 0.04))
        .join("text")
        .attr("transform", d => {
          const angle = (d.x0 + d.x1) / 2 * 180 / Math.PI;
          const radiusPos = (d.y0 + d.y1) / 2 * radius;
          return `rotate(${angle - 90}) translate(${radiusPos},0) rotate(${angle < 180 ? 0 : 180})`;
        })
        .attr("dy", "0.35em")
        .attr("font-size", d => `${Math.min(10, (d.x1 - d.x0) * radius / 6)}px`)
        .attr("fill", "#000")
        .text(d => truncateText(d.data.name, (d.x1 - d.x0) * radius));
    };

    const truncateText = (text, maxWidth) => {
      const maxChars = Math.floor(maxWidth / 8);
      return text.length > maxChars ? text.slice(0, maxChars - 2) + "…" : text;
    };

    const renderLegend = () => {
      const legend = d3.select("#legend");
      
      Object.entries(regionColors).forEach(([abbr, { color, fullName }]) => {
        const item = legend.append("div").attr("class", "legend-item");
        item.append("div")
          .attr("class", "legend-color")
          .style("background-color", color);
        item.append("span").text(fullName);

        item.on("click", function () {
          const isActive = activeRegions.includes(abbr);
          if (isActive) {
              activeRegions = activeRegions.filter(region => region !== abbr);
            item.classed("active", false).style("opacity", "1");
          } else {
              activeRegions.push(abbr);
            item.classed("active", true).style("opacity", "0.7");
          }
            renderChart(filterData());
        });
      });
    };

    renderLegend();

    const filterData = () => {
      return {
        name: data.name || "World",
        children: data.children
          .filter(region => activeRegions.length === 0 || activeRegions.includes(region.region))
          .flatMap(region => ({
            name: region.region,
            children: region.children
              .filter(y => y.year === currentYear)
              .flatMap(y => 
                y.children.map(country => ({
                  name: country.country,
                  value: country.total_incidence,
                }))
              ),
          })),
      };
    };

    const years = Array.from(new Set(data.children.flatMap(r => r.children.map(y => y.year))));
    const yearSelect = d3.select("#year-select");
    years.forEach(year => {
      yearSelect.append("option")
        .attr("value", year)
        .text(year)
        .property("selected", year === currentYear);
    });

    yearSelect.on("change", function () {
      currentYear = +this.value;
      renderChart(filterData());
    });

    const regionButtons = d3.select("#region-buttons");
    Object.keys(regionColors).forEach(region => {
      const buttonColor = regionColors[region].color;
      regionButtons.append("button")
        .attr("class", "region-button")
        .style("background-color", buttonColor)
        .style("color", "#fff")
        .text(region)
        .on("click", function () {
          const button = d3.select(this);
          const isActive = button.classed("active");
          if (isActive) {
            activeRegions = activeRegions.filter(r => r !== region);
            button.classed("active", false).style("opacity", "1");
          } else {
            activeRegions.push(region);
            button.classed("active", true).style("opacity", "0.7");
          }
          renderChart(filterData());
        });
    });

    renderChart(filterData());
  }).catch(err => console.error("Error loading JSON:", err));