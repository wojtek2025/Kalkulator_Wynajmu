const { createApp } = Vue;

const app = createApp({
    data() {
        return {
            activeTab: 'calc',

            toastMessage: '',
            toastIsError: false,
            toastVisible: false,

            contractStart: '',
            contractEnd: '',
            rateNetto: 0,
            vatRate: 23,

            assignedData: {}, 
            selectedDays: [], 
            currentYear: new Date().getFullYear(),
            currentMonth: new Date().getMonth(),
            
            manualH: '',
            manualM: '',

            batchDays: [
                { id: 1, name: "Poniedziałek", color: "", checked: false, h: '', m: '' },
                { id: 2, name: "Wtorek", color: "", checked: false, h: '', m: '' },
                { id: 3, name: "Środa", color: "", checked: false, h: '', m: '' },
                { id: 4, name: "Czwartek", color: "", checked: false, h: '', m: '' },
                { id: 5, name: "Piątek", color: "", checked: false, h: '', m: '' },
                { id: 6, name: "Sobota", color: "", checked: false, h: '', m: '' },
                { id: 0, name: "Niedziela", color: "#dc3545", checked: false, h: '', m: '' }
            ],

            customHolidaysText: '',

            bsn2Data: [],
            districtsW0: {},
            fixedHolidays: {},
            wFactors: {},
            customHolidays: {},

            selectedDistrictKey: '',
            calcContractStart: '',
            calcContractEnd: '',
            globalActiveFactors: {}, 
            calcRooms: [] 
        };
    },

    computed: {
        rateBrutto: {
            get() {
                let nettoGrosze = Math.round((this.rateNetto || 0) * 100);
                let vatAmt = Math.round(nettoGrosze * (this.vatRate / 100));
                return (nettoGrosze + vatAmt) / 100;
            },
            set(newBrutto) {
                let vat = this.vatRate / 100;
                this.rateNetto = Math.round(((newBrutto || 0) / (1 + vat)) * 100) / 100;
            }
        },
        computedVat() {
            return (this.rateBrutto - this.rateNetto);
        },

        monthNames() { return ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień']; },
        currentMonthName() { return this.monthNames[this.currentMonth].toUpperCase(); },
        daysOfWeekNames() { return [{ name: 'Pon', isSun: false }, { name: 'Wt', isSun: false }, { name: 'Śr', isSun: false }, { name: 'Czw', isSun: false }, { name: 'Pt', isSun: false }, { name: 'Sob', isSun: false }, { name: 'Niedz', isSun: true }]; },
        blankDays() { return (new Date(this.currentYear, this.currentMonth, 1).getDay() + 6) % 7; },
        calendarDays() {
            let days = [];
            let daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
            for (let day = 1; day <= daysInMonth; day++) {
                let date = new Date(this.currentYear, this.currentMonth, day);
                let isSunday = (date.getDay() === 0);
                let mm = String(this.currentMonth + 1).padStart(2, '0');
                let dd = String(day).padStart(2, '0');
                let dateStr = `${this.currentYear}-${mm}-${dd}`;
                let mdStr = `${mm}-${dd}`;
                
                let holidayName = this.customHolidays[dateStr] || this.fixedHolidays[mdStr] || null;
                // Poprawione bezpieczne porównywanie ciągów tekstowych daty
                let isOutOfRange = (this.contractStart && dateStr < this.contractStart) || (this.contractEnd && dateStr > this.contractEnd);
                
                days.push({ day: day, dateStr: dateStr, isSunday: isSunday, isHoliday: holidayName !== null, holidayName: holidayName, isOutOfRange: isOutOfRange, hours: this.assignedData[dateStr] || 0 });
            }
            return days;
        },

        manualDecimal() {
            let h = parseInt(this.manualH) || 0;
            let m = parseInt(this.manualM) || 0;
            if (h < 0) h = 0; if (h > 24) h = 24;
            if (m < 0) m = 0; if (m > 59) m = 59;
            if (h === 24) m = 0; // Jeśli 24h, to minuty ustawiamy na 0
            let decVal = h + (m / 60);
            return Math.round(decVal * 10000) / 10000;
        },
        summaryData() {
            let monthsMap = {};
            for (let dateStr in this.assignedData) {
                let val = this.assignedData[dateStr];
                if (val > 0) {
                    let monthKey = dateStr.substring(0, 7);
                    if (!monthsMap[monthKey]) monthsMap[monthKey] = { days: 0, values: [] };
                    monthsMap[monthKey].days++;
                    monthsMap[monthKey].values.push(val);
                }
            }
            let sortedKeys = Object.keys(monthsMap).sort();
            let rows = [];
            sortedKeys.forEach(key => {
                let [y, m] = key.split('-');
                let monthLabel = `${this.monthNames[parseInt(m) - 1]} ${y}`;
                let sumDec = parseFloat(monthsMap[key].values.reduce((a, b) => a + b, 0).toFixed(4));
                rows.push({ month: key, monthLabel, daysCount: monthsMap[key].days, hoursSum: sumDec, fin: this.calculateFinancials(sumDec) });
            });
            return rows;
        },
        globalSummary() {
            let tDays = 0, tHours = 0, tNetto = 0, tVat = 0, tBrutto = 0;
            this.summaryData.forEach(r => {
                tDays += r.daysCount; tHours += r.hoursSum; tNetto += r.fin.netto; tVat += r.fin.vat; tBrutto += r.fin.brutto;
            });
            let numMonths = this.summaryData.length;
            let avg = numMonths > 0 ? (tBrutto / numMonths) : 0;
            
            return { 
                totalDays: tDays, 
                totalHours: parseFloat(tHours.toFixed(4)), 
                totalNetto: tNetto, 
                totalVat: tVat, 
                totalBrutto: tBrutto, 
                avgBrutto: parseFloat(avg.toFixed(2)) 
            };
        },
        rateInfoHtml() {
            let n1h = this.rateNetto || 0;
            let v1h = Math.round(n1h * (this.vatRate / 100) * 100) / 100;
            let b1h = n1h + v1h;
            return `<b><strong style="font-size:16px;">Stawka bazowa:</strong> &nbsp;&nbsp; <b>Netto:</b> <span style="color:var(--text-main);">${this.formatCurrency(n1h)}</span> &nbsp;|&nbsp; <b>VAT (${this.vatRate}%):</b> <span style="color:var(--text-main);">${this.formatCurrency(v1h)}</span> &nbsp;|&nbsp; <b>Brutto:</b> <span style="color:var(--success); font-size: 16px;">${this.formatCurrency(b1h)} / h</span></b>`;
        },

        wFactorsGlobal() {
            let globals = {};
            for (let id in this.wFactors) { if (id >= 2) globals[id] = this.wFactors[id]; }
            return globals;
        },

        totalSuggestedRate() {
            let w0 = parseFloat(this.districtsW0[this.selectedDistrictKey]) || 1.0;
            let total = 0;
            this.calcRooms.forEach(room => {
                let item = this.bsn2Data[room.itemIdx];
                if (!item) return;
                let opg = item.bsn2 * w0;
                let allowedWs = item.w || [];
                if (room.w1Active && allowedWs.includes(1) && this.wFactors[1]) opg *= this.wFactors[1].val;
                for (let i = 2; i <= 8; i++) {
                    if (this.globalActiveFactors[i] && allowedWs.includes(i) && this.wFactors[i]) opg *= this.wFactors[i].val;
                }
                total += opg;
            });
            return total;
        },

        contractDurationNotice() {
            if (!this.calcContractStart || !this.calcContractEnd) return "";
            if (this.calcContractStart > this.calcContractEnd) return "<span style='color:red;'>Data początkowa nie może być późniejsza niż końcowa!</span>";
            let minThree = new Date(this.calcContractStart);
            minThree.setMonth(minThree.getMonth() + 3);
            if (new Date(this.calcContractEnd) >= minThree) {
                if (!this.globalActiveFactors[2]) this.globalActiveFactors[2] = true;
                return "⏱️ Okres umowy wynosi <b style='color:#28a745;'>co najmniej 3 miesiące</b>. Automatycznie zaznaczono <b>W2</b>.";
            }
            return "⏱️ Okres umowy jest <b style='color:#dc3545;'>krótszy niż 3 miesiące</b>.";
        }
    },

   // ===============================================
    // OBSERWATORZY (WATCHERS) 
    // ===============================================
    watch: {
        // Zabezpieczenie Zakładki 4: Przesuwa datę końcową, jeśli początkowa ją wyprzedzi
        contractStart(newVal) {
            if (newVal && this.contractEnd && newVal > this.contractEnd) {
                this.contractEnd = newVal;
            }
        },
        // Zabezpieczenie Zakładki 3: Przesuwa datę końcową, jeśli początkowa ją wyprzedzi
        calcContractStart(newVal) {
            if (newVal && this.calcContractEnd && newVal > this.calcContractEnd) {
                this.calcContractEnd = newVal;
            }
        },
        activeTab(newTab) {
            if (newTab === 'report') {
                setTimeout(() => { 
                    if (typeof preparePrintContainer === 'function') preparePrintContainer(); 
                }, 50);
            }
        },
        assignedData: {
            deep: true,
            handler() {
                if (this.activeTab === 'report') {
                    setTimeout(() => { 
                        if (typeof preparePrintContainer === 'function') preparePrintContainer(); 
                    }, 50);
                }
            }
        }
    },

    methods: {
        showToast(msg, isError = false) {
            this.toastMessage = msg; this.toastIsError = isError; this.toastVisible = true;
            setTimeout(() => { this.toastVisible = false; }, 3500);
        },
        formatCurrency(amount) {
            let parts = (parseFloat(amount) || 0).toFixed(2).split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ");
            return parts[0] + ',' + parts[1] + " zł";
        },
        formatHoursDisp(val) { return (parseFloat(val) || 0).toFixed(2); },
        formatTimeDisp(val) {
            let num = parseFloat(val) || 0;
            if (num <= 0) return "0h 00m";
            let h = Math.floor(num); let m = Math.round((num - h) * 60);
            return `${h}h ${m < 10 ? '0' : ''}${m}m`;
        },
        calculateFinancials(totalHoursDecimal) {
            let n = Math.round(((Math.round((this.rateNetto || 0) * 100) * totalHoursDecimal) / 100) * 100) / 100;
            let v = Math.round(n * (this.vatRate / 100) * 100) / 100;
            return { netto: n, vat: v, brutto: n + v };
        },

        changeMonth(dir) {
            this.currentMonth += dir;
            if (this.currentMonth > 11) { this.currentMonth = 0; this.currentYear++; }
            else if (this.currentMonth < 0) { this.currentMonth = 11; this.currentYear--; }
            this.selectedDays = [];
        },
        toggleDaySelection(day) {
            if (day.isHoliday || day.isOutOfRange) return;
            let idx = this.selectedDays.indexOf(day.dateStr);
            if (idx === -1) this.selectedDays.push(day.dateStr); else this.selectedDays.splice(idx, 1);
        },
        assignHoursToSelected() {
            let val = this.manualDecimal;
            this.selectedDays.forEach(dateStr => {
                if (val === 0) delete this.assignedData[dateStr]; else this.assignedData[dateStr] = val;
            });
            this.selectedDays = [];
            this.saveCalendarData();
        },
        clearSelectedHours() {
            this.selectedDays.forEach(d => delete this.assignedData[d]);
            this.selectedDays = [];
            this.saveCalendarData();
        },
        clearEntireCalendar() {
            if (confirm("⚠️ Czy na pewno chcesz całkowicie ZRESETOWAĆ kalendarz i konfigurację?")) {
                this.assignedData = {}; this.selectedDays = [];
                this.contractStart = ''; this.contractEnd = '';
                this.rateNetto = 0; this.vatRate = 23;
                this.manualH = ''; this.manualM = '';
                this.batchDays.forEach(d => { d.checked = false; d.h = ''; d.m = ''; });
                this.calcRooms = []; this.addRoomRow();
                localStorage.removeItem('school_rental_config'); localStorage.removeItem('school_rental_assigned_data'); localStorage.removeItem('school_rental_batch_data');
                this.saveCalendarData();
            }
        },
        saveCalendarData() { localStorage.setItem('school_rental_assigned_data', JSON.stringify(this.assignedData)); },

        getBatchDecimal(dayObj) {
            let h = parseInt(dayObj.h) || 0; 
            let m = parseInt(dayObj.m) || 0;
            if (h < 0) h = 0; if (h > 24) h = 24;
            if (m < 0) m = 0; if (m > 59) m = 59;
            if (h === 24) m = 0; // Jeśli 24h, minuty automatycznie zerujemy
            return Math.round((h + (m / 60)) * 10000) / 10000;
        },
        saveBatchState() {
            let state = {};
            this.batchDays.forEach(d => {
                let dec = this.getBatchDecimal(d);
                if (dec > 0 || d.checked) state[d.id] = { checked: d.checked, val: dec };
            });
            localStorage.setItem('school_rental_batch_data', JSON.stringify(state));
        },
        
        validateBatchHours(day) {
            if (day.h === '' || isNaN(day.h)) return;
            if (day.h < 0) day.h = 0;
            if (day.h > 24) day.h = 24;
            this.saveBatchState();
        },
        validateBatchMinutes(day) {
            if (day.m === '' || isNaN(day.m)) return;
            if (day.m < 0) day.m = 0;
            if (day.m > 59) day.m = 59;
            this.saveBatchState();
        },
        validateManualHours() {
            if (this.manualH === '' || isNaN(this.manualH)) return;
            if (this.manualH < 0) this.manualH = 0;
            if (this.manualH > 24) this.manualH = 24;
        },
        validateManualMinutes() {
            if (this.manualM === '' || isNaN(this.manualM)) return;
            if (this.manualM < 0) this.manualM = 0;
            if (this.manualM > 59) this.manualM = 59;
        },

        applyBatchAssignment() {
            if (!this.contractStart || !this.contractEnd) { 
                this.showToast("⚠️ Najpierw ustaw daty trwania umowy w Konfiguracji!", true); 
                this.activeTab = 'config'; 
                return; 
            }
            let activeMask = {};
            this.batchDays.forEach(d => { if (d.checked) activeMask[d.id] = this.getBatchDecimal(d); });
            if (Object.keys(activeMask).length === 0) { 
                this.showToast("⚠️ Zaznacz przynajmniej jeden dzień do przypisania.", true); 
                return; 
            }
            
            // Poprawka dla czasu UTC/Lokalnego - wymusza bezpieczny odczyt początku umowy
            let curr = new Date(this.contractStart + 'T00:00:00'); 
            let addedCount = 0;
            
            // Pętla while(true) z bezpiecznym przerwaniem (break) po przekroczeniu daty końcowej
            while (true) {
                let y = curr.getFullYear();
                let m = String(curr.getMonth() + 1).padStart(2, '0');
                let d = String(curr.getDate()).padStart(2, '0');
                let dStr = `${y}-${m}-${d}`;
                
                // Bezbłędne sprawdzanie stringów: ostatni dzień się załapie!
                if (dStr > this.contractEnd) break; 

                let mdStr = `${m}-${d}`;
                let dayOfW = curr.getDay();
                
                if (!this.customHolidays[dStr] && !this.fixedHolidays[mdStr] && activeMask[dayOfW] !== undefined) {
                    if (activeMask[dayOfW] > 0) { 
                        this.assignedData[dStr] = activeMask[dayOfW]; 
                        addedCount++; 
                    } else {
                        delete this.assignedData[dStr];
                    }
                }
                curr.setDate(curr.getDate() + 1); // Zawsze +1 dzień
            }
            this.saveCalendarData();
            this.activeTab = 'calc';
            this.showToast(`✅ Zaktualizowano! Dodano godziny do ${addedCount} dni.`);
        },

        saveConfiguration() {
            if (this.contractStart && this.contractEnd && this.contractStart > this.contractEnd) { this.showToast("⚠️ Data początkowa nie może być późniejsza!", true); return; }
            let cfg = { start: this.contractStart, end: this.contractEnd, rateNetto: this.rateNetto, vat: this.vatRate };
            localStorage.setItem('school_rental_config', JSON.stringify(cfg));
            this.showToast("✅ Zapisano pomyślnie Konfigurację Umowy!");
            this.activeTab = 'calc';
        },

        saveHolidaysFromText() {
            let newHols = {};
            this.customHolidaysText.split('\n').forEach(line => {
                line = line.trim();
                if (line.startsWith('#') || !line) return;
                let sep = line.indexOf(':'); if (sep === -1) sep = line.search(/\s/);
                if (sep !== -1) {
                    let d = line.substring(0, sep).trim();
                    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(d)) { let parts = d.split('-'); newHols[`${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`] = line.substring(sep + 1).trim().replace(/^:\s*/, '') || "Wolne"; }
                } else if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(line)) {
                    let parts = line.split('-'); newHols[`${parts[0]}-${parts[1].padStart(2,'0')}-${parts[2].padStart(2,'0')}`] = "Dzień wolny";
                }
            });
            this.customHolidays = newHols;
            localStorage.setItem('school_rental_custom_holidays', JSON.stringify(newHols));
            
            Object.keys(this.assignedData).forEach(dStr => {
                if (this.customHolidays[dStr] || this.fixedHolidays[dStr.substring(5, 10)]) delete this.assignedData[dStr];
            });
            this.saveCalendarData(); this.generateHolidaysText(); this.showToast("✅ Zaktualizowano kalendarz dni wolnych!");
        },
        generateHolidaysText() {
            let t = "# --- Święta stałe ---\n";
            for (let md in this.fixedHolidays) t += `${md} : ${this.fixedHolidays[md]}\n`;
            t += "\n# --- Dni użytkownika (Z rokiem) ---\n";
            Object.keys(this.customHolidays).sort().forEach(k => { t += `${k} : ${this.customHolidays[k]}\n`; });
            this.customHolidaysText = t;
        },

        addRoomRow() { this.calcRooms.push({ uid: Date.now() + Math.random(), itemIdx: 0, w1Active: false }); },
        removeRoomRow(index) { if (this.calcRooms.length > 1) this.calcRooms.splice(index, 1); else this.showToast("Musisz mieć chociaż jedno pomieszczenie!", true); },
        isW1Allowed(idx) { let item = this.bsn2Data[idx]; return item && item.w && item.w.includes(1); },
        getRoomRate(room) {
            let item = this.bsn2Data[room.itemIdx]; if (!item) return 0;
            let opg = item.bsn2 * (parseFloat(this.districtsW0[this.selectedDistrictKey]) || 1.0);
            let allow = item.w || [];
            if (room.w1Active && allow.includes(1) && this.wFactors[1]) opg *= this.wFactors[1].val;
            for (let i = 2; i <= 8; i++) { if (this.globalActiveFactors[i] && allow.includes(i) && this.wFactors[i]) opg *= this.wFactors[i].val; }
            return opg;
        },
        transferSuggestedRate() {
            this.rateNetto = parseFloat(this.totalSuggestedRate.toFixed(2));
            if (this.calcContractStart) this.contractStart = this.calcContractStart;
            if (this.calcContractEnd) this.contractEnd = this.calcContractEnd;
            this.saveConfiguration();
            this.activeTab = 'config';
            this.showToast("✅ Obliczona stawka została przeniesiona!");
        }
    },

    async mounted() {
        let savedConfig = localStorage.getItem('school_rental_config');
        if (savedConfig) {
            try {
                let cfg = JSON.parse(savedConfig);
                this.contractStart = cfg.start || ''; this.contractEnd = cfg.end || '';
                this.vatRate = cfg.vat || 23; this.rateNetto = cfg.rateNetto || 0;
                this.calcContractStart = this.contractStart; this.calcContractEnd = this.contractEnd;
            } catch(e) {}
        }

        let savedHours = localStorage.getItem('school_rental_assigned_data');
        if (savedHours) try { this.assignedData = JSON.parse(savedHours); } catch(e){}
        
        let savedBatch = localStorage.getItem('school_rental_batch_data');
        if (savedBatch) {
            try {
                let sb = JSON.parse(savedBatch);
                this.batchDays.forEach(d => {
                    if (sb[d.id]) {
                        d.checked = sb[d.id].checked;
                        let dec = parseFloat(sb[d.id].val) || 0;
                        d.h = Math.floor(dec) || '';
                        let mRaw = Math.round((dec - Math.floor(dec)) * 60);
                        if (mRaw === 60) { d.h++; d.m = ''; } else { d.m = mRaw || ''; }
                    }
                });
            } catch(e){}
        }

        let savedHols = localStorage.getItem('school_rental_custom_holidays');
        if (savedHols) try { this.customHolidays = JSON.parse(savedHols); } catch(e){}
        else this.customHolidays = { "2024-12-31": "Dzień rektorski" };

        let defData = {};
        try { const resp = await fetch('cennik.json'); defData = await resp.json(); } catch(e) {}

        let customC = localStorage.getItem('school_rental_custom_cennik');
        if (customC) {
            try {
                let c = JSON.parse(customC); 
                this.bsn2Data = c.bsn2Data || defData.bsn2Data || []; this.districtsW0 = c.districtsW0 || defData.districtsW0 || {};
                this.fixedHolidays = c.fixedHolidays || defData.fixedHolidays || {}; this.wFactors = c.wFactors || defData.wFactors || {};
            } catch(e) {}
        } else {
            this.bsn2Data = defData.bsn2Data || []; this.districtsW0 = defData.districtsW0 || {};
            this.fixedHolidays = defData.fixedHolidays || {}; this.wFactors = defData.wFactors || {};
        }

        this.generateHolidaysText();
        
        for (let k in this.districtsW0) { if (k.toLowerCase().includes('mokotów')) { this.selectedDistrictKey = k; break; } }
        if (!this.selectedDistrictKey && Object.keys(this.districtsW0).length > 0) this.selectedDistrictKey = Object.keys(this.districtsW0)[0];
        
        this.addRoomRow();
    }
});

window.vueApp = app.mount('#app');

window.refreshReportView = function() {
    if (typeof preparePrintContainer === 'function') {
        setTimeout(() => { preparePrintContainer(); }, 100); 
    }
}