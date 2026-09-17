let assignedData = {};
let selectedDays = new Set();
let activeRateType = 'brutto';

let bsn2Data = [];
let districtsW0 = {};
let fixedHolidays = {};
let wFactors = {};
let customHolidays = {};

// ==========================================
// POWIADOMIENIA (TOAST)
// ==========================================
function showToast(message, isError = false) {
    let toast = document.getElementById("toast-notification");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast-notification";
        toast.className = "toast-notification";
        document.body.appendChild(toast);
    }
    
    toast.innerText = message;
    
    if (isError) {
        toast.classList.add("error");
    } else {
        toast.classList.remove("error");
    }
    
    toast.classList.add("show");
    
    setTimeout(() => { 
        toast.classList.remove("show"); 
    }, 3500);
}

// ==========================================
// ZAKŁADKA SZYBKIE PRZYPISANIE (TYLKO GODZINY I MINUTY)
// ==========================================
function initBatchRows() {
    const container = document.getElementById('batchRowsContainer');
    if (!container) return;
    const daysData = [
        { id: 1, name: "Poniedziałek" }, { id: 2, name: "Wtorek" }, { id: 3, name: "Środa" },
        { id: 4, name: "Czwartek" }, { id: 5, name: "Piątek" }, { id: 6, name: "Sobota" }, { id: 0, name: "Niedziela", color: "#dc3545" }
    ];

    let savedBatch = {};
    try {
        savedBatch = JSON.parse(localStorage.getItem('school_rental_batch_data')) || {};
    } catch (e) {
        savedBatch = {};
    }

    let html = '';
    daysData.forEach(d => {
        let isChecked = savedBatch[d.id] && savedBatch[d.id].checked ? 'checked' : '';
        
        let valDec = savedBatch[d.id] && savedBatch[d.id].val !== undefined ? parseFloat(savedBatch[d.id].val) : 0;
        if (isNaN(valDec) || valDec < 0) valDec = 0;
        
        let h = Math.floor(valDec);
        let m = Math.round((valDec - h) * 60);
        if (m === 60) { h++; m = 0; }
        
        let hStr = valDec > 0 ? h.toString() : '';
        let mStr = valDec > 0 ? m.toString() : '';
        let decStr = valDec > 0 ? valDec.toFixed(4) : '0.0000';

        html += `
            <div class="batch-row" style="background: #fff; padding: 10px 15px; border-radius: 6px; border: 1px solid #e9ecef; display: flex; align-items: center; flex-wrap: wrap; gap: 15px;">
                <div style="width: 140px; display: flex; align-items: center; gap: 8px;">
                    <input type="checkbox" id="chk_${d.id}" value="${d.id}" ${isChecked} onchange="saveBatchInputsState()">
                    <label for="chk_${d.id}" style="cursor: pointer; font-weight: 600; color: ${d.color || '#495057'}; margin: 0;">${d.name}</label>
                </div>
                
                <div style="display: flex; align-items: center; gap: 5px; flex: 1;">
                    <input type="number" id="val_h_${d.id}" value="${hStr}" placeholder="0" min="0" style="width: 60px; text-align: center; border: 1px solid #ced4da; border-radius: 4px; padding: 6px; font-weight:bold;" oninput="syncBatchTime(${d.id}); saveBatchInputsState()"> 
                    <span style="font-size:14px; color:#6c757d; margin-right:10px; font-weight:bold;">h</span>
                    
                    <input type="number" id="val_m_${d.id}" value="${mStr}" placeholder="0" min="0" max="59" style="width: 60px; text-align: center; border: 1px solid #ced4da; border-radius: 4px; padding: 6px; font-weight:bold;" oninput="syncBatchTime(${d.id}); saveBatchInputsState()"> 
                    <span style="font-size:14px; color:#6c757d; font-weight:bold;">m</span>
                    
                    <span style="color:#adb5bd; font-size:13px; margin: 0 10px 0 15px; font-weight:bold;">=</span>
                    
                    <span id="disp_dec_${d.id}" style="color: var(--primary); font-weight: 800; font-size: 15px;">${decStr} h</span>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

function syncBatchTime(id) {
    let hInput = document.getElementById(`val_h_${id}`);
    let mInput = document.getElementById(`val_m_${id}`);
    let disp = document.getElementById(`disp_dec_${id}`);
    if(!hInput || !mInput || !disp) return;

    let h = parseInt(hInput.value) || 0;
    let m = parseInt(mInput.value) || 0;
    if (h < 0) h = 0;
    if (m < 0) m = 0;
    
    let decVal = h + (m / 60);
    let finalDec = Math.round(decVal * 10000) / 10000;
    
    if (h === 0 && m === 0 && hInput.value === '' && mInput.value === '') {
        disp.innerText = '0.0000 h';
    } else {
        disp.innerText = finalDec.toFixed(4) + ' h';
    }
}

function saveBatchInputsState() {
    let batchState = {};
    for (let i = 0; i <= 6; i++) {
        let chk = document.getElementById(`chk_${i}`);
        let hInput = document.getElementById(`val_h_${i}`);
        let mInput = document.getElementById(`val_m_${i}`);
        
        if (chk && hInput && mInput) {
            let h = parseInt(hInput.value) || 0;
            let m = parseInt(mInput.value) || 0;
            let decVal = h + (m / 60);
            let val = Math.round(decVal * 10000) / 10000;
            batchState[i] = { checked: chk.checked, val: val };
        }
    }
    localStorage.setItem('school_rental_batch_data', JSON.stringify(batchState));
}

function applyBatchAssignment() {
    let startContract = document.getElementById('contractStart').value;
    let endContract = document.getElementById('contractEnd').value;

    if (!startContract || !endContract) {
        showToast("⚠️ Błąd: Ustaw zakres umowy w Konfiguracji lub Wylicz Stawkę!", true);
        switchTab('config', document.querySelectorAll('.tab-btn')[3]);
        return;
    }

    saveBatchInputsState();

    let activeDays = {};
    for (let i = 0; i <= 6; i++) {
        let chk = document.getElementById(`chk_${i}`);
        if (chk && chk.checked) {
            let h = parseInt(document.getElementById(`val_h_${i}`).value) || 0;
            let m = parseInt(document.getElementById(`val_m_${i}`).value) || 0;
            let decVal = h + (m / 60);
            let val = Math.round(decVal * 10000) / 10000;
            activeDays[i] = val;
        }
    }

    if (Object.keys(activeDays).length === 0) {
        showToast("⚠️ Zaznacz przynajmniej jeden dzień i podaj liczbę godzin.", true);
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

    saveAssignedData();
    renderCalendar();
    switchTab('calc', document.querySelectorAll('.tab-btn')[0]);
    showToast(`✅ Zaktualizowano! Uzupełniono harmonogram dla ${countAssigned} dni.`);
}

// ==========================================
// POLE MANUALNE POD KALENDARZEM
// ==========================================
function upgradeManualTimeInput() {
    let oldInput = document.getElementById('hoursInput');
    if (!oldInput || oldInput.dataset.upgraded) return;
    
    let container = document.createElement('div');
    container.style.display = 'inline-flex';
    container.style.alignItems = 'center';
    container.style.gap = '8px';
    container.style.flexWrap = 'wrap';
    container.style.justifyContent = 'center';

    container.innerHTML = `
        <div style="display:flex; align-items:center; gap:5px; margin-left:10px;">
            <input type="number" id="manual_h" placeholder="0" min="0" style="width: 60px; text-align:center; font-weight:bold; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;" oninput="syncManualTime()"> 
            <span style="font-size:14px; color:#6c757d; font-weight:bold;">h</span>
            
            <input type="number" id="manual_m" placeholder="0" min="0" max="59" style="width: 60px; text-align:center; font-weight:bold; padding: 8px; border: 1px solid #ced4da; border-radius: 4px;" oninput="syncManualTime()"> 
            <span style="font-size:14px; color:#6c757d; font-weight:bold;">m</span>
            
            <span style="color:#adb5bd; font-size:14px; font-weight:bold; margin:0 10px;">=</span>
            
            <span id="manual_disp_dec" style="color:var(--primary); font-weight:800; font-size:16px;">0.0000 h</span>
            <input type="hidden" id="hoursInput" data-upgraded="true" value="0">
        </div>
    `;
    oldInput.replaceWith(container);
    
    // Ukrywamy stary, niepotrzebny podgląd z HTML
    let prevEl = document.getElementById('timePreview');
    if (prevEl) prevEl.style.display = 'none';
}

function syncManualTime() {
    let hInput = document.getElementById('manual_h');
    let mInput = document.getElementById('manual_m');
    let hiddenDec = document.getElementById('hoursInput');
    let dispDec = document.getElementById('manual_disp_dec');
    if(!hInput || !mInput || !hiddenDec || !dispDec) return;

    let h = parseInt(hInput.value) || 0;
    let m = parseInt(mInput.value) || 0;
    if (h < 0) h = 0;
    if (m < 0) m = 0;
    
    let decVal = h + (m / 60);
    let finalDec = Math.round(decVal * 10000) / 10000;
    
    hiddenDec.value = finalDec;

    if (h === 0 && m === 0 && hInput.value === '' && mInput.value === '') { 
        dispDec.innerText = '0.0000 h';
    } else {
        dispDec.innerText = finalDec.toFixed(4) + ' h';
    }
}

// ==========================================
// WYLICZANIE STAWKI (KALKULATOR)
// ==========================================
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
    if (!distSelect) return;
    distSelect.innerHTML = '';
    for (let dist in districtsW0) {
        let opt = document.createElement('option');
        opt.value = districtsW0[dist];
        opt.text = `${dist} (W0: ${districtsW0[dist]})`;
        
        if (dist.toLowerCase().includes('mokotów')) {
            opt.selected = true;
        }
        distSelect.appendChild(opt);
    }
    let roomsCont = document.getElementById('calcRoomsContainer');
    if (roomsCont) {
        roomsCont.innerHTML = '';
        addRoomRow();
    }
}

function addRoomRow() {
    let container = document.getElementById('calcRoomsContainer');
    if (!container) return;
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
        showToast("Kalkulator musi zawierać co najmniej jedno pomieszczenie.", true);
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
        let allowedWs = item.w || [];
        
        let w1Chk = row.querySelector('.chk-w1');
        let w1Wrap = row.querySelector('.w1-wrap');
        
        if (allowedWs.includes(1)) {
            w1Wrap.classList.remove('disabled');
            w1Chk.disabled = false;
        } else {
            w1Wrap.classList.add('disabled');
            w1Chk.disabled = true;
            w1Chk.checked = false;
        }

        let opg = bsn2 * w0;
        if (w1Chk.checked && wFactors[1]) opg *= wFactors[1].val;
        
        for (let i = 2; i <= 8; i++) {
            let isAllowedForRoom = allowedWs.includes(i);
            if (globalActive[i] && isAllowedForRoom && wFactors[i]) {
                opg *= wFactors[i].val;
            }
        }
        row.querySelector('.room-opg').innerText = formatCurrency(opg) + ' / h';
        totalOpG += opg;
    });
    
    let dispEl = document.getElementById('displaySuggestedRate');
    if (dispEl) dispEl.innerText = formatCurrency(totalOpG) + " / h";
}

function transferSuggestedRate() {
    updateSuggestedRate();
    let totalStr = document.getElementById('displaySuggestedRate').innerText;
    let totalVal = parseFloat(totalStr.replace(',', '.').replace(/[^\d.-]/g, ''));
    
    document.getElementById('rateNetto').value = totalVal.toFixed(2);
    updateFromNetto();

    let calcStart = document.getElementById('calcContractStart').value;
    let calcEnd = document.getElementById('calcContractEnd').value;
    if (calcStart) document.getElementById('contractStart').value = calcStart;
    if (calcEnd) document.getElementById('contractEnd').value = calcEnd;
    
    saveConfiguration(true);
    switchTab('config', document.querySelectorAll('.tab-btn')[3]);
    showToast("✅ Wyliczona stawka i daty zostały przeniesione!");
    
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

// ==========================================
// KONFIGURACJA UMOWY I STAWEK
// ==========================================
function validateNonNegative(input) {
    if (input.value !== "" && parseFloat(input.value) < 0) input.value = 0;
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
    if (activeRateType === 'netto') updateFromNetto();
    else updateFromBrutto();
}

function getActiveRateConfig() {
    let type = activeRateType;
    let rate = type === 'netto' ? (parseFloat(document.getElementById('rateNetto').value) || 0) : (parseFloat(document.getElementById('rateBrutto').value) || 0);
    let vat = parseFloat(document.getElementById('vatRate').value) || 0;
    return { rate: rate, type: type, vat: vat };
}

function onContractDatesChange(source) {
    let startEl = document.getElementById(source === 'calc' ? 'calcContractStart' : 'contractStart');
    let endEl = document.getElementById(source === 'calc' ? 'calcContractEnd' : 'contractEnd');
    let startVal = startEl.value;
    let endVal = endEl.value;

    if (source === 'calc') {
        document.getElementById('contractStart').value = startVal;
        document.getElementById('contractEnd').value = endVal;
    } else {
        document.getElementById('calcContractStart').value = startVal;
        document.getElementById('calcContractEnd').value = endVal;
    }

    let noticeEl = document.getElementById('contractDurationNotice');
    let chkW2 = document.getElementById('chk_glob_W2');

    if (!startVal || !endVal) {
        if (noticeEl) noticeEl.innerText = "";
        return;
    }

    let startDate = new Date(startVal);
    let endDate = new Date(endVal);

    if (startDate > endDate) {
        if (noticeEl) noticeEl.innerHTML = "<span style='color:red;'>Data początkowa nie może być późniejsza niż końcowa!</span>";
        return;
    }

    let minThreeMonthsDate = new Date(startDate);
    minThreeMonthsDate.setMonth(minThreeMonthsDate.getMonth() + 3);

    if (endDate >= minThreeMonthsDate) {
        if (chkW2 && !chkW2.checked) chkW2.checked = true;
        if (noticeEl) noticeEl.innerHTML = "⏱️ Okres umowy wynosi <b style='color:#28a745;'>co najmniej 3 miesiące</b>. Automatycznie zaznaczono wskaźnik <b>W2</b>.";
    } else {
        if (noticeEl) noticeEl.innerHTML = "⏱️ Okres umowy jest <b style='color:#dc3545;'>krótszy niż 3 miesiące</b>.";
    }

    saveConfiguration(true);
    updateSuggestedRate();
    renderCalendar();
}

function saveConfiguration(silent = false) {
    let startVal = document.getElementById('contractStart').value;
    let endVal = document.getElementById('contractEnd').value;

    if (startVal && endVal && startVal > endVal) {
        showToast("⚠️ Data początkowa nie może być późniejsza niż data końcowa.", true);
        document.getElementById('contractEnd').value = startVal;
        document.getElementById('calcContractEnd').value = startVal;
        return;
    }

    let currentConfig = getActiveRateConfig();
    if (currentConfig.rate < 0) currentConfig.rate = 0;

    let cfg = { start: startVal, end: endVal, rate: currentConfig.rate, type: currentConfig.type, vat: currentConfig.vat };
    localStorage.setItem('school_rental_config', JSON.stringify(cfg));
    renderCalendar();
    
    if (silent !== true) {
        switchTab('calc', document.querySelectorAll('.tab-btn')[0]);
        showToast("✅ Zapisano pomyślnie! Konfiguracja została zaktualizowana.");
    }
}

// ==========================================
// DNI WOLNE (ŚWIĘTA)
// ==========================================
function updateHolidaysTextarea() {
    let text = "# --- Święta stałe ---\n";
    for (let md in fixedHolidays) text += `${md} : ${fixedHolidays[md]}\n`;
    text += "\n# --- Dni użytkownika (z rokiem) ---\n";
    let sortedKeys = Object.keys(customHolidays).sort();
    sortedKeys.forEach(date => { text += `${date} : ${customHolidays[date]}\n`; });
    let inputEl = document.getElementById('holidaysInput');
    if (inputEl) inputEl.value = text.trim();
}

function saveHolidaysFromText() {
    let lines = document.getElementById('holidaysInput').value.split('\n');
    let newCustom = {};
    
    lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('#') || line === '') return;
        
        let separatorIdx = line.indexOf(':');
        if (separatorIdx === -1) separatorIdx = line.search(/\s/);
        
        if (separatorIdx !== -1) {
            let datePart = line.substring(0, separatorIdx).trim();
            let namePart = line.substring(separatorIdx + 1).trim();
            
            if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(datePart)) {
                let [y, m, d] = datePart.split('-');
                let formattedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                namePart = namePart.replace(/^:\s*/, '');
                newCustom[formattedDate] = namePart || "Dzień wolny";
            }
        } else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(line)) {
            let [y, m, d] = line.split('-');
            let formattedDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            newCustom[formattedDate] = "Dzień wolny";
        }
    });

    customHolidays = newCustom;
    localStorage.setItem('school_rental_custom_holidays', JSON.stringify(customHolidays));

    let removedCount = 0;
    Object.keys(assignedData).forEach(dateStr => {
        let parts = dateStr.split('-');
        let mmdd = `${parts[1]}-${parts[2]}`;
        if (checkIsHoliday(dateStr, mmdd) !== null) {
            delete assignedData[dateStr];
            removedCount++;
        }
    });
    
    if (removedCount > 0) saveAssignedData();
    updateHolidaysTextarea(); 
    renderCalendar();
    
    let msg = "✅ Zaktualizowano kalendarz dni wolnych!";
    if (removedCount > 0) msg += ` Usunięto przypisane godziny z ${removedCount} dni.`;
    showToast(msg);
}

function checkIsHoliday(dateStr, monthDayStr) {
    if (customHolidays.hasOwnProperty(dateStr)) return customHolidays[dateStr];
    if (fixedHolidays.hasOwnProperty(monthDayStr)) return fixedHolidays[monthDayStr];
    return null;
}

// ==========================================
// KALENDARZ I GŁÓWNA LOGIKA APLIKACJI
// ==========================================
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
    let activeTab = document.getElementById(tabId + 'Tab');
    if (activeTab) activeTab.classList.add('active');
    if (btnElement) btnElement.classList.add('active');
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
    let totalMinutes = Math.round((val - hours) * 60);
    return `${hours}h ${totalMinutes < 10 ? '0' : ''}${totalMinutes}m`;
}

function formatHoursDisp(val) {
    let num = parseFloat(val);
    if (isNaN(num)) return "0.00";
    return num.toFixed(2);
}

function changeMonth(direction) {
    currentMonth += direction;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    else if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar();
}

function saveAssignedData() {
    localStorage.setItem('school_rental_assigned_data', JSON.stringify(assignedData));
}

function renderCalendar() {
    let labelEl = document.getElementById('monthYearLabel');
    if (labelEl) labelEl.innerText = `${monthNames[currentMonth]} ${currentYear}`.toUpperCase();
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
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
        let isOutOfRange = (startContract && dateStr < startContract) || (endContract && dateStr > endContract);

        const cell = document.createElement('div');
        let cellClass = 'day-cell' + (isSunday ? ' sunday' : '');
        
        if (isHoliday) cellClass += ' holiday';
        else if (isOutOfRange) cellClass += ' out-of-range';
        else if (selectedDays.has(dateStr)) cellClass += ' selected';
        
        cell.className = cellClass;
        cell.innerHTML = `<div class="day-number">${day}</div>`;

        if (isHoliday) {
            cell.innerHTML += `<div class="holiday-tooltip" title="${holidayName}">${holidayName}</div>`;
        } else {
            let hoursDiv = document.createElement('div');
            hoursDiv.className = 'day-hours';
            if (assignedData[dateStr] > 0) {
                let val = assignedData[dateStr];
                hoursDiv.innerHTML = `${formatHoursDisp(val)}h<br><span style="font-weight:normal;font-size:10px;">(${formatDecimalToHoursAndMinutes(val)})</span>`;
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
}

function assignHours() {
    let hoursInputEl = document.getElementById('hoursInput');
    if (!hoursInputEl) return;
    let hours = parseFloat(hoursInputEl.value);
    if (isNaN(hours) || hours < 0) { hours = 0; }
    
    // Zabezpieczenie dokładności 4 miejsc
    hours = Math.round(hours * 10000) / 10000;

    let startContract = document.getElementById('contractStart').value;
    let endContract = document.getElementById('contractEnd').value;

    selectedDays.forEach(dateStr => {
        let parts = dateStr.split('-');
        let mmdd = `${parts[1]}-${parts[2]}`;
        if ((startContract && dateStr < startContract) || (endContract && dateStr > endContract) || checkIsHoliday(dateStr, mmdd) !== null) return;
        
        if (hours === 0) delete assignedData[dateStr];
        else assignedData[dateStr] = hours;
    });

    selectedDays.clear();
    saveAssignedData();
    renderCalendar();
}

function clearAssignedHours() {
    selectedDays.forEach(dateStr => delete assignedData[dateStr]);
    selectedDays.clear();
    saveAssignedData();
    renderCalendar();
}

function clearEntireCalendar() {
    if (confirm("⚠️ UWAGA! Czy na pewno chcesz ZRESETOWAĆ całkowicie kalkulator?")) {
        assignedData = {};
        selectedDays.clear();
        localStorage.removeItem('school_rental_config');
        localStorage.removeItem('school_rental_assigned_data');
        localStorage.removeItem('school_rental_batch_data');

        document.getElementById('contractStart').value = "";
        document.getElementById('calcContractStart').value = "";
        document.getElementById('contractEnd').value = "";
        document.getElementById('calcContractEnd').value = "";
        document.getElementById('vatRate').value = "23";
        document.getElementById('rateNetto').value = "0";
        document.getElementById('rateVatAmount').value = "0.00";
        document.getElementById('rateBrutto').value = "0";
        activeRateType = 'brutto';

        for (let i = 0; i <= 6; i++) {
            let chk = document.getElementById(`chk_${i}`);
            let hInput = document.getElementById(`val_h_${i}`);
            let mInput = document.getElementById(`val_m_${i}`);
            let disp = document.getElementById(`disp_dec_${i}`);
            
            if (chk) chk.checked = false;
            if (hInput) hInput.value = "";
            if (mInput) mInput.value = "";
            if (disp) disp.innerText = "0.0000 h";
        }

        let mH = document.getElementById('manual_h');
        let mM = document.getElementById('manual_m');
        let mDisp = document.getElementById('manual_disp_dec');
        let hInput = document.getElementById('hoursInput');
        if (mH) mH.value = "";
        if (mM) mM.value = "";
        if (mDisp) mDisp.innerText = "0.0000 h";
        if (hInput) hInput.value = "0";

        let distEl = document.getElementById('calcDistrictSelect');
        if (distEl) distEl.selectedIndex = 0;
        for(let i=2; i<=8; i++) {
            let globChk = document.getElementById('chk_glob_W'+i);
            if (globChk) globChk.checked = false;
        }
        
        let roomsCont = document.getElementById('calcRoomsContainer');
        if (roomsCont) {
            roomsCont.innerHTML = '';
            addRoomRow();
        }
        renderCalendar();
    }
}

// Precyzyjne sumowanie godzin z obsługą do 4 miejsc po przecinku w logice matematycznej
function sumDecimalHours(hoursArray) {
    let sum = hoursArray.reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0);
    return parseFloat(sum.toFixed(4));
}

function calculateFinancials(totalHoursDecimal) {
    let conf = getActiveRateConfig();
    let rate = conf.rate < 0 ? 0 : conf.rate;
    let vatRate = conf.vat / 100;
    let netto = 0, vat = 0, brutto = 0;
    let rateGrosze = Math.round(rate * 100);

    if (conf.type === 'netto') {
        netto = Math.round(((rateGrosze * totalHoursDecimal) / 100) * 100) / 100;
        vat = Math.round(netto * vatRate * 100) / 100;
        brutto = netto + vat;
    } else {
        brutto = Math.round(((rateGrosze * totalHoursDecimal) / 100) * 100) / 100;
        netto = Math.round((brutto / (1 + vatRate)) * 100) / 100;
        vat = Math.round((brutto - netto) * 100) / 100;
    }
    return { netto, vat, brutto };
}

function updateSummaryTable() {
    let conf = getActiveRateConfig();
    let rate = conf.rate < 0 ? 0 : conf.rate;
    let netto1h = 0, vat1h = 0, brutto1h = 0;
    let rateGrosze = Math.round(rate * 100);
    
    if (conf.type === 'netto') {
        netto1h = rateGrosze / 100;
        vat1h = Math.round(netto1h * (conf.vat / 100) * 100) / 100;
        brutto1h = netto1h + vat1h;
    } else {
        brutto1h = rateGrosze / 100;
        netto1h = Math.round((brutto1h / (1 + conf.vat / 100)) * 100) / 100;
        vat1h = brutto1h - netto1h;
    }

    let rateInfoEl = document.getElementById('displayRateInfo');
    if (rateInfoEl) {
        rateInfoEl.innerHTML = `<b><strong style="font-size:16px;">Stawka bazowa:</strong> &nbsp;&nbsp; <b>Netto:</b> <span style="color:var(--text-main);">${formatCurrency(netto1h)}</span> &nbsp;|&nbsp; <b>VAT (${conf.vat}%):</b> <span style="color:var(--text-main);">${formatCurrency(vat1h)}</span> &nbsp;|&nbsp; <b>Brutto:</b> <span style="color:var(--success); font-size: 16px;">${formatCurrency(brutto1h)} / h</span></b>`;
    }

    const tbody = document.getElementById('summaryTableBody');
    if (!tbody) return;
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
    let totalDaysAll = 0, allValuesGlobal = [], globalNettoSum = 0, globalVatSum = 0, globalBruttoSum = 0;

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

    sortedKeys.forEach(key => {
        let [y, m] = key.split('-');
        let monthLabel = `${monthNames[parseInt(m) - 1]} ${y}`;
        let daysCount = monthsMap[key].days;
        let monthValues = monthsMap[key].values;

        totalDaysAll += daysCount;
        allValuesGlobal = allValuesGlobal.concat(monthValues);

        let hoursSumDecimal = sumDecimalHours(monthValues);
        let fin = calculateFinancials(hoursSumDecimal);

        globalNettoSum += fin.netto;
        globalVatSum += fin.vat;
        globalBruttoSum += fin.brutto;

        let row = document.createElement('tr');
        row.innerHTML = `<td>${monthLabel}</td><td>${daysCount}</td><td><b style="color:var(--primary);">${formatHoursDisp(hoursSumDecimal)}h</b></td><td>${formatCurrency(fin.netto)}</td><td>${formatCurrency(fin.vat)}</td><td><b style="color:#2c3e50;">${formatCurrency(fin.brutto)}</b></td>`;
        tbody.appendChild(row);
    });

    let totalHoursGlobalDecimal = sumDecimalHours(allValuesGlobal);
    let totalRow = document.createElement('tr');
    totalRow.className = 'total-row';
    totalRow.innerHTML = `<td>Łącznie</td><td>${totalDaysAll}</td><td><b style="color:var(--primary);">${formatHoursDisp(totalHoursGlobalDecimal)}h</b></td><td>${formatCurrency(globalNettoSum)}</td><td>${formatCurrency(globalVatSum)}</td><td><b style="color:var(--success); font-size:15px;">${formatCurrency(globalBruttoSum)}</b></td>`;
    tbody.appendChild(totalRow);

    let avgBrutto = sortedKeys.length > 0 ? (globalBruttoSum / sortedKeys.length) : 0;

    document.getElementById('statTotalDaysHours').innerHTML = `<b>${totalDaysAll}</b> dni / <b style="color:#f1c40f;">${formatHoursDisp(totalHoursGlobalDecimal)}h</b>`;
    document.getElementById('statTotalNetto').innerText = formatCurrency(globalNettoSum);
    document.getElementById('statTotalVat').innerText = formatCurrency(globalVatSum);
    document.getElementById('statTotalBrutto').innerText = formatCurrency(globalBruttoSum);
    document.getElementById('statAvgBrutto').innerText = formatCurrency(avgBrutto);
    document.getElementById('thresholdAlert').style.display = (avgBrutto > 2500) ? 'block' : 'none';
}

// ==========================================
// SEKCJA EDYTORA GRAFICZNEGO CENNIK.JSON
// ==========================================
function renderCennikEditor() {
    let distHtml = '';
    for (let d in districtsW0) {
        distHtml += `<tr>
            <td><input type="text" class="editor-input dist-key" value="${d}"></td>
            <td><input type="number" step="0.01" class="editor-input dist-val" value="${districtsW0[d]}"></td>
            <td><button class="editor-del-btn" onclick="this.closest('tr').remove()">X</button></td>
        </tr>`;
    }
    let dBody = document.querySelector('#editor-districts-table tbody');
    if (dBody) dBody.innerHTML = distHtml;

    let wHtml = '';
    for (let wId in wFactors) {
        wHtml += `<tr>
            <td><input type="text" class="editor-input w-id" value="${wId}"></td>
            <td><input type="text" class="editor-input w-name" value="${wFactors[wId].name}"></td>
            <td><input type="number" step="0.01" class="editor-input w-val" value="${wFactors[wId].val}"></td>
            <td><button class="editor-del-btn" onclick="this.closest('tr').remove()">X</button></td>
        </tr>`;
    }
    let wBody = document.querySelector('#editor-wfactors-table tbody');
    if (wBody) wBody.innerHTML = wHtml;

    let holHtml = '';
    for (let hDate in fixedHolidays) {
        holHtml += `<tr>
            <td><input type="text" class="editor-input h-key" value="${hDate}" placeholder="MM-DD"></td>
            <td><input type="text" class="editor-input h-name" value="${fixedHolidays[hDate]}"></td>
            <td><button class="editor-del-btn" onclick="this.closest('tr').remove()">X</button></td>
        </tr>`;
    }
    let hBody = document.querySelector('#editor-holidays-table tbody');
    if (hBody) hBody.innerHTML = holHtml;

    let roomHtml = '';
    bsn2Data.forEach((room) => {
        let chkHtml = '';
        for(let i=1; i<=8; i++) {
            let isChecked = (room.w && room.w.includes(i)) ? 'checked' : '';
            chkHtml += `<label style="margin-right:8px; font-size:12px;"><input type="checkbox" class="r-w-chk" value="${i}" ${isChecked}> W${i}</label>`;
        }
        roomHtml += `<tr>
            <td><input type="text" class="editor-input r-name" value="${room.name}"></td>
            <td><input type="number" step="0.1" class="editor-input r-val" value="${room.bsn2}"></td>
            <td><div style="display:flex; flex-wrap:wrap; gap:4px;">${chkHtml}</div></td>
            <td><button class="editor-del-btn" onclick="this.closest('tr').remove()">X</button></td>
        </tr>`;
    });
    let rBody = document.querySelector('#editor-rooms-table tbody');
    if (rBody) rBody.innerHTML = roomHtml;
}

function addEditorRow(type) {
    let tbody, tr;
    if (type === 'districts') {
        tbody = document.querySelector('#editor-districts-table tbody');
        tr = `<tr><td><input type="text" class="editor-input dist-key" value="Nowa Dzielnica"></td><td><input type="number" step="0.01" class="editor-input dist-val" value="1.0"></td><td><button class="editor-del-btn" onclick="this.closest('tr').remove()">X</button></td></tr>`;
    } else if (type === 'wfactors') {
        tbody = document.querySelector('#editor-wfactors-table tbody');
        tr = `<tr><td><input type="text" class="editor-input w-id" value="9"></td><td><input type="text" class="editor-input w-name" value="Nowy wskaźnik"></td><td><input type="number" step="0.01" class="editor-input w-val" value="1.0"></td><td><button class="editor-del-btn" onclick="this.closest('tr').remove()">X</button></td></tr>`;
    } else if (type === 'holidays') {
        tbody = document.querySelector('#editor-holidays-table tbody');
        tr = `<tr><td><input type="text" class="editor-input h-key" value="01-01" placeholder="MM-DD"></td><td><input type="text" class="editor-input h-name" value="Nowe święto"></td><td><button class="editor-del-btn" onclick="this.closest('tr').remove()">X</button></td></tr>`;
    } else if (type === 'rooms') {
        tbody = document.querySelector('#editor-rooms-table tbody');
        let chkHtml = '';
        for(let i=1; i<=8; i++) chkHtml += `<label style="margin-right:8px; font-size:12px;"><input type="checkbox" class="r-w-chk" value="${i}"> W${i}</label>`;
        tr = `<tr><td><input type="text" class="editor-input r-name" value="Nowa Sala"></td><td><input type="number" step="0.1" class="editor-input r-val" value="0.0"></td><td><div style="display:flex; flex-wrap:wrap; gap:4px;">${chkHtml}</div></td><td><button class="editor-del-btn" onclick="this.closest('tr').remove()">X</button></td></tr>`;
    }
    if (tbody) tbody.insertAdjacentHTML('beforeend', tr);
}

function saveCennikEditor() {
    let newDistricts = {};
    document.querySelectorAll('#editor-districts-table tbody tr').forEach(tr => {
        let k = tr.querySelector('.dist-key').value.trim();
        let v = parseFloat(tr.querySelector('.dist-val').value) || 1.0;
        if(k) newDistricts[k] = v;
    });

    let newWFactors = {};
    document.querySelectorAll('#editor-wfactors-table tbody tr').forEach(tr => {
        let k = tr.querySelector('.w-id').value.trim();
        let name = tr.querySelector('.w-name').value.trim();
        let val = parseFloat(tr.querySelector('.w-val').value) || 1.0;
        if(k) newWFactors[k] = { name: name, val: val };
    });

    let newHolidays = {};
    document.querySelectorAll('#editor-holidays-table tbody tr').forEach(tr => {
        let k = tr.querySelector('.h-key').value.trim();
        let name = tr.querySelector('.h-name').value.trim();
        if(k) newHolidays[k] = name;
    });

    let newRooms = [];
    document.querySelectorAll('#editor-rooms-table tbody tr').forEach(tr => {
        let name = tr.querySelector('.r-name').value.trim();
        let bsn2 = parseFloat(tr.querySelector('.r-val').value) || 0;
        let wArr = [];
        tr.querySelectorAll('.r-w-chk:checked').forEach(chk => {
            wArr.push(parseInt(chk.value));
        });
        if(name) newRooms.push({ name: name, bsn2: bsn2, w: wArr });
    });

    districtsW0 = newDistricts;
    wFactors = newWFactors;
    fixedHolidays = newHolidays;
    bsn2Data = newRooms;

    let fullJson = {
        districtsW0: districtsW0,
        wFactors: wFactors,
        fixedHolidays: fixedHolidays,
        bsn2Data: bsn2Data
    };

    localStorage.setItem('school_rental_custom_cennik', JSON.stringify(fullJson));
    
    initRateCalculatorSelects();
    initGlobalIndicators();
    updateSuggestedRate();
    renderCalendar();
    
    showToast("✅ Zapisano zmiany cennika w przeglądarce!");
}

function exportCennikJson() {
    let fullJson = {
        districtsW0: districtsW0,
        wFactors: wFactors,
        fixedHolidays: fixedHolidays,
        bsn2Data: bsn2Data
    };
    
    let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullJson, null, 2));
    let dlElem = document.createElement('a');
    dlElem.setAttribute("href", dataStr);
    dlElem.setAttribute("download", "cennik.json");
    dlElem.click();
}

function resetCennikToDefault() {
    if (confirm("Czy na pewno chcesz usunąć własne modyfikacje i przywrócić pierwotne dane z pliku serwera?")) {
        localStorage.removeItem('school_rental_custom_cennik');
        location.reload();
    }
}

// ==========================================
// INICJALIZACJA STARTOWA
// ==========================================
function loadConfiguration() {
    initRateCalculatorSelects();
    initGlobalIndicators();

    let savedHours = localStorage.getItem('school_rental_assigned_data');
    if (savedHours) {
        try { assignedData = JSON.parse(savedHours); } catch (e) { assignedData = {}; }
    }

    let savedConfig = localStorage.getItem('school_rental_config');
    if (savedConfig) {
        try {
            let cfg = JSON.parse(savedConfig);
            if (cfg.start) { document.getElementById('contractStart').value = cfg.start; document.getElementById('calcContractStart').value = cfg.start; }
            if (cfg.end) { document.getElementById('contractEnd').value = cfg.end; document.getElementById('calcContractEnd').value = cfg.end; }
            if (cfg.vat) document.getElementById('vatRate').value = cfg.vat;
            
            activeRateType = cfg.type || 'brutto';
            if (activeRateType === 'netto') {
                document.getElementById('rateNetto').value = cfg.rate !== undefined ? cfg.rate : 0;
                updateFromNetto();
            } else {
                document.getElementById('rateBrutto').value = cfg.rate !== undefined ? cfg.rate : 0;
                updateFromBrutto();
            }
            if (cfg.start && cfg.end) onContractDatesChange('config');
        } catch(e) {}
    } else {
        document.getElementById('vatRate').value = "23";
        document.getElementById('rateNetto').value = "0";
        document.getElementById('rateVatAmount').value = "0.00";
        document.getElementById('rateBrutto').value = "0";
        activeRateType = 'brutto';
    }

    let savedHolidays = localStorage.getItem('school_rental_custom_holidays');
    if (savedHolidays) {
        try { customHolidays = JSON.parse(savedHolidays); } catch(e) { customHolidays = {}; }
    } else {
        customHolidays = { "2024-12-31": "np. Dzień wolny od zajęć dydaktycznych" };
    }
    updateHolidaysTextarea();
}

window.onload = async function() {
    let defaultData = {};
    try {
        const response = await fetch('cennik.json');
        defaultData = await response.json();
    } catch (error) {
        console.warn("Nie udało się pobrać domyślnego pliku cennik.json.", error);
    }
    
    let customCennikStr = localStorage.getItem('school_rental_custom_cennik');
    if (customCennikStr) {
        try {
            let customData = JSON.parse(customCennikStr);
            bsn2Data = customData.bsn2Data || defaultData.bsn2Data || [];
            districtsW0 = customData.districtsW0 || defaultData.districtsW0 || {};
            fixedHolidays = customData.fixedHolidays || defaultData.fixedHolidays || {};
            wFactors = customData.wFactors || defaultData.wFactors || {};
        } catch(e) {
            bsn2Data = defaultData.bsn2Data || [];
            districtsW0 = defaultData.districtsW0 || {};
            fixedHolidays = defaultData.fixedHolidays || {};
            wFactors = defaultData.wFactors || {};
        }
    } else {
        bsn2Data = defaultData.bsn2Data || [];
        districtsW0 = defaultData.districtsW0 || {};
        fixedHolidays = defaultData.fixedHolidays || {};
        wFactors = defaultData.wFactors || {};
    }
    
    upgradeManualTimeInput(); 
    initBatchRows(); 
    loadConfiguration();
    renderCalendar();
};

// ==========================================
// MOSTEK GLOBALNY WINDOW DLA OBFUSKACJI
// ==========================================
window.showToast = showToast;
window.applyBatchAssignment = applyBatchAssignment;
window.saveBatchInputsState = saveBatchInputsState;
window.syncBatchTime = syncBatchTime;
window.syncManualTime = syncManualTime;
window.addRoomRow = addRoomRow;
window.removeRoomRow = removeRoomRow;
window.updateSuggestedRate = updateSuggestedRate;
window.transferSuggestedRate = transferSuggestedRate;
window.updateFromNetto = updateFromNetto;
window.updateFromBrutto = updateFromBrutto;
window.updateFromVat = updateFromVat;
window.saveConfiguration = saveConfiguration;
window.saveHolidaysFromText = saveHolidaysFromText;
window.changeMonth = changeMonth;
window.assignHours = assignHours;
window.clearAssignedHours = clearAssignedHours;
window.clearEntireCalendar = clearEntireCalendar;
window.switchTab = switchTab;
window.getActiveRateConfig = getActiveRateConfig;
window.formatCurrency = formatCurrency;
window.sumDecimalHours = sumDecimalHours;
window.calculateFinancials = calculateFinancials;
window.checkIsHoliday = checkIsHoliday;
window.renderCennikEditor = renderCennikEditor;
window.addEditorRow = addEditorRow;
window.saveCennikEditor = saveCennikEditor;
window.exportCennikJson = exportCennikJson;
window.resetCennikToDefault = resetCennikToDefault;
window.onContractDatesChange = onContractDatesChange;
window.validateNonNegative = validateNonNegative;
window.formatHoursDisp = formatHoursDisp;