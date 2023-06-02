export default class GUIhomeHandler {

    #datahandler;

    constructor(dh) {
        this.#datahandler = dh;
        this.#initOverviewTable();
        this.#initFormSubmit();
    }

// Übersicht Daten (Tabelle):
    #initOverviewTable() {
        // Tabelle mit Daten aus overview.csv füllen
        d3.dsv(";", "data/overview.csv?" + new Date().getTime()).then(function (data) { // + new Date... damit Browser nicht cached (sonst kein Aktualisieren möglich)
            var table = d3.select("#dataOV_table");
            var rows = table.selectAll("tbody tr")
                .data(data)
                .join("tr");

            rows.each(function (d) {
                var row = d3.select(this);
                var firstDate = new Date(d.first_date)
                var lastDate = new Date(d.last_date)
                // Badges:
                var badges = ""
                var outdated_threshold = new Date();
                outdated_threshold.setDate(outdated_threshold.getDate() - 14); // Stichtag für "nicht aktuell": 2 Wochen vor heute
                if (lastDate < outdated_threshold) {badges += '<span class="badge text-bg-secondary me-2">Nicht aktuell</span>'}; 
                if (!(d.gaps_txt === '-')) {badges += '<span class="badge text-bg-warning me-2">Datenlücken</span>'};
                if (badges === "") {badges += '<span class="badge text-bg-success me-2">Vollständig & Aktuell</span>'};
                // Tabelle füllen
                row.selectAll("td") 
                    .data([d.region, badges, firstDate.toLocaleDateString('de-DE'), lastDate.toLocaleDateString('de-DE'), d.gaps_txt])
                    .join("td")
                    .html(function (d) { return d; });
            });
        })
    }



// Upload-Formular:
    #initFormSubmit() {
        const that = this;

        // sobald File gewählt wurde:
        $('#choose_file').on('change', (event) => {
            const file = event.target.files[0];

            // Datentyp & Dateinamen prüfen:
            if (file.type != 'text/csv') {
                alert('Bitte wähle eine CSV-Datei aus')
            } else if (!/[0-9]*-[0-9]*-[0-9]*.*[0-9]*-[0-9]*-[0-9]*/.test(file.name)) {
                alert('Bitte füge dem Dateinamen Start- und Enddatum hinzu (z.B: 2022-12-01_2022-12-31)')
            } else if (!/Belp|Emmental|Gotthard|Herzogenbuchsee/.test(file.name)) {
                alert('Bitte füge dem Dateinamen die Region hinzu (z.B: Belp)')
            } else {
                $('#submit_button').prop('disabled', false); // Submit-Button aktivieren
                const formData = new FormData();
                formData.append('file', file);
                this.#datahandler.checkFormData(formData, (result) => { // An File-Checker schicken
                    var info = JSON.parse(result).info
                    $('#file_info tr:eq(0) td:eq(1)').text(info[0]);
                    $('#file_info tr:eq(1) td:eq(1)').text(info[1]);
                    $('#file_info tr:eq(2) td:eq(1)').text(info[2]);
                    $('#file_info tr:eq(3) td:eq(1)').text(info[3]);
                });
            }
        });


    // Wenn auf "hochladen" geklickt wird:
        $(document).on("submit", "#upload_form", (event) => {
            event.preventDefault();
            that.#datahandler.confirmFormData((result) => {
                console.log(result);
            });
            this.#initOverviewTable(); // Update overview table
            location.reload(true); // reload page
        });
    }



}