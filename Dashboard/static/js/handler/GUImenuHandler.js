export default class GUImenuHandler {

    #datahandler;

    constructor(dh) {
        this.#datahandler = dh;
        this.#initTabs();
        this.#initTooltips();
        this.#initRegionSelection();
        this.#initDatepicker();
        this.#initTimeRangeSlider();
        this.#filtersChange();
    }



/////////////
// Sidebar //
/////////////

// Initialisierung Jquery UI Tabs: 
    #initTabs() {
        $('#myTabs').tabs({
            activate: function (event, ui) { // Bei Tabwechsel:
                // Tooltip bei Wechsel entfernen
                var clickedAnchor = $(ui.newTab).find('a[data-bs-toggle="tooltip"]');
                if (clickedAnchor.length) {
                    var tooltip = bootstrap.Tooltip.getInstance(clickedAnchor);
                    tooltip.hide();
                }
                // Klasse active auf aktuelles Tab wechseln
                $('#myTabs a').removeClass('active');
                $(ui.newTab[0].children[0]).addClass('active');
                // Pagename updaten
                const topbarPagename = document.getElementById('topbar-pagename');
                topbarPagename.textContent = ui.newTab.prevObject[0].getAttribute('data-bs-original-title');

                // Plots resizen:
                window.dispatchEvent(new Event('resize'));
            }
        });
    }

// Tooltip-Trigger (von https://getbootstrap.com/docs/5.3/examples/sidebars/)
    #initTooltips() {
        'use strict';
        const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
        tooltipTriggerList.forEach((tooltipTriggerEl) => {
            new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }




////////////
// Topbar //
////////////

// Regionen-Auswahl (Checkboxes)
    #initRegionSelection() {
        const that = this;
        const region_sel = $('#region_sel')[0];
        const checkboxes = $("#region_sel :checkbox").toArray();
        const button = $("#region_sel > button")[0];

        function update_button_text(sel) {
            if (sel.length < 4) {
                button.innerText = sel.join(', ');
            } else {
                button.innerText = 'Alle Regionen';
            }
        }
        
        region_sel.addEventListener('click', (event) => {
            if (event.target.type === 'checkbox') {
                // Button-Text updaten:
                var selectedRegions = [];
                checkboxes.forEach((checkbox) => {
                    if (checkbox.checked) {selectedRegions.push(checkbox.value);}
                });
                if (selectedRegions.length < 1) { // Wenn keine Region mehr gewählt ist werden autom. alle wieder angewählt
                    checkboxes.forEach((checkbox) => {
                        checkbox.checked = true;
                        selectedRegions.push(checkbox.value);
                    });
                }
                update_button_text(selectedRegions);
            }
        });
    }


// Date-Range Picker (von: https://codepen.io/surabhi/pen/dObYoP)
    #initDatepicker() {
        const that = this;

        function getDate(element) {
            var date;
            try {
                date = $.datepicker.parseDate(dateFormat, element.value);
            } catch (error) {
                date = null;
            }
            return date;
        };

        var dateFormat = "dd.mm.yy",
            from = $("#from_date")
                .datepicker({
                    dateFormat: dateFormat,
                    changeMonth: true,
                    changeYear: true,
                    minDate: '27.04.2019',
                    maxDate: '-1D',
                    numberOfMonths: 1
                })
                .on("change", function () {
                    to.datepicker("option", "minDate", getDate(this));
                }),
            to = $("#to_date").datepicker({
                dateFormat: dateFormat,
                changeMonth: true,
                changeYear: true,
                minDate: '27.04.2019',
                maxDate: '-1D',
                numberOfMonths: 1
            })
                .on("change", function () {
                    from.datepicker("option", "maxDate", getDate(this));
                });

        // Vorgefüllt: (Der ganze vorherige Monat)
        from.datepicker("setDate", that.#datahandler.selDates[0]);
        to.datepicker("setDate", that.#datahandler.selDates[1]);
    }



// Time-Slider (angepasst von: https://jsfiddle.net/jrweinb/MQ6VT):
    #initTimeRangeSlider() {
        const that = this;

        $("#slider-range").slider({
            range: true,
            min: 360,
            max: 1440,
            step: 60,
            values: that.#datahandler.timeRange,
            slide: function (e, ui) {

                // Abbrechen vor Überlappung
                var distance = ui.values[1] - ui.values[0];
                var step = $("#slider-range").slider("option", "step");
                if (distance < step) { return false; }

                // Text linker Slider
                var hours1 = Math.floor(ui.values[0] / 60);
                var minutes1 = ui.values[0] - (hours1 * 60);
                if (hours1.toString().length == 1) hours1 = '0' + hours1;
                if (minutes1.toString().length == 1) minutes1 = '0' + minutes1;
                if (minutes1 == 0) minutes1 = '00';
                $('.slider-time').html(hours1 + ':' + minutes1);

                // Text rechter Slider
                var hours2 = Math.floor(ui.values[1] / 60);
                var minutes2 = ui.values[1] - (hours2 * 60);
                if (hours2.toString().length == 1) hours2 = '0' + hours2;
                if (minutes2.toString().length == 1) minutes2 = '0' + minutes2;
                if (minutes2 == 0) minutes2 = '00';
                if (hours2 == 24) {
                    hours2 = '23';
                    minutes2 = '59';
                }
                $('.slider-time2').html(hours2 + ':' + minutes2);

                // Update Text-Position
                var max = $("#slider-range").slider("option", "max");
                var min = $("#slider-range").slider("option", "min");
                var parent_width = parseInt($("#time-range").css('width'));
                var perc_left = 100 / (max - min) * (ui.values[0] - min)
                $('.slider-time').css("left", perc_left / 100 * parent_width - 33 + "px"); // 33px offset
                var perc_right = 100 / (max - min) * (ui.values[1] - min)
                $('.slider-time2').css("right", (100 - perc_right) / 100 * parent_width - 33 + "px"); // 33px offset
            }
        });
    }


// Event-Listener bei Wechsel eines Filters & Updaten der Grafiken
    #filtersChange() {
        const that = this;

        const handleFilterChange = () => {
            // Regionen updaten:
            that.#datahandler.checkedRegions = $('#region_sel input[type="checkbox"]:checked')
                .map(function() {return $(this).val();})
                .get();       
            // Datum updaten:
            that.#datahandler.selDates[0] = new Date($('#from_date').val().split(".").reverse().join("-"))
            that.#datahandler.selDates[1] = new Date($('#to_date').val().split(".").reverse().join("-"))
            // Tageszeit updaten:
            that.#datahandler.timeRange = $("#slider-range").slider("values")
            
            // Neu filtern der Daten auslösen:
            that.#datahandler.filterData();
            //Aktualisierung der Plots auslösen:
            document.dispatchEvent(new Event("reload_chart"));
        };

        // Listener bei Änderungen an Filtern:  
        var sel_elements = $('#region_sel input[type="checkbox"], #from_date, #to_date, #slider-range')
        sel_elements.on('slide change', _.debounce(handleFilterChange, 2000, { 'leading': false, 'trailing': true }));
    }

}