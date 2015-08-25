////////////////////////////////////////////////////////////////////////
// JavaScript library for the HXL Proxy
//
// All functions and varibles appear as properties of the hxl_proxy
// object.
//
// Main entry points:
//   hxl_proxy.setupForm()
//   hxl_proxy.setupChart(params)
//   hxl_proxy.setupMap()
////////////////////////////////////////////////////////////////////////


/**
 * Root object for all HXL Proxy functions and variables.
 */
var hxl_proxy = {}


/**
 * Bring up the Dropbox file selector.
 */
hxl_proxy.doDropbox = function() {
    Dropbox.choose({
        success: function(files) {
            url = files[0].link;
            window.location = "/data/edit?url=" + encodeURIComponent(url);
        }
    });
}


/**
 * Renumber filters in sequence.
 */
hxl_proxy.renumberFilters = function() {

    // Adjust the first numeric value in an attribute.
    function adjustAttr(node, attrName, index) {
        value = $(node).attr(attrName);
        if (value) {
            value = value.replace(/[0-9][0-9]/, index);
            $(node).attr(attrName, value);
        }
    }

    // look through all descendants of each filter
    $('.filter').each(function (index, node) {
        $(node).find('*').each(function (i, child) {
            n = '00' + (index + 1);
            n = n.substr(n.length - 2);
            adjustAttr(child, 'id', n);
            adjustAttr(child, 'name', n);
            adjustAttr(child, 'for', n);
            adjustAttr(child, 'data-target', n);
            adjustAttr(child, 'href', n);
        });
    });
}

/**
 * Set up a page containing a form.
 * External dependencies: none
 */
hxl_proxy.setupForm = function() {

    function setup_fieldset(node, index) {
        filter_name = $(node).find(".field_filter select").val();
        filter_desc = $(node).find(".field_filter option:selected").text();
        filter_class = ".fields-" + filter_name;
        filter_title = (filter_desc ? filter_desc : '(not set)');
        $(node).find(".modal-title").text(filter_title);

        var filter_button = $(node).find(".filter-button");
        filter_button.text(filter_title);
        if (filter_name) {
            filter_button.removeClass("btn-default")
            filter_button.addClass("btn-primary")
        } else {
            filter_button.removeClass("btn-primary")
            filter_button.addClass("btn-default")
        }
        $(node).find(".hideable").hide();
        $(node).find(".hideable").find(hxl_proxy.field_types).prop("disabled", true);
        $(node).find(filter_class).show();
        $(node).find(filter_class).find(hxl_proxy.field_types).prop("disabled", false);
    };

    hxl_proxy.field_types = "input,select"
    $(".hideable").hide();
    $("#filter-form div.filter").each(function (index) {
        var filter_node = this;
        setup_fieldset(filter_node, index);
        $(filter_node).find(".field_filter select").on("change", function () {
            setup_fieldset(filter_node, index);
        })
    });
};


/**
 * Set up a page containing a chart.
 * External dependencies: Google Charts, JQuery, HXL
 * @param params.data_url URL to a CSV HXL dataset
 * @param params.type currently "pie", "bar", or "column" (defaults to "pie")
 * @param params.label_pattern HXL tag pattern for the column containing labels (defaults to first column)
 * @param params.value_pattern HXL tag pattern for the column containing values (defaults to a numbery column, if present)
 */
hxl_proxy.setupChart = function(params) {

    // Callback that creates and populates a data table,
    // instantiates the pie chart, passes in the data and
    // draws it.
    function drawChart() {

        function get_label_pattern(hxl) {
            if (params.label_pattern && hxl.hasColumn(params.label_pattern)) {
                return params.label_pattern;
            } else {
                // FIXME - just defaulting to first tag for now
                return hxl.columns[0].tag;
            }
        }

        function get_value_pattern(hxl) {
            if (params.value_pattern && hxl.hasColumn(params.value_pattern)) {
                return params.value_pattern;
            } else {
                for (i in hxl.columns) {
                    if (hxl.isNumbery(hxl.columns[i].displayTag)) {
                        return hxl.columns[i];
                    }
                }
                alert("Can't guess numeric column for charting.");
            }
        }

        $.get(params.data_url, function(csvString) {
            var rawData = $.csv.toArrays(csvString, {onParseValue: $.csv.hooks.castToScalar});
            var hxlData = hxl.wrap(rawData);
            var label_pattern = get_label_pattern(hxlData);
            var value_column = get_value_pattern(hxlData);
            var value_pattern = value_column.displayTag;
            var title = '';
            if (value_column.header) {
                title = value_column.header + ' (' + value_column.displayTag + ')';
            } else {
                title = value_column.displayTag;
            }

            var chartData = [[label_pattern, value_pattern]];
            var iterator = hxlData.iterator();
            while (row = iterator.next()) {
                var label = row.get(label_pattern);
                var value = row.get(value_pattern);
                if (!isNaN(value)) {
                    chartData.push([label, 0 + value]);
                }
            }

            var data = google.visualization.arrayToDataTable(chartData);

            if (params.type == 'bar') {
                options = {
                    title: title,
                    width: '100%',
                    height: hxlData.getRows().length * 40,
                    chartArea: {
                        top: 50
                    },
                    legend: {
                        position: 'none'
                    }
                }
                var chart = new google.visualization.BarChart(document.getElementById('chart_div'));
            } else if (params.type == 'column') {
                options = {
                    title: title,
                    width: hxlData.getRows().length * 60,
                    chartArea: {
                        top: 50,
                        left: 50
                    },
                    legend: {
                        position: 'none'
                    }
                }
                var chart = new google.visualization.ColumnChart(document.getElementById('chart_div'));
            } else {
                if (params.type && params.type != 'pie') {
                    alert("Unknown chart type: " + params.type + "\nPlease use 'bar', 'column', or 'pie'");
                }
                options = {
                    title: title,
                    width: '100%',
                    height: '100%',
                    chartArea: {
                        top: 50,
                        left: 50,
                    }
                }
                var chart = new google.visualization.PieChart(document.getElementById('chart_div'));
            }

            chart.draw(data, options);
        });
    }

    // Load the Visualization API and the piechart package.
    google.load('visualization', '1.0', {'packages':['corechart']});

    // Set a callback to run when the Google Visualization API is loaded.
    google.setOnLoadCallback(drawChart);

};


/**
 * Set up a page containing a map.
 * External dependencies: Leaflet, Leaflet marker cluster plugin, JQuery, HXL
 */
hxl_proxy.setupMap = function() {

    /**
     * Generate a heat-map colour.
     */
    function make_color(value, min, max) {

        function make_hex(n) {
            var s = n.toString(16);
            if (s.length < 2) {
                s = '0' + s;
            }
            return s;
        }

        var range = max - min;
        var magnitude = value - min;
        var percentage = magnitude / range;
        var red = Math.floor(255 * percentage);
        var green = Math.floor(255 * (1 - percentage));
        return '#' + make_hex(red) + make_hex(green) + '00';
    }

    /**
     * Generate a label for a map item.
     */
    function make_label(row) {
        var escapeHTML = (function () {
            'use strict';
            var chr = { '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' };
            return function (text) {
                text = '' + text;
                return text.replace(/[\"&<>]/g, function (a) { return chr[a]; });
            };
        }());
        var label = "<table class='map-popup'>\n";
        for (i in row.values) {
            column = row.columns[i];
            value = row.values[i];
            if (value && column.tag != '#geo' && column.tag != '#lat_deg' && column.tag != '#lon_deg' && column.tag != '#x_bounds_js') {
                label += "  <tr>\n";
                if (column.header) {
                    label += "    <th>" + escapeHTML(column.header) + "</th>\n";
                } else {
                    label += "    <th>" + escapeHTML(column.tag) + "</th>\n";
                }
                label += "    <td>" + escapeHTML(value) + "</td>\n";
                label += "  </tr>\n";
            }
        }
        label += "</table>";
        return label;
    }

    /**
     * Draw point features on a map.
     */
    function draw_points(hxl) {
        var map_layers = {};

        function get_map_layer(name) {
            if (!map_layers[name]) {
                map_layers[name] = new L.layerGroup();
            }
            return map_layers[name];
        }

        var iterator = hxl.iterator();
        var seen_latlon = false;

        while (row = iterator.next()) {
            var layer = get_map_layer(row.get(map_layer_tag));
            var lat = row.get('#geo+lat') || row.get('#lat_deg');
            var lon = row.get('#geo+lon') || row.get('#lon_deg');
            if (lat != null && !isNaN(lat) && lon != null && !isNaN(lon)) {
                var marker = L.marker([lat, lon]);
                marker.bindPopup(make_label(row));
                layer.addLayer(marker);
                seen_latlon = true;
            }
        }

        var overlays = {}
        for (name in map_layers) {
            map_markers.addLayer(map_layers[name]);
            overlays[name] = new L.layerGroup();
            map.addLayer(overlays[name]);
        }
        L.control.layers(null, overlays).addTo(map);

        map.on('overlayadd', function (event) {
            map_markers.addLayer(map_layers[event.name]);
        });

        map.on('overlayremove', function (event) {
            map_markers.removeLayer(map_layers[event.name]);
        });

        map.addLayer(map_markers);
        map.fitBounds(map_markers.getBounds());
    }

    /**
     * Draw a map of shapes (e.g. a choropleth map)
     */
    function draw_polygons(hxl) {
        var features = L.featureGroup([]);

        var min_value = hxl.getMin('#meta+count') || hxl.getMin('#x_count_num');
        var max_value = hxl.getMax('#meta+count') || hxl.getMax('#x_count_num');

        var iterator = hxl.iterator();
        while (row = iterator.next()) {
            bounds_str = row.get('#geo+bounds') || row.get('#x_bounds_js');
            if (bounds_str) {
                var geometry = jQuery.parseJSON(bounds_str);
                var count = row.get('#meta+count') || row.get('#x_count_num');
                var layer = L.geoJson(geometry, {
                    style: {
                        color: make_color(count, min_value, max_value),
                        opacity: 0.5,
                        weight: 2
                    }
                });
                layer.bindPopup(make_label(row));
                features.addLayer(layer);
            }
            map.addLayer(features);
            map.fitBounds(features.getBounds());
        }
    }

    /**
     * Load the HXL and draw the map.
     */
    $.get(csv_url, function(csvString) {
        var arrayData = $.csv.toArrays(csvString, {onParseValue: $.csv.hooks.castToScalar});
        var hxl = new HXLDataset(arrayData);
        // FIXME - for now, always prefer the boundary data to lat/lon
        if (hxl.hasColumn('#geo+bounds') || hxl.hasColumn('#x_bounds_js')) {
            draw_polygons(hxl);
        } else if ((hxl.hasColumn('#geo+lat') || hxl.hasColumn('#lat_deg')) && (hxl.hasColumn('#geo+lon') || hxl.hasColumn('#lon_deg'))) {
            draw_points(hxl);
        } else {
            alert("Either #geo+bounds or #geo+lat and #geo+lon needed for a map.");
        }
    });

    var map = L.map('map-div');
    var map_markers = new L.MarkerClusterGroup();

    var osmUrl='http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    var osmAttrib='Map data © <a href="http://openstreetmap.org">OpenStreetMap</a> contributors';
    var osm = new L.TileLayer(osmUrl, {attribution: osmAttrib});
    map.addLayer(osm);
};

// end
