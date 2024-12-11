        const width = 1050;
        const height = 550;
        const margin = { top: 30, right: 30, bottom: 50, left: 60 };
        let selectedCountry = null;
        let activeRegions = [];
        let activeRange = null;
        let currentTransform = d3.zoomIdentity;

        d3.json("time_line.json").then(data => {
            const nestedData = d3.group(data, d => d.country);
            const countries = Array.from(nestedData.keys());
            const eligibleCountries = countries.filter(country => {
                const countryData = nestedData.get(country);
                return countryData.every(d =>
                    d.year >= 1990 &&
                    d.year <= 2013 &&
                    d.total_incidence >= 2500 &&
                    d.total_incidence <= 95000 &&
                    d.total_prevelance_ex_HIV >= 1000 &&
                    d.total_prevelance_ex_HIV <= 18000
                );
            });

            const countriesByRegion = {};
            eligibleCountries.forEach(country => {
                const region = nestedData.get(country)[0].region;
                if (!countriesByRegion[region]) {
                    countriesByRegion[region] = [];
                }
                countriesByRegion[region].push(country);
            });

            const selectedCountries = [];
            const allRegions = ["AMR", "EUR", "EMR", "AFR", "SEA", "WPR"];
            allRegions.forEach(region => {
                if (countriesByRegion[region] && countriesByRegion[region].length >= 2) {
                    selectedCountries.push(...d3.shuffle(countriesByRegion[region]).slice(0, 3));
                }
            });

            const remainingSlots = 20 - selectedCountries.length;
            const remainingCountries = eligibleCountries.filter(country => !selectedCountries.includes(country));
            selectedCountries.push(...d3.shuffle(remainingCountries).slice(0, remainingSlots));

            const randomCountries = selectedCountries;
            const filteredData = data.filter(d => randomCountries.includes(d.country));

            const timelineLegend = d3.select("#timeline-legend");

            const regionColors = {
                AMR: { color: "#1f77b4", fullName: "Americas" },
                EUR: { color: "#ff7f0e", fullName: "Europe" },
                EMR: { color: "#2ca02c", fullName: "Eastern Mediterranean" },
                AFR: { color: "#d62728", fullName: "Africa" },
                SEA: { color: "#9467bd", fullName: "Southeast Asia" },
                WPR: { color: "#8c564b", fullName: "Western Pacific" }
            };

            Object.entries(regionColors).forEach(([abbr, { color, fullName }]) => {
                const item = timelineLegend.append("div").attr("class", "legend-item");

                item.append("div")
                    .attr("class", "legend-color")
                    .style("background-color", color);

                item.append("span").text(fullName);

                item.on("click", function () {
                    if (activeRegions.includes(abbr)) {
                        activeRegions = activeRegions.filter(region => region !== abbr);
                        item.classed("active", false);
                    } else {
                        activeRegions.push(abbr);
                        item.classed("active", true);
                    }

                    updateYear(+yearSlider.property("value"));
                });
            });

            d3.selectAll(".region-button").each(function () {
                const region = d3.select(this).attr("data-region");
                const color = regionColors[region]?.color;
                d3.select(this)
                    .style("background-color", color || "#ccc")
                    .style("color", "#fff")
                    .style("border", `1px solid ${color || "#ccc"}`)
                    .style("box-shadow", "0px 2px 4px rgba(0,0,0,0.2)")
                    .style("transition", "background-color 0.3s ease, color 0.3s ease");
            });

            d3.selectAll(".region-button").on("click", function () {
                const selectedRegion = d3.select(this).attr("data-region");
                if (activeRegions.includes(selectedRegion)) {
                    activeRegions = activeRegions.filter(region => region !== selectedRegion);
                    d3.select(this)
                        .classed("active", false)
                        .style("font-weight", "normal")
                        .style("border", "none");
                } else {
                    activeRegions.push(selectedRegion);
                    d3.select(this)
                        .classed("active", true)
                        .style("font-weight", "bold")
                        .style("border", "2px solid black");
                }
                updateYear(+yearSlider.property("value"));
            });

            const xScale = d3.scaleLinear()
                .domain([0, 100000])
                .range([margin.left, width - margin.right]);

            const yScale = d3.scaleLinear()
                .domain([0, 20000])
                .range([height - margin.bottom, margin.top]);

            const sizeScale = d3.scaleSqrt()
                .domain([50, 100])
                .range([4, 20]);

            const xAxis = d3.axisBottom(xScale).ticks(10).tickFormat(d3.format(","));
            const yAxis = d3.axisLeft(yScale).ticks(10).tickFormat(d3.format(","));

            const svg = d3.select("#chart")
                .append("svg")
                .attr("width", width)
                .attr("height", height);

            const gX = svg.append("g")
                .attr("class", "x-axis")
                .attr("transform", `translate(0,${height - margin.bottom})`)
                .call(d3.axisBottom(xScale).ticks(10).tickFormat(d3.format(",")))
                .append("text")
                .attr("x", width / 2)
                .attr("y", 40)
                .attr("fill", "black")
                .attr("text-anchor", "middle")
                .text("Total Incidence");

            const gY = svg.append("g")
                .attr("class", "y-axis")
                .attr("transform", `translate(${margin.left},0)`)
                .call(d3.axisLeft(yScale).ticks(10).tickFormat(d3.format(",")))
                .append("text")
                .attr("x", -height / 2)
                .attr("y", -50)
                .attr("fill", "black")
                .attr("text-anchor", "middle")
                .attr("transform", "rotate(-90)")
                .text("Total Prevalence");

            function zoomed(event) {
                currentTransform = event.transform;
                const newXScale = currentTransform.rescaleX(xScale);
                const newYScale = currentTransform.rescaleY(yScale);

                gX.call(xAxis.scale(newXScale));
                gY.call(yAxis.scale(newYScale));

                svg.selectAll("circle")
                    .attr("cx", d => newXScale(d.total_incidence))
                    .attr("cy", d => newYScale(d.total_prevelance_ex_HIV));
            }

            const zoom = d3.zoom()
                .scaleExtent([1, 10])
                .on("zoom", (event) => {
                    currentTransform = event.transform;
                    const newXScale = currentTransform.rescaleX(xScale);
                    const newYScale = currentTransform.rescaleY(yScale);

                    gX.call(xAxis.scale(newXScale));
                    gY.call(yAxis.scale(newYScale));

                    svg.selectAll("circle")
                        .attr("cx", d => newXScale(d.total_incidence))
                        .attr("cy", d => newYScale(d.total_prevelance_ex_HIV));
                });

            svg.call(zoom);

            d3.select("#resetZoom").on("click", () => {
                svg.transition()
                    .duration(750)
                    .call(zoom.transform, d3.zoomIdentity);
            });

            svg.append("g")
                .attr("class", "grid")
                .attr("transform", `translate(0,${height - margin.bottom})`)
                .call(
                    d3.axisBottom(xScale)
                        .ticks(10)
                        .tickSize(-height + margin.top + margin.bottom)
                        .tickFormat("")
                )
                .style("stroke", "#ccc")
                .style("stroke-width", "1px")
                .style("opacity", 0.1);

            svg.append("g")
                .attr("class", "grid")
                .attr("transform", `translate(${margin.left},0)`)
                .call(
                    d3.axisLeft(yScale)
                        .ticks(10)
                        .tickSize(-width + margin.left + margin.right)
                        .tickFormat("")
                )
                .style("stroke", "#ccc")
                .style("stroke-width", "1px")
                .style("opacity", 0.1);

            const tooltip = d3.select("#tooltip");

            const years = d3.range(1990, 2014);
            let playing = false;

            const playPauseButton = d3.select("#playPause");
            const yearSlider = d3.select("#yearSlider");
            const currentYearLabel = d3.select("#currentYear");
            let timer;

            function updateYear(year) {
                const yearData = filteredData.filter(d => d.year === +year);
                currentYearLabel.text(year);

                const newXScale = currentTransform.rescaleX(xScale);
                const newYScale = currentTransform.rescaleY(yScale);

                const circles = svg.selectAll("circle")
                    .data(yearData, d => d.country);

                circles.join(
                    enter => enter
                        .append("circle")
                        .attr("cx", d => newXScale(d.total_incidence))
                        .attr("cy", d => newYScale(d.total_prevelance_ex_HIV))
                        .attr("r", 0)
                        .attr("fill", d => regionColors[d.region]?.color || "#ccc")
                        .attr("opacity", d => getOpacity(d))
                        .attr("stroke", d => selectedCountry === d.country ? "black" : "#333")
                        .attr("stroke-width", d => selectedCountry === d.country ? 2 : 1.5)
                        .call(enter => enter.transition()
                            .duration(500)
                            .attr("r", d => sizeScale(d.recovery_rate)))
                        .call(applyEventListeners),
                    update => update
                        .call(update => update.transition()
                            .duration(800)
                            .attr("cx", d => newXScale(d.total_incidence))
                            .attr("cy", d => newYScale(d.total_prevelance_ex_HIV))
                            .attr("r", d => sizeScale(d.recovery_rate))
                            .attr("fill", d => regionColors[d.region]?.color || "#ccc")
                            .attr("opacity", d => getOpacity(d))
                            .attr("stroke", d => selectedCountry === d.country ? "black" : "#333")
                            .attr("stroke-width", d => selectedCountry === d.country ? 2 : 1.5))
                        .call(applyEventListeners),
                    exit => exit
                        .call(exit => exit.transition()
                            .duration(500)
                            .attr("r", 0)
                            .attr("opacity", 0)
                            .remove())
                );

                d3.selectAll(".region-button")
                    .classed("active", function () {
                        return activeRegions.includes(this.getAttribute("data-region"));
                    })
                    .style("font-weight", function () {
                        return activeRegions.includes(this.getAttribute("data-region")) ? "bold" : "normal";
                    })
                    .style("border", function () {
                        return activeRegions.includes(this.getAttribute("data-region")) ? "2px solid black" : "none";
                    });

                d3.selectAll(".size-legend-item")
                    .classed("active", function (d) {
                        return activeRange && activeRange.min === d.min;
                    })
                    .style("font-weight", function (d) {
                        return activeRange && activeRange.min === d.min ? "bold" : "normal";
                    })
                    .style("background-color", function (d) {
                        return activeRange && activeRange.min === d.min ? "#f0f0f0" : "#fff";
                    });
            }

            function getOpacity(d) {
                const inRegion = !activeRegions.length || activeRegions.includes(d.region);
                const inRange = !activeRange || (d.recovery_rate >= activeRange.min && d.recovery_rate < activeRange.max);
                const isSelected = !selectedCountry || selectedCountry === d.country;

                return inRegion && inRange && isSelected ? 0.7 : 0.1;
            }

            function applyEventListeners(selection) {
                selection
                    .on("mouseover", (event, d) => {
                        const formatValue = d3.format(",.0f");

                        tooltip.style("visibility", "visible")
                            .html(`
                                <strong>${d.country}</strong><br>
                                Region: ${d.region}<br>
                                Year: ${d.year}<br>
                                Total Incidence: ${formatValue(d.total_incidence)}<br>
                                Total Prevalence: ${formatValue(d.total_prevelance_ex_HIV)}<br>
                                Recovery Rate: ${d.recovery_rate}%`);
                    })
                    .on("mousemove", (event) => {
                        const [x, y] = d3.pointer(event);
                        tooltip
                            .style("top", `${y + margin.top}px`)
                            .style("left", `${x + margin.left}px`);
                    })
                    .on("mouseout", () => {
                        tooltip.style("visibility", "hidden");
                    })
                    .on("click", (event, d) => {
                        selectedCountry = selectedCountry === d.country ? null : d.country;
                        updateYear(yearSlider.property("value"));
                    });
            }

            function setYear(year, updateVisualization = true) {
                yearSlider.property("value", year);
                currentYearLabel.text(year);
                if (updateVisualization) {
                    updateYear(year);
                }
            }

            yearSlider.on("input", function () {
                const selectedYear = +this.value;
                currentYearLabel.text(selectedYear);
                updateYear(selectedYear);
            });

            playPauseButton.on("click", function () {
                playing = !playing;
                playPauseButton.text(playing ? "Pause" : "Play");

                if (playing) {
                    let currentYearIndex = years.indexOf(+yearSlider.property("value"));
                    timer = setInterval(() => {
                        currentYearIndex = (currentYearIndex + 1) % years.length;
                        const year = years[currentYearIndex];
                        setYear(year, true);

                        if (currentYearIndex === years.length - 1) {
                            clearInterval(timer);
                            playing = false;
                            playPauseButton.text("Play");
                        }
                    }, 1000);
                } else {
                    clearInterval(timer);
                }
            });

            function createSizeLegend() {
                const sizeLegend = d3.select("#sizeLegend");
                const recoveryRateRanges = [
                    { label: "50-60%", min: 50, max: 60, size: 10 },
                    { label: "60-70%", min: 60, max: 70, size: 15 },
                    { label: "70-80%", min: 70, max: 80, size: 20 },
                    { label: "80-90%", min: 80, max: 90, size: 25 },
                    { label: "90-100%", min: 90, max: 100, size: 30 }
                ];

                recoveryRateRanges.forEach(({ label, min, max, size }) => {
                    const item = sizeLegend.append("div")
                        .attr("class", "size-legend-item")
                        .on("click", function () {
                            const isActive = activeRange && activeRange.min === min;
                            activeRange = isActive ? null : { min, max };

                            d3.selectAll(".size-legend-item")
                                .classed("active", false)
                                .style("font-weight", "normal")
                                .style("background-color", "#fff");

                            if (activeRange) {
                                d3.select(this)
                                    .classed("active", true)
                                    .style("font-weight", "bold")
                                    .style("background-color", "#f0f0f0");
                            }

                            updateYear(+yearSlider.property("value"));
                        });

                    item.append("div")
                        .attr("class", "size-legend-circle")
                        .style("width", `${size}px`)
                        .style("height", `${size}px`);

                    item.append("span").text(label);
                });
            }

            d3.selectAll(".region-button").on("click", function () {
                const selectedRegion = d3.select(this).attr("data-region");

                if (activeRegions.includes(selectedRegion)) {
                    activeRegions = activeRegions.filter(region => region !== selectedRegion);
                    d3.select(this)
                        .classed("active", false)
                        .style("font-weight", "normal")
                        .style("border", "none");
                } else {
                    activeRegions.push(selectedRegion);
                    d3.select(this)
                        .classed("active", true)
                        .style("font-weight", "bold")
                        .style("border", "2px solid black");
                }

                updateYear(+yearSlider.property("value"));
            });

            createSizeLegend();
            setYear(1990);
            updateYear(1990);

        }).catch(err => console.error(err));