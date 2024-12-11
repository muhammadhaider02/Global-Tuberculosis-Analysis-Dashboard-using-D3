        const width = window.innerWidth + 200;
        const height = window.innerHeight;

        const zoom = d3.zoom()
            .scaleExtent([1, 10])
            .on("zoom", (event) => {
                svg.attr("transform", event.transform);
            });

        const svg = d3.select("#map")
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .call(zoom)
            .append("g");

        d3.select("#resetZoom").on("click", () => {
            d3.select("#map svg")
                .transition()
                .duration(750)
                .call(zoom.transform, d3.zoomIdentity);
        });

        const projection = d3.geoNaturalEarth1()
            .scale(200)
            .translate([width / 2.5, height / 2]);

        const path = d3.geoPath().projection(projection);
        const tooltip = d3.select("#tooltip");

        let activeRegions = [];
        let activeRange = null;

        Promise.all([
            d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
            d3.json("map_chart.json")
        ]).then(([geoData, mapData]) => {
            const dataByCountryYear = {};

            mapData.forEach(d => {
                if (!dataByCountryYear[d.country]) {
                    dataByCountryYear[d.country] = {};
                }
                dataByCountryYear[d.country][d.year] = {
                    totalCases: d.total_cases,
                    hospitalsPerCapita: d.hospitals_per_capita,
                    region: d.region
                };
            });

            const colorScaleCases = d3.scaleSequential()
                .domain([0, 100000])
                .interpolator(d3.interpolateReds);

            const colorScaleHospitals = d3.scaleSequential()
                .domain([3, 6])
                .interpolator(d3.interpolateBlues);

            const yearDropdown = d3.select("#years");
            for (let year = 1990; year <= 2013; year++) {
                yearDropdown.append("option").attr("value", year).text(year);
            }

            let currentYear = "1990"; 
            let currentMetric = "avgTotalCases";
            updateMap(currentYear, currentMetric);

            yearDropdown.on("change", function () {
                currentYear = d3.select(this).property("value");
                updateMap(currentYear, currentMetric);
            });

            d3.select("#metrics").on("change", function () {
                currentMetric = d3.select(this).property("value");
                updateMap(currentYear, currentMetric);
            });

            function updateMap(selectedYear, selectedMetric) {
                svg.selectAll("path")
                    .data(geoData.features)
                    .join("path")
                    .attr("d", path)
                    .attr("fill", d => {
                        const countryName = d.properties.name;
                        const data = dataByCountryYear[countryName];
                        const yearData = data ? data[selectedYear] : null;

                        const value = selectedMetric === "avgTotalCases" ? yearData?.totalCases : yearData?.hospitalsPerCapita;
                        return value ? (selectedMetric === "avgTotalCases" ? colorScaleCases(value) : colorScaleHospitals(value)) : "#ccc";
                    })
                    .attr("stroke", "#333")
                    .attr("stroke-width", 0.5)
                    .attr("opacity", d => {
                        const countryName = d.properties.name;
                        const data = dataByCountryYear[countryName];
                        const region = data ? Object.values(data)[0]?.region : null;

                        return activeRegions.length === 0 || activeRegions.includes(region) ? 1 : 0.3;
                    })
                    .on("mouseover", (event, d) => {
                        const countryName = d.properties.name;
                        const data = dataByCountryYear[countryName];
                        const yearData = data ? data[currentYear] : null;
                        const formatValue = d3.format(",.0f");
                        
                        if (yearData) {
                            tooltip.style("visibility", "visible").html(`
                                <strong>${countryName}</strong><br>
                                Region: ${yearData.region}<br>
                                Year: ${currentYear}<br>
                                ${currentMetric === "avgTotalCases" ?
                                `Total Cases: ${formatValue(yearData.totalCases)}` :
                                `Clinics per Capita: ${formatValue(yearData.hospitalsPerCapita)}`
                            }
                            `);
                        } else {
                            tooltip.style("visibility", "visible").html(`
                                <strong>${countryName}</strong><br>
                                Region: Unknown<br>
                                Year: ${currentYear}<br>
                                No data available for this year.
                            `);
                        }
                    })
                    .on("mousemove", event => {
                        tooltip
                            .style("top", (event.pageY - 20) + "px")
                            .style("left", (event.pageX + 10) + "px");
                    })
                    .on("mouseout", () => tooltip.style("visibility", "hidden"))
                    .on("click", function (event, d) {
                        const isSelected = d3.select(this).classed("selected");

                        if (isSelected) {
                            svg.selectAll("path").classed("selected", false).attr("opacity", 1);
                        } else {
                            svg.selectAll("path").classed("selected", false).attr("opacity", 0.3);
                            d3.select(this).classed("selected", true).attr("opacity", 1);
                        }
                    });
            }

            d3.selectAll(".region-button").on("click", function () {
                const region = d3.select(this).attr("data-region");

                if (activeRegions.includes(region)) {
                    activeRegions = activeRegions.filter(r => r !== region);
                    d3.select(this)
                        .classed("active", false);
                } else {
                    activeRegions.push(region);
                    d3.select(this)
                        .classed("active", true);
                }

                svg.selectAll("path").transition()
                    .duration(500)
                    .attr("opacity", d => {
                        const countryName = d.properties.name;
                        const data = dataByCountryYear[countryName];
                        const region = data ? Object.values(data)[0]?.region : null;
                        return activeRegions.length === 0 || activeRegions.includes(region) ? 1 : 0.3;
                    });
            });

            const legend = d3.select("#legend");
            const updateLegend = (metric) => {
                legend.selectAll("*").remove();

                const ranges = metric === "avgTotalCases" ? [0, 25000, 50000, 75000, 100000] : [3, 4, 5, 6];
                const colorScale = metric === "avgTotalCases" ? colorScaleCases : colorScaleHospitals;

                const countries = svg.selectAll("path")
                    .data(geoData.features)
                    .join("path")
                    .attr("d", path);

                ranges.forEach((range, i) => {
                    const nextRange = ranges[i + 1];
                    legend.append("div")
                        .attr("class", "legend-item")
                        .html(`
                            <span class="legend-color" style="background:${colorScale(range)};"></span>
                            ${nextRange ? `${range} - ${nextRange}` : `${range}+`}
                        `)
                        .on("click", function () {
                            if (activeRange === range) {
                                activeRange = null;
                                countries.transition()
                                    .duration(500)
                                    .attr("opacity", 1);
                            } else {
                                activeRange = range;
                                countries.transition()
                                    .duration(500)
                                    .attr("opacity", d => {
                                        const countryName = d.properties.name;
                                        const data = dataByCountryYear[countryName];
                                        const value = currentYear === "all"
                                            ? Object.values(data || {}).reduce((sum, val) => sum + val[currentMetric === "avgTotalCases" ? "totalCases" : "hospitalsPerCapita"], 0) / Object.values(data || {}).length
                                            : data?.[currentYear]?.[currentMetric === "avgTotalCases" ? "totalCases" : "hospitalsPerCapita"];
                                        return value >= range && (!nextRange || value < nextRange) ? 1 : 0.3;
                                    });
                            }

                            d3.selectAll(".legend-item").classed("active", false);
                            d3.select(this).classed("active", activeRange !== null);
                        });
                });
            };

            updateLegend("avgTotalCases");

            d3.select("#metrics").on("change", function () {
                currentMetric = d3.select(this).property("value");
                updateMap(currentYear, currentMetric);
                updateLegend(currentMetric);
            });
        }).catch(err => console.error(err));