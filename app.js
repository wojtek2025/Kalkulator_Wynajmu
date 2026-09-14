let assignedData = {};
let selectedDays = new Set();
let activeRateType = 'brutto';

let bsn2Data = [];
let districtsW0 = {};
let fixedHolidays = {};
let wFactors = {};
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

function initGlobalIndicators() {
    for (let i = 2; i <= 8; i++) {
        let chk = document.getElementById(`chk_glob_W${i}`);
        if (chk && chk.parentElement && wFactors[i]) {
            chk.parentElement.innerHTML = `
                <input type="checkbox" id="chk_glob_W${i}" onchange="updateSuggestedRate()"> 
                ${wFactors[i].name} <span class="badge" style="background:#e9ecef; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:12px; margin-left:6px;">x${wFactors[i].val}</span>
            `;
        }
    }
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

    document.getElementById('calcRoomsContainer').innerHTML = '';
    addRoomRow();
}

function addRoomRow() {
    let container = document.getElementById('calcRoomsContainer');
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

function updateSuggestedRate() {
    let distEl = document.getElementById('calcDistrictSelect');
    let w0 = distEl ? (parseFloat(distEl.value) || 1.0) : 1.0;
    
    let globalActive = {};
    for (let i = 2; i <= 8; i++) {
        let el = document.getElementById(`chk_glob_W${i}`);
        globalActive[i] = el ? el.checked : false;
    }

    let totalOpG = 0;

    document.querySelectorAll('.room-calc-row').forEach(row => {
        let selectEl = row.querySelector('.item-select');
        if (!selectEl || isNaN(parseInt(selectEl.value))) return;
        
        let itemIdx = parseInt(selectEl.value);
        let item = bsn2Data[itemIdx];
        if (!item) return;

        let bsn2 = item.bsn2;
        let allowedWs = item.w || []; // Teraz to prosta tablica: [1, 2, 3...]
        
        let w1Chk = row.querySelector('.chk-w1');
        let w1Wrap = row.querySelector('.w1-wrap');
        
        // Sprawdzenie czy W1 jest dozwolony dla tej sali
        if (allowedWs.includes(1)) {
            w1Wrap.classList.remove('disabled');
            w1Chk.disabled = false;
        } else {
            w1Wrap.classList.add('disabled');
            w1Chk.disabled = true;
            w1Chk.checked = false;
        }

        let opg = bsn2 * w0;
        
        // Mnożnik W1 (z wFactors)
        if (w1Chk.checked && wFactors[1]) {
            opg *= wFactors[1].val;
        }
        
        // Mnożniki globalne W2-W8 (z wFactors, jeśli zaznaczone i dozwolone dla sali)
        for (let i = 2; i <= 8; i++) {
            if (globalActive[i] && allowedWs.includes(i) && wFactors[i]) {
                opg *= wFactors[i].val;
            }
        }
        
        row.querySelector('.room-opg').innerText = formatCurrency(opg) + ' / h';
        totalOpG += opg;
    });
    
    let dispEl = document.getElementById('displaySuggestedRate');
    if (dispEl) {
        dispEl.innerText = formatCurrency(totalOpG) + " / h";
    }
}

function transferSuggestedRate() {
    updateSuggestedRate();
    
    let totalStr = document.getElementById('displaySuggestedRate').innerText;
    let totalVal = parseFloat(totalStr.replace(',', '.').replace(/[^\d.-]/g, ''));
    
    document.getElementById('rateNetto').value = totalVal.toFixed(2);
    updateFromNetto();
    
    switchTab('config', document.querySelectorAll('.tab-btn')[3]);
    
    setTimeout(() => {
        let saveBtn = document.querySelector('#configTab .save-btn');
        if (saveBtn) {
            saveBtn.style.transform = 'scale(1.05)';
            saveBtn.style.boxShadow = '0 0 15px rgba(40,167,69,0.8)';
            setTimeout(() => {
                saveBtn.style.transform = 'scale(1)';
                saveBtn.style.boxShadow = '0 2px 4px rgba(40,167,69,0.3)';
            }, 500);
        }
    }, 300);
}

function updateFromNetto() {
    activeRateType = 'netto';
    let netto = parseFloat(document.getElementById('rateNetto').value) || 0;
    let vat = parseFloat(document.getElementById('vatRate').value) / 100;
    
    let rateGrosze = Math.round(netto * 100);
    let vatAmt = Math.round((rateGrosze * vat)) / 100;
    let brutto = (rateGrosze / 100) + vatAmt;

    document.getElementById('rateVatAmount').value = vatAmt.toFixed(2);
    document.getElementById('rateBrutto').value = brutto.toFixed(2);
}

function updateFromBrutto() {
    activeRateType = 'brutto';
    let brutto = parseFloat(document.getElementById('rateBrutto').value) || 0;
    let vat = parseFloat(document.getElementById('vatRate').value) / 100;
    
    let netto = Math.round((brutto / (1 + vat)) * 100) / 100;
    let vatAmt = Math.round((brutto - netto) * 100) / 100;

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
    initRateCalculatorSelects();
    initGlobalIndicators();

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
    let text = "# --- Święta stałe ---\n";
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

        document.getElementById('calcDistrictSelect').selectedIndex = 0;
        for(let i=2; i<=8; i++) {
            let globChk = document.getElementById('chk_glob_W'+i);
            if (globChk) globChk.checked = false;
        }
        
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
        vat = Math.round((netto * vatRate) * 100 + Number.EPSILON) / 100;
        brutto = netto + vat;
    } else {
        brutto = (rateGrosze * totalHoursDecimal) / 100;
        brutto = Math.round(brutto * 100 + Number.EPSILON) / 100;
        netto = Math.round((brutto / (1 + vatRate)) * 100 + Number.EPSILON) / 100;
        vat = Math.round((brutto - netto) * 100 + Number.EPSILON) / 100;
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


function generatePDFReport() {
    let conf = getActiveRateConfig();
    let startContract = document.getElementById('contractStart').value || "Nie określono";
    let endContract = document.getElementById('contractEnd').value || "Nie określono";

    // Wyliczenie stawek jednostkowych 1h
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

    // Grupowanie aktywnych dni per miesiąc
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
        alert("Brak wprowadzonych godzin wynajmu. Przypisz godziny w kalendarzu, aby wygenerować raport.");
        return;
    }

    // Generowanie tabeli rozliczenia
    let tableRowsHtml = "";
    let totalDaysAll = 0;
    let allValuesGlobal = [];
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

        globalNettoSum += fin.netto;
        globalVatSum += fin.vat;
        globalBruttoSum += fin.brutto;

        tableRowsHtml += `
            <tr>
                <td>${monthLabel}</td>
                <td>${daysCount}</td>
                <td>${hoursSumDecimal}h</td>
                <td>${formatCurrency(fin.netto)}</td>
                <td>${formatCurrency(fin.vat)}</td>
                <td><b>${formatCurrency(fin.brutto)}</b></td>
            </tr>
        `;
    });

    let totalHoursGlobalDecimal = sumDecimalHours(allValuesGlobal);
    let avgBrutto = sortedKeys.length > 0 ? (globalBruttoSum / sortedKeys.length) : 0;

    // Generowanie miniatur kalendarza dla wykorzystanych miesięcy
    let miniCalendarsHtml = "";
    sortedKeys.forEach(key => {
        let [yStr, mStr] = key.split('-');
        let yearNum = parseInt(yStr);
        let monthIdx = parseInt(mStr) - 1;

        let firstDayIndex = (new Date(yearNum, monthIdx, 1).getDay() + 6) % 7;
        let daysInMonth = new Date(yearNum, monthIdx + 1, 0).getDate();

        let cellsHtml = "";
        for (let i = 0; i < firstDayIndex; i++) {
            cellsHtml += `<div class="mini-cell empty"></div>`;
        }

        for (let day = 1; day <= daysInMonth; day++) {
            let dd = String(day).padStart(2, '0');
            let dateStr = `${yearNum}-${mStr}-${dd}`;
            let monthDayStr = `${mStr}-${dd}`;

            let holidayName = checkIsHoliday(dateStr, monthDayStr);
            let isHoliday = holidayName !== null;
            let val = assignedData[dateStr] || 0;

            let cellClass = "mini-cell";
            let content = `<span>${day}</span>`;

            if (isHoliday) {
                cellClass += " holiday";
                content += `<span style="font-size:6pt;">Święto</span>`;
            } else if (val > 0) {
                cellClass += " active";
                content += `<span style="font-size:7pt; color:#1e7e34;">${val}h</span>`;
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

    // Złożenie kompletnego widoku raportu
    let reportHtml = `
        <div class="report-header">
            <h2 style="margin:0 0 5px 0; font-size:18pt;">Raport Rozliczenia Wynajmu Sal Oświatowych</h2>
            <div style="font-size:10pt; color:#555;">Wygenerowano: ${new Date().toLocaleDateString('pl-PL')}</div>
        </div>

        <div class="report-meta-grid">
            <div class="report-meta-box">
                <b>Okres obowiązywania umowy:</b><br>
                Od: <b>${startContract}</b> do: <b>${endContract}</b><br><br>
                <b>Łączny czas wynajmu:</b> ${totalDaysAll} dni / <b>${totalHoursGlobalDecimal}h</b>
            </div>
            <div class="report-meta-box">
                <b>Stawka godzinowa bazowa:</b><br>
                Netto: <b>${formatCurrency(netto1h)}/h</b> | VAT (${vat}%): <b>${formatCurrency(vat1h)}/h</b><br>
                Brutto: <b style="font-size:11pt;">${formatCurrency(brutto1h)}/h</b><br><br>
                Średnia miesięczna: <b>${formatCurrency(avgBrutto)} brutto</b>
                ${avgBrutto > 2500 ? '<br><span style="color:red; font-weight:bold;">(Wymagana opłata kaucyjna / zabezpieczenie)</span>' : ''}
            </div>
        </div>

        <h3 style="font-size:13pt; margin: 20px 0 10px 0;">Zestawienie Finansowe Miesięczne</h3>
        <table class="report-table">
            <thead>
                <tr>
                    <th>Miesiąc</th>
                    <th>Liczba dni</th>
                    <th>Liczba godzin</th>
                    <th>Wartość Netto</th>
                    <th>Kwota VAT</th>
                    <th>Wartość Brutto</th>
                </tr>
            </thead>
            <tbody>
                ${tableRowsHtml}
                <tr class="report-total-row">
                    <td>ŁĄCZNIE</td>
                    <td>${totalDaysAll}</td>
                    <td>${totalHoursGlobalDecimal}h</td>
                    <td>${formatCurrency(globalNettoSum)}</td>
                    <td>${formatCurrency(globalVatSum)}</td>
                    <td>${formatCurrency(globalBruttoSum)}</td>
                </tr>
            </tbody>
        </table>

        <div class="page-break"></div>

        <h3 style="font-size:13pt; margin: 20px 0 10px 0;">Szczegółowy Harmonogram Dni i Godzin Wynajmu</h3>
        <div class="calendar-print-grid">
            ${miniCalendarsHtml}
        </div>
    `;

    document.getElementById('reportPrintArea').innerHTML = reportHtml;
    window.print();
}

window.onload = async function() {
    try {
        const response = await fetch('cennik.json');
        const data = await response.json();
        
        bsn2Data = data.bsn2Data || [];
        districtsW0 = data.districtsW0 || {};
        fixedHolidays = data.fixedHolidays || {};
        wFactors = data.wFactors || {};
    } catch (error) {
        console.warn("Nie udało się pobrać pliku cennik.json przez fetch.", error);
    }
    
    initBatchRows(); 
    loadConfiguration();
    renderCalendar();
};