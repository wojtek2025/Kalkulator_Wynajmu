// ==========================================
// RENDEROWANIE WIDOKU RAPORTU DLA DRUKU/PDF
// ==========================================
function preparePrintContainer() {
    let app = window.vueApp; // Pobieramy stan z VUE
    let reportArea = document.getElementById('reportDisplayArea');
    if (!reportArea) return;

    let gSum = app.globalSummary;
    let reportData = app.summaryData;

    if (reportData.length === 0) {
        reportArea.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6c757d;">
                <h3>Brak danych do raportu</h3>
                <p>Wprowadź godziny wynajmu w kalendarzu lub użyj szybkiego przypisania, aby zobaczyć wyliczenia.</p>
            </div>
        `;
        return;
    }

    let n1h = app.rateNetto || 0;
    let b1h = app.rateBrutto || 0;
    let v1h = b1h - n1h;

    let tableRowsHtml = "";
    reportData.forEach(row => {
        tableRowsHtml += `
            <tr>
                <td>${row.monthLabel}</td>
                <td style="text-align:center;">${row.daysCount}</td>
                <td style="text-align:center;">${app.formatHoursDisp(row.hoursSum)}h</td>
                <td>${app.formatCurrency(row.fin.netto)}</td>
                <td>${app.formatCurrency(row.fin.vat)}</td>
                <td><b>${app.formatCurrency(row.fin.brutto)}</b></td>
            </tr>
        `;
    });

    let miniCalendarsHtml = "";
    reportData.forEach(row => {
        let [yStr, mStr] = row.month.split('-');
        let yearNum = parseInt(yStr);
        let monthIdx = parseInt(mStr) - 1;

        let firstDayIndex = (new Date(yearNum, monthIdx, 1).getDay() + 6) % 7;
        let daysInMonth = new Date(yearNum, monthIdx + 1, 0).getDate();

        let cellsHtml = "";
        for (let i = 0; i < firstDayIndex; i++) cellsHtml += `<div class="mini-cell empty"></div>`;

        for (let day = 1; day <= daysInMonth; day++) {
            let dd = String(day).padStart(2, '0');
            let dateStr = `${yearNum}-${mStr}-${dd}`;
            let monthDayStr = `${mStr}-${dd}`;

            let holidayName = app.customHolidays[dateStr] || app.fixedHolidays[monthDayStr];
            let isHoliday = holidayName !== undefined && holidayName !== null;
            let val = app.assignedData[dateStr] || 0;

            let cellClass = "mini-cell";
            let content = `<span style="line-height:1.2;">${day}</span>`;

            if (isHoliday) {
                cellClass += " holiday";
                content += `<span style="font-size:6pt; line-height:1;">Wolne</span>`;
            } else if (val > 0) {
                cellClass += " active";
                content += `<span style="font-size:7pt; color:#1e7e34; line-height:1;">${app.formatHoursDisp(val)}h</span>`;
            }

            cellsHtml += `<div class="${cellClass}">${content}</div>`;
        }

        miniCalendarsHtml += `
            <div class="mini-month" style="width: 100%; box-sizing: border-box; border: 1px solid #777; padding: 5px; border-radius: 4px; page-break-inside: avoid; break-inside: avoid;">
                <h4 style="text-align: center; margin: 0 0 5px 0; font-size: 11px; text-transform: uppercase;">${app.monthNames[monthIdx]} ${yearNum}</h4>
                <div class="mini-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; text-align: center;">
                    <div class="mini-day-header" style="font-weight: bold; background: #eee; font-size: 9px; padding: 2px;">Pn</div>
                    <div class="mini-day-header" style="font-weight: bold; background: #eee; font-size: 9px; padding: 2px;">Wt</div>
                    <div class="mini-day-header" style="font-weight: bold; background: #eee; font-size: 9px; padding: 2px;">Śr</div>
                    <div class="mini-day-header" style="font-weight: bold; background: #eee; font-size: 9px; padding: 2px;">Cz</div>
                    <div class="mini-day-header" style="font-weight: bold; background: #eee; font-size: 9px; padding: 2px;">Pt</div>
                    <div class="mini-day-header" style="font-weight: bold; background: #eee; font-size: 9px; padding: 2px;">So</div>
                    <div class="mini-day-header" style="font-weight: bold; background: #eee; font-size: 9px; padding: 2px; color: red;">Nd</div>
                    ${cellsHtml}
                </div>
            </div>
        `;
    });

    let avgBruttoHtml = gSum.avgBrutto > 2500 ? '<br><span style="color:red; font-size:10px; font-weight:bold;">(Wymagane zabezpieczenie)</span>' : '';

    reportArea.innerHTML = `
        <style>
            .print-wrapper {
                display: flex;
                flex-wrap: wrap;
                gap: 20px;
                width: 100%;
                box-sizing: border-box;
            }
            .print-col {
                flex: 1 1 0;
                min-width: 350px;
                box-sizing: border-box;
            }
            @media print {
                @page { size: landscape; margin: 12mm; }
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 11px; }
                .print-wrapper {
                    flex-wrap: nowrap !important;
                    gap: 20px;
                    width: 100%;
                }
                .print-col { min-width: auto !important; }
                .col-left { flex: 0 0 48%; width: 48%; }
                .col-right { flex: 0 0 50%; width: 50%; }
            }
        </style>

        <div id="print-preview-inner" class="print-wrapper">
            <!-- LEWA KOLUMNA (Wyliczenia) -->
            <div class="print-col col-left">
                <div class="report-header-box" style="border-bottom: 2px solid #2c3e50; padding-bottom: 5px; margin-bottom: 10px;">
                    <h2 style="margin:0 0 4px 0; font-size:18px;">Rozliczenie Wynajmu</h2>
                    <div style="font-size:10px; color:#6c757d;">Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}</div>
                </div>
                
                <div class="report-meta-grid" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px;">
                    <div class="report-meta-box" style="border: 1px solid #999; padding: 8px; border-radius: 4px; font-size: 11px; background: #fafafa;">
                        <b>Okres umowy:</b><br>
                        Od: <b>${app.contractStart || 'Brak'}</b> do: <b>${app.contractEnd || 'Brak'}</b><br>
                        <b>Łączny czas:</b> ${gSum.totalDays} dni / <b>${app.formatHoursDisp(gSum.totalHours)}h</b>
                    </div>
                    <div class="report-meta-box" style="border: 1px solid #999; padding: 8px; border-radius: 4px; font-size: 11px; background: #e8f4f8;">
                        <b>Stawka bazowa:</b><br>
                        Netto: <b>${app.formatCurrency(n1h)}/h</b> | VAT (${app.vatRate}%): <b>${app.formatCurrency(v1h)}/h</b><br>
                        Brutto: <b style="color:var(--success);">${app.formatCurrency(b1h)}/h</b><br>
                        Średnia/m-c: <b>${app.formatCurrency(gSum.avgBrutto)} brutto</b>
                        ${avgBruttoHtml}
                    </div>
                </div>

                <h4 style="margin: 15px 0 6px 0; color:#2c3e50; text-transform: uppercase; font-size: 11px;">Zestawienie Miesięczne:</h4>
                <table class="report-table" style="width: 100%; border-collapse: collapse; font-size: 11px;">
                    <thead>
                        <tr style="background: #e9ecef;">
                            <th style="border: 1px solid #666; padding: 4px;">M-c</th>
                            <th style="border: 1px solid #666; padding: 4px;">Dni</th>
                            <th style="border: 1px solid #666; padding: 4px;">Godz.</th>
                            <th style="border: 1px solid #666; padding: 4px;">Netto</th>
                            <th style="border: 1px solid #666; padding: 4px;">VAT</th>
                            <th style="border: 1px solid #666; padding: 4px;">Brutto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                        <tr style="background: #f1f3f5; font-weight: bold;">
                            <td style="border: 1px solid #666; padding: 4px;">SUMA</td>
                            <td style="border: 1px solid #666; padding: 4px; text-align:center;">${gSum.totalDays}</td>
                            <td style="border: 1px solid #666; padding: 4px; text-align:center;">${app.formatHoursDisp(gSum.totalHours)}h</td>
                            <td style="border: 1px solid #666; padding: 4px;">${app.formatCurrency(gSum.totalNetto)}</td>
                            <td style="border: 1px solid #666; padding: 4px;">${app.formatCurrency(gSum.totalVat)}</td>
                            <td style="border: 1px solid #666; padding: 4px;"><b>${app.formatCurrency(gSum.totalBrutto)}</b></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- PRAWA KOLUMNA (Kalendarze) -->
            <div class="print-col col-right">
                <h4 style="margin: 0 0 10px 0; color:#2c3e50; text-transform: uppercase; font-size: 13px; text-align:center;">Harmonogram Wynajmu:</h4>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; align-content: start;">
                    ${miniCalendarsHtml}
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// WYWOŁANIE DRUKOWANIA PDF (Z KLONOWANIEM)
// ==========================================
window.triggerPrintWithRefresh = function() {
    let app = window.vueApp;
    app.activeTab = 'report';
    
    setTimeout(() => {
        preparePrintContainer();
        
        // Zabezpieczone klonowanie do druku (ID print-container)
        let oldContainer = document.getElementById('print-container');
        if (oldContainer && oldContainer.parentNode === document.body) {
            document.body.removeChild(oldContainer);
        }

        let printContainer = document.createElement('div');
        printContainer.id = 'print-container'; // Twój style.css szuka TEGO id!
        document.body.appendChild(printContainer);
        
        printContainer.innerHTML = document.getElementById('reportDisplayArea').innerHTML;

        setTimeout(() => {
            window.print();
        }, 200);
    }, 100);
}

// ==========================================
// EKSPORT DO EXCELA (.XLSX)
// ==========================================
window.exportReportToExcel = function() {
    let app = window.vueApp;
    
    if (typeof XLSX === 'undefined') {
        app.showToast("⚠️ Błąd: Nie załadowano biblioteki Excel.", true);
        return;
    }

    let reportData = app.summaryData;
    if (reportData.length === 0) {
        app.showToast("⚠️ Brak godzin wynajmu do wyeksportowania.", true);
        return;
    }

    let gSum = app.globalSummary;
    let netto1h = app.rateNetto || 0;
    let brutto1h = app.rateBrutto || 0;
    let vat1h = brutto1h - netto1h;

    let summaryData = [
        ["RAPORT ROZLICZENIA WYNAJMU SAL", ""],
        ["Data wygenerowania raportu:", new Date().toLocaleDateString('pl-PL')],
        ["", ""],
        ["PARAMETRY UMOWY I STAWKI", ""],
        ["Okres umowy od:", app.contractStart || "Nie określono"],
        ["Okres umowy do:", app.contractEnd || "Nie określono"],
        ["Stawka bazowa Netto [zł/h]:", parseFloat(netto1h.toFixed(2))],
        ["Stawka VAT (%):", app.vatRate + "%"],
        ["Kwota VAT [zł/h]:", parseFloat(vat1h.toFixed(2))],
        ["Stawka bazowa Brutto [zł/h]:", parseFloat(brutto1h.toFixed(2))],
        ["", ""]
    ];

    let monthlyRows = [
        ["Miesiąc", "Liczba dni", "Liczba godzin [h]", "Wartość Netto [zł]", "Kwota VAT [zł]", "Wartość Brutto [zł]"]
    ];

    reportData.forEach(row => {
        monthlyRows.push([
            row.monthLabel, 
            row.daysCount, 
            row.hoursSum,
            parseFloat(row.fin.netto.toFixed(2)), 
            parseFloat(row.fin.vat.toFixed(2)), 
            parseFloat(row.fin.brutto.toFixed(2))
        ]);
    });

    monthlyRows.push([
        "ŁĄCZNIE", gSum.totalDays, gSum.totalHours,
        parseFloat(gSum.totalNetto.toFixed(2)), parseFloat(gSum.totalVat.toFixed(2)), parseFloat(gSum.totalBrutto.toFixed(2))
    ]);

    summaryData.push(
        ["PODSUMOWANIE FINANSOWE", ""],
        ["Łączny czas wynajmu (dni):", gSum.totalDays],
        ["Łączny czas wynajmu (godziny):", gSum.totalHours],
        ["Łączna kwota Netto [zł]:", parseFloat(gSum.totalNetto.toFixed(2))],
        ["Łączna kwota VAT [zł]:", parseFloat(gSum.totalVat.toFixed(2))],
        ["Łączna kwota Brutto [zł]:", parseFloat(gSum.totalBrutto.toFixed(2))],
        ["Średnia miesięczna (Brutto) [zł]:", parseFloat(gSum.avgBrutto.toFixed(2))],
        ["Wymóg kaucji / zabezpieczenia:", gSum.avgBrutto > 2500 ? "TAK - WYMAGANE ZABEZPIECZENIE" : "NIE"]
    );

    let scheduleRows = [["Lp.", "Data (RRRR-MM-DD)", "Dzień tygodnia", "Liczba godzin [h]"]];
    let sortedDates = Object.keys(app.assignedData).filter(d => app.assignedData[d] > 0).sort();
    let dayNamesPL = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];

    sortedDates.forEach((dateStr, idx) => {
        let dateObj = new Date(dateStr);
        let dayName = dayNamesPL[dateObj.getDay()];
        scheduleRows.push([idx + 1, dateStr, dayName, app.assignedData[dateStr]]);
    });

    let wb = XLSX.utils.book_new();
    let wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    let wsMonthly = XLSX.utils.aoa_to_sheet(monthlyRows);
    let wsSchedule = XLSX.utils.aoa_to_sheet(scheduleRows);

    wsSummary['!cols'] = [{ wch: 35 }, { wch: 45 }];
    wsMonthly['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 20 }];
    wsSchedule['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 18 }, { wch: 18 }];

    XLSX.utils.book_append_sheet(wb, wsSummary, "Podsumowanie");
    XLSX.utils.book_append_sheet(wb, wsMonthly, "Zestawienie Miesięczne");
    XLSX.utils.book_append_sheet(wb, wsSchedule, "Harmonogram Dni");

    XLSX.writeFile(wb, `Rozliczenie_Wynajmu_${app.contractStart || 'Brak'}_${app.contractEnd || 'Brak'}.xlsx`);
    app.showToast("✅ Wyeksportowano plik Excel pomyślnie.");
}