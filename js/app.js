/**
 * SKYSERVE - MISSION CONTROL APPLICATION LOGIC & UI CONTROLLER
 */

(function() {
  // Global Audio Synthesizer (Web Audio API - No external files needed)
  const AudioEngine = {
    ctx: null,
    init: function() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
    },
    playTone: function(freq, type = 'sine', duration = 0.08, gainVal = 0.05) {
      if (!window.SkyserveState.audioEnabled) return;
      try {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
      } catch (e) {}
    },
    beepClick: function() { this.playTone(880, 'sine', 0.04, 0.03); },
    beepSuccess: function() {
      this.playTone(523, 'triangle', 0.06, 0.05);
      setTimeout(() => this.playTone(659, 'triangle', 0.08, 0.05), 60);
    },
    beepWarning: function() {
      this.playTone(440, 'sawtooth', 0.1, 0.06);
      setTimeout(() => this.playTone(370, 'sawtooth', 0.12, 0.06), 90);
    },
    beepCritical: function() {
      this.playTone(220, 'square', 0.15, 0.08);
      setTimeout(() => this.playTone(180, 'square', 0.18, 0.08), 120);
    }
  };

  // Main UI Controller Object
  const App = {
    currentView: "dashboard",
    evalResult: null,

    init: function() {
      this.evalResult = window.SkyserveEngine.evaluateReadiness();
      this.setupNavigation();
      this.setupHeaderActions();
      this.setupMissionSelector();
      this.setupScenarioInjector();
      this.setupSimulationControls();
      this.setupOscilloscopeChannelTabs();
      this.setupChecklistView();
      this.setupWeatherView();
      this.setupRocketView();
      this.setupAvionicsView();
      this.setupTelemetryView();
      this.setupAiView();
      this.setupReadinessResultView();
      this.setupReportsView();
      this.setupDataLogsView();
      this.setupAuthView();
      this.setupSettingsView();
      this.setupModals();
      this.startClockAndTelemetryLoop();
      this.renderCurrentView();
    },

    // -------------------------------------------------------------------------
    // NAVIGATION & VIEW SWITCHING
    // -------------------------------------------------------------------------
    setupNavigation: function() {
      const navLinks = document.querySelectorAll('.nav-link');
      navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const targetView = link.getAttribute('data-view');
          if (targetView) {
            AudioEngine.beepClick();
            this.switchView(targetView);
          }
        });
      });

      // Handle Quick Actions on Dashboard
      document.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-quick-action]');
        if (actionBtn) {
          const action = actionBtn.getAttribute('data-quick-action');
          AudioEngine.beepClick();
          if (action === 'checklist') this.switchView('checklist');
          else if (action === 'ai') this.switchView('ai');
          else if (action === 'weather') this.switchView('weather');
          else if (action === 'report') this.openReportModal();
          else if (action === 'telemetry') this.switchView('telemetry');
          else if (action === 'readiness') this.switchView('readiness');
        }
      });
    },

    switchView: function(viewId) {
      this.currentView = viewId;

      // Update sidebar active classes
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.getAttribute('data-view') === viewId);
      });

      // Show matching view section
      document.querySelectorAll('.view-section').forEach(sec => {
        sec.classList.remove('active-view');
      });
      const targetSec = document.getElementById(`view-${viewId}`);
      if (targetSec) {
        targetSec.classList.add('active-view');
        // Scroll to top of viewport
        const vp = document.querySelector('.mc-viewport');
        if (vp) vp.scrollTop = 0;
      }

      this.renderCurrentView();
    },

    renderCurrentView: function() {
      // Re-evaluate readiness
      this.evalResult = window.SkyserveEngine.evaluateReadiness();
      this.updateHeaderSummary();

      switch(this.currentView) {
        case "dashboard":
          this.renderDashboard();
          break;
        case "checklist":
          this.renderChecklistTable();
          break;
        case "weather":
          this.renderWeather();
          break;
        case "rocket":
          this.renderRocketSystems();
          break;
        case "avionics":
          this.renderAvionics();
          break;
        case "telemetry":
          this.renderTelemetry();
          break;
        case "ai":
          this.renderAiPage();
          break;
        case "readiness":
          this.renderReadinessResultPage();
          break;
        case "reports":
          this.renderReportsList();
          break;
        case "logs":
          this.renderDataLogsTable();
          break;
        case "auth":
          this.renderAuthPage();
          break;
        case "admin":
          if (window.SkyserveAdmin) window.SkyserveAdmin.loadAdminData();
          break;
        case "settings":
          this.renderSettingsPage();
          break;
      }
    },

    // -------------------------------------------------------------------------
    // HEADER & GLOBAL ACTIONS
    // -------------------------------------------------------------------------
    setupHeaderActions: function() {
      // Audio toggle
      const audioBtn = document.getElementById('btn-audio-toggle');
      if (audioBtn) {
        audioBtn.addEventListener('click', () => {
          window.SkyserveState.audioEnabled = !window.SkyserveState.audioEnabled;
          audioBtn.classList.toggle('active', window.SkyserveState.audioEnabled);
          const iconSpan = audioBtn.querySelector('.audio-status-label');
          if (iconSpan) {
            iconSpan.textContent = window.SkyserveState.audioEnabled ? "AUDIO ON" : "MUTED";
          }
          if (window.SkyserveState.audioEnabled) AudioEngine.beepSuccess();
        });
      }

      // Role selector pill
      const rolePill = document.getElementById('role-profile-pill');
      if (rolePill) {
        rolePill.addEventListener('click', () => {
          AudioEngine.beepClick();
          this.switchView('auth');
        });
      }

      // Search trigger
      const searchBtn = document.getElementById('btn-search-trigger');
      if (searchBtn) {
        searchBtn.addEventListener('click', () => {
          AudioEngine.beepClick();
          this.openModal('modal-search');
        });
      }

      // Keyboard shortcut Cmd/Ctrl + K
      window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          this.openModal('modal-search');
        }
      });

      // Notification trigger
      const notifBtn = document.getElementById('btn-notifications');
      if (notifBtn) {
        notifBtn.addEventListener('click', () => {
          AudioEngine.beepClick();
          this.openModal('modal-notifications');
        });
      }
    },

    setupMissionSelector: function() {
      const select = document.getElementById('header-mission-select');
      if (select) {
        select.addEventListener('change', (e) => {
          AudioEngine.beepClick();
          window.SkyserveState.currentMissionId = e.target.value;
          this.renderCurrentView();
        });
      }
    },

    updateHeaderSummary: function() {
      const r = this.evalResult;
      if (!r) return;

      // Update sidebar checklist badge
      const chkBadge = document.getElementById('sidebar-chk-badge');
      if (chkBadge) {
        chkBadge.textContent = `${r.completedItems}/${r.totalItems}`;
      }

      // Update sidebar readiness decision badge
      const decBadge = document.getElementById('sidebar-decision-badge');
      if (decBadge) {
        decBadge.textContent = r.decision;
        decBadge.className = `nav-badge ${r.decision === 'GO' ? 'badge-ready' : r.decision === 'HOLD' ? 'badge-hold' : 'badge-danger'}`;
      }
    },

    // -------------------------------------------------------------------------
    // 1. DASHBOARD VIEW
    // -------------------------------------------------------------------------
    renderDashboard: function() {
      const r = this.evalResult;
      const s = window.SkyserveState;

      // Dial Score Number
      const scoreEl = document.getElementById('dash-readiness-score');
      if (scoreEl) scoreEl.textContent = `${r.overallScore}%`;

      // Dial Circle SVG progress
      const dialCircle = document.getElementById('dash-dial-circle');
      if (dialCircle) {
        const circumference = 534;
        const offset = circumference - (r.overallScore / 100) * circumference;
        dialCircle.style.strokeDashoffset = offset;
        dialCircle.className = `dial-progress ${r.decision === 'GO' ? 'state-ready' : r.decision === 'NO-GO' ? 'state-critical' : ''}`;
      }

      // Decision Badge
      const decBadge = document.getElementById('dash-decision-pill');
      if (decBadge) {
        decBadge.textContent = r.decision;
        decBadge.className = `mission-decision-pill ${r.decision === 'GO' ? 'decision-go' : r.decision === 'HOLD' ? 'decision-hold' : 'decision-nogo'}`;
      }

      // Reasons List
      const reasonsList = document.getElementById('dash-decision-reasons');
      if (reasonsList) {
        let html = '';
        if (r.decision === 'GO') {
          html = `
            <div class="reason-item info">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
              <span>All flight criteria verified. Range safety clear.</span>
            </div>
          `;
        } else {
          // Show up to 3 top blockers/warnings
          const items = [...r.criticalBlockers, ...r.warningNotices].slice(0, 3);
          items.forEach(item => {
            const isCrit = item.severity === 'CRITICAL';
            html += `
              <div class="reason-item ${isCrit ? 'critical' : 'warning'}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  ${isCrit ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>' : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'}
                </svg>
                <span>${item.title}</span>
              </div>
            `;
          });
        }
        reasonsList.innerHTML = html;
      }

      // Subsystem Status Cards
      this.updateStatusCard('card-weather-status', s.subsystems.weather.status, `${r.weatherScore}%`, s.subsystems.weather.label, `Wind: ${s.weather.windSpeedKmH} km/h`);
      this.updateStatusCard('card-rocket-status', s.subsystems.rocket.status, `${r.rocketScore}%`, s.subsystems.rocket.label, `Stability: ${s.rocket.stabilityMarginCalibers} cal`);
      this.updateStatusCard('card-avionics-status', s.subsystems.avionics.status, `${r.avionicsScore}%`, s.subsystems.avionics.label, `Bus: ${s.avionics.batteryTotalVoltage}V`);
      this.updateStatusCard('card-telemetry-status', s.subsystems.telemetry.status, `${r.telemetryScore}%`, s.subsystems.telemetry.label, `RSSI: ${s.telemetry.signalRssi} dBm`);
      this.updateStatusCard('card-checklist-status', s.subsystems.checklist.status, `${r.checklistScore}%`, `${r.completedItems}/${r.totalItems} DONE`, 'Pre-launch criteria');

      // AI Risk Insights Pill on Dashboard
      const aiInsightsContainer = document.getElementById('dash-ai-insights-list');
      if (aiInsightsContainer) {
        aiInsightsContainer.innerHTML = s.aiEngine.insights.slice(0, 4).map(ins => `
          <div class="insight-pill">
            <div class="insight-icon" style="color: ${ins.type === 'critical' ? 'var(--red-critical)' : ins.type === 'warning' ? 'var(--amber-warning)' : ins.type === 'ready' ? 'var(--green-ready)' : 'var(--cyan-primary)'}">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                ${ins.type === 'ready' ? '<polyline points="20 6 9 17 4 12"></polyline>' : ins.type === 'info' ? '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>' : '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'}
              </svg>
            </div>
            <div class="insight-content">
              <div class="insight-title">${ins.title}</div>
              <div class="insight-desc">${ins.desc}</div>
            </div>
          </div>
        `).join('');
      }

      // Draw Readiness Trend Chart and HUD Canvases
      this.drawTrendChart('canvas-dash-trend');
      this.drawTrajectoryProfile('canvas-trajectory');
      this.drawAttitudeHorizon('canvas-attitude-horizon');
    },

    updateStatusCard: function(cardId, status, value, label, sub) {
      const card = document.getElementById(cardId);
      if (!card) return;
      const pill = card.querySelector('.status-indicator-pill');
      const valEl = card.querySelector('.status-card-value');
      const descEl = card.querySelector('.status-card-desc');

      if (pill) {
        pill.textContent = label;
        pill.className = `status-indicator-pill ${status === 'READY' ? 'status-pill-ready' : status === 'CRITICAL' ? 'status-pill-critical' : status === 'INFO' ? 'status-pill-info' : 'status-pill-warning'}`;
      }
      if (valEl) valEl.innerHTML = `${value}`;
      if (descEl && sub) descEl.innerHTML = sub;
    },

    // -------------------------------------------------------------------------
    // 2. LAUNCH CHECKLIST VIEW
    // -------------------------------------------------------------------------
    setupChecklistView: function() {
      // Filter tabs
      const filterBtns = document.querySelectorAll('#checklist-filters button');
      filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          AudioEngine.beepClick();
          filterBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.renderChecklistTable();
        });
      });

      // Add item button
      const addBtn = document.getElementById('btn-add-checklist-item');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          AudioEngine.beepClick();
          this.openModal('modal-add-checklist');
        });
      }
    },

    renderChecklistTable: function() {
      const s = window.SkyserveState;
      const tbody = document.getElementById('checklist-table-body');
      if (!tbody) return;

      const activeFilterBtn = document.querySelector('#checklist-filters button.active');
      const activeFilter = activeFilterBtn ? activeFilterBtn.getAttribute('data-filter') : 'all';

      // Update progress bar
      const r = this.evalResult;
      const progText = document.getElementById('chk-progress-count');
      const progPercent = document.getElementById('chk-progress-percent');
      const progFill = document.getElementById('chk-progress-fill');
      if (progText) progText.textContent = `${r.completedItems} / ${r.totalItems} items completed`;
      if (progPercent) progPercent.textContent = `${r.checklistScore}%`;
      if (progFill) progFill.style.width = `${r.checklistScore}%`;

      let items = s.checklist;
      if (activeFilter === 'critical') items = items.filter(i => i.priority === 'Critical');
      else if (activeFilter === 'pending') items = items.filter(i => !i.completed);
      else if (activeFilter === 'completed') items = items.filter(i => i.completed);

      tbody.innerHTML = items.map(item => `
        <tr class="${item.completed ? 'row-completed' : ''}">
          <td style="width: 44px; text-align: center;">
            <label class="custom-checkbox-wrap">
              <input type="checkbox" class="custom-checkbox-input" data-chk-id="${item.id}" ${item.completed ? 'checked' : ''} ${s.currentUser.role === 'Viewer' ? 'disabled' : ''}>
              <div class="checkbox-custom-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
            </label>
          </td>
          <td style="font-family: var(--font-mono); font-size: 11px; color: var(--cyan-primary);">${item.id}</td>
          <td>
            <div style="font-weight: 600; color: #fff; margin-bottom: 2px;">${item.title}</div>
            <div style="font-size: 10.5px; color: var(--text-muted);">${item.category}</div>
          </td>
          <td>
            <span class="priority-pill priority-${item.priority.toLowerCase()}">${item.priority}</span>
          </td>
          <td>
            <span class="status-indicator-pill ${item.completed ? 'status-pill-ready' : 'status-pill-warning'}">
              ${item.completed ? 'VERIFIED' : 'PENDING'}
            </span>
          </td>
          <td style="color: var(--text-secondary); font-size: 11px;">${item.assignee}</td>
          <td style="font-family: var(--font-mono); font-size: 10.5px; color: var(--text-muted);">${item.timestamp}</td>
          <td style="font-size: 11px; color: var(--text-muted); max-width: 200px;">${item.notes}</td>
        </tr>
      `).join('');

      // Attach checkbox change listeners
      tbody.querySelectorAll('.custom-checkbox-input').forEach(input => {
        input.addEventListener('change', (e) => {
          const chkId = e.target.getAttribute('data-chk-id');
          const isChecked = e.target.checked;
          const found = s.checklist.find(i => i.id === chkId);
          if (found) {
            found.completed = isChecked;
            found.timestamp = isChecked ? "T-00:08:12" : "Pending";
            if (isChecked) AudioEngine.beepSuccess();
            else AudioEngine.beepWarning();

            // Re-evaluate
            this.evalResult = window.SkyserveEngine.evaluateReadiness();
            this.updateHeaderSummary();
            this.renderChecklistTable();
          }
        });
      });
    },

    // -------------------------------------------------------------------------
    // 3. WEATHER MONITORING
    // -------------------------------------------------------------------------
    setupWeatherView: function() {
      // Configurable sliders
      const windSlider = document.getElementById('slider-wind-limit');
      if (windSlider) {
        windSlider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          window.SkyserveState.launchCriteria.maxWindSpeedKmH = val;
          const label = document.getElementById('val-wind-limit');
          if (label) label.textContent = `${val} km/h`;
          this.renderWeather();
        });
      }

      const tempSlider = document.getElementById('slider-temp-limit');
      if (tempSlider) {
        tempSlider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          window.SkyserveState.launchCriteria.maxTempC = val;
          const label = document.getElementById('val-temp-limit');
          if (label) label.textContent = `${val}°C`;
          this.renderWeather();
        });
      }
    },

    renderWeather: function() {
      const w = window.SkyserveState.weather;
      const c = window.SkyserveState.launchCriteria;
      const r = this.evalResult;

      // Update primary readings
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };
      setVal('w-temp', `${w.temperatureC} <span class="status-card-unit">°C</span>`);
      setVal('w-wind', `${w.windSpeedKmH} <span class="status-card-unit">km/h</span>`);
      setVal('w-direction', `${w.windDirectionCardinal} <span class="status-card-unit">(${w.windDirectionDeg}°)</span>`);
      setVal('w-humidity', `${w.humidityPct} <span class="status-card-unit">%</span>`);
      setVal('w-pressure', `${w.pressureHpa} <span class="status-card-unit">hPa</span>`);
      setVal('w-visibility', `${w.visibilityKm} <span class="status-card-unit">km</span>`);
      setVal('w-precip', `${w.precipitationMmH} <span class="status-card-unit">mm/h</span>`);
      setVal('w-lightning', `CLEAR <span class="status-card-unit">(${w.lightningRiskKm}km)</span>`);

      // Weather Readiness Card
      const statusPill = document.getElementById('w-overall-pill');
      if (statusPill) {
        const isReady = w.windSpeedKmH <= c.maxWindSpeedKmH && w.precipitationMmH === 0 && w.lightningRiskKm >= 30;
        statusPill.textContent = isReady ? "WEATHER GO" : "WEATHER HOLD / WARNING";
        statusPill.className = `status-indicator-pill ${isReady ? 'status-pill-ready' : 'status-pill-critical'}`;
      }

      // Wind Vector Compass Canvas
      this.drawWindCompass('canvas-wind-compass', w.windDirectionDeg, w.windSpeedKmH);
    },

    // -------------------------------------------------------------------------
    // 4. ROCKET SYSTEMS
    // -------------------------------------------------------------------------
    setupRocketView: function() {},
    renderRocketSystems: function() {
      const rk = window.SkyserveState.rocket;
      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

      setEl('rk-id', rk.identification);
      setEl('rk-config', rk.configuration);
      setEl('rk-wet-mass', `${rk.totalWetMassKg} kg`);
      setEl('rk-dry-mass', `${rk.dryMassKg} kg`);
      setEl('rk-prop-mass', `${rk.propellantMassKg} kg`);
      setEl('rk-cg', `${rk.centerOfGravityM} m from tip`);
      setEl('rk-cp', `${rk.centerOfPressureM} m from tip`);
      setEl('rk-margin', `${rk.stabilityMarginCalibers} Calibers`);
      setEl('rk-chamber-pres', `${rk.motorChamberPressureBar} bar`);
      setEl('rk-integrity', `${rk.structuralIntegrityPct}% Nominal`);

      // Update stability marker position on caliber bar
      const marker = document.getElementById('rk-stability-marker');
      if (marker) {
        // Range: 0 to 4 calibers -> 2.14 is ~ 53%
        const pct = Math.min(100, Math.max(0, (rk.stabilityMarginCalibers / 4.0) * 100));
        marker.style.left = `${pct}%`;
      }
    },

    // -------------------------------------------------------------------------
    // 5. AVIONICS HEALTH
    // -------------------------------------------------------------------------
    setupAvionicsView: function() {},
    renderAvionics: function() {
      const av = window.SkyserveState.avionics;
      const setPill = (id, text, type) => {
        const el = document.getElementById(id);
        if (el) {
          el.textContent = text;
          el.className = `avionics-state-pill ${type === 'ready' ? 'state-online' : type === 'warn' ? 'state-warning' : 'state-offline'}`;
        }
      };

      setPill('av-fc-pill', av.flightComputerStatus, 'ready');
      setPill('av-imu-pill', 'ONLINE (DUAL)', 'ready');
      setPill('av-gps-pill', 'ONLINE (18 SV)', 'ready');
      setPill('av-temp-pill', `${av.tempSensorCabinC}°C (NOMINAL)`, 'ready');
      setPill('av-pres-pill', `${av.pressureBaroHpa} hPa`, 'ready');
      setPill('av-cam-pill', `${av.cameraFps} FPS 1080P`, 'ready');
      setPill('av-bat-pill', `${av.batteryTotalVoltage}V (CELL 3 SAG)`, 'warn');
      setPill('av-storage-pill', `${av.storageFreeGb} GB FREE`, 'ready');
      setPill('av-bus-pill', 'CAN/SPI 0 ERR', 'ready');

      // Battery waveform canvas
      this.drawBatteryWaveform('canvas-battery-wave');
    },

    // -------------------------------------------------------------------------
    // 6. TELEMETRY MONITORING
    // -------------------------------------------------------------------------
    setupTelemetryView: function() {},
    renderTelemetry: function() {
      const t = window.SkyserveState.telemetry;
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.innerHTML = val; };

      setVal('tlm-rssi', `${t.signalRssi} <span class="status-card-unit">dBm</span>`);
      setVal('tlm-packet-rate', `${t.packetRateSec} <span class="status-card-unit">pkts/s</span>`);
      setVal('tlm-snr', `${t.signalSnrDb} <span class="status-card-unit">dB</span>`);
      setVal('tlm-loss', `${t.packetLossPct} <span class="status-card-unit">%</span>`);
      setVal('tlm-conn', t.connectionStatus);

      // Render Telemetry Event Log
      const eventLog = document.getElementById('tlm-events-list');
      if (eventLog) {
        eventLog.innerHTML = t.events.map(ev => `
          <div class="activity-item">
            <div class="activity-left">
              <div class="activity-dot" style="background: ${ev.type === 'ready' ? 'var(--green-ready)' : 'var(--amber-warning)'};"></div>
              <div>
                <span style="font-family: var(--font-mono); font-weight: 700; color: var(--cyan-primary); margin-right: 6px;">[${ev.code}]</span>
                <span>${ev.text}</span>
              </div>
            </div>
            <div class="activity-time">${ev.time}</div>
          </div>
        `).join('');
      }

      this.drawTelemetryOscilloscope('canvas-telemetry-stream');
    },

    // -------------------------------------------------------------------------
    // 7. AI ANALYSIS ENGINE
    // -------------------------------------------------------------------------
    setupAiView: function() {
      const runBtn = document.getElementById('btn-run-ai-analysis');
      if (runBtn) {
        runBtn.addEventListener('click', () => {
          this.triggerAiAnalysisSimulation();
        });
      }
    },

    renderAiPage: function() {
      const ai = window.SkyserveState.aiEngine;
      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

      setEl('ai-last-run', ai.lastRunTimestamp);
      setEl('ai-risk-classification', ai.riskClassification);
      setEl('ai-decision-preview', ai.recommendation);

      const grid = document.getElementById('ai-anomalies-grid');
      if (grid) {
        grid.innerHTML = ai.insights.map(ins => `
          <div class="anomaly-card risk-${ins.type === 'critical' ? 'high' : ins.type === 'warning' ? 'medium' : 'low'}">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <span style="font-family: var(--font-heading); font-size: 10px; color: var(--cyan-primary); letter-spacing: 1px;">${ins.category}</span>
              <span style="font-family: var(--font-mono); font-size: 9.5px; color: var(--text-muted);">Conf: ${ins.confidence}</span>
            </div>
            <div style="font-weight: 700; font-size: 13px; color: #fff;">${ins.title}</div>
            <div style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.4;">${ins.desc}</div>
            <div style="font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px;">
              ${ins.rule}
            </div>
          </div>
        `).join('');
      }
    },

    triggerAiAnalysisSimulation: function() {
      AudioEngine.beepClick();
      this.openModal('modal-ai-diagnostics');
      const terminal = document.getElementById('ai-scan-terminal');
      const progressLabel = document.getElementById('ai-scan-stage-label');
      if (!terminal) return;

      terminal.innerHTML = "";
      const logs = [
        "Initializing SkyServe AI Core Engine v4.2...",
        "Fetching real-time telemetry snapshot from Pad-03 gantry...",
        "Parsing 1,420 avionics sensor packets / second...",
        "Cross-checking battery cell delta (Cell 3: 3.61V, delta 0.09V detected)...",
        "Executing Aerodynamic Transonic Wind Shear Matrix...",
        "Validating Pre-Launch Safety Gates (22 items verified against safety interlocks)...",
        "Scanning Historical Rocketry Database for matching signatures (Found 3 matches)...",
        "Synthesizing explainable decision-support payload...",
        "ANALYSIS COMPLETE: Recommendation = HOLD (82% Confidence)"
      ];

      let idx = 0;
      const interval = setInterval(() => {
        if (idx < logs.length) {
          const p = document.createElement('div');
          p.textContent = `> ${logs[idx]}`;
          terminal.appendChild(p);
          terminal.scrollTop = terminal.scrollHeight;
          if (progressLabel) progressLabel.textContent = logs[idx];
          AudioEngine.beepClick();
          idx++;
        } else {
          clearInterval(interval);
          AudioEngine.beepSuccess();
          setTimeout(() => {
            this.closeModal('modal-ai-diagnostics');
            window.SkyserveState.aiEngine.lastRunTimestamp = new Date().toUTCString();
            this.renderCurrentView();
          }, 800);
        }
      }, 350);
    },

    // -------------------------------------------------------------------------
    // 8. READINESS RESULT VIEW
    // -------------------------------------------------------------------------
    setupReadinessResultView: function() {
      const genReportBtn = document.getElementById('btn-readiness-generate-report');
      if (genReportBtn) {
        genReportBtn.addEventListener('click', () => {
          AudioEngine.beepClick();
          this.openReportModal();
        });
      }
    },

    renderReadinessResultPage: function() {
      const r = this.evalResult;
      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

      setEl('res-hero-score', `${r.overallScore}%`);
      const decBadge = document.getElementById('res-decision-badge');
      if (decBadge) {
        decBadge.textContent = r.decision;
        decBadge.className = `mission-decision-pill ${r.decision === 'GO' ? 'decision-go' : r.decision === 'HOLD' ? 'decision-hold' : 'decision-nogo'}`;
      }

      setEl('res-score-weather', `${r.weatherScore}%`);
      setEl('res-score-rocket', `${r.rocketScore}%`);
      setEl('res-score-avionics', `${r.avionicsScore}%`);
      setEl('res-score-telemetry', `${r.telemetryScore}%`);
      setEl('res-score-checklist', `${r.checklistScore}%`);
      setEl('res-ai-risk', r.aiRiskLevel);

      // Render Blockers List
      const blockersContainer = document.getElementById('res-critical-blockers');
      if (blockersContainer) {
        if (r.criticalBlockers.length === 0) {
          blockersContainer.innerHTML = '<div style="color: var(--green-ready); font-size: 12px;">✓ Zero critical blockers identified. Safety interlocks satisfied.</div>';
        } else {
          blockersContainer.innerHTML = r.criticalBlockers.map(b => `
            <div class="reason-item critical" style="background: rgba(255,23,68,0.1); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(255,23,68,0.3);">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
              <span><strong>[${b.subsystem}]</strong> ${b.title}</span>
            </div>
          `).join('');
        }
      }

      // Render Recommended Actions
      const actionsContainer = document.getElementById('res-recommended-actions');
      if (actionsContainer) {
        actionsContainer.innerHTML = r.recommendedActions.map((a, i) => `
          <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
            <span style="font-family: var(--font-mono); color: var(--cyan-primary); font-weight: 700;">0${i+1}.</span>
            <span>${a}</span>
          </div>
        `).join('');
      }
    },

    // -------------------------------------------------------------------------
    // 9. REPORTS & HISTORY
    // -------------------------------------------------------------------------
    setupReportsView: function() {},
    renderReportsList: function() {
      const history = window.SkyserveState.history;
      const listEl = document.getElementById('reports-history-list');
      if (!listEl) return;

      listEl.innerHTML = history.map(h => `
        <div class="glass-panel" style="margin-bottom: 12px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px;">
              <span style="font-family: var(--font-mono); color: var(--cyan-primary); font-weight: 700; font-size: 11px;">${h.id}</span>
              <span style="font-weight: 700; font-size: 13px; color: #fff;">${h.mission}</span>
              <span class="status-indicator-pill ${h.status === 'GO' ? 'status-pill-ready' : 'status-pill-warning'}">${h.status} (${h.readinessScore}%)</span>
            </div>
            <div style="font-size: 11.5px; color: var(--text-muted);">${h.summary}</div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="text-align: right; font-size: 10.5px; color: var(--text-muted);">
              <div>${h.author}</div>
              <div style="font-family: var(--font-mono);">${h.date}</div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="alert('Viewing archived flight report ${h.id}');">VIEW</button>
          </div>
        </div>
      `).join('');
    },

    openReportModal: function() {
      const r = this.evalResult;
      const s = window.SkyserveState;
      const content = document.getElementById('modal-report-content');
      if (content) {
        content.innerHTML = `
          <div style="position: relative; overflow: hidden; padding: 4px;">
            <div class="dossier-watermark">${r.decision}</div>
            
            <div class="dossier-header-bar">
              <div>
                <div style="font-family: var(--font-heading); font-size: 20px; font-weight: 900; color: #fff; letter-spacing: 2.5px;">
                  SKYSERVE AEROSPACE SYSTEMS
                </div>
                <div style="font-family: var(--font-mono); font-size: 11px; color: var(--cyan-primary); letter-spacing: 1px; margin-top: 2px;">
                  OFFICIAL FLIGHT READINESS DOSSIER & SAFETY INTERLOCK CERTIFICATE
                </div>
              </div>
              <div style="text-align: right;">
                <span class="status-indicator-pill ${r.decision === 'GO' ? 'status-pill-ready' : r.decision === 'HOLD' ? 'status-pill-warning' : 'status-pill-critical'}" style="font-size: 14px; padding: 6px 16px;">
                  DECISION: ${r.decision} (${r.overallScore}%)
                </span>
                <div style="font-family: var(--font-mono); font-size: 10px; color: var(--text-muted); margin-top: 4px;">
                  DOC-ID: SSR-FRR-${s.currentMissionId}-${Date.now().toString().slice(-6)}
                </div>
              </div>
            </div>

            <!-- Mission Specs Summary Table -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
              <div class="glass-panel" style="padding: 10px;">
                <div style="font-size: 9.5px; color: var(--text-muted); font-family: var(--font-heading);">MISSION / VEHICLE</div>
                <div style="font-size: 12px; font-weight: 700; color: #fff; margin-top: 2px;">${s.currentMissionId}</div>
                <div style="font-size: 10.5px; color: var(--cyan-primary); font-family: var(--font-mono);">${s.rocket.identification}</div>
              </div>
              <div class="glass-panel" style="padding: 10px;">
                <div style="font-size: 9.5px; color: var(--text-muted); font-family: var(--font-heading);">LAUNCH LOCATION</div>
                <div style="font-size: 12px; font-weight: 700; color: #fff; margin-top: 2px;">Pad-03A Coastal</div>
                <div style="font-size: 10.5px; color: var(--text-secondary); font-family: var(--font-mono);">Azimuth 042° NE</div>
              </div>
              <div class="glass-panel" style="padding: 10px;">
                <div style="font-size: 9.5px; color: var(--text-muted); font-family: var(--font-heading);">TARGET APOGEE</div>
                <div style="font-size: 12px; font-weight: 700; color: #fff; margin-top: 2px;">120.0 km</div>
                <div style="font-size: 10.5px; color: var(--green-ready); font-family: var(--font-mono);">Suborbital Space</div>
              </div>
              <div class="glass-panel" style="padding: 10px;">
                <div style="font-size: 9.5px; color: var(--text-muted); font-family: var(--font-heading);">CHECKLIST GATE</div>
                <div style="font-size: 12px; font-weight: 700; color: #fff; margin-top: 2px;">${r.completedItems} / ${r.totalItems} Signed</div>
                <div style="font-size: 10.5px; color: ${r.checklistScore >= 95 ? 'var(--green-ready)' : 'var(--amber-warning)'}; font-family: var(--font-mono);">${r.checklistScore}% Verified</div>
              </div>
            </div>

            <!-- Subsystems Breakdown Matrix -->
            <div style="margin-bottom: 16px;">
              <div style="font-family: var(--font-heading); font-size: 10.5px; letter-spacing: 1px; color: var(--cyan-primary); margin-bottom: 8px;">
                SUBSYSTEM READINESS AUDIT SCORES
              </div>
              <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px;">
                <div class="glass-panel" style="padding: 8px; text-align: center;">
                  <div style="font-size: 10px; color: var(--text-muted);">Weather</div>
                  <div style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; color: #fff;">${r.weatherScore}%</div>
                  <div style="font-size: 9px; color: ${r.weatherScore >= 85 ? 'var(--green-ready)' : 'var(--red-critical)'};">${r.weatherScore >= 85 ? 'PASS' : 'HOLD'}</div>
                </div>
                <div class="glass-panel" style="padding: 8px; text-align: center;">
                  <div style="font-size: 10px; color: var(--text-muted);">Rocket Prop</div>
                  <div style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; color: #fff;">${r.rocketScore}%</div>
                  <div style="font-size: 9px; color: ${r.rocketScore >= 85 ? 'var(--green-ready)' : 'var(--red-critical)'};">${r.rocketScore >= 85 ? 'PASS' : 'HOLD'}</div>
                </div>
                <div class="glass-panel" style="padding: 8px; text-align: center;">
                  <div style="font-size: 10px; color: var(--text-muted);">Avionics</div>
                  <div style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; color: #fff;">${r.avionicsScore}%</div>
                  <div style="font-size: 9px; color: ${r.avionicsScore >= 85 ? 'var(--green-ready)' : 'var(--amber-warning)'};">${r.avionicsScore >= 85 ? 'PASS' : 'WARN'}</div>
                </div>
                <div class="glass-panel" style="padding: 8px; text-align: center;">
                  <div style="font-size: 10px; color: var(--text-muted);">Telemetry</div>
                  <div style="font-family: var(--font-heading); font-size: 16px; font-weight: 700; color: #fff;">${r.telemetryScore}%</div>
                  <div style="font-size: 9px; color: ${r.telemetryScore >= 85 ? 'var(--green-ready)' : 'var(--amber-warning)'};">${r.telemetryScore >= 85 ? 'PASS' : 'WARN'}</div>
                </div>
                <div class="glass-panel" style="padding: 8px; text-align: center;">
                  <div style="font-size: 10px; color: var(--text-muted);">AI Risk Level</div>
                  <div style="font-family: var(--font-heading); font-size: 13px; font-weight: 700; color: ${r.aiRiskLevel === 'LOW RISK' ? 'var(--green-ready)' : r.aiRiskLevel === 'MEDIUM RISK' ? 'var(--amber-warning)' : 'var(--red-critical)'};">${r.aiRiskLevel}</div>
                  <div style="font-size: 9px; color: var(--text-muted);">AERO-ML 4.2</div>
                </div>
              </div>
            </div>

            <!-- Identified Blockers / Action Items -->
            ${r.criticalBlockers.length > 0 ? `
              <div style="background: rgba(255, 23, 68, 0.08); border: 1px solid rgba(255, 23, 68, 0.3); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px;">
                <div style="font-family: var(--font-heading); font-size: 10.5px; color: var(--red-critical); margin-bottom: 6px;">
                  MANDATORY SAFETY BLOCKERS (COUNTDOWN HALTED)
                </div>
                ${r.criticalBlockers.map(b => `<div style="font-size: 11.5px; color: #ff8a80; margin-bottom: 4px;">• [${b.subsystem}] ${b.title}</div>`).join('')}
              </div>
            ` : `
              <div style="background: rgba(0, 230, 118, 0.08); border: 1px solid rgba(0, 230, 118, 0.3); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px;">
                <div style="font-family: var(--font-heading); font-size: 10.5px; color: var(--green-ready);">
                  ALL MANDATORY FLIGHT GATES SATISFIED - CLEARED FOR LAUNCH COUNTDOWN
                </div>
              </div>
            `}

            <!-- 3-Role Aerospace Sign-off Certification Grid -->
            <div class="dossier-signoff-grid">
              <div class="dossier-sign-box">
                <div class="dossier-sign-role">Flight Director</div>
                <div class="dossier-sign-name">Dr. Elena Cruz, Ph.D.</div>
                <div class="dossier-sign-signature">${r.decision === 'GO' ? '✓ CERTIFIED & AUTHORIZED' : '[HOLD] SIGNATURE PENDING'}</div>
              </div>
              <div class="dossier-sign-box">
                <div class="dossier-sign-role">Chief Avionics Lead</div>
                <div class="dossier-sign-name">Saurav Roy, M.S. Aero</div>
                <div class="dossier-sign-signature">${r.avionicsScore >= 85 ? '✓ BUS SYNCHRONIZED' : '[WARN] SENSORS FLAGGED'}</div>
              </div>
              <div class="dossier-sign-box">
                <div class="dossier-sign-role">Range Safety Officer</div>
                <div class="dossier-sign-name">Cmdr. Alex Vance</div>
                <div class="dossier-sign-signature">${r.decision === 'NO-GO' ? '✕ RANGE INTERLOCK ABORT' : r.decision === 'GO' ? '✓ RANGE AIRSPACE CLEAR' : '[HOLD] RANGE STANDBY'}</div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 9.5px; color: var(--text-muted); font-family: var(--font-mono); margin-top: 14px; border-top: 1px solid var(--border-subtle); padding-top: 10px;">
              <span>SHA-256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</span>
              <span>VERIFIED BY SKYSERVE MISSION ENGINE V4.2</span>
            </div>
          </div>
        `;
      }
      this.openModal('modal-report');
    },

    // -------------------------------------------------------------------------
    // 10. DATA & LOGS
    // -------------------------------------------------------------------------
    setupDataLogsView: function() {
      const searchInput = document.getElementById('logs-search-filter');
      if (searchInput) {
        searchInput.addEventListener('input', () => {
          this.renderDataLogsTable();
        });
      }
      const catSelect = document.getElementById('logs-category-select');
      if (catSelect) {
        catSelect.addEventListener('change', () => {
          this.renderDataLogsTable();
        });
      }
    },

    renderDataLogsTable: function() {
      const s = window.SkyserveState;
      const tbody = document.getElementById('logs-table-body');
      if (!tbody) return;

      const query = (document.getElementById('logs-search-filter')?.value || "").toLowerCase();
      const cat = document.getElementById('logs-category-select')?.value || "ALL";

      let logs = s.logs;
      if (cat !== "ALL") logs = logs.filter(l => l.category === cat);
      if (query) logs = logs.filter(l => l.message.toLowerCase().includes(query) || l.category.toLowerCase().includes(query));

      tbody.innerHTML = logs.map(l => `
        <tr>
          <td style="font-family: var(--font-mono); color: var(--cyan-primary); font-size: 11px;">LOG-${l.id}</td>
          <td style="font-family: var(--font-mono); font-size: 10.5px; color: var(--text-muted);">${l.time}</td>
          <td><span class="status-indicator-pill ${l.level === 'WARN' ? 'status-pill-warning' : l.level === 'CRIT' ? 'status-pill-critical' : 'status-pill-info'}">${l.category}</span></td>
          <td style="color: #fff; font-size: 11.5px;">${l.message}</td>
        </tr>
      `).join('');
    },

    // -------------------------------------------------------------------------
    // 11. AUTHENTICATION & ROLES
    // -------------------------------------------------------------------------
    setupAuthView: function() {
      // Mock role switching behavior disabled in favor of real session authentication
    },

    renderAuthPage: function() {
      const curRole = window.SkyserveState.currentUser.role;
      document.querySelectorAll('.auth-role-card').forEach(card => {
        const isMatch = (card.getAttribute('data-role') || '').toUpperCase() === (curRole || '').toUpperCase();
        card.style.borderColor = isMatch ? 'var(--cyan-primary)' : 'var(--border-subtle)';
        card.style.boxShadow = isMatch ? '0 0 20px rgba(0,229,255,0.25)' : 'none';
      });
    },

    // -------------------------------------------------------------------------
    // 12. SETTINGS
    // -------------------------------------------------------------------------
    setupSettingsView: function() {},
    renderSettingsPage: function() {},

    // -------------------------------------------------------------------------
    // MODAL WINDOW MANAGEMENT
    // -------------------------------------------------------------------------
    setupModals: function() {
      document.querySelectorAll('.mc-modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay) {
            this.closeModal(overlay.id);
          }
        });
      });

      document.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const overlay = btn.closest('.mc-modal-overlay');
          if (overlay) this.closeModal(overlay.id);
        });
      });
    },

    openModal: function(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('modal-active');
      }
    },

    closeModal: function(modalId) {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.remove('modal-active');
      }
    },

    // -------------------------------------------------------------------------
    // SCENARIO INJECTOR & STRESS-TESTING SUITE
    // -------------------------------------------------------------------------
    setupScenarioInjector: function() {
      const btns = document.querySelectorAll('.scenario-btn');
      btns.forEach(btn => {
        btn.addEventListener('click', () => {
          const scen = btn.getAttribute('data-scenario');
          if (scen) this.injectScenario(scen);
        });
      });
    },

    injectScenario: function(scenarioKey) {
      const s = window.SkyserveState;
      s.simulation.activeScenario = scenarioKey;

      document.querySelectorAll('.scenario-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-scenario') === scenarioKey);
      });

      const nowTime = new Date().toTimeString().split(' ')[0];

      if (scenarioKey === 'nominal_go') {
        s.weather.windSpeedKmH = 12.4;
        s.weather.lightningRiskKm = 65;
        s.weather.precipitationMmH = 0.0;
        s.rocket.structuralIntegrityPct = 100;
        s.rocket.motorChamberPressureBar = 48.5;
        s.rocket.stabilityMarginCalibers = 2.15;
        s.avionics.batteryTotalVoltage = 14.84;
        s.avionics.batteryCell1V = 3.71;
        s.avionics.batteryCell2V = 3.71;
        s.avionics.batteryCell3V = 3.71;
        s.avionics.batteryCell4V = 3.71;
        s.avionics.batteryState = "READY";
        s.telemetry.signalRssi = -64;
        s.telemetry.packetRateSec = 49.8;
        s.telemetry.packetLossPct = 0.01;
        s.telemetry.groundLinkUhf = "ONLINE";
        s.checklist.forEach(item => { item.completed = true; });
        s.attitude.pitchDeg = 89.8;
        s.attitude.rollDeg = 0.0;
        s.trajectory.flightState = "COUNTDOWN-ARMED";
        s.logs.unshift({
          id: Date.now() % 10000,
          time: nowTime,
          category: "SCENARIO",
          level: "INFO",
          message: "Injected Scenario [NOMINAL ALL GREEN]: All 22 checklist items verified; sensor buses balanced; GO authorized."
        });
        AudioEngine.beepSuccess();
      } else if (scenarioKey === 'wind_shear_lightning') {
        s.weather.windSpeedKmH = 36.4;
        s.weather.windGustKmH = 48.2;
        s.weather.lightningRiskKm = 14;
        s.weather.precipitationMmH = 2.4;
        s.logs.unshift({
          id: Date.now() % 10000,
          time: nowTime,
          category: "SCENARIO",
          level: "WARN",
          message: "Injected Scenario [WIND SHEAR & LIGHTNING]: Atmospheric array detected 36.4 km/h gusts & storm cell at 14 km. Meteorological NO-GO enforced."
        });
        AudioEngine.beepCritical();
      } else if (scenarioKey === 'avionics_sag') {
        s.avionics.batteryTotalVoltage = 13.82;
        s.avionics.batteryCell3V = 3.15;
        s.avionics.batteryState = "CRITICAL";
        s.logs.unshift({
          id: Date.now() % 10000,
          time: nowTime,
          category: "SCENARIO",
          level: "CRIT",
          message: "Injected Scenario [AVIONICS BUS SAG]: 4S LiPo Cell #3 collapsed to 3.15V. Total bus voltage 13.82V. Hardware interlock NO-GO."
        });
        AudioEngine.beepCritical();
      } else if (scenarioKey === 'rf_blackout') {
        s.telemetry.signalRssi = -96;
        s.telemetry.packetRateSec = 18.2;
        s.telemetry.packetLossPct = 14.8;
        s.telemetry.groundLinkUhf = "OFFLINE";
        s.logs.unshift({
          id: Date.now() % 10000,
          time: nowTime,
          category: "SCENARIO",
          level: "WARN",
          message: "Injected Scenario [RF JAMMING / TELEMETRY BLACKOUT]: S-band RSSI collapsed to -96 dBm. Packet loss jumped to 14.8%. Range safety HOLD."
        });
        AudioEngine.beepWarning();
      } else if (scenarioKey === 'chamber_overpressure') {
        s.rocket.motorChamberPressureBar = 64.2;
        s.rocket.motorTempC = 42.8;
        s.logs.unshift({
          id: Date.now() % 10000,
          time: nowTime,
          category: "SCENARIO",
          level: "CRIT",
          message: "Injected Scenario [CHAMBER OVERPRESSURE]: Propulsion manifold flagged 64.2 bar chamber overpressure anomaly. Ignition abort NO-GO."
        });
        AudioEngine.beepCritical();
      } else if (scenarioKey === 'baseline_hold') {
        s.weather.windSpeedKmH = 14.8;
        s.weather.lightningRiskKm = 48;
        s.weather.precipitationMmH = 0.0;
        s.rocket.structuralIntegrityPct = 100;
        s.rocket.motorChamberPressureBar = 48.5;
        s.rocket.stabilityMarginCalibers = 2.14;
        s.avionics.batteryTotalVoltage = 14.72;
        s.avionics.batteryCell1V = 3.71;
        s.avionics.batteryCell2V = 3.70;
        s.avionics.batteryCell3V = 3.61;
        s.avionics.batteryCell4V = 3.70;
        s.avionics.batteryState = "WARNING";
        s.telemetry.signalRssi = -68;
        s.telemetry.packetRateSec = 48.2;
        s.telemetry.packetLossPct = 0.04;
        s.telemetry.groundLinkUhf = "WARNING";
        s.checklist.forEach(item => {
          item.completed = (item.id !== 'CHK-09' && item.id !== 'CHK-13' && item.id !== 'CHK-19' && item.id !== 'CHK-22');
        });
        s.attitude.pitchDeg = 89.4;
        s.attitude.rollDeg = 0.2;
        s.trajectory.flightState = "PAD-STANDBY";
        s.logs.unshift({
          id: Date.now() % 10000,
          time: nowTime,
          category: "SCENARIO",
          level: "INFO",
          message: "Restored baseline mission parameters (Countdown HOLD - 82%)."
        });
        AudioEngine.beepClick();
      }

      this.evalResult = window.SkyserveEngine.evaluateReadiness();
      this.updateHeaderSummary();
      this.renderCurrentView();
    },

    // -------------------------------------------------------------------------
    // SIMULATION SPEED & TELEMETRY CLOCK CONTROLS
    // -------------------------------------------------------------------------
    setupSimulationControls: function() {
      const s = window.SkyserveState;
      const pauseBtn = document.getElementById('btn-sim-pause');
      if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
          AudioEngine.beepClick();
          s.simulation.paused = !s.simulation.paused;
          pauseBtn.textContent = s.simulation.paused ? "▶" : "⏸";
          pauseBtn.title = s.simulation.paused ? "Resume Simulation" : "Pause Simulation";
        });
      }

      ['1x', '2x', '5x'].forEach(spd => {
        const btn = document.getElementById(`btn-sim-${spd}`);
        if (btn) {
          btn.addEventListener('click', () => {
            AudioEngine.beepClick();
            s.simulation.speed = parseInt(spd);
            document.querySelectorAll('.sim-playback-group .sim-btn').forEach(b => {
              if (b.id !== 'btn-sim-pause') b.classList.remove('active');
            });
            btn.classList.add('active');
          });
        }
      });
    },

    // -------------------------------------------------------------------------
    // OSCILLOSCOPE CHANNEL SWITCHER
    // -------------------------------------------------------------------------
    setupOscilloscopeChannelTabs: function() {
      const tabs = document.querySelectorAll('.channel-tab-btn');
      tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          AudioEngine.beepClick();
          tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          const channel = tab.getAttribute('data-osc-channel');
          if (channel) {
            window.SkyserveState.oscilloscope.selectedChannel = channel;
            this.drawTelemetryOscilloscope('canvas-telemetry-stream');
          }
        });
      });
    },

    // -------------------------------------------------------------------------
    // DATA EXPORT & IMPORT (CSV, JSON)
    // -------------------------------------------------------------------------
    downloadTelemetryCSV: function() {
      const s = window.SkyserveState;
      const r = this.evalResult || window.SkyserveEngine.evaluateReadiness();
      const records = s.telemetryRecordings && s.telemetryRecordings.length > 0 ? s.telemetryRecordings : [
        {
          timestamp: new Date().toISOString(),
          mission: s.currentMissionId,
          readinessScore: r.overallScore,
          decision: r.decision,
          windSpeedKmH: s.weather.windSpeedKmH,
          temperatureC: s.weather.temperatureC,
          stabilityMarginCalibers: s.rocket.stabilityMarginCalibers,
          motorChamberPressureBar: s.rocket.motorChamberPressureBar,
          batteryTotalVoltage: s.avionics.batteryTotalVoltage,
          batteryCell3V: s.avionics.batteryCell3V,
          signalRssi: s.telemetry.signalRssi,
          packetRateSec: s.telemetry.packetRateSec,
          packetLossPct: s.telemetry.packetLossPct,
          pitchDeg: s.attitude.pitchDeg,
          rollDeg: s.attitude.rollDeg,
          yawDeg: s.attitude.yawDeg
        }
      ];

      const headers = [
        "Timestamp", "Mission", "ReadinessScore", "Decision",
        "WindSpeed_kmh", "Temperature_C", "Stability_cal", "ChamberPressure_bar",
        "BatteryTotal_V", "BatteryCell3_V", "SignalRSSI_dBm", "PacketRate_pkts_s",
        "PacketLoss_pct", "Pitch_deg", "Roll_deg", "Yaw_deg"
      ];

      const csvRows = [headers.join(',')];
      records.forEach(rec => {
        csvRows.push([
          rec.timestamp, rec.mission, rec.readinessScore, rec.decision,
          rec.windSpeedKmH, rec.temperatureC, rec.stabilityMarginCalibers, rec.motorChamberPressureBar,
          rec.batteryTotalVoltage, rec.batteryCell3V, rec.signalRssi, rec.packetRateSec,
          rec.packetLossPct, rec.pitchDeg, rec.rollDeg, rec.yawDeg
        ].join(','));
      });

      const csvBlob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(csvBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `skyserve_telemetry_${s.currentMissionId}_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      AudioEngine.beepSuccess();
      s.logs.unshift({
        id: Date.now() % 10000,
        time: new Date().toTimeString().split(' ')[0],
        category: "TELEMETRY",
        level: "INFO",
        message: `Exported ${records.length} flight telemetry records to CSV format.`
      });
      this.renderCurrentView();
    },

    exportMissionJSON: function() {
      const s = window.SkyserveState;
      const jsonBlob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(jsonBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `skyserve_state_snapshot_${s.currentMissionId}_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      AudioEngine.beepSuccess();
    },

    importMissionJSON: function(event) {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          Object.assign(window.SkyserveState, imported);
          this.evalResult = window.SkyserveEngine.evaluateReadiness();
          this.updateHeaderSummary();
          this.renderCurrentView();
          AudioEngine.beepSuccess();
          alert("Mission state configuration successfully loaded from JSON snapshot!");
        } catch (err) {
          alert("Error loading JSON state file: " + err.message);
        }
      };
      reader.readAsText(file);
    },

    // -------------------------------------------------------------------------
    // CLOCK & TELEMETRY LIVE TICK
    // -------------------------------------------------------------------------
    startClockAndTelemetryLoop: function() {
      setInterval(() => {
        const now = new Date();
        const clockEl = document.getElementById('header-utc-clock');
        if (clockEl) {
          clockEl.textContent = now.toUTCString().split(' ')[4] + " UTC";
        }

        const s = window.SkyserveState;
        if (!s) return;

        // Skip simulation advancements if paused
        if (s.simulation && s.simulation.paused) return;

        const countEl = document.getElementById('header-tminus-clock');
        if (countEl) {
          const isHold = this.evalResult && (this.evalResult.decision === "HOLD" || this.evalResult.decision === "NO-GO");
          countEl.textContent = isHold ? `T-00:42:15 [${this.evalResult.decision}]` : "T-00:42:15 [ACTIVE]";
          countEl.classList.toggle('countdown-hold', isHold);
        }

        // Jitter live telemetry packet rates slightly for realistic aerospace telemetry
        if (Math.random() > 0.4) {
          s.telemetry.packetRateSec = +(48.0 + Math.random() * 1.8).toFixed(1);
          s.avionics.flightComputerCpuUsagePct = +(17.5 + Math.random() * 2.2).toFixed(1);
        }

        // Record telemetry row for CSV export buffer
        if (s.telemetryRecordings) {
          s.telemetryRecordings.push({
            timestamp: now.toISOString(),
            mission: s.currentMissionId,
            readinessScore: this.evalResult ? this.evalResult.overallScore : 82,
            decision: this.evalResult ? this.evalResult.decision : "HOLD",
            windSpeedKmH: s.weather.windSpeedKmH,
            temperatureC: s.weather.temperatureC,
            stabilityMarginCalibers: s.rocket.stabilityMarginCalibers,
            motorChamberPressureBar: s.rocket.motorChamberPressureBar,
            batteryTotalVoltage: s.avionics.batteryTotalVoltage,
            batteryCell3V: s.avionics.batteryCell3V,
            signalRssi: s.telemetry.signalRssi,
            packetRateSec: s.telemetry.packetRateSec,
            packetLossPct: s.telemetry.packetLossPct,
            pitchDeg: s.attitude.pitchDeg,
            rollDeg: s.attitude.rollDeg,
            yawDeg: s.attitude.yawDeg
          });
          if (s.telemetryRecordings.length > 300) s.telemetryRecordings.shift();
        }

        // Live refresh active canvases
        if (this.currentView === 'dashboard') {
          this.drawTrajectoryProfile('canvas-trajectory');
          this.drawAttitudeHorizon('canvas-attitude-horizon');
          this.drawTrendChart('canvas-dash-trend');
        } else if (this.currentView === 'telemetry') {
          this.drawTelemetryOscilloscope('canvas-telemetry-stream');
        } else if (this.currentView === 'avionics') {
          this.drawBatteryWaveform('canvas-battery-wave');
        }
      }, 1000);
    },

    // -------------------------------------------------------------------------
    // CANVAS VISUALIZERS (HTML5 Canvas)
    // -------------------------------------------------------------------------
    drawTrendChart: function(canvasId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width = canvas.offsetWidth;
      const h = canvas.height = canvas.offsetHeight;
      if (w === 0 || h === 0) return;

      ctx.clearRect(0, 0, w, h);

      // Draw subtle grid lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      for (let y = 20; y < h; y += 35) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const currentScore = (this.evalResult && this.evalResult.overallScore) || 82;
      const dataPoints = [72, 74, 76, 75, 79, 81, 80, 84, 83, currentScore];
      const stepX = w / (dataPoints.length - 1);

      // Area gradient
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(0, 229, 255, 0.25)');
      grad.addColorStop(1, 'rgba(0, 229, 255, 0.0)');

      ctx.beginPath();
      dataPoints.forEach((val, i) => {
        const x = i * stepX;
        const y = h - (val / 100) * (h - 20) - 10;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Stroke line
      ctx.beginPath();
      dataPoints.forEach((val, i) => {
        const x = i * stepX;
        const y = h - (val / 100) * (h - 20) - 10;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glow current point
      const lastX = (dataPoints.length - 1) * stepX;
      const lastY = h - (dataPoints[dataPoints.length - 1] / 100) * (h - 20) - 10;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.shadowBlur = 0;
    },

    drawTrajectoryProfile: function(canvasId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width = canvas.offsetWidth;
      const h = canvas.height = canvas.offsetHeight;
      if (w === 0 || h === 0) return;

      ctx.clearRect(0, 0, w, h);

      // Background grid lines
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let y = 30; y < h; y += 35) {
        ctx.beginPath();
        ctx.moveTo(35, y);
        ctx.lineTo(w - 15, y);
        ctx.stroke();
      }
      for (let x = 35; x < w; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 15);
        ctx.lineTo(x, h - 25);
        ctx.stroke();
      }

      // Altitude axis labels (0 to 120 km)
      ctx.font = '8.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'right';
      ctx.fillText('120k', 30, 30);
      ctx.fillText('60k', 30, (h - 25) / 2 + 10);
      ctx.fillText('0km', 30, h - 25);

      // Ground baseline
      ctx.beginPath();
      ctx.moveTo(35, h - 25);
      ctx.lineTo(w - 15, h - 25);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Launch Pad point
      const padX = 45;
      const padY = h - 25;
      ctx.beginPath();
      ctx.arc(padX, padY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00e5ff';
      ctx.fill();

      // Projected Trajectory Parabola (Bezier curve)
      const apogeeX = w * 0.62;
      const apogeeY = 28;
      const impactX = w - 30;
      const impactY = h - 25;

      // Trajectory gradient fill
      const grad = ctx.createLinearGradient(0, 20, 0, h - 25);
      grad.addColorStop(0, 'rgba(0, 229, 255, 0.22)');
      grad.addColorStop(1, 'rgba(0, 229, 255, 0.01)');

      ctx.beginPath();
      ctx.moveTo(padX, padY);
      ctx.quadraticCurveTo(padX + (apogeeX - padX) * 0.4, apogeeY, apogeeX, apogeeY);
      ctx.quadraticCurveTo(apogeeX + (impactX - apogeeX) * 0.6, apogeeY + 10, impactX, impactY);
      ctx.lineTo(padX, padY);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Trajectory curve line
      ctx.beginPath();
      ctx.moveTo(padX, padY);
      ctx.quadraticCurveTo(padX + (apogeeX - padX) * 0.4, apogeeY, apogeeX, apogeeY);
      ctx.quadraticCurveTo(apogeeX + (impactX - apogeeX) * 0.6, apogeeY + 10, impactX, impactY);
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.2;
      ctx.shadowColor = 'rgba(0, 229, 255, 0.5)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Annotations: Max Q (~11.5 km)
      const maxQX = padX + (apogeeX - padX) * 0.22;
      const maxQY = padY - (padY - apogeeY) * 0.32;
      ctx.beginPath();
      ctx.arc(maxQX, maxQY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb300';
      ctx.fill();
      ctx.font = '8px "Orbitron", sans-serif';
      ctx.fillStyle = '#ffb300';
      ctx.textAlign = 'center';
      ctx.fillText('MAX Q (11.5k)', maxQX, maxQY - 8);

      // Annotations: Stage 1 Separation (~35 km)
      const sepX = padX + (apogeeX - padX) * 0.48;
      const sepY = padY - (padY - apogeeY) * 0.65;
      ctx.beginPath();
      ctx.arc(sepX, sepY, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#2979ff';
      ctx.fill();
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('STAGE 1 SEP', sepX, sepY - 8);

      // Annotations: Target Apogee (120 km)
      ctx.beginPath();
      ctx.arc(apogeeX, apogeeY, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#00e676';
      ctx.fill();
      ctx.fillStyle = '#00e676';
      ctx.fillText('APOGEE 120 KM', apogeeX, apogeeY - 9);

      // Pulsing Vehicle Beacon
      const t = Date.now() * 0.003;
      const pulseR = 5 + Math.sin(t) * 2.5;
      ctx.beginPath();
      ctx.arc(padX, padY, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const apogeeEl = document.getElementById('hud-traj-apogee');
      if (apogeeEl && window.SkyserveState.trajectory) {
        apogeeEl.textContent = `${window.SkyserveState.trajectory.projectedApogeeKm} km`;
      }
      const statusEl = document.getElementById('hud-traj-status');
      if (statusEl && window.SkyserveState.trajectory) {
        statusEl.textContent = window.SkyserveState.trajectory.flightState;
      }
    },

    drawAttitudeHorizon: function(canvasId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width = canvas.offsetWidth;
      const h = canvas.height = canvas.offsetHeight;
      if (w === 0 || h === 0) return;

      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy) - 10;

      const s = window.SkyserveState;
      const pitch = (s.attitude && s.attitude.pitchDeg) || 89.4;
      const roll = (s.attitude && s.attitude.rollDeg) || 0.2;
      const yaw = (s.attitude && s.attitude.yawDeg) || 42.0;

      // Circular instrument mask
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();

      // Sky hemisphere
      const skyGrad = ctx.createLinearGradient(0, cy - r, 0, cy + r);
      skyGrad.addColorStop(0, '#0a1d37');
      skyGrad.addColorStop(0.5, '#103158');
      skyGrad.addColorStop(1, '#05101f');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

      // Pitch and roll transformation
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((roll * Math.PI) / 180);

      // Ground hemisphere split based on pitch
      const pitchOffset = (pitch - 90) * 1.5;
      ctx.fillStyle = 'rgba(15, 25, 45, 0.85)';
      ctx.fillRect(-r, pitchOffset, r * 2, r * 2);

      // Horizon line
      ctx.beginPath();
      ctx.moveTo(-r, pitchOffset);
      ctx.lineTo(r, pitchOffset);
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Pitch ladder ticks
      ctx.font = '8px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      for (let p = -30; p <= 30; p += 10) {
        if (p === 0) continue;
        const py = pitchOffset - p * 1.8;
        const tickW = p % 20 === 0 ? 30 : 18;
        ctx.beginPath();
        ctx.moveTo(-tickW, py);
        ctx.lineTo(tickW, py);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillText(Math.abs(p) + '°', tickW + 10, py + 3);
      }

      ctx.restore();

      // Center crosshair / aircraft reticle
      ctx.strokeStyle = '#ffb300';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - 16, cy);
      ctx.lineTo(cx - 5, cy);
      ctx.moveTo(cx + 5, cy);
      ctx.lineTo(cx + 16, cy);
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx, cy - 3);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffb300';
      ctx.fill();

      ctx.restore(); // Restore clip

      // Outer bezel ring
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.35)';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Heading tape / Compass azimuth badge at bottom
      ctx.font = '9px "Orbitron", sans-serif';
      ctx.fillStyle = '#00e5ff';
      ctx.textAlign = 'center';
      ctx.fillText(`HDG: ${yaw.toFixed(1)}° NE`, cx, cy + r - 8);

      // Update overlay element labels
      const pitchEl = document.getElementById('hud-att-pitch');
      if (pitchEl) pitchEl.textContent = `${pitch.toFixed(1)}°`;
      const rollEl = document.getElementById('hud-att-roll');
      if (rollEl) rollEl.textContent = `${roll.toFixed(1)}°`;
      const yawEl = document.getElementById('hud-att-yaw');
      if (yawEl) yawEl.textContent = `${yaw.toFixed(1)}°`;
    },

    drawBatteryWaveform: function(canvasId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width = canvas.offsetWidth;
      const h = canvas.height = canvas.offsetHeight;
      if (w === 0 || h === 0) return;

      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#ffb300';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const dip = (x > w * 0.45 && x < w * 0.65) ? 14 : 0;
        const y = (h / 2) + Math.sin(x * 0.08) * 4 + dip;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    },

    drawWindCompass: function(canvasId, angleDeg, speed) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width = canvas.offsetWidth;
      const h = canvas.height = canvas.offsetHeight;
      if (w === 0 || h === 0) return;

      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(cx, cy) - 14;

      ctx.clearRect(0, 0, w, h);

      // Dial circle
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Cardinal marks
      ctx.font = '9px "Orbitron", sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.fillText('N', cx, cy - r + 10);
      ctx.fillText('S', cx, cy + r - 3);
      ctx.fillText('E', cx + r - 8, cy + 3);
      ctx.fillText('W', cx - r + 8, cy + 3);

      // Wind Vector Arrow
      const rad = (angleDeg - 90) * (Math.PI / 180);
      const tipX = cx + Math.cos(rad) * (r - 18);
      const tipY = cy + Math.sin(rad) * (r - 18);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tipX, tipY);
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Arrow head
      ctx.beginPath();
      ctx.arc(tipX, tipY, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00e5ff';
      ctx.fill();
    },

    drawTelemetryOscilloscope: function(canvasId) {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width = canvas.offsetWidth;
      const h = canvas.height = canvas.offsetHeight;
      if (w === 0 || h === 0) return;

      ctx.clearRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let y = 15; y < h; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const s = window.SkyserveState;
      const channel = (s.oscilloscope && s.oscilloscope.selectedChannel) || 'battery';

      let strokeColor = '#00e676';
      let freq = 0.05;
      let amp = 20;
      let baselineY = h / 2;

      if (channel === 'battery') {
        const isSag = s.avionics.batteryState === 'CRITICAL' || s.avionics.batteryState === 'WARNING';
        strokeColor = isSag ? '#ffb300' : '#00e676';
        amp = isSag ? 26 : 8;
        freq = 0.08;
      } else if (channel === 'pressure') {
        const isOver = s.rocket.motorChamberPressureBar > 55.0;
        strokeColor = isOver ? '#ff1744' : '#00e5ff';
        amp = isOver ? 36 : 14;
        freq = 0.12;
      } else if (channel === 'rf_rssi') {
        const isWeak = s.telemetry.signalRssi < -85;
        strokeColor = isWeak ? '#ff5252' : '#2979ff';
        amp = isWeak ? 32 : 12;
        freq = 0.06;
      } else if (channel === 'vibration') {
        strokeColor = '#c084fc';
        amp = 20;
        freq = 0.22;
      }

      // Draw real-time oscillating waveform
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.8;
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 8;

      const phase = Date.now() * 0.005;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const noise = (Math.random() - 0.5) * 3;
        const y = baselineY + Math.sin(x * freq + phase) * amp + noise;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Channel name indicator
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = strokeColor;
      ctx.textAlign = 'left';
      ctx.fillText(`CHANNEL: ${channel.toUpperCase()} | SYNC LOCKED`, 10, 18);
    }
  };

  // Expose and boot on DOM ready
  window.SkyserveApp = App;
  document.addEventListener('DOMContentLoaded', () => {
    App.init();
  });
})();
