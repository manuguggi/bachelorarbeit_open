export default class DataHandler {

    constructor() {
        this.promiseAll;
        this.filteredData;
        this.#loadData();
        this.filterData();

        // Variabeln für Filter initialisieren
        this.checkedRegions = ['Belp', 'Emmental', 'Gotthard', 'Herzogenbuchsee'];
        this.selDates = [new Date(new Date().setMonth(new Date().getMonth() - 1, 1)), new Date(new Date().setMonth(new Date().getMonth() - 0, 0))];
        this.timeRange = [360, 1440];
    }


    checkFormData(formData, callback) {
        $.ajax({
            type: 'POST',
            url: '/check_file',
            data: formData,
            processData: false,
            contentType: false,
            success: function (returned_value) {
                callback(returned_value);
            },
            error: function (error) {
                console.log(error);
            }
        });
    };

    confirmFormData(callback) {
        $.ajax({
            type: 'GET',
            url: '/confirm_file',
            success: function (returned_value) {
                callback(returned_value);
            },
            error: function (error) {
                console.log(error);
            }
        });
    };


    #loadData() {
        this.promiseAll = Promise.all([
            d3.dsv(";", "data/Belp.csv?" + new Date().getTime()),
            d3.dsv(";", "data/Emmental.csv?" + new Date().getTime()),
            d3.dsv(";", "data/Gotthard.csv?" + new Date().getTime()),
            d3.dsv(";", "data/Herzogenbuchsee.csv?" + new Date().getTime())
        ])
            .then(function (files) {
                // Evtl Datei verkleinern (Spalten löschen)
                // Daten bereinigen (solche ohne Timestamps rauslöschen, etc.)
                // Beides evtl auch schon vorher mit Python
                return files
            });
    }

    filterData() {
        const that = this;

        that.filteredData = that.promiseAll.then(function (files) {
            var belp = files[0];
            var emmental = files[1];
            var gotthard = files[2];
            var herzogenbuchsee = files[3];

            // Filtern (in constructor verschieben)
            function filterData(data) {
                // Datum filtern:
                var startDate = new Date(that.selDates[0]);
                startDate.setHours(0, 0, 0, 0); // nearest midnight past
                var endDate = new Date(that.selDates[1]); // kopieren, damit nicht jedes mal 24h mehr
                endDate.setHours(24, 0, 0, 0); // nearest midnight future
                var dt_filData = data.filter(function (d) {
                    var pickupDate = new Date(d['timestamps.effective_pickup']); // Auswahl nur aufgrund Pickup-Date
                    return (pickupDate >= startDate && pickupDate <= endDate)
                })
                // Stunden filtern:
                var startTime = (that.timeRange[0] / 60);
                var endTime = (that.timeRange[1] / 60);
                var dt_hr_filData = dt_filData.filter(function (d) {
                    var pickupTime = new Date(d['timestamps.effective_pickup']).getHours(); // Auswahl nur aufgrund Pickup-Zeit
                    return (pickupTime >= startTime && pickupTime < endTime)
                })

                return dt_hr_filData
            }

            // Wenn Region angewählt: zu Daten hinzufügen
            var data = [];
            if (that.checkedRegions.includes('Belp')) { data = data.concat(filterData(belp)) };
            if (that.checkedRegions.includes('Emmental')) { data = data.concat(filterData(emmental)) };
            if (that.checkedRegions.includes('Gotthard')) { data = data.concat(filterData(gotthard)) };
            if (that.checkedRegions.includes('Herzogenbuchsee')) { data = data.concat(filterData(herzogenbuchsee)) };

            // Alert machen wenn in der aktuellen Selektion keine Daten vorhanden sind
            if (data.length === 0) {
                alert('Für die aktuelle Auswahl sind keine Daten vorhanden!');
            }

            return data
        })
    }

    // Funktion für Plots (zum Daten erhalten):
    get_selectedData() {
        const that = this;
        return that.filteredData
    }

}