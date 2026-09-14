let assignedData = {};
let selectedDays = new Set();
let activeRateType = 'brutto';

// Zmienne przygotowane do przyjęcia danych z pliku JSON
let bsn2Data = [];
let districtsW0 = {};

let fixedHolidays = {
    "01-01": "Nowy Rok", "01-06": "Trzech Króli", "05-01": "Święto Pracy", "05-03": "Święto Konstytucji 3 Maja",
    "08-15": "Wniebowzięcie NMP", "11-01": "Wszystkich Świętych", "11-11": "Święto Niepodległości",
    "12-25": "Boże Narodzenie", "12-26": "Drugi dzień świąt"
};

let customHolidays = {};

function initBatchRows() {
    const container = document.getElementById('batchRowsContainer');
    if (!container) return;
    const daysData = [
        { id: 1, name: "Poniedziałek" }, { id: 2, name: "Wtorek" }, { id: 3, name: "Środa" },
        { id: 4, name: "Czwartek" }, { id: 5, name: "Piątek" }, { id: 6, name: "Sobota" }, { id: 0, name: "Niedziela", color: "#dc3545" }
    ];
    let html = '';
    daysData.forEach(d => {
        html += `
            <div class="batch-row" style="background: #fff; padding: 6px 10px; border-radius: 6px; border: 1px solid #e9ecef;">
                <input type="checkbox" id="chk_${d.id}" value="${d.id}">
                <label for="chk_${d.id}" style="cursor: pointer; font-weight: 600; color: ${d.color || '#495057'};">${d.name}</label>
                <input type="number" id="val_${d.id}" min="0" step="0.01" value="0.0" style="text-align: center; font-weight: bold;" oninput="validateNonNegative(this); updateBatchPreview(${d.id})">
                <span style="color: var(--text-muted);">h</span>
                <span id="prev_${d.id}" style="font-size: 13px; color: var(--primary); font-weight: bold; text-align: left;">(0h 00m)</span>
            </div>
        `;
    });
    container.innerHTML = html;
}

function initRateCalculatorSelects() {
    let distSelect = document.getElementById('calcDistrictSelect');
    distSelect.innerHTML = '';
    for (let dist in districtsW0) {
        let opt = document.createElement('option');
        opt.value = districtsW0[dist];
        opt.text = `${dist} (W0: ${districtsW0[dist]})`;
        distSelect.appendChild(opt);
    }

    // Czyszczenie i dodanie pierwszego pomieszczenia
    document.getElementById('calcRoomsContainer').innerHTML = '';
    addRoomRow();
}

function addRoomRow() {
    let container = document.getElementById('calcRoomsContainer');
    let rowId = 'room_' + Date.now();
    let row = document.createElement('div');
    row.className = 'room-calc-row';
    
    let optionsHtml = bsn2Data.map((item, idx) => `<option value="${idx}">${item.name} (${item.bsn2} zł)</option>`).join('');
    
    row.innerHTML = `
        <div style="flex: 2; min-width: 300px;">
            <select class="item-select" onchange="updateSuggestedRate()" style="width: 100%; padding: 10px; font-weight: 600; border: 1px solid #ced4da; border-radius: 6px; color: #2c3e50;">
                ${optionsHtml}
            </select>
        </div>
        <div class="w1-wrap" style="flex: 1; min-width: 150px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 0; color: #495057;">
                <input type="checkbox" class="chk-w1" onchange="updateSuggestedRate()"> W1 (Multimedia)
            </label>
        </div>
        <div style="flex: 1; text-align: right; min-width: 120px;">
            <span class="room-opg" style="font-weight: 800; color: var(--primary); font-size: 18px;">0,00 zł/h</span>
        </div>
        <button onclick="removeRoomRow(this)" style="background: #dc3545; color: white; border: none; border-radius: 6px; padding: 8px 14px; cursor: pointer; font-weight: bold; transition: 0.2s;" onmouseover="this.style.background='#c82333'" onmouseout="this.style.background='#dc3545'">X</button>
    `;
    container.appendChild(row);
    updateSuggestedRate();
}

function removeRoomRow(btn) {
    if (document.querySelectorAll('.room-calc-row').length > 1) {
        btn.parentElement.remove();
        updateSuggestedRate();
    } else {
        alert("Kalkulator musi zawierać co najmniej jedno pomieszczenie.");
    }
}

function validateNonNegative(input) {
    if (input.value !== "" && parseFloat(input.value) < 0) {
        input.value = 0;
    }
}

// Wyliczanie zsumowanej stawki OpG dla wszystkich pomieszczeń
function updateSuggestedRate() {
    let w0 = parseFloat(document.getElementById('calcDistrictSelect').value) || 1.0;
    
    // Stan globalnych wskaźników
    let globalActive = {
        2: document.getElementById('chk_glob_W2').checked,
        3: document.getElementById('chk_glob_W3').checked,
        4: document.getElementById('chk_glob_W4').checked,
        5: document.getElementById('chk_glob_W5').checked,
        6: document.getElementById('chk_glob_W6').checked,
        7: document.getElementById('chk_glob_W7').checked,
        8: document.getElementById('chk_glob_W8').checked
    };

    let totalOpG = 0;

    // Przeliczanie każdego pokoju indywidualnie
    document.querySelectorAll('.room-calc-row').forEach(row => {
        let itemIdx = parseInt(row.querySelector('.item-select').value);
        let bsn2 = bsn2Data[itemIdx].bsn2;
        let allowedWs = bsn2Data[itemIdx].w; // np. {1:1.3, 2:0.9...}
        
        let w1Chk = row.querySelector('.chk-w1');
        let w1Wrap = row.querySelector('.w1-wrap');
        
        // Obsługa interfejsu W1 (aktywny / nieaktywny w zależności od sali)
        if (allowedWs[1] !== undefined) {
            w1Wrap.classList.remove('disabled');
            w1Chk.disabled = false;
        } else {
            w1Wrap.classList.add('disabled');
            w1Chk.disabled = true;
            w1Chk.checked = false; // reset
        }

        // Podstawa z uwzględnieniem dzielnicy
        let opg = bsn2 * w0;
        
        // W1 (jeśli zaznaczony i dozwolony)
        if (w1Chk.checked) {
            opg *= allowedWs[1]; // x1.3
        }
        
        // Wskaźniki globalne (tylko te, które są dozwolone dla tej konkretnej sali)
        for (let i = 2; i <= 8; i++) {
            if (globalActive[i] && allowedWs[i] !== undefined) {
                opg *= allowedWs[i]; // Wartość brana prosto ze słownika (matrycy) dla danej sali!
            }
        }
        
        // Aktualizacja UI wiersza
        row.querySelector('.room-opg').innerText = formatCurrency(opg) + ' / h';
        totalOpG += opg;
    });
    
    // Sumaryczna wartość na dole
    document.getElementById('displaySuggestedRate').innerText = formatCurrency(totalOpG) + " / h";
}

function transferSuggestedRate() {
    // Wywołujemy odświeżenie na wypadek niezapisanych stanów
    updateSuggestedRate();
    
    let totalStr = document.getElementById('displaySuggestedRate').innerText;
    let totalVal = parseFloat(totalStr.replace(',', '.').replace(/[^\d.-]/g, ''));
    
    document.getElementById('rateNetto').value = totalVal.toFixed(2);
    updateFromNetto();
    
    switchTab('config', document.querySelectorAll('.tab-btn')[3]);
    
    setTimeout(() => {
        let saveBtn = document.querySelector('#configTab .save-btn');
        saveBtn.style.transform = 'scale(1.05)';
        saveBtn.style.boxShadow = '0 0 15px rgba(40,167,69,0.8)';
        setTimeout(() => {
            saveBtn.style.transform = 'scale(1)';
            saveBtn.style.boxShadow = '0 2px 4px rgba(40,167,69,0.3)';
        }, 500);
    }, 300);
}

function updateFromNetto() {
    activeRateType = 'netto';
    let netto = parseFloat(document.getElementById('rateNetto').value);
    if (isNaN(netto)) netto = 0;
    let vat = parseFloat(document.getElementById('vatRate').value) / 100;
    
    let vatAmt = Math.round(netto * vat * 100) / 100;
    let brutto = netto + vatAmt;

    document.getElementById('rateVatAmount').value = vatAmt.toFixed(2);
    document.getElementById('rateBrutto').value = brutto.toFixed(2);
}

function updateFromBrutto() {
    activeRateType = 'brutto';
    let brutto = parseFloat(document.getElementById('rateBrutto').value);
    if (isNaN(brutto)) brutto = 0;
    let vat = parseFloat(document.getElementById('vatRate').value) / 100;
    
    let netto = Math.round((brutto / (1 + vat)) * 100) / 100;
    let vatAmt = brutto - netto;

    document.getElementById('rateVatAmount').value = vatAmt.toFixed(2);
    document.getElementById('rateNetto').value = netto.toFixed(2);
}

function updateFromVat() {
    if (activeRateType === 'netto') {
        updateFromNetto();
    } else {
        updateFromBrutto();
    }
}

function getActiveRateConfig() {
    let type = activeRateType;
    let rate = type === 'netto' ? (parseFloat(document.getElementById('rateNetto').value) || 0) : (parseFloat(document.getElementById('rateBrutto').value) || 0);
    let vat = parseFloat(document.getElementById('vatRate').value) || 0;
    return { rate: rate, type: type, vat: vat };
}

function updateBatchPreview(dayId) {
    let val = parseFloat(document.getElementById(`val_${dayId}`).value) || 0;
    if (val < 0) val = 0;
    document.getElementById(`prev_${dayId}`).innerText = `(${formatDecimalToHoursAndMinutes(val)})`;
}

function initBatchPreviews() {
    for (let i = 0; i <= 6; i++) {
        updateBatchPreview(i);
    }
}

function loadConfiguration() {
    initRateCalculatorSelects(); // ładuje też pierwszy pokój

    let savedConfig = localStorage.getItem('school_rental_config');
    if (savedConfig) {
        try {
            let cfg = JSON.parse(savedConfig);
            if (cfg.start) document.getElementById('contractStart').value = cfg.start;
            if (cfg.end) document.getElementById('contractEnd').value = cfg.end;
            if (cfg.vat) document.getElementById('vatRate').value = cfg.vat;
            
            activeRateType = cfg.type || 'brutto';
            if (activeRateType === 'netto') {
                document.getElementById('rateNetto').value = cfg.rate !== undefined ? cfg.rate : 0;
                updateFromNetto();
            } else {
                document.getElementById('rateBrutto').value = cfg.rate !== undefined ? cfg.rate : 0;
                updateFromBrutto();
            }
        } catch(e) {}
    } else {
        document.getElementById('contractStart').value = "";
        document.getElementById('contractEnd').value = "";
        document.getElementById('vatRate').value = "23";
        document.getElementById('rateNetto').value = "0";
        document.getElementById('rateVatAmount').value = "0.00";
        document.getElementById('rateBrutto').value = "0";
        activeRateType = 'brutto';
    }

    let savedHolidays = localStorage.getItem('school_rental_custom_holidays');
    if (savedHolidays) {
        try {
            customHolidays = JSON.parse(savedHolidays);
        } catch(e) {
            customHolidays = {};
        }
    } else {
        customHolidays = {
            "2024-12-31": "np. Dzień wolny od zajęć dydaktycznych"
        };
    }
    updateHolidaysTextarea();
    initBatchPreviews();
}

function saveConfiguration() {
    let startVal = document.getElementById('contractStart').value;
    let endVal = document.getElementById('contractEnd').value;

    if (startVal && endVal && startVal > endVal) {
        alert("Data początkowa nie może być późniejsza niż data końcowa.");
        document.getElementById('contractEnd').value = startVal;
        return;
    }

    let currentConfig = getActiveRateConfig();
    if (currentConfig.rate < 0) currentConfig.rate = 0;

    let cfg = {
        start: startVal,
        end: endVal,
        rate: currentConfig.rate,
        type: currentConfig.type,
        vat: currentConfig.vat
    };

    localStorage.setItem('school_rental_config', JSON.stringify(cfg));
    renderCalendar();
    switchTab('calc', document.querySelectorAll('.tab-btn')[0]);
}

function updateHolidaysTextarea() {
    let text = "# --- Święta stałe (bez roku) ---\n";
    for (let md in fixedHolidays) {
        text += `${md} : ${fixedHolidays[md]}\n`;
    }
    text += "\n# --- Dni użytkownika (z rokiem) ---\n";
    let sortedKeys = Object.keys(customHolidays).sort();
    sortedKeys.forEach(date => {
        text += `${date} : ${customHolidays[date]}\n`;
    });
    document.getElementById('holidaysInput').value = text.trim();
}

function saveHolidaysFromText() {
    let lines = document.getElementById('holidaysInput').value.split('\n');
    let newCustom = {};
    lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('#') || line === '') return;
        let parts = line.split(':');
        if (parts.length >= 2) {
            let date = parts[0].trim();
            let name = parts.slice(1).join(':').trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                newCustom[date] = name;
            }
        }
    });
    customHolidays = newCustom;
    localStorage.setItem('school_rental_custom_holidays', JSON.stringify(customHolidays));
    renderCalendar();
    alert("Pomyślnie zaktualizowano kalendarz dni wolnych!");
}

const today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth();

const daysOfWeekNames = [
    { name: 'Pon', isSun: false }, { name: 'Wt', isSun: false }, { name: 'Śr', isSun: false },
    { name: 'Czw', isSun: false }, { name: 'Pt', isSun: false }, { name: 'Sob', isSun: false },
    { name: 'Niedz', isSun: true }
];

const monthNames = [
    'styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 
    'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'
];

function switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabId + 'Tab').classList.add('active');
    btnElement.classList.add('active');
}

function formatCurrency(amount) {
    let num = parseFloat(amount);
    if (isNaN(num)) num = 0;
    let parts = num.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return parts[0] + ',' + parts[1] + " zł";
}

function formatDecimalToHoursAndMinutes(val) {
    if (isNaN(val) || val <= 0) return "0h 00m";
    let hours = Math.floor(val);
    let decimalPart = val - hours;
    let totalMinutes = Math.round(decimalPart * 60);
    return `${hours}h ${totalMinutes < 10 ? '0' : ''}${totalMinutes}m`;
}

function updateTimePreview() {
    let val = parseFloat(document.getElementById('hoursInput').value);
    if (isNaN(val) || val < 0) val = 0;
    document.getElementById('timePreview').innerText = `(${formatDecimalToHoursAndMinutes(val)})`;
}

function changeMonth(direction) {
    currentMonth += direction;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    else if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
}

function checkIsHoliday(dateStr, monthDayStr) {
    if (customHolidays.hasOwnProperty(dateStr)) return customHolidays[dateStr];
    if (fixedHolidays.hasOwnProperty(monthDayStr)) return fixedHolidays[monthDayStr];
    return null;
}

function applyBatchAssignment() {
    let startContract = document.getElementById('contractStart').value;
    let endContract = document.getElementById('contractEnd').value;

    if (!startContract || !endContract) {
        alert("Aby użyć przypisywania cyklicznego, musisz ustawić zakres umowy w zakładce Konfiguracja i ZAPISAĆ!");
        switchTab('config', document.querySelectorAll('.tab-btn')[3]);
        return;
    }

    let activeDays = {};
    for (let i = 0; i <= 6; i++) {
        let chk = document.getElementById(`chk_${i}`);
        if (chk && chk.checked) {
            let val = parseFloat(document.getElementById(`val_${i}`).value) || 0;
            if (val < 0) val = 0;
            activeDays[i] = val;
        }
    }

    if (Object.keys(activeDays).length === 0) {
        alert("Zaznacz przynajmniej jeden dzień tygodnia i podaj liczbę godzin.");
        return;
    }

    let [sY, sM, sD] = startContract.split('-').map(Number);
    let [eY, eM, eD] = endContract.split('-').map(Number);
    
    let curr = new Date(sY, sM - 1, sD);
    let end = new Date(eY, eM - 1, eD);

    let countAssigned = 0;
    while (curr <= end) {
        let y = curr.getFullYear();
        let m = String(curr.getMonth() + 1).padStart(2, '0');
        let d = String(curr.getDate()).padStart(2, '0');
        let dateStr = `${y}-${m}-${d}`;
        let mdStr = `${m}-${d}`;

        let dayOfWeek = curr.getDay();
        let isHoliday = checkIsHoliday(dateStr, mdStr) !== null;

        if (!isHoliday && activeDays.hasOwnProperty(dayOfWeek)) {
            let hrs = activeDays[dayOfWeek];
            if (hrs > 0) {
                assignedData[dateStr] = hrs;
                countAssigned++;
            } else {
                delete assignedData[dateStr];
            }
        }

        curr.setDate(curr.getDate() + 1);
    }

    alert(`Zaktualizowano przypisania! Uzupełniono harmonogram dla ${countAssigned} dni w podanym okresie.`);
    switchTab('calc', document.querySelectorAll('.tab-btn')[0]);
    renderCalendar();
}

function renderCalendar() {
    document.getElementById('monthYearLabel').innerText = `${monthNames[currentMonth]} ${currentYear}`.toUpperCase();
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    daysOfWeekNames.forEach(dayInfo => {
        const header = document.createElement('div');
        header.className = 'day-header' + (dayInfo.isSun ? ' sunday' : '');
        header.innerText = dayInfo.name;
        grid.appendChild(header);
    });

    const firstDayIndex = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    let startContract = document.getElementById('contractStart').value;
    let endContract = document.getElementById('contractEnd').value;

    for (let i = 0; i < firstDayIndex; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'day-cell empty';
        grid.appendChild(emptyCell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth, day);
        const isSunday = (date.getDay() === 0);
        
        const mm = String(currentMonth + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        const dateStr = `${currentYear}-${mm}-${dd}`;
        const monthDayStr = `${mm}-${dd}`;
        
        let holidayName = checkIsHoliday(dateStr, monthDayStr);
        let isHoliday = holidayName !== null;

        let isOutOfRange = false;
        if (startContract && dateStr < startContract) isOutOfRange = true;
        if (endContract && dateStr > endContract) isOutOfRange = true;

        const cell = document.createElement('div');
        let cellClass = 'day-cell' + (isSunday ? ' sunday' : '');
        
        if (isHoliday) {
            cellClass += ' holiday';
        } else if (isOutOfRange) {
            cellClass += ' out-of-range';
        } else if (selectedDays.has(dateStr)) {
            cellClass += ' selected';
        }
        cell.className = cellClass;

        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.innerText = day;
        cell.appendChild(dayNumber);

        if (isHoliday) {
            const tooltipDiv = document.createElement('div');
            tooltipDiv.className = 'holiday-tooltip';
            tooltipDiv.innerText = holidayName;
            tooltipDiv.title = holidayName;
            cell.appendChild(tooltipDiv);
        } else {
            const hoursDiv = document.createElement('div');
            hoursDiv.className = 'day-hours';
            if (assignedData[dateStr] > 0) {
                let val = assignedData[dateStr];
                let formattedHM = formatDecimalToHoursAndMinutes(val);
                hoursDiv.innerHTML = `${val}h<br><span style="font-weight: normal; font-size: 10px;">(${formattedHM})</span>`;
            }
            cell.appendChild(hoursDiv);
        }

        if (isOutOfRange || isHoliday) {
            selectedDays.delete(dateStr);
        } else {
            cell.onclick = () => {
                if (selectedDays.has(dateStr)) {
                    selectedDays.delete(dateStr);
                    cell.classList.remove('selected');
                } else {
                    selectedDays.add(dateStr);
                    cell.classList.add('selected');
                }
            };
        }

        grid.appendChild(cell);
    }
    updateSummaryTable();
    updateTimePreview();
}

function assignHours() {
    let hoursInputEl = document.getElementById('hoursInput');
    let hours = parseFloat(hoursInputEl.value);
    if (isNaN(hours) || hours < 0) {
        hours = 0;
        hoursInputEl.value = 0;
    }

    let startContract = document.getElementById('contractStart').value;
    let endContract = document.getElementById('contractEnd').value;

    selectedDays.forEach(dateStr => {
        let parts = dateStr.split('-');
        let mmdd = `${parts[1]}-${parts[2]}`;
        if ((startContract && dateStr < startContract) || (endContract && dateStr > endContract) || checkIsHoliday(dateStr, mmdd) !== null) {
            return;
        }
        if (hours === 0) delete assignedData[dateStr];
        else assignedData[dateStr] = hours;
    });

    selectedDays.clear();
    renderCalendar();
}

function clearAssignedHours() {
    selectedDays.forEach(dateStr => {
        delete assignedData[dateStr];
    });
    selectedDays.clear();
    renderCalendar();
}

function clearEntireCalendar() {
    if (confirm("⚠️ UWAGA! Czy na pewno chcesz ZRESETOWAĆ całkowicie kalkulator? Stracisz przypisane dni, daty umowy oraz konfigurację stawek.")) {
        assignedData = {};
        selectedDays.clear();
        localStorage.removeItem('school_rental_config');

        document.getElementById('contractStart').value = "";
        document.getElementById('contractEnd').value = "";
        document.getElementById('vatRate').value = "23";
        document.getElementById('rateNetto').value = "0";
        document.getElementById('rateVatAmount').value = "0.00";
        document.getElementById('rateBrutto').value = "0";
        activeRateType = 'brutto';

        for (let i = 0; i <= 6; i++) {
            let chk = document.getElementById(`chk_${i}`);
            let valInput = document.getElementById(`val_${i}`);
            if (chk) chk.checked = false;
            if (valInput) valInput.value = "0.0";
            updateBatchPreview(i);
        }

        // Reset Kalkulatora Stawek
        document.getElementById('calcDistrictSelect').selectedIndex = 0;
        for(let i=2; i<=8; i++) {
            let globChk = document.getElementById('chk_glob_W'+i);
            if (globChk) globChk.checked = false;
        }
        
        // Reset pokoi do jednego
        document.getElementById('calcRoomsContainer').innerHTML = '';
        addRoomRow();
        
        renderCalendar();
    }
}

function sumDecimalHours(hoursArray) {
    let totalHours = 0;
    let totalMinutes = 0;

    hoursArray.forEach(val => {
        let h = Math.floor(val);
        let m = Math.round((val - h) * 60);
        totalHours += h;
        totalMinutes += m;
    });

    totalHours += Math.floor(totalMinutes / 60);
    totalMinutes = totalMinutes % 60;

    return parseFloat((totalHours + (totalMinutes / 60)).toFixed(2));
}

function calculateFinancials(totalHoursDecimal) {
    let conf = getActiveRateConfig();
    let rate = conf.rate;
    if (rate < 0) rate = 0;
    let type = conf.type;
    let vatRate = conf.vat / 100;

    let netto = 0, vat = 0, brutto = 0;
    let rateGrosze = Math.round(rate * 100);

    if (type === 'netto') {
        netto = (rateGrosze * totalHoursDecimal) / 100;
        netto = Math.round(netto * 100 + Number.EPSILON) / 100;
        vat = netto * vatRate;
        vat = Math.round(vat * 100 + Number.EPSILON) / 100;
        brutto = netto + vat;
    } else {
        brutto = (rateGrosze * totalHoursDecimal) / 100;
        brutto = Math.round(brutto * 100 + Number.EPSILON) / 100;
        netto = brutto / (1 + vatRate);
        netto = Math.round(netto * 100 + Number.EPSILON) / 100;
        vat = brutto - netto;
        vat = Math.round(vat * 100 + Number.EPSILON) / 100;
    }

    return { netto: netto, vat: vat, brutto: brutto };
}

function updateSummaryTable() {
    let conf = getActiveRateConfig();
    let rate = conf.rate;
    if (rate < 0) rate = 0;
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

    document.getElementById('displayRateInfo').innerHTML = `<b><strong style="font-size:16px;">Stawka bazowa:</strong> &nbsp;&nbsp; <b>Netto:</b> <span style="color:var(--text-main);">${formatCurrency(netto1h)}</span> &nbsp;|&nbsp; <b>VAT (${vat}%):</b> <span style="color:var(--text-main);">${formatCurrency(vat1h)}</span> &nbsp;|&nbsp; <b>Brutto:</b> <span style="color:var(--success); font-size: 16px;">${formatCurrency(brutto1h)} / h</span></b>`;

    const tbody = document.getElementById('summaryTableBody');
    tbody.innerHTML = '';

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
    let totalDaysAll = 0;
    let allValuesGlobal = [];

    if (sortedKeys.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">Brak wprowadzonych godzin wynajmu</td></tr>`;
        document.getElementById('statTotalDaysHours').innerText = `0 dni / 0h`;
        document.getElementById('statTotalNetto').innerText = formatCurrency(0);
        document.getElementById('statTotalVat').innerText = formatCurrency(0);
        document.getElementById('statTotalBrutto').innerText = formatCurrency(0);
        document.getElementById('statAvgBrutto').innerText = formatCurrency(0);
        document.getElementById('thresholdAlert').style.display = 'none';
        return;
    }

    let globalNettoSum = 0;
    let globalVatSum = 0;
    let globalBruttoSum = 0;

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

        let rowNetto = parseFloat(fin.netto.toFixed(2));
        let rowVat = parseFloat(fin.vat.toFixed(2));
        let rowBrutto = parseFloat(fin.brutto.toFixed(2));

        globalNettoSum += rowNetto;
        globalVatSum += rowVat;
        globalBruttoSum += rowBrutto;

        let row = document.createElement('tr');
        row.innerHTML = `
            <td>${monthLabel}</td>
            <td>${daysCount}</td>
            <td><b style="color:var(--primary);">${hoursSumDecimal}</b></td>
            <td>${formatCurrency(rowNetto)}</td>
            <td>${formatCurrency(rowVat)}</td>
            <td><b style="color:#2c3e50;">${formatCurrency(rowBrutto)}</b></td>
        `;
        tbody.appendChild(row);
    });

    let totalHoursGlobalDecimal = sumDecimalHours(allValuesGlobal);

    let totalRow = document.createElement('tr');
    totalRow.className = 'total-row';
    totalRow.innerHTML = `
        <td>Łącznie</td>
        <td>${totalDaysAll}</td>
        <td><b style="color:var(--primary);">${totalHoursGlobalDecimal}</b></td>
        <td>${formatCurrency(globalNettoSum)}</td>
        <td>${formatCurrency(globalVatSum)}</td>
        <td><b style="color:var(--success); font-size:15px;">${formatCurrency(globalBruttoSum)}</b></td>
    `;
    tbody.appendChild(totalRow);

    let numberOfMonths = sortedKeys.length;
    let avgBrutto = numberOfMonths > 0 ? (globalBruttoSum / numberOfMonths) : 0;

    document.getElementById('statTotalDaysHours').innerHTML = `<b>${totalDaysAll}</b> dni / <b style="color:#f1c40f;">${totalHoursGlobalDecimal}h</b>`;
    document.getElementById('statTotalNetto').innerText = formatCurrency(globalNettoSum);
    document.getElementById('statTotalVat').innerText = formatCurrency(globalVatSum);
    document.getElementById('statTotalBrutto').innerText = formatCurrency(globalBruttoSum);
    document.getElementById('statAvgBrutto').innerText = formatCurrency(avgBrutto);

    let alertBox = document.getElementById('thresholdAlert');
    if (avgBrutto > 2500) {
        alertBox.style.display = 'block';
    } else {
        alertBox.style.display = 'none';
    }
}

// Zmieniona metoda inicjalizacji przy starcie strony (wczytuje plik JSON)
window.onload = async function() {
    try {
        // Zwróć uwagę, by plik z cennikiem znajdował się w tym samym folderze!
        const response = await fetch('cennik.json');
        const data = await response.json();
        
        bsn2Data = data.bsn2Data;
        districtsW0 = data.districtsW0;
        
        initBatchRows(); 
        loadConfiguration();
        renderCalendar();
    } catch (error) {
        console.error("Błąd podczas ładowania cennika:", error);
        alert("Nie udało się załadować bazy stawek i słowników z pliku cennik.json. Upewnij się, że plik istnieje i aplikacja jest uruchomiona na serwerze (np. przez Netlify).");
    }
};