# Bachelorarbeit: Analyse-Dashboard mybuxi

This project was created as part of my bachelor thesis during my studies in Mobility, Data Science & Economics at the Lucerne University of Applied Sciences. The main goal of the thesis was to create an analytics dashboard for mybuxi. Mybuxi is a Swiss-based provider of demand responsive transportation (DRT). In addition to this, it was also intended to develop a forecast model for the same company.


More details can be found in the thesis paper itself:

<details>
  <summary><b>Abstract</b></summary>
<em><p>Um die Mobilität effizienter und nachhaltiger zu gestalten, soll Demand- Responsive-Transport (DRT) in die Verkehrssysteme integriert werden. Durch Unklarheiten bei der Regulierung und Finanzierung gestaltet sich der Betrieb bisheriger Lösungen teilweise schwierig. Datenanalysen können Erkenntnisse über die Systeme liefern und die Effizienz im Betrieb erhöhen. Damit helfen sie den Betreibenden selbst und leisten zudem einen Beitrag zur Positionierung des DRT. Analyse-Dashboards stellen eine mögliche Option dar, entsprechende Datenanalysen zu realisieren. Mit dieser Arbeit wurde ein solches Dashboard für mybuxi erstellt. Ergänzend dazu wurde untersucht, wie die Prognose der Nachfrage im Betrieb realisiert werden könnte.</p>
<p>Die Resultate zeigen anhand des Beispiels, wie ein Analyse-Dashboard bei DRT-Systemen umgesetzt werden kann. Die Beschreibungen zum Prozess und der technischen Implementierung können als Vorschlag für zukünftige Lösungen dienen. Ausserdem kann das Dashboard für mybuxi einerseits mit den entstandenen Möglichkeiten für Analysen einen Mehrwert bieten. Anderseits handelt es sich um eine erweiterbare und auf andere Systeme übertragbare Plattform.</p>
<p>Um ein für mybuxi nützliches Prognosemodell zu finden, wurden drei verschiedene Varianten getestet. Die Qualität der Vorhersagen und der Modelle war bei allen ungenügend. Aufgrund von Erfolgen in vergleichbaren Fällen, könnte es sich trotzdem lohnen, die Entwicklung weiterzuführen. Vorerst bietet es sich jedoch an, auf Analysen zu setzen und Durchschnittswerte für die Prognosen zu verwenden.</p>
<p>Die Erkenntnisse aus dieser Arbeit und den daraus resultierenden Dashboard-Analysen sollten in Zukunft dazu genutzt werden, um die Systeme effizienter zu gestalten und die Position des DRT zu stärken.</p></em>

</details>

<details>
  <summary><b>Full version</b> (HSLU-Login required)</summary>
  
  [https://portfoliodb.hslu.ch/entries/bb2c750d-c734-408b-b42e-ff5a4a4839eb](https://portfoliodb.hslu.ch/entries/bb2c750d-c734-408b-b42e-ff5a4a4839eb)

</details>


## Structure of this repository
As you can see in the short introduction, the project consists of 2 main themes with coding parts.

### 1. Dashboard
This folder contains all the code of the mybuxi-Dashboard. The dashboard was created using the Flask web framework.

*Note: The "data" folder contains the trip data of all mybuxi trips. In order to make the work public, these files have been removed and replaced with sample files*

### 2. Prognosemodell
In this folder, all the Jupyter Notebooks related to the forecast models can be found.
