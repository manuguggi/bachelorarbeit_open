
export default class GUIroutenHandler {

    #datahandler;
    #map;
    #barchart;
    #sa_chart;

    constructor(dh) {
        this.#datahandler = dh;

        this.#reloadPlots();

        this.stops;
        this.mapData;
        this.markers;
        this.markersOnScreen;
        this.selectedMarker;
        this.minmaxJourneys;
        this.#initMap();

        this.#barchart = document.getElementById('routen_barchart')
        this.#initBarChart();
        this.#sa_chart = document.getElementById('routen_sa_chart')
        this.#initSAChart();
    }


    // Plots bei Filter-Wechsel neu laden:
    #reloadPlots() {
        const that = this;
        document.addEventListener('reload_chart', () => {
            // Map:
            for (var key in that.markers) { // Alte Marker von Map entfernen
                if (that.markers.hasOwnProperty(key)) {
                    that.markers[key].remove();
                }
            }
            that.markers = {}; // Erstelle Marker löschen 2x
            that.markersOnScreen = {};
            this.selectedMarker = null;
            $("#routen_map .mapboxgl-popup").remove() // Tooltip entfernen (wenn geöffnet)
            that.#loadMapData(); // Neue Daten laden
            that.mapData.then(mapData => { // Neue Daten setzen
                that.#map.getSource('mapData').setData(mapData);
            });

            // Plotly:
            that.#initBarChart();
            that.#initSAChart();
        });
    }


    /////////
    // Map //
    /////////

    #initMap() {
        const that = this;

        mapboxgl.accessToken = "ACCESS_TOKEN";
        that.#map = new mapboxgl.Map({
            style: "mapbox://styles/mapbox/light-v10",
            container: "routen_map",
            center: [8.25, 46.8],
            zoom: 6.8,
            minZoom: 6.8,
            maxBounds: [[4, 43.5], [12, 50]]
        });

        that.stops = Promise.all([
            d3.json("data/stops/stopsBelp.geojson?" + new Date().getTime()),
            d3.json("data/stops/stopsEmmental.geojson?" + new Date().getTime()),
            d3.json("data/stops/stopsGotthard.geojson?" + new Date().getTime()),
            d3.json("data/stops/stopsHerzogenbuchsee.geojson?" + new Date().getTime())
        ])
            .then(function (files) {
                var stops = { "type": "FeatureCollection", "features": [] };
                files.forEach(file => { stops.features = stops.features.concat(file.features) });

                return stops
            });


        that.#loadMapData();

        that.mapData.then(mapData => {

            // Template von https://docs.mapbox.com/mapbox-gl-js/example/cluster-html/
            // (Stark abgeändert)

            const colors = ['#0081A7', '#F07167'];

            that.#map.on('load', () => {
                // add a clustered GeoJSON source for the pickup data
                that.#map.addSource('mapData', {
                    'type': 'geojson',
                    'data': mapData,
                    'cluster': true,
                    'clusterRadius': 80,
                    'clusterProperties': {
                        'pickups': ['+', ['get', 'pickups']],
                        'dropoffs': ['+', ['get', 'dropoffs']],
                        'stationNames': ['concat', ['get', 'Address'], ';']
                    }
                });
                // circle and symbol layers for rendering individual stops (unclustered points)
                that.#map.addLayer({
                    'id': 'pickup_circle',
                    'type': 'circle',
                    'source': 'mapData',
                    'paint': {
                        'circle-opacity': 0,
                    }
                });

                // objects for caching and keeping track of HTML marker objects (for performance)
                that.markers = {};
                that.markersOnScreen = {};

                function updateMarkers() {
                    const newMarkers = {};
                    const features = that.#map.querySourceFeatures('mapData');

                    // for every cluster & point on the screen, create an HTML marker for it (if we didn't yet),
                    // and add it to the map if it's not there already
                    for (const feature of features) {
                        const coords = feature.geometry.coordinates;
                        const props = feature.properties;

                        // Nicht geclusterte Punkte:
                        if (!props.cluster) {
                            props.point_count = 1;
                            const address = props.Address;
                            let marker = that.markers[address];
                            if (!marker) {
                                const el = createDonutChart(props);
                                marker = that.markers[address] = new mapboxgl.Marker({
                                    element: el
                                }).setLngLat(coords);
                                marker.id = address;
                                marker.getElement().addEventListener('click', () => onMarkerClick(marker));
                            }
                            newMarkers[address] = marker;
                            if (!that.markersOnScreen[address]) {
                                marker.addTo(that.#map);
                            }

                            // Geclusterte Punkte:
                        } else {
                            const id = props.cluster_id;
                            let marker = that.markers[id];
                            if (!marker) {
                                const el = createDonutChart(props);
                                marker = that.markers[id] = new mapboxgl.Marker({ element: el })
                                    .setLngLat(coords);
                                marker.id = id;
                                marker.stations = props.stationNames
                                marker.getElement().addEventListener('click', () => onMarkerClick(marker));
                            }
                            newMarkers[id] = marker;
                            if (!that.markersOnScreen[id]) {
                                marker.addTo(that.#map);
                            }
                        }
                    }
                    // for every marker we've added previously, remove those that are no longer visible
                    for (const id in that.markersOnScreen) {
                        if (!newMarkers[id]) that.markersOnScreen[id].remove();
                    }
                    that.markersOnScreen = newMarkers;

                    // Wenn der selektierte Marker nicht mehr auf dem Screen ist
                    if (that.selectedMarker && !(that.selectedMarker.id in that.markersOnScreen)) {
                        removeOldMarker(); // Alte Marker-Selection entfernen 
                        $("#routen_map .mapboxgl-popup").remove() // Tooltip entfernen (wenn geöffnet)
                        that.#initBarChart(); // Barchart wieder mit allen Routen
                        that.#initSAChart(); // SA-Chart wieder mit mostcommon Station
                    }

                }


                // Marker-Click Logik:
                function removeOldMarker() {
                    if (that.markers[that.selectedMarker.id]) {
                        const oldMarker = that.markers[that.selectedMarker.id]._element;
                        oldMarker.style.removeProperty('border');
                        that.selectedMarker = null
                    }
                }
                function onMarkerClick(marker) {
                    if (that.selectedMarker && that.selectedMarker.id === marker.id) { // Bei Klick auf ausgewählten Marker
                        removeOldMarker();
                        $("#routen_map .mapboxgl-popup").remove()
                    } else { // Neuer Marker angeklickt
                        if (that.selectedMarker) { // Wenn es bereits eine andere Selektion gibt
                            removeOldMarker();
                            $("#routen_map .mapboxgl-popup").remove()
                        }
                        // Neuen Marker highlighten
                        that.selectedMarker = marker;
                        marker._element.style.borderRadius = '50%';
                        marker._element.style.border = '3px solid black';
                        // Popup-Text
                        const sourceMapData = that.#map.getSource('mapData')._data // mapData aus Source holen (Damit bei Aktualisierungen jeweils alle Daten berückischtigt werden)
                        if (typeof marker.id === 'string') { // Wenn einzelne Station ausgewählt
                            const stationFeature = sourceMapData.features.find(feature => feature.properties.Address === marker.id);
                            const pickups = stationFeature.properties.pickups
                            const dropoffs = stationFeature.properties.dropoffs
                            var popuptxt = '<b>' + marker.id + '</b>'
                                + '<br>Pickups: <span style="color: ' + colors[0] + '">' + pickups + '</span>'
                                + '<br>Dropoffs: <span style="color: ' + colors[1] + '">' + dropoffs + '</span>';
                        } else { // Wenn Cluster ausgewählt
                            const clusterStations_fc = sourceMapData.features.filter(feature => {
                                return that.selectedMarker.stations.includes(feature.properties.Address)
                            });
                            const pickups = clusterStations_fc.reduce((sum, feature) => sum + feature.properties.pickups, 0);
                            const dropoffs = clusterStations_fc.reduce((sum, feature) => sum + feature.properties.dropoffs, 0);
                            var popuptxt = '<b>Cluster mit ' + clusterStations_fc.length + ' Haltepunkten</b>'
                                + '<br>Pickups: <span style="color: ' + colors[0] + '">' + pickups + '</span>'
                                + '<br>Dropoffs: <span style="color: ' + colors[1] + '">' + dropoffs + '</span>';
                        };
                        // Popup öffnen
                        var popup = new mapboxgl.Popup({
                            offset: marker._element.clientHeight / 2 + 3, // Halbe Höhe des Kreises + 3px von BorderWidth
                            closeButton: true,
                            closeOnClick: false
                        })
                            .setHTML(popuptxt);
                        popup.setLngLat(marker._lngLat).addTo(that.#map);
                    }
                    // Barchart und SA-Chart updaten:
                    that.#initBarChart();
                    that.#initSAChart();
                }


                // after the GeoJSON data is loaded, update markers on the screen on every frame
                that.#map.on('render', () => {
                    if (!that.#map.isSourceLoaded('mapData')) return;
                    updateMarkers();
                });
            });

            // code for creating an SVG donut chart from feature properties
            function createDonutChart(props) {
                const offsets = [];
                const counts = [
                    props.pickups,
                    props.dropoffs
                ];
                let total = 0;
                for (const count of counts) {
                    offsets.push(total);
                    total += count;
                }
                const fontSize = 16;
                const rScale = d3.scaleLinear()
                    .domain(that.minmaxJourneys)
                    .range([20, 40])
                    .clamp(true);
                const r = rScale(total);
                var r0 = 0
                // Wenn es ein Cluster ist: Loch in PieChart machen (für Zahl)
                if (props.cluster) { r0 = Math.round(r * 0.6) };
                const w = r * 2;
                const opacityScale = d3.scaleLinear()
                    .domain(that.minmaxJourneys)
                    .range([0.3, 1])
                    .clamp(true);
                const opacity = opacityScale(total)

                let html = `<div><svg width="${w}" height="${w}" viewbox="0 0 ${w} ${w}" text-anchor="middle" style="font: ${fontSize}px sans-serif; display: block; opacity: ${opacity}">`;

                for (let i = 0; i < counts.length; i++) {
                    html += donutSegment(
                        offsets[i] / total,
                        (offsets[i] + counts[i]) / total,
                        r,
                        r0,
                        colors[i]
                    );
                }
                // Wenn es ein Cluster ist: Zahl in Mitte hinzufügen
                if (props.cluster) { html += `<circle cx="${r}" cy="${r}" r="${r0}" fill="white" /><text dominant-baseline="central" transform="translate(${r}, ${r})">${props.point_count.toLocaleString()}</text></svg></div>` };

                const el = document.createElement('div');
                el.innerHTML = html;
                return el.firstChild;
            }

            function donutSegment(start, end, r, r0, color) {
                if (end - start === 1) end -= 0.00001;
                const a0 = 2 * Math.PI * (start - 0.25);
                const a1 = 2 * Math.PI * (end - 0.25);
                const x0 = Math.cos(a0),
                    y0 = Math.sin(a0);
                const x1 = Math.cos(a1),
                    y1 = Math.sin(a1);
                const largeArc = end - start > 0.5 ? 1 : 0;

                // draw an SVG path
                return `<path d="M ${r + r0 * x0} ${r + r0 * y0} L ${r + r * x0} ${r + r * y0
                    } A ${r} ${r} 0 ${largeArc} 1 ${r + r * x1} ${r + r * y1} L ${r + r0 * x1
                    } ${r + r0 * y1} A ${r0} ${r0} 0 ${largeArc} 0 ${r + r0 * x0} ${r + r0 * y0
                    }" fill="${color}" />`;
            }

        })

    }

    #loadMapData() {
        const that = this;

        that.mapData = that.stops.then(stops => {
            var sel_data = that.#datahandler.get_selectedData()
            var mapData = sel_data.then(sel_data => {

                // Anzahl Pickups & Dropoffs berechnen und zu stops featColl hinzufügen
                var pickups = d3.rollup(sel_data, v => v.length, d => d['pickup.station_chosen_confirmation_addr'])
                var dropoffs = d3.rollup(sel_data, v => v.length, d => d['dropoff.station_chosen_confirmation_addr'])
                for (const feature of stops.features) {
                    const address = feature.properties.Address;
                    if (pickups.has(address)) {
                        feature.properties.pickups = pickups.get(address);
                    } else {
                        feature.properties.pickups = 0;
                    };
                    if (dropoffs.has(address)) {
                        feature.properties.dropoffs = dropoffs.get(address);
                    } else {
                        feature.properties.dropoffs = 0;
                    }
                }

                // Nur solche behalten, die Pickups oder Dropoffs enthalten:
                var filteredFeatures = stops.features.filter(feature => feature.properties.pickups !== 0 || feature.properties.dropoffs !== 0);
                stops = { "type": "FeatureCollection", "features": filteredFeatures };

                // Maximale Anzahl an Fahrten speichern
                that.minmaxJourneys = [
                    d3.min(stops.features, function (d) { return d.properties.pickups + d.properties.dropoffs }),
                    d3.max(stops.features, function (d) { return d.properties.pickups + d.properties.dropoffs }),
                ];

                return stops
            })
            return mapData
        })

    }



    ///////////////////
    // Charts rechts //
    ///////////////////

    // Barchart:
    #initBarChart() {
        const that = this;

        var data = that.#datahandler.get_selectedData()
        data.then(data => {

            that.mapData.then(mapData => { // Laden der MapData abwarten (zur Ermittlung der meisten Pickups/Dropoffs)

                // Station(en) bestimmen
                var stations = [];
                var selectedStation = null;
                if (that.selectedMarker) {
                    if (typeof that.selectedMarker.id === 'string') { //  Wenn einzelne Station ausgewählt
                        stations.push(that.selectedMarker.id);
                        selectedStation = 'one'
                    } else { //  Wenn Cluster ausgewählt
                        const presentStations_fc = mapData.features.filter(feature => {
                            return that.selectedMarker.stations.includes(feature.properties.Address);
                        });
                        stations = presentStations_fc.map(feature => feature.properties.Address);
                        selectedStation = 'multiple'
                    }
                }

                // Daten vorbereiten
                var routes = [];
                data.forEach(d => {
                    var pickup = d['pickup.station_chosen_confirmation_addr'];
                    var dropoff = d['dropoff.station_chosen_confirmation_addr'];
                    var route = { pickup: pickup, dropoff: dropoff };
                    routes.push(route);
                })

                if (selectedStation) { // Wenn Station(en) selektiert: Daten filtern
                    routes = routes.filter(d => stations.includes(d.pickup))
                }
                routes = d3.rollups(routes, v => v.length, d => d.pickup + '<br>➔ ' + d.dropoff);

                // Prozentanteil gegenüber aller Fahrten hinzufügen: 
                var totalJourneys = routes.reduce((sum, subarray) => sum + subarray[1], 0);
                for (let i = 0; i < routes.length; i++) {
                    var percentage = (routes[i][1] / totalJourneys) * 100;
                    routes[i].push(percentage);
                }

                var top5 = routes.sort((a, b) => b[1] - a[1]).slice(0, 5).reverse();
                var top5_keys = top5.map(item => item[0]);
                var top5_values = top5.map(item => item[1]); // hier evtl wieder auf absolute Zahlen wechseln


                // Plot-Einstellungen:
                if (selectedStation === 'one') {
                    var subtitle = 'Pickup-Station (selektiert): ' + stations
                } else if (selectedStation === 'multiple') {
                    var subtitle = 'Pickup-Stationen (selektiert): Cluster mit ' + stations.length + ' Haltepunkten'
                } else {
                    var subtitle = 'Pickup-Stationen: Alle'
                }

                var barchartData = [{
                    type: 'bar',
                    x: top5_values,
                    y: top5_keys,
                    orientation: 'h',
                    text: top5_values.map(String)
                }];

                var barchart_layout = {
                    hovermode: false,
                    font: { size: 12 },
                    title: {
                        text: 'Häufigste Routen',
                        xref: 'paper',
                        yref: 'paper',
                        xanchor: 'left',
                        yanchor: 'bottom',
                        font: { color: "black" },
                        x: 0,
                        y: 1.2
                    },
                    annotations: [{
                        text: subtitle,
                        y: 1,
                        x: 0,
                        xref: 'paper',
                        yref: 'paper',
                        xanchor: 'left',
                        yanchor: 'bottom',
                        font: { color: "black" },
                        showarrow: false
                    }, {
                        text: 'Anzahl Fahrten',
                        xref: 'paper',
                        yref: 'paper',
                        x: 0.5,
                        xanchor: 'center',
                        y: 0.0,
                        yanchor: 'top',
                        showarrow: false
                    }],
                    xaxis: {
                        showticklabels: false,
                        autorange: 'reversed',
                        fixedrange: true
                    },
                    yaxis: {
                        tickfont: { size: 11 },
                        side: "right",
                        fixedrange: true
                    },
                    margin: {
                        l: 25,
                        r: 225,
                        b: 20,
                        t: 40
                    }
                };

                // Plot kreieren
                Plotly.newPlot(that.#barchart.id, barchartData, barchart_layout, { displayModeBar: false });
            })
        })


        // Plot bei resize-Event neu ausrichten
        window.addEventListener('resize', () => {
            Plotly.Plots.resize(that.#barchart);
        });
    }


    // SA-Chart:
    #initSAChart() {
        const that = this;

        function get_hour(datestr) {
            if (!datestr) { return "" }
            const hour = new Date(datestr).getHours();
            return hour
        }
        function fillMissingHours(hours, values) {
            for (let hour = 0; hour < 24; hour++) {
                const index = hours.indexOf(hour);
                if (index === -1) {
                    hours.splice(hour, 0, hour);
                    values.splice(hour, 0, 0);
                }
            }
            return hours, values
        }

        var data = that.#datahandler.get_selectedData()
        data.then(data => {

            that.mapData.then(mapData => { // Laden der MapData abwarten (zur Ermittlung der meisten Pickups/Dropoffs)

                // Station(en) bestimmen
                var stations = [];
                var selectedStation;
                if (that.selectedMarker) {
                    if (typeof that.selectedMarker.id === 'string') { //  Wenn einzelne Station ausgewählt
                        stations.push(that.selectedMarker.id);
                        selectedStation = 'one'
                    } else { //  Wenn Cluster ausgewählt
                        const presentStations_fc = mapData.features.filter(feature => {
                            return that.selectedMarker.stations.includes(feature.properties.Address);
                        });
                        stations = presentStations_fc.map(feature => feature.properties.Address);
                        selectedStation = 'multiple'
                    }
                } else { // if no station selected: use the one with most traffic
                    const maxPicDrop = d3.max(mapData.features, feature => feature.properties.pickups + feature.properties.dropoffs);
                    const maxPicDropFeature = mapData.features.find(feature => feature.properties.pickups + feature.properties.dropoffs === maxPicDrop);
                    if (typeof maxPicDropFeature !== 'undefined') {stations.push(maxPicDropFeature.properties.Address);} // Wenn keine Daten selektiert sind wir der Code sonst hier abgebrochen --> falsches Diagramm wird dargestellt
                    selectedStation = null
                }


                // Daten vorbereiten
                var pickups = data.filter(function (d) {
                    return stations.includes(d['pickup.station_chosen_confirmation_addr'])
                });
                pickups = d3.rollup(pickups, v => v.length, d => get_hour(d['timestamps.effective_pickup']))
                pickups.delete("")
                var pickup_hours = Array.from(pickups.keys());
                var pickup_values = Array.from(pickups.values());
                pickup_hours, pickup_values = fillMissingHours(pickup_hours, pickup_values)

                var dropoffs = data.filter(function (d) {
                    return stations.includes(d['dropoff.station_chosen_confirmation_addr'])
                });
                dropoffs = d3.rollup(dropoffs, v => v.length, d => get_hour(d['timestamps.effective_pickup']))
                dropoffs.delete("")
                var dropoff_hours = Array.from(dropoffs.keys());
                var dropoff_values = Array.from(dropoffs.values());
                dropoff_hours, dropoff_values = fillMissingHours(dropoff_hours, dropoff_values)

                // Daten bereitstellen
                var traces = [
                    {
                        x: pickup_hours,
                        y: pickup_values,
                        stackgroup: 'one',
                        name: 'Pickups',
                        customdata: pickup_values,
                        hovertemplate: '%{customdata} Pickups<extra>%{x}:00-%{x}:59</extra>',
                        marker: { color: '#0081A7' },
                        groupnorm: 'percent'
                    },
                    {
                        x: dropoff_hours,
                        y: dropoff_values,
                        stackgroup: 'one',
                        name: 'Dropoffs',
                        customdata: dropoff_values,
                        hovertemplate: '%{customdata} Dropoffs<extra>%{x}:00-%{x}:59</extra>',
                        marker: { color: '#F07167' }
                    }
                ];

                // Plot-Einstellungen:
                if (selectedStation === 'one') {
                    var subtitle = 'Haltepunkt (selektiert): ' + stations
                } else if (selectedStation === 'multiple') {
                    var subtitle = 'Haltepunkte (selektiert): Cluster mit ' + stations.length + ' Haltepunkten'
                } else {
                    var subtitle = 'Haltepunkt (grösster Traffic): ' + stations
                }

                var sa_chart_layout = {
                    font: { size: 12 },
                    title: {
                        text: 'Verlauf Pickups/Dropoffs',
                        xref: 'paper',
                        yref: 'paper',
                        xanchor: 'left',
                        yanchor: 'bottom',
                        font: { color: "black" },
                        x: 0,
                        y: 1.2
                    },
                    annotations: [{
                        text: subtitle,
                        y: 1,
                        x: 0,
                        xref: 'paper',
                        yref: 'paper',
                        xanchor: 'left',
                        yanchor: 'bottom',
                        font: { color: "black" },
                        showarrow: false
                    }, {
                        text: '%',
                        xref: 'paper',
                        yref: 'paper',
                        x: -0.01,
                        xanchor: 'right',
                        y: 0.99,
                        yanchor: 'bottom',
                        showarrow: false
                    }, {
                        text: 'Tageszeit (h)',
                        xref: 'paper',
                        yref: 'paper',
                        x: 1.03,
                        xanchor: 'left',
                        y: 0.015,
                        yanchor: 'top',
                        showarrow: false
                    }],
                    xaxis: {
                        range: [that.#datahandler.timeRange[0] / 60, that.#datahandler.timeRange[1] / 60 - 1],
                        fixedrange: true
                    },
                    yaxis: {
                        fixedrange: true
                    },
                    margin: {
                        l: 25,
                        r: 0,
                        b: 15,
                        t: 40
                    }
                };

                // Plot kreiren
                Plotly.newPlot(that.#sa_chart.id, traces, sa_chart_layout, { displayModeBar: false });
            })

            // Plot bei resize-Event neu ausrichten
            window.addEventListener('resize', () => {
                Plotly.Plots.resize(that.#sa_chart);
            });
        })
    }


}