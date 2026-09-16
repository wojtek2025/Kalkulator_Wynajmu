// ==========================================
// RENDEROWANIE WIDOKU RAPORTU DLA DRUKU/PDF
// ==========================================
// ==========================================
// RENDEROWANIE WIDOKU RAPORTU DLA DRUKU/PDF
// ==========================================
function refreshReportView() {
    let conf = getActiveRateConfig();
    let startContract = document.getElementById('contractStart').value || "Nie określono";
    let endContract = document.getElementById('contractEnd').value || "Nie określono";

    let rate = conf.rate;
    let type = conf.type;
    let vat = conf.vat;
    let netto1h = 0, vat1h = 0, brutto1h = 0;
    let rateGrosze = Math.round(rate * 100);

    if (type === 'netto') {
        netto1h = rateGrosze / 100;
        vat1h = Math.round(netto1h * (vat / 100) * 100) / 100;
        brutto1h = netto1h + vat1h;
    } else {
        brutto1h = rateGrosze / 100;
        netto1h = Math.round((brutto1h / (1 + vat / 100)) * 100) / 100;
        vat1h = brutto1h - netto1h;
    }

    let monthsMap = {};
    for (let dateStr in assignedData) {
        let val = assignedData[dateStr];
        if (val > 0) {
            let monthKey = dateStr.substring(0, 7);
            if (!monthsMap[monthKey]) monthsMap[monthKey] = { days: 0, values: [] };
            monthsMap[monthKey].days++;
            monthsMap[monthKey].values.push(val);
        }
    }

    let sortedKeys = Object.keys(monthsMap).sort();
    let reportArea = document.getElementById('reportDisplayArea');

    if (sortedKeys.length === 0) {
        reportArea.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #6c757d;">
                <h3>Brak danych do raportu</h3>
                <p>Wprowadź godziny wynajmu w kalendarzu lub użyj szybkiego przypisania, aby zobaczyć wyliczenia.</p>
            </div>
        `;
        return;
    }

    let tableRowsHtml = "";
    let totalDaysAll = 0, allValuesGlobal = [], globalNettoSum = 0, globalVatSum = 0, globalBruttoSum = 0;

    sortedKeys.forEach(key => {
        let [y, m] = key.split('-');
        let monthName = monthNames[parseInt(m) - 1];
        let monthLabel = `${monthName} ${y}`;

        let daysCount = monthsMap[key].days;
        let monthValues = monthsMap[key].values;

        totalDaysAll += daysCount;
        allValuesGlobal = allValuesGlobal.concat(monthValues);

        let hoursSumDecimal = sumDecimalHours(monthValues);
        let fin = calculateFinancials(hoursSumDecimal);

        globalNettoSum += fin.netto;
        globalVatSum += fin.vat;
        globalBruttoSum += fin.brutto;

        tableRowsHtml += `
            <tr>
                <td>${monthLabel}</td>
                <td style="text-align:center;">${daysCount}</td>
                <td style="text-align:center;">${hoursSumDecimal}h</td>
                <td>${formatCurrency(fin.netto)}</td>
                <td>${formatCurrency(fin.vat)}</td>
                <td><b>${formatCurrency(fin.brutto)}</b></td>
            </tr>
        `;
    });

    let totalHoursGlobalDecimal = sumDecimalHours(allValuesGlobal);
    let avgBrutto = sortedKeys.length > 0 ? (globalBruttoSum / sortedKeys.length) : 0;

    let miniCalendarsHtml = "";
    sortedKeys.forEach(key => {
        let [yStr, mStr] = key.split('-');
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

            let holidayName = checkIsHoliday(dateStr, monthDayStr);
            let isHoliday = holidayName !== null;
            let val = assignedData[dateStr] || 0;

            let cellClass = "mini-cell";
            let content = `<span style="line-height:1.2;">${day}</span>`;

            if (isHoliday) {
                cellClass += " holiday";
                content += `<span style="font-size:6pt; line-height:1;">Wolne</span>`;
            } else if (val > 0) {
                cellClass += " active";
                content += `<span style="font-size:7pt; color:#1e7e34; line-height:1;">${val}h</span>`;
            }

            cellsHtml += `<div class="${cellClass}">${content}</div>`;
        }

        miniCalendarsHtml += `
            <div class="mini-month">
                <h4>${monthNames[monthIdx]} ${yearNum}</h4>
                <div class="mini-grid">
                    <div class="mini-day-header">Pn</div><div class="mini-day-header">Wt</div>
                    <div class="mini-day-header">Śr</div><div class="mini-day-header">Cz</div>
                    <div class="mini-day-header">Pt</div><div class="mini-day-header">So</div>
                    <div class="mini-day-header" style="color:red;">Nd</div>
                    ${cellsHtml}
                </div>
            </div>
        `;
    });

    reportArea.innerHTML = `
        <div class="print-two-column">
            <!-- LEWA KOLUMNA (Wyliczenia) -->
            <div class="print-col-left">
                <div class="report-header-box">
                    <h2 style="margin:0 0 4px 0; font-size:18px;">Rozliczenie Wynajmu</h2>
                    <div style="font-size:10px; color:#6c757d;">Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}</div>
                </div>
                
                <div class="report-meta-grid">
                    <div class="report-meta-box">
                        <b>Okres umowy:</b><br>
                        Od: <b>${startContract}</b> do: <b>${endContract}</b><br>
                        <b>Łączny czas:</b> ${totalDaysAll} dni / <b>${totalHoursGlobalDecimal}h</b>
                    </div>
                    <div class="report-meta-box">
                        <b>Stawka bazowa:</b><br>
                        Netto: <b>${formatCurrency(netto1h)}/h</b> | VAT (${vat}%): <b>${formatCurrency(vat1h)}/h</b><br>
                        Brutto: <b style="color:var(--success);">${formatCurrency(brutto1h)}/h</b><br>
                        Średnia/m-c: <b>${formatCurrency(avgBrutto)} brutto</b>
                        ${avgBrutto > 2500 ? '<br><span style="color:red; font-size:10px; font-weight:bold;">(Wymagane zabezpieczenie)</span>' : ''}
                    </div>
                </div>

                <h4 style="margin: 15px 0 6px 0; color:#2c3e50; text-transform: uppercase; font-size: 11px;">Zestawienie Miesięczne:</h4>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>M-c</th><th>Dni</th><th>Godz.</th><th>Netto</th><th>VAT</th><th>Brutto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                        <tr class="report-total-row">
                            <td>SUMA</td>
                            <td style="text-align:center;">${totalDaysAll}</td>
                            <td style="text-align:center;">${totalHoursGlobalDecimal}h</td>
                            <td>${formatCurrency(globalNettoSum)}</td>
                            <td>${formatCurrency(globalVatSum)}</td>
                            <td><b>${formatCurrency(globalBruttoSum)}</b></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- PRAWA KOLUMNA (Kalendarze) -->
            <div class="print-col-right">
                <h4 style="margin: 0 0 10px 0; color:#2c3e50; text-transform: uppercase; font-size: 13px; text-align:center;">Harmonogram Wynajmu:</h4>
                <div class="calendar-print-grid">
                    ${miniCalendarsHtml}
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// WYWOŁANIE DRUKOWANIA PDF (Z KLONOWANIEM)
// ==========================================
function triggerPrintWithRefresh() {
    const reportTabBtn = document.querySelectorAll('.tab-btn')[4];
    switchTab('report', reportTabBtn);
    refreshReportView();

    let printContainer = document.getElementById('print-container');
    if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'print-container';
        document.body.appendChild(printContainer);
    }
    
    printContainer.innerHTML = document.getElementById('reportDisplayArea').innerHTML;

    setTimeout(() => {
        window.print();
    }, 200);
}

// ==========================================
// EKSPORT DO EXCELA (.XLSX)
// ==========================================
function exportReportToExcel() {
    if (typeof XLSX === 'undefined') {
        showToast("⚠️ Błąd: Nie załadowano biblioteki Excel.", true);
        return;
    }

    let conf = getActiveRateConfig();
    let startContract = document.getElementById('contractStart').value || "Nie określono";
    let endContract = document.getElementById('contractEnd').value || "Nie określono";

    let rate = conf.rate;
    let type = conf.type;
    let vat = conf.vat;
    let netto1h = 0, vat1h = 0, brutto1h = 0;
    let rateGrosze = Math.round(rate * 100);

    if (type === 'netto') {
        netto1h = rateGrosze / 100;
        vat1h = Math.round(netto1h * (vat / 100) * 100) / 100;
        brutto1h = netto1h + vat1h;
    } else {
        brutto1h = rateGrosze / 100;
        netto1h = Math.round((brutto1h / (1 + vat / 100)) * 100) / 100;
        vat1h = brutto1h - netto1h;
    }

    let monthsMap = {};
    for (let dateStr in assignedData) {
        let val = assignedData[dateStr];
        if (val > 0) {
            let monthKey = dateStr.substring(0, 7);
            if (!monthsMap[monthKey]) monthsMap[monthKey] = { days: 0, values: [] };
            monthsMap[monthKey].days++;
            monthsMap[monthKey].values.push(val);
        }
    }

    let sortedKeys = Object.keys(monthsMap).sort();
    if (sortedKeys.length === 0) {
        showToast("⚠️ Brak godzin wynajmu do wyeksportowania.", true);
        return;
    }

    let summaryData = [
        ["RAPORT ROZLICZENIA WYNAJMU SAL", ""],
        ["Data wygenerowania raportu:", new Date().toLocaleDateString('pl-PL')],
        ["", ""],
        ["PARAMETRY UMOWY I STAWKI", ""],
        ["Okres umowy od:", startContract],
        ["Okres umowy do:", endContract],
        ["Stawka bazowa Netto [zł/h]:", netto1h],
        ["Stawka VAT (%):", vat + "%"],
        ["Kwota VAT [zł/h]:", vat1h],
        ["Stawka bazowa Brutto [zł/h]:", brutto1h],
        ["", ""]
    ];

    let monthlyRows = [
        ["Miesiąc", "Liczba dni", "Liczba godzin [h]", "Wartość Netto [zł]", "Kwota VAT [zł]", "Wartość Brutto [zł]"]
    ];

    let totalDaysAll = 0, allValuesGlobal = [], globalNettoSum = 0, globalVatSum = 0, globalBruttoSum = 0;

    sortedKeys.forEach(key => {
        let [y, m] = key.split('-');
        let monthName = monthNames[parseInt(m) - 1];
        let monthLabel = `${monthName} ${y}`;

        let daysCount = monthsMap[key].days;
        let monthValues = monthsMap[key].values;

        totalDaysAll += daysCount;
        allValuesGlobal = allValuesGlobal.concat(monthValues);

        let hoursSumDecimal = sumDecimalHours(monthValues);
        let fin = calculateFinancials(hoursSumDecimal);

        globalNettoSum += fin.netto;
        globalVatSum += fin.vat;
        globalBruttoSum += fin.brutto;

        monthlyRows.push([
            monthLabel, daysCount, hoursSumDecimal,
            parseFloat(fin.netto.toFixed(2)), parseFloat(fin.vat.toFixed(2)), parseFloat(fin.brutto.toFixed(2))
        ]);
    });

    let totalHoursGlobalDecimal = sumDecimalHours(allValuesGlobal);
    let avgBrutto = sortedKeys.length > 0 ? (globalBruttoSum / sortedKeys.length) : 0;

    monthlyRows.push([
        "ŁĄCZNIE", totalDaysAll, totalHoursGlobalDecimal,
        parseFloat(globalNettoSum.toFixed(2)), parseFloat(globalVatSum.toFixed(2)), parseFloat(globalBruttoSum.toFixed(2))
    ]);

    summaryData.push(
        ["PODSUMOWANIE FINANSOWE", ""],
        ["Łączny czas wynajmu (dni):", totalDaysAll],
        ["Łączny czas wynajmu (godziny):", totalHoursGlobalDecimal],
        ["Łączna kwota Netto [zł]:", parseFloat(globalNettoSum.toFixed(2))],
        ["Łączna kwota VAT [zł]:", parseFloat(globalVatSum.toFixed(2))],
        ["Łączna kwota Brutto [zł]:", parseFloat(globalBruttoSum.toFixed(2))],
        ["Średnia miesięczna (Brutto) [zł]:", parseFloat(avgBrutto.toFixed(2))],
        ["Wymóg kaucji / zabezpieczenia:", avgBrutto > 2500 ? "TAK - WYMAGANE ZABEZPIECZENIE" : "NIE"]
    );

    let scheduleRows = [["Lp.", "Data (RRRR-MM-DD)", "Dzień tygodnia", "Liczba godzin [h]"]];
    let sortedDates = Object.keys(assignedData).filter(d => assignedData[d] > 0).sort();
    let dayNamesPL = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];

    sortedDates.forEach((dateStr, idx) => {
        let dateObj = new Date(dateStr);
        let dayName = dayNamesPL[dateObj.getDay()];
        scheduleRows.push([idx + 1, dateStr, dayName, assignedData[dateStr]]);
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

    XLSX.writeFile(wb, `Rozliczenie_Wynajmu_${startContract}_${endContract}.xlsx`);
    showToast("✅ Wyeksportowano plik Excel pomyślnie.");
}