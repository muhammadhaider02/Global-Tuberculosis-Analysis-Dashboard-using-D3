d3.json("force_directed.json").then(data => {
    const width = document.getElementById('chart').clientWidth;
    const height = document.getElementById('chart').clientHeight;
    const tooltip = d3.select("#tooltip");

    const regionColors = {
      AMR: { color: "#1f77b4", fullName: "Americas" },
      EUR: { color: "#ff7f0e", fullName: "Europe" },
      EMR: { color: "#2ca02c", fullName: "Eastern Mediterranean" },
      AFR: { color: "#d62728", fullName: "Africa" },
      SEA: { color: "#9467bd", fullName: "Southeast Asia" },
      WPR: { color: "#8c564b", fullName: "Western Pacific" }
    };

    const radiusScale = d3.scaleLinear()
      .domain([0, 100])
      .range([5, 30]);

    const years = [...new Set(data.nodes.map(d => d.year))];
    const yearSelect = d3.select("#year-select");

    years.forEach(year => {
      yearSelect.append("option")
        .attr("value", year)
        .text(year)
        .property("selected", year === 1990);
    });

    const legend = d3.select("#legend");
    legend.selectAll("*").remove();
    Object.entries(regionColors).forEach(([abbr, { color, fullName }]) => {
      const item = legend.append("div")
        .attr("class", "legend-item");

      item.append("div")
        .attr("class", "legend-color")
        .style("background-color", color);

      item.append("span").html(fullName.replace(/ /g, "&nbsp;"));

      item.on("click", function () {
        if (selectedRegion === abbr) {
          selectedRegion = null;
          item.classed("active", false).style("opacity", 1);
        } else {
          selectedRegion = abbr;
          legend.selectAll(".legend-item").classed("active", false).style("opacity", 1);
          item.classed("active", true).style("opacity", 0.7);
        }
        renderGraph(selectedYear, selectedRegion);
      });
    });

    let selectedYear = 1990;
    let selectedRegion = "AMR";
    d3.select(`.region-button[data-region="${selectedRegion}"]`).classed("active", true);

    let highlightedNode = null;

    const svg = d3.select("#chart").append("svg")
      .attr("width", width)
      .attr("height", height);

    const container = svg.append("g");

    const zoom = d3.zoom()
      .scaleExtent([0.8, 2.5])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });

    svg.call(zoom);

    document.getElementById("reset-zoom").addEventListener("click", () => {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    });

    function truncateText(text, maxRadius) {
      const maxChars = Math.floor(maxRadius / 4);
      return text.length > maxChars ? text.slice(0, maxChars - 2) + "…" : text;
    }

    function renderGraph(year, region) {
      const filteredNodes = data.nodes.filter(d => 
      d.year === year && 
      (selectedRegion === null || d.region === selectedRegion)
    );

      const nodeMap = new Map(filteredNodes.map(node => [node.id, node]));
      const filteredLinks = data.links
        .filter(link => nodeMap.has(link.source) && nodeMap.has(link.target))
        .map(link => ({
          ...link,
          source: nodeMap.get(link.source),
          target: nodeMap.get(link.target)
        }));

      container.selectAll(".link").remove();
      container.selectAll(".node").remove();
      container.selectAll(".label").remove();

      const simulation = d3.forceSimulation(filteredNodes)
        .force("link", d3.forceLink(filteredLinks)
          .id(d => d.id)
          .distance(120))
        .force("charge", d3.forceManyBody().strength(-50))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide(50));

      const link = container.append("g")
        .selectAll(".link")
        .data(filteredLinks)
        .join("line")
        .attr("class", "link")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", d => Math.sqrt(d.value) / 4);

      const node = container.append("g")
        .selectAll(".node")
        .data(filteredNodes)
        .join("circle")
        .attr("class", "node")
        .attr("r", d => radiusScale(d.recovery_rate || 0))
        .attr("fill", d => regionColors[d.region]?.color || "#ccc")
        .call(drag(simulation))
        .on("mouseover", (event, d) => {
          tooltip.style("visibility", "visible")
            .style("top", `${event.pageY}px`)
            .style("left", `${event.pageX}px`)
            .html(`<strong>${d.id}</strong><br>Region: ${regionColors[d.region]?.fullName}<br>Recovery Rate: ${d.recovery_rate}%`);
        })
        .on("mousemove", event => {
          tooltip.style("top", `${event.pageY + 10}px`)
            .style("left", `${event.pageX + 10}px`);
        })
        .on("mouseout", () => {
          tooltip.style("visibility", "hidden");
        })
        .on("click", function (event, d) {
          if (highlightedNode === d) {
            highlightedNode = null;
            resetHighlight(node, link);
          } else {
            highlightedNode = d;
            applyHighlight(node, link, d);
          }
        });

      const labels = container.append("g")
        .selectAll(".label")
        .data(filteredNodes)
        .join("text")
        .attr("class", "label")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .text(d => truncateText(d.id, radiusScale(d.recovery_rate || 0)));

      simulation.on("tick", () => {
        link
          .attr("x1", d => d.source.x)
          .attr("y1", d => d.source.y)
          .attr("x2", d => d.target.x)
          .attr("y2", d => d.target.y);

        node
          .attr("cx", d => d.x)
          .attr("cy", d => d.y);

        labels
          .attr("x", d => d.x)
          .attr("y", d => d.y);
      });

      function applyHighlight(nodes, links, targetNode) {
        nodes.attr("opacity", node => (node === targetNode || isLinked(node, targetNode) ? 1 : 0.1));
        links.attr("opacity", link => (link.source === targetNode || link.target === targetNode ? 1 : 0.1));
      }

      function resetHighlight(nodes, links) {
        nodes.attr("opacity", 1);
        links.attr("opacity", 0.6);
      }

      function isLinked(node, targetNode) {
        return filteredLinks.some(link => (link.source === node && link.target === targetNode) ||
                                          (link.target === node && link.source === targetNode));
      }

      function drag(simulation) {
        function dragstarted(event, d) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        }

        function dragged(event, d) {
          d.fx = event.x;
          d.fy = event.y;
        }

        function dragended(event, d) {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }

        return d3.drag()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended);
      }
    }

    yearSelect.on("change", function () {
      selectedYear = +this.value;
      renderGraph(selectedYear, selectedRegion);
    });

    d3.selectAll(".region-button").on("click", function () {
      selectedRegion = d3.select(this).attr("data-region");
      d3.selectAll(".region-button").classed("active", false);
      d3.select(this).classed("active", true);
      renderGraph(selectedYear, selectedRegion);
    });

    renderGraph(selectedYear, selectedRegion);
  }).catch(err => console.error("Error loading JSON:", err));