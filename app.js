/**
 * GRADEFLOW — SENIOR FRONTEND/FULLSTACK GRADE PARSER & ANALYTICS
 * Google Classroom Parser • Multi-Group Management • Geist Minimalist UI
 */

(() => {
  'use strict';

  // Global State
  const state = {
    groups: [],
    activeGroupId: null,
    searchQuery: '',
    currentSort: 'name_asc', // 'name_asc' | 'name_desc' | 'avg_desc' | 'avg_asc'
    currentFilter: 'all', // 'all' | 'passed' | 'failed'
    settings: {
      treatMissingAsZero: true,
      roundAverages: true, // true: redondeado oficial CBTis (enteros), false: sin redondear (con decimales)
      minPassingGrade: 6.0
    }
  };

  // DOM Elements Cache
  const el = {
    // Sidebar
    sidebarGroupCount: document.getElementById('sidebarGroupCount'),
    groupsNavList: document.getElementById('groupsNavList'),
    btnClearAllGroups: document.getElementById('btnClearAllGroups'),
    btnClearAllGroupsHeader: document.getElementById('btnClearAllGroupsHeader'),
    btnOpenUploadModal: document.getElementById('btnOpenUploadModal'),

    // Top Nav
    activeGroupName: document.getElementById('activeGroupName'),
    activeGroupMeta: document.getElementById('activeGroupMeta'),
    toggleMissingAsZero: document.getElementById('toggleMissingAsZero'),
    toggleRoundAverages: document.getElementById('toggleRoundAverages'),
    labelRoundAverages: document.getElementById('labelRoundAverages'),
    tabRoundAvg: document.getElementById('tabRoundAvg'),
    tabRawAvg: document.getElementById('tabRawAvg'),
    badgeAvgMode: document.getElementById('badgeAvgMode'),
    inputMinPassing: document.getElementById('inputMinPassing'),
    btnAddNewTask: document.getElementById('btnAddNewTask'),
    btnExportGroup: document.getElementById('btnExportGroup'),
    btnDeleteCurrentGroup: document.getElementById('btnDeleteCurrentGroup'),

    // Empty View & Dropzone
    emptyStateView: document.getElementById('emptyStateView'),
    emptyDropCard: document.getElementById('emptyDropCard'),
    emptyFileInput: document.getElementById('emptyFileInput'),
    btnEmptyBrowse: document.getElementById('btnEmptyBrowse'),

    // Workspace & Metrics
    groupWorkspace: document.getElementById('groupWorkspace'),
    kpiGroupAvg: document.getElementById('kpiGroupAvg'),
    kpiAvgStatus: document.getElementById('kpiAvgStatus'),
    kpiAvgSub: document.getElementById('kpiAvgSub'),
    kpiTotalStudents: document.getElementById('kpiTotalStudents'),
    kpiTaskCount: document.getElementById('kpiTaskCount'),
    kpiPassRateNumber: document.getElementById('kpiPassRateNumber'),
    kpiPassRateBadge: document.getElementById('kpiPassRateBadge'),
    kpiPassRateFill: document.getElementById('kpiPassRateFill'),
    kpiPassRateSub: document.getElementById('kpiPassRateSub'),
    kpiMinPassTag: document.getElementById('kpiMinPassTag'),
    kpiPassCount: document.getElementById('kpiPassCount'),
    kpiFailCount: document.getElementById('kpiFailCount'),
    kpiPassSplitSub: document.getElementById('kpiPassSplitSub'),
    kpiZeroCount: document.getElementById('kpiZeroCount'),
    kpiZeroBadge: document.getElementById('kpiZeroBadge'),
    kpiZeroSub: document.getElementById('kpiZeroSub'),

    // Toolbar
    tableSearchInput: document.getElementById('tableSearchInput'),
    btnSortNameAsc: document.getElementById('btnSortNameAsc'),
    btnSortNameDesc: document.getElementById('btnSortNameDesc'),
    btnSortAvgDesc: document.getElementById('btnSortAvgDesc'),
    btnSortAvgAsc: document.getElementById('btnSortAvgAsc'),
    countAll: document.getElementById('countAll'),
    countPassed: document.getElementById('countPassed'),
    countFailed: document.getElementById('countFailed'),
    countZero: document.getElementById('countZero'),

    // Table
    theadDatesRow: document.getElementById('theadDatesRow'),
    theadTasksRow: document.getElementById('theadTasksRow'),
    thStudentName: document.getElementById('thStudentName'),
    thStudentAvg: document.getElementById('thStudentAvg'),
    nameSortIndicator: document.getElementById('nameSortIndicator'),
    avgSortIndicator: document.getElementById('avgSortIndicator'),
    gradesTableBody: document.getElementById('gradesTableBody'),
    tableSearchEmpty: document.getElementById('tableSearchEmpty'),

    // Modal
    uploadModal: document.getElementById('uploadModal'),
    btnCloseUploadModal: document.getElementById('btnCloseUploadModal'),
    btnCancelUpload: document.getElementById('btnCancelUpload'),
    inputCustomGroupName: document.getElementById('inputCustomGroupName'),
    modalDropZone: document.getElementById('modalDropZone'),
    modalFileInput: document.getElementById('modalFileInput'),
    btnModalBrowse: document.getElementById('btnModalBrowse'),

    // Toasts
    toastStack: document.getElementById('toastStack')
  };

  /* ==========================================================================
     Storage & State Persistence
     ========================================================================== */
  function loadPersistedState() {
    try {
      const savedGroups = localStorage.getItem('gradeflow_groups');
      const savedActive = localStorage.getItem('gradeflow_active_group');
      const savedSettings = localStorage.getItem('gradeflow_settings');

      if (savedSettings) {
        state.settings = { ...state.settings, ...JSON.parse(savedSettings) };
      }
      if (typeof state.settings.roundAverages !== 'boolean') {
        state.settings.roundAverages = true;
      }

      if (savedGroups) {
        const parsed = JSON.parse(savedGroups);
        // Exclude any previous demo groups
        state.groups = Array.isArray(parsed) ? parsed.filter(g => !g.id.startsWith('grp_demo_')) : [];
      } else {
        state.groups = [];
      }

      if (savedActive && state.groups.some(g => g.id === savedActive)) {
        state.activeGroupId = savedActive;
      } else if (state.groups.length > 0) {
        state.activeGroupId = state.groups[0].id;
      } else {
        state.activeGroupId = null;
      }

      // Persist cleaned state immediately
      persistState();
    } catch (e) {
      console.warn('Error reading from localStorage', e);
    }

    // Apply settings to UI
    el.toggleMissingAsZero.checked = state.settings.treatMissingAsZero;
    el.inputMinPassing.value = state.settings.minPassingGrade;
    syncRoundingControls();
  }

  function persistState() {
    try {
      localStorage.setItem('gradeflow_groups', JSON.stringify(state.groups));
      if (state.activeGroupId) {
        localStorage.setItem('gradeflow_active_group', state.activeGroupId);
      } else {
        localStorage.removeItem('gradeflow_active_group');
      }
      localStorage.setItem('gradeflow_settings', JSON.stringify(state.settings));
    } catch (e) {
      console.warn('Error saving to localStorage', e);
    }
  }

  /* ==========================================================================
     Theme Management (Solo Tema Blanco)
     ========================================================================== */
  function initTheme() {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.removeItem('gradeflow_theme');
  }

  function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    el.toastStack.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  /* ==========================================================================
     Google Classroom & Excel Parser
     ========================================================================== */
  function parseSpreadsheet(dataBuffer, fileName, customGroupName = '') {
    const workbook = XLSX.read(dataBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    
    // Parse as raw 2D array of rows
    const rawAoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!rawAoa || rawAoa.length === 0) {
      throw new Error('La hoja de cálculo está vacía.');
    }

    // Deduce group name
    let cleanGroupName = customGroupName.trim();
    if (!cleanGroupName) {
      cleanGroupName = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
    }

    // Inspect if row 3 is Google Classroom "Promedio de la clase"
    // Classroom Export Pattern:
    // Row 0 (Fila 1): Fechas de entrega (Col C en adelante)
    // Row 1 (Fila 2): Títulos de tareas (Col C en adelante)
    // Row 2 (Fila 3): "Promedio de la clase"
    // Row 3+ (Fila 4+): Alumnos (Col A = Apellidos, Col B = Nombres, Col C+ = Notas)
    
    const row0 = rawAoa[0] || [];
    const row1 = rawAoa[1] || [];
    const row2 = rawAoa[2] || [];

    const row2Join = row2.map(c => String(c).toLowerCase()).join(' ');
    const isClassroomFormat = row2Join.includes('promedio') || row2Join.includes('average');

    let taskDates = [];
    let taskNames = [];
    let studentStartRow = 3;

    if (isClassroomFormat && rawAoa.length >= 4) {
      // Standard Classroom Export
      studentStartRow = 3; // Row index 3 (Fila 4)
      const maxCols = Math.max(row0.length, row1.length);
      for (let c = 2; c < maxCols; c++) {
        const rawDate = row0[c] ? String(row0[c]).trim() : '';
        const rawTitle = row1[c] ? String(row1[c]).trim() : `Tarea ${c - 1}`;
        if (rawTitle || rawDate) {
          taskDates.push(rawDate);
          taskNames.push(rawTitle);
        }
      }
    } else {
      // Standard single-header format
      studentStartRow = 1;
      const headers = rawAoa[0] || [];
      for (let c = 2; c < headers.length; c++) {
        taskDates.push('');
        taskNames.push(String(headers[c] || `Tarea ${c - 1}`).trim());
      }
    }

    // Build Task Definitions
    const tasks = taskNames.map((name, idx) => ({
      id: `task_${idx + 1}`,
      name: name || `Tarea ${idx + 1}`,
      date: taskDates[idx] || '-'
    }));

    // Parse Student Rows
    const students = [];
    for (let r = studentStartRow; r < rawAoa.length; r++) {
      const row = rawAoa[r];
      if (!row || row.length === 0) continue;

      // Skip if row is empty or if it accidentally contains class average row
      const rowText = row.map(c => String(c).toLowerCase()).join(' ');
      if (rowText.includes('promedio de la clase') || rowText.includes('class average')) {
        continue;
      }

      const apellidos = String(row[0] || '').trim();
      const nombres = String(row[1] || '').trim();

      // Skip row if both name columns are empty
      if (!apellidos && !nombres) continue;

      const fullName = [apellidos, nombres].filter(Boolean).join(' ');

      // Parse assignment grades
      const grades = {};
      tasks.forEach((t, tIdx) => {
        const colIdx = 2 + tIdx;
        const rawVal = row[colIdx];
        
        if (rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '') {
          const str = String(rawVal).trim().replace(',', '.');
          const num = parseFloat(str);
          if (!isNaN(num)) {
            grades[t.id] = Math.round(num * 10) / 10;
          } else {
            grades[t.id] = null; // NP or unsubmitted
          }
        } else {
          grades[t.id] = null;
        }
      });

      students.push({
        id: `stu_${r}_${Date.now()}`,
        apellidos,
        nombres,
        fullName,
        grades
      });
    }

    if (students.length === 0) {
      throw new Error('No se detectaron alumnos válidos en la hoja.');
    }

    return {
      id: `group_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: cleanGroupName,
      fileName,
      tasks,
      students,
      createdAt: new Date().toISOString()
    };
  }

  /* ==========================================================================
     Calculations & Averages
     ========================================================================== */
  function roundAverage(val) {
    if (val === null || val === undefined || isNaN(val) || val <= 0) return 0;
    if (val >= 10) return 10;

    const integerPart = Math.floor(val);
    // Evita problemas de precisión de punto flotante en JS (ej. 7.6 - 7 = 0.5999999999999996)
    const decimalPart = Math.round((val - integerPart) * 10000) / 10000;

    // Regla: si el decimal es >= 0.6 redondea hacia arriba, si es menor redondea hacia abajo
    let rounded = decimalPart >= 0.6 ? integerPart + 1 : integerPart;

    // Norma oficial DGETI / CBTis: calificaciones menores a 6.0 no suben a aprobatoria (5.0 a 5.9 queda en 5)
    if (val < 6.0 && rounded >= 6) {
      rounded = 5;
    }

    return Math.min(10, Math.max(0, rounded));
  }

  function computeStudentRawAverage(student, tasks, treatAsZero) {
    let sum = 0;
    let count = 0;

    tasks.forEach(t => {
      const grade = student.grades[t.id];
      if (grade !== null && grade !== undefined) {
        sum += grade;
        count++;
      } else if (treatAsZero) {
        sum += 0;
        count++;
      }
    });

    if (count === 0) return 0;
    return sum / count;
  }

  function computeStudentAverage(student, tasks, treatAsZero, shouldRound = state.settings.roundAverages) {
    const raw = computeStudentRawAverage(student, tasks, treatAsZero);
    if (shouldRound !== false) {
      return roundAverage(raw);
    }
    return Math.round(raw * 100) / 100;
  }

  function syncRoundingControls() {
    const isRound = state.settings.roundAverages !== false;
    if (el.toggleRoundAverages) {
      el.toggleRoundAverages.checked = isRound;
    }
    if (el.labelRoundAverages) {
      el.labelRoundAverages.textContent = isRound ? 'Redondear promedios' : 'Sin redondear';
    }
    if (el.tabRoundAvg) {
      el.tabRoundAvg.classList.toggle('active', isRound);
    }
    if (el.tabRawAvg) {
      el.tabRawAvg.classList.toggle('active', !isRound);
    }
    const badge = document.getElementById('badgeAvgMode');
    if (badge) {
      badge.textContent = isRound ? 'Redondeado' : 'Sin redondear';
    }
  }

  function setRoundingMode(round) {
    state.settings.roundAverages = !!round;
    syncRoundingControls();
    persistState();
    updateDashboard();
    renderTable();
    showToast(state.settings.roundAverages 
      ? 'Promedios redondeados (Norma oficial CBTis)' 
      : 'Promedios sin redondear (Con decimales exactos)');
  }

  function getActiveGroup() {
    return state.groups.find(g => g.id === state.activeGroupId) || null;
  }

  function updateDashboard() {
    const group = getActiveGroup();
    if (!group) {
      el.emptyStateView.classList.remove('hidden');
      el.groupWorkspace.classList.add('hidden');
      el.activeGroupName.textContent = 'Sin grupo seleccionado';
      el.activeGroupMeta.textContent = 'Carga un archivo .xlsx para comenzar';
      if (el.btnExportGroup) el.btnExportGroup.disabled = true;
      if (el.btnDeleteCurrentGroup) el.btnDeleteCurrentGroup.disabled = true;
      if (el.btnAddNewTask) el.btnAddNewTask.disabled = true;
      return;
    }

    if (el.btnExportGroup) el.btnExportGroup.disabled = false;
    if (el.btnDeleteCurrentGroup) el.btnDeleteCurrentGroup.disabled = false;
    if (el.btnAddNewTask) el.btnAddNewTask.disabled = false;

    el.emptyStateView.classList.add('hidden');
    el.groupWorkspace.classList.remove('hidden');

    el.activeGroupName.textContent = group.name;
    el.activeGroupMeta.textContent = `${group.students.length} alumnos • ${group.tasks.length} tareas evaluadas`;

    const treatAsZero = state.settings.treatMissingAsZero;
    const minPass = state.settings.minPassingGrade;
    const shouldRound = state.settings.roundAverages !== false;

    // Student Averages
    const studentAvgs = group.students.map(s => computeStudentAverage(s, group.tasks, treatAsZero, shouldRound));
    const rawAvgs = group.students.map(s => computeStudentRawAverage(s, group.tasks, treatAsZero));
    const totalStudents = studentAvgs.length;

    // Group Average
    const groupAvg = totalStudents > 0 
      ? (shouldRound 
          ? (studentAvgs.reduce((a, b) => a + b, 0) / totalStudents)
          : (rawAvgs.reduce((a, b) => a + b, 0) / totalStudents))
      : 0;
    const roundedGroupAvg = shouldRound ? (Math.round(groupAvg * 10) / 10) : (Math.round(groupAvg * 100) / 100);

    el.kpiGroupAvg.textContent = shouldRound ? roundedGroupAvg.toFixed(1) : roundedGroupAvg.toFixed(2);
    if (roundedGroupAvg >= minPass) {
      el.kpiAvgStatus.textContent = 'Aprobado';
      el.kpiAvgStatus.className = 'metric-badge badge-success';
    } else {
      el.kpiAvgStatus.textContent = 'En Riesgo';
      el.kpiAvgStatus.className = 'metric-badge badge-danger';
    }

    if (el.kpiAvgSub) {
      el.kpiAvgSub.textContent = shouldRound 
        ? 'Promedios redondeados (Norma CBTis)' 
        : 'Promedios sin redondear (Con decimales)';
    }

    el.kpiTotalStudents.textContent = totalStudents;
    el.kpiTaskCount.textContent = `${group.tasks.length} actividades`;

    // Passing vs Failing
    const passedCount = studentAvgs.filter(avg => avg >= minPass).length;
    const failedCount = totalStudents - passedCount;
    const passRate = totalStudents > 0 ? (Math.round((passedCount / totalStudents) * 1000) / 10) : 0;
    const passRateDisplay = passRate % 1 === 0 ? `${passRate}%` : `${passRate.toFixed(1)}%`;

    // Porcentaje de Aprobación KPI
    if (el.kpiPassRateNumber) el.kpiPassRateNumber.textContent = passRateDisplay;
    if (el.kpiPassRateBadge) {
      if (passRate >= 70) {
        el.kpiPassRateBadge.textContent = 'Aprobatorio';
        el.kpiPassRateBadge.className = 'metric-badge badge-success';
      } else if (passRate >= 60) {
        el.kpiPassRateBadge.textContent = 'Regular';
        el.kpiPassRateBadge.className = 'metric-badge';
      } else {
        el.kpiPassRateBadge.textContent = 'En Riesgo';
        el.kpiPassRateBadge.className = 'metric-badge badge-danger';
      }
    }
    if (el.kpiPassRateFill) el.kpiPassRateFill.style.width = `${Math.min(100, Math.max(0, passRate))}%`;
    if (el.kpiPassRateSub) el.kpiPassRateSub.textContent = `${passedCount} de ${totalStudents} aprobados`;

    // Aprobados vs Reprobados Split
    if (el.kpiMinPassTag) el.kpiMinPassTag.textContent = `Mín. ${minPass.toFixed(1)}`;
    if (el.kpiPassCount) el.kpiPassCount.textContent = passedCount;
    if (el.kpiFailCount) el.kpiFailCount.textContent = failedCount;
    if (el.kpiPassSplitSub) el.kpiPassSplitSub.textContent = `${failedCount} alumno${failedCount === 1 ? '' : 's'} por regularizar`;

    // Alumnos con Promedio 0 KPI
    const zeroCount = studentAvgs.filter(avg => avg === 0).length;
    const zeroRate = totalStudents > 0 ? (Math.round((zeroCount / totalStudents) * 1000) / 10) : 0;
    const zeroRateDisplay = zeroRate % 1 === 0 ? `${zeroRate}%` : `${zeroRate.toFixed(1)}%`;

    if (el.kpiZeroCount) el.kpiZeroCount.textContent = zeroCount;
    if (el.kpiZeroBadge) {
      if (zeroCount === 0) {
        el.kpiZeroBadge.textContent = '0%';
        el.kpiZeroBadge.className = 'metric-badge badge-success';
      } else {
        el.kpiZeroBadge.textContent = `${zeroRateDisplay} del grupo`;
        el.kpiZeroBadge.className = 'metric-badge badge-danger';
      }
    }
    if (el.kpiZeroSub) {
      el.kpiZeroSub.textContent = zeroCount === 0 
        ? 'Ningún alumno con promedio 0.0' 
        : `${zeroCount} alumno${zeroCount > 1 ? 's' : ''} sin entregas o calif. 0.0`;
    }
  }

  /* ==========================================================================
     Table Rendering & Dynamic Columns
     ========================================================================== */
  /* ==========================================================================
     Task Management & Inline Live Grade Editing
     ========================================================================== */
  function addNewTaskPrompt() {
    const group = getActiveGroup();
    if (!group) {
      showToast('Selecciona o importa un grupo primero');
      return;
    }

    const defaultName = `Tarea ${group.tasks.length + 1}`;
    const name = prompt('Nombre de la nueva tarea / actividad:', defaultName);
    if (name === null) return;

    const taskName = name.trim() || defaultName;
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = now.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '');
    const todayDate = `${day} ${month}`;

    const newTask = {
      id: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: taskName,
      date: todayDate
    };

    group.tasks.push(newTask);
    group.students.forEach(s => {
      s.grades[newTask.id] = null;
    });

    persistState();
    updateDashboard();
    renderTable();
    showToast(`Tarea "${taskName}" agregada con éxito`);
  }

  function deleteTask(taskId) {
    const group = getActiveGroup();
    if (!group) return;

    const task = group.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (!confirm(`¿Eliminar la tarea "${task.name}"?\nSe borrarán las calificaciones asignadas a esta tarea.`)) {
      return;
    }

    group.tasks = group.tasks.filter(t => t.id !== taskId);
    group.students.forEach(s => {
      delete s.grades[taskId];
    });

    persistState();
    updateDashboard();
    renderTable();
    showToast(`Tarea "${task.name}" eliminada`);
  }

  function updateStudentRowMetrics(studentId) {
    const group = getActiveGroup();
    if (!group) return;

    const student = group.students.find(s => s.id === studentId);
    if (!student) return;

    const tr = el.gradesTableBody.querySelector(`tr[data-student-id="${studentId}"]`);
    if (!tr) return;

    const treatAsZero = state.settings.treatMissingAsZero;
    const minPass = state.settings.minPassingGrade;
    const isRoundMode = state.settings.roundAverages !== false;

    const rawAvg = computeStudentRawAverage(student, group.tasks, treatAsZero);
    const roundedAvg = roundAverage(rawAvg);
    const currentAvg = isRoundMode ? roundedAvg : Math.round(rawAvg * 100) / 100;
    const isPassed = currentAvg >= minPass;

    const mainDisplay = isRoundMode 
      ? `${roundedAvg}` 
      : (Math.round(rawAvg * 100) / 100).toFixed(2);

    const subDisplay = isRoundMode 
      ? `(${(Math.round(rawAvg * 100) / 100).toFixed(2)})` 
      : `(Red: ${roundedAvg})`;

    const tooltipText = isRoundMode
      ? `Promedio redondeado (CBTis): ${roundedAvg} • Sin redondear: ${(Math.round(rawAvg * 100) / 100).toFixed(2)}`
      : `Promedio sin redondear: ${(Math.round(rawAvg * 100) / 100).toFixed(2)} • Redondeado CBTis: ${roundedAvg}`;

    const avgCell = tr.querySelector('.student-avg-cell');
    if (avgCell) {
      avgCell.title = tooltipText;
      avgCell.classList.toggle('text-success', isPassed);
      avgCell.classList.toggle('text-danger', !isPassed);
      const valDiv = avgCell.querySelector('.avg-cell-val');
      if (valDiv) valDiv.textContent = mainDisplay;
      const subDiv = avgCell.querySelector('.avg-cell-sub');
      if (subDiv) subDiv.textContent = subDisplay;
    }

    const statusCell = tr.querySelector('.col-status');
    if (statusCell) {
      const badge = statusCell.querySelector('.badge-status');
      if (badge) {
        badge.className = `badge-status ${isPassed ? 'badge-status-pass' : 'badge-status-fail'}`;
        badge.textContent = isPassed ? 'Aprobado' : 'Reprobado';
      }
    }

    // Refresh KPI metrics in dashboard
    updateDashboard();

    // Update filter count tabs
    const allStudents = group.students;
    el.countAll.textContent = allStudents.length;
    el.countPassed.textContent = allStudents.filter(s => computeStudentAverage(s, group.tasks, treatAsZero, isRoundMode) >= minPass).length;
    el.countFailed.textContent = allStudents.filter(s => computeStudentAverage(s, group.tasks, treatAsZero, isRoundMode) < minPass).length;
    if (el.countZero) {
      el.countZero.textContent = allStudents.filter(s => computeStudentAverage(s, group.tasks, treatAsZero, isRoundMode) === 0).length;
    }
  }

  function handleGradeChange(input) {
    const studentId = input.getAttribute('data-student-id');
    const taskId = input.getAttribute('data-task-id');
    const group = getActiveGroup();
    if (!group) return;

    const student = group.students.find(s => s.id === studentId);
    if (!student) return;

    const rawVal = input.value.trim();
    let newVal = null;

    if (rawVal === '' || rawVal.toLowerCase() === 'np' || rawVal === '-') {
      newVal = null;
    } else {
      const normalized = rawVal.replace(',', '.');
      const num = parseFloat(normalized);
      if (isNaN(num) || num < 0) {
        const prev = student.grades[taskId];
        input.value = prev !== null && prev !== undefined ? (Number.isInteger(prev) ? prev.toString() : prev.toFixed(1)) : '';
        showToast('Ingresa un número válido entre 0 y 100 (o vacío para no entregado)');
        return;
      }
      const clamped = Math.min(100, Math.max(0, num));
      newVal = Math.round(clamped * 10) / 10;
    }

    if (student.grades[taskId] !== newVal) {
      student.grades[taskId] = newVal;
      persistState();

      const hasVal = newVal !== null && newVal !== undefined;
      const isZero = hasVal && newVal === 0;
      input.value = hasVal ? (Number.isInteger(newVal) ? newVal.toString() : newVal.toFixed(1)) : '';
      input.classList.toggle('grade-zero', isZero);
      input.classList.toggle('grade-unsubmitted', !hasVal);

      const parentTd = input.closest('td');
      if (parentTd) {
        parentTd.classList.toggle('grade-zero', isZero);
        parentTd.classList.toggle('grade-unsubmitted', !hasVal);
      }

      input.classList.add('just-updated');
      setTimeout(() => input.classList.remove('just-updated'), 700);

      updateStudentRowMetrics(studentId);
    }
  }

  function handleGradeKeyDown(e, input) {
    const row = parseInt(input.getAttribute('data-row'), 10);
    const col = parseInt(input.getAttribute('data-col'), 10);

    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
      const targetRow = e.shiftKey ? row - 1 : row + 1;
      const nextInput = el.gradesTableBody.querySelector(`input.grade-cell-input[data-row="${targetRow}"][data-col="${col}"]`);
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextInput = el.gradesTableBody.querySelector(`input.grade-cell-input[data-row="${row + 1}"][data-col="${col}"]`);
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevInput = el.gradesTableBody.querySelector(`input.grade-cell-input[data-row="${row - 1}"][data-col="${col}"]`);
      if (prevInput) {
        prevInput.focus();
        prevInput.select();
      }
    } else if (e.key === 'Escape') {
      const studentId = input.getAttribute('data-student-id');
      const taskId = input.getAttribute('data-task-id');
      const group = getActiveGroup();
      if (group) {
        const student = group.students.find(s => s.id === studentId);
        if (student) {
          const val = student.grades[taskId];
          input.value = val !== null && val !== undefined ? (Number.isInteger(val) ? val.toString() : val.toFixed(1)) : '';
        }
      }
      input.blur();
    }
  }

  function renderTable() {
    const group = getActiveGroup();
    if (!group) {
      el.theadDatesRow.innerHTML = '';
      el.theadTasksRow.innerHTML = '';
      el.gradesTableBody.innerHTML = '';
      return;
    }

    const treatAsZero = state.settings.treatMissingAsZero;
    const minPass = state.settings.minPassingGrade;

    // 1. Rebuild Headers (Dates Row & Tasks Row)
    el.theadDatesRow.innerHTML = `
      <th class="col-pinned col-idx">#</th>
      <th class="col-pinned col-student">FECHA DE ENTREGA:</th>
    `;
    el.theadTasksRow.innerHTML = `
      <th class="col-pinned col-idx">#</th>
      <th class="col-pinned col-student sortable" id="thStudentName">
        <span>Alumno (Apellidos y Nombres)</span>
        <span class="sort-indicator" id="nameSortIndicator">${state.currentSort.startsWith('name') ? (state.currentSort === 'name_asc' ? '▲' : '▼') : '⇅'}</span>
      </th>
    `;

    // Append dynamic task columns with inline editable date and title
    group.tasks.forEach((t, colIndex) => {
      // Date row
      const thDate = document.createElement('th');
      thDate.className = 'font-mono task-header-th task-date-th';
      thDate.innerHTML = `
        <div class="task-date-container">
          <span class="task-date-text" title="Clic para editar fecha de entrega">${escapeHtml(t.date || '-')}</span>
          <input class="task-header-input task-date-input hidden" type="text" value="${escapeHtml(t.date && t.date !== '-' ? t.date : '')}" placeholder="Fecha..." />
        </div>
      `;

      const dateText = thDate.querySelector('.task-date-text');
      const dateInput = thDate.querySelector('.task-date-input');

      const activateDateEdit = () => {
        dateText.classList.add('hidden');
        dateInput.classList.remove('hidden');
        dateInput.focus();
        dateInput.select();
      };

      const saveDateEdit = () => {
        const newDate = dateInput.value.trim() || '-';
        if (t.date !== newDate) {
          t.date = newDate;
          dateText.textContent = newDate;
          persistState();
          showToast(`Fecha de "${t.name}" actualizada: ${newDate}`);
        }
        dateInput.classList.add('hidden');
        dateText.classList.remove('hidden');
      };

      dateText.addEventListener('click', activateDateEdit);
      dateInput.addEventListener('blur', saveDateEdit);
      dateInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          saveDateEdit();
        } else if (e.key === 'Escape') {
          dateInput.value = t.date || '';
          dateInput.classList.add('hidden');
          dateText.classList.remove('hidden');
        }
      });

      el.theadDatesRow.appendChild(thDate);

      // Task title row
      const thTask = document.createElement('th');
      thTask.className = 'task-header-th task-name-th';
      thTask.innerHTML = `
        <div class="task-name-container">
          <span class="task-name-text" title="Clic para editar título: ${escapeHtml(t.name)}">${escapeHtml(t.name)}</span>
          <input class="task-header-input task-name-input hidden" type="text" value="${escapeHtml(t.name)}" placeholder="Nombre de tarea..." />
          <button type="button" class="btn-delete-task" title="Eliminar tarea &quot;${escapeHtml(t.name)}&quot;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      `;

      const nameText = thTask.querySelector('.task-name-text');
      const nameInput = thTask.querySelector('.task-name-input');
      const btnDelete = thTask.querySelector('.btn-delete-task');

      const activateNameEdit = () => {
        nameText.classList.add('hidden');
        nameInput.classList.remove('hidden');
        nameInput.focus();
        nameInput.select();
      };

      const saveNameEdit = () => {
        const newName = nameInput.value.trim();
        if (newName && t.name !== newName) {
          t.name = newName;
          nameText.textContent = newName;
          nameText.title = `Clic para editar título: ${newName}`;
          persistState();
          updateDashboard();
          showToast(`Tarea renombrada a "${newName}"`);
        }
        nameInput.classList.add('hidden');
        nameText.classList.remove('hidden');
      };

      nameText.addEventListener('click', activateNameEdit);
      nameInput.addEventListener('blur', saveNameEdit);
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          saveNameEdit();
        } else if (e.key === 'Escape') {
          nameInput.value = t.name;
          nameInput.classList.add('hidden');
          nameText.classList.remove('hidden');
        }
      });

      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTask(t.id);
      });

      el.theadTasksRow.appendChild(thTask);
    });

    // Append "+ Tarea" Column in Header
    const thAddDate = document.createElement('th');
    thAddDate.className = 'col-add-task-th';
    el.theadDatesRow.appendChild(thAddDate);

    const thAddTask = document.createElement('th');
    thAddTask.className = 'col-add-task-th';
    thAddTask.innerHTML = `
      <button type="button" class="btn-add-task-col" id="btnTableAddTask" title="Agregar una nueva tarea a este grupo">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span>+ Tarea</span>
      </button>
    `;
    const btnTableAddTask = thAddTask.querySelector('#btnTableAddTask');
    if (btnTableAddTask) {
      btnTableAddTask.addEventListener('click', addNewTaskPrompt);
    }
    el.theadTasksRow.appendChild(thAddTask);

    // Pinned Right Columns (Metrics & Condition)
    const appendPinnedRight = (row, html) => {
      const template = document.createElement('template');
      template.innerHTML = html.trim();
      Array.from(template.content.children).forEach(node => row.appendChild(node));
    };

    appendPinnedRight(el.theadDatesRow, `
      <th class="col-pinned-right col-avg">MÉTRICAS</th>
      <th class="col-pinned-right col-status">ESTADO</th>
    `);

    appendPinnedRight(el.theadTasksRow, `
      <th class="col-pinned-right col-avg sortable" id="thStudentAvg" title="Clic para ordenar por promedio • Alternar modo redondeado/sin redondear">
        <div class="avg-header-inner">
          <div class="avg-header-top">
            <span>Promedio</span>
            <span class="sort-indicator" id="avgSortIndicator">${state.currentSort.startsWith('avg') ? (state.currentSort === 'avg_desc' ? '▼' : '▲') : '⇅'}</span>
          </div>
          <span class="badge-avg-mode" id="badgeAvgMode">${state.settings.roundAverages ? 'Redondeado' : 'Sin redondear'}</span>
        </div>
      </th>
      <th class="col-pinned-right col-status">
        <span>Condición</span>
      </th>
    `);

    // Attach click sorting to dynamically rebuilt headers
    document.getElementById('thStudentName').addEventListener('click', () => {
      setSort(state.currentSort === 'name_asc' ? 'name_desc' : 'name_asc');
    });
    const thStudentAvg = document.getElementById('thStudentAvg');
    if (thStudentAvg) {
      thStudentAvg.addEventListener('click', () => {
        setSort(state.currentSort === 'avg_desc' ? 'avg_asc' : 'avg_desc');
      });
    }
    const badgeAvgMode = document.getElementById('badgeAvgMode');
    if (badgeAvgMode) {
      badgeAvgMode.addEventListener('click', (e) => {
        e.stopPropagation();
        setRoundingMode(!state.settings.roundAverages);
      });
    }

    // 2. Filter & Sort Student List
    let list = [...group.students];
    const isRoundMode = state.settings.roundAverages !== false;

    // Search filter
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      list = list.filter(s => {
        const normName = s.fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return normName.includes(q);
      });
    }

    // Status filter
    if (state.currentFilter === 'passed') {
      list = list.filter(s => computeStudentAverage(s, group.tasks, treatAsZero, isRoundMode) >= minPass);
    } else if (state.currentFilter === 'failed') {
      list = list.filter(s => computeStudentAverage(s, group.tasks, treatAsZero, isRoundMode) < minPass);
    } else if (state.currentFilter === 'zero') {
      list = list.filter(s => computeStudentAverage(s, group.tasks, treatAsZero, isRoundMode) === 0);
    }

    // Sorting
    list.sort((a, b) => {
      const rawA = computeStudentRawAverage(a, group.tasks, treatAsZero);
      const rawB = computeStudentRawAverage(b, group.tasks, treatAsZero);
      const avgA = isRoundMode ? roundAverage(rawA) : Math.round(rawA * 100) / 100;
      const avgB = isRoundMode ? roundAverage(rawB) : Math.round(rawB * 100) / 100;

      if (state.currentSort === 'name_asc') {
        return (a.apellidos || a.fullName).localeCompare(b.apellidos || b.fullName, 'es', { sensitivity: 'base' });
      }
      if (state.currentSort === 'name_desc') {
        return (b.apellidos || b.fullName).localeCompare(a.apellidos || a.fullName, 'es', { sensitivity: 'base' });
      }
      if (state.currentSort === 'avg_desc') {
        return (avgB - avgA) || (rawB - rawA);
      }
      if (state.currentSort === 'avg_asc') {
        return (avgA - avgB) || (rawA - rawB);
      }
      return 0;
    });

    // Update counts
    const allStudents = group.students;
    el.countAll.textContent = allStudents.length;
    el.countPassed.textContent = allStudents.filter(s => computeStudentAverage(s, group.tasks, treatAsZero, isRoundMode) >= minPass).length;
    el.countFailed.textContent = allStudents.filter(s => computeStudentAverage(s, group.tasks, treatAsZero, isRoundMode) < minPass).length;
    if (el.countZero) {
      el.countZero.textContent = allStudents.filter(s => computeStudentAverage(s, group.tasks, treatAsZero, isRoundMode) === 0).length;
    }

    // 3. Render Body Rows
    el.gradesTableBody.innerHTML = '';
    if (list.length === 0) {
      el.tableSearchEmpty.classList.remove('hidden');
      return;
    }
    el.tableSearchEmpty.classList.add('hidden');

    list.forEach((student, rowIndex) => {
      const rawAvg = computeStudentRawAverage(student, group.tasks, treatAsZero);
      const roundedAvg = roundAverage(rawAvg);
      const currentAvg = isRoundMode ? roundedAvg : Math.round(rawAvg * 100) / 100;
      const isPassed = currentAvg >= minPass;

      const mainDisplay = isRoundMode 
        ? `${roundedAvg}` 
        : (Math.round(rawAvg * 100) / 100).toFixed(2);

      const subDisplay = isRoundMode 
        ? `(${(Math.round(rawAvg * 100) / 100).toFixed(2)})` 
        : `(Red: ${roundedAvg})`;

      const tooltipText = isRoundMode
        ? `Promedio redondeado (CBTis): ${roundedAvg} • Sin redondear: ${(Math.round(rawAvg * 100) / 100).toFixed(2)}`
        : `Promedio sin redondear: ${(Math.round(rawAvg * 100) / 100).toFixed(2)} • Redondeado CBTis: ${roundedAvg}`;

      const tr = document.createElement('tr');
      tr.setAttribute('data-student-id', student.id);
      tr.setAttribute('data-row-index', rowIndex);

      // Pinned Left columns
      const tdIdx = document.createElement('td');
      tdIdx.className = 'col-pinned col-idx';
      tdIdx.textContent = rowIndex + 1;
      tr.appendChild(tdIdx);

      const tdStudent = document.createElement('td');
      tdStudent.className = 'col-pinned col-student';
      tdStudent.innerHTML = `<span class="student-row-name">${escapeHtml(student.fullName)}</span>`;
      tr.appendChild(tdStudent);

      // Task grades editable cells
      group.tasks.forEach((t, colIndex) => {
        const val = student.grades[t.id];
        const hasVal = val !== null && val !== undefined && !isNaN(val);
        const displayVal = hasVal ? (Number.isInteger(val) ? val.toString() : val.toFixed(1)) : '';
        const isZero = hasVal && val === 0;
        const isUnsubmitted = !hasVal;

        const td = document.createElement('td');
        td.className = `grade-cell ${isZero ? 'grade-zero' : ''} ${isUnsubmitted ? 'grade-unsubmitted' : ''}`;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = `grade-cell-input ${isZero ? 'grade-zero' : ''} ${isUnsubmitted ? 'grade-unsubmitted' : ''}`;
        input.value = displayVal;
        input.placeholder = treatAsZero ? '0.0' : '-';
        input.setAttribute('data-student-id', student.id);
        input.setAttribute('data-task-id', t.id);
        input.setAttribute('data-row', rowIndex);
        input.setAttribute('data-col', colIndex);
        input.title = `Calificación de ${escapeHtml(student.fullName)} en "${escapeHtml(t.name)}"`;
        input.autocomplete = 'off';
        input.spellcheck = false;

        input.addEventListener('focus', () => input.select());
        input.addEventListener('change', () => handleGradeChange(input));
        input.addEventListener('blur', () => handleGradeChange(input));
        input.addEventListener('keydown', (e) => handleGradeKeyDown(e, input));

        td.appendChild(input);
        tr.appendChild(td);
      });

      // Empty cell under "+ Tarea"
      const tdAddEmpty = document.createElement('td');
      tdAddEmpty.className = 'col-add-task-empty';
      tr.appendChild(tdAddEmpty);

      // Pinned Right columns (Avg & Condition)
      const tdAvg = document.createElement('td');
      tdAvg.className = `col-pinned-right col-avg student-avg-cell ${isPassed ? 'text-success' : 'text-danger'}`;
      tdAvg.title = tooltipText;
      tdAvg.innerHTML = `
        <div class="avg-cell-val">${mainDisplay}</div>
        <div class="avg-cell-sub">${subDisplay}</div>
      `;
      tr.appendChild(tdAvg);

      const tdStatus = document.createElement('td');
      tdStatus.className = 'col-pinned-right col-status';
      tdStatus.innerHTML = `
        <span class="badge-status ${isPassed ? 'badge-status-pass' : 'badge-status-fail'}">
          ${isPassed ? 'Aprobado' : 'Reprobado'}
        </span>
      `;
      tr.appendChild(tdStatus);

      el.gradesTableBody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ==========================================================================
     Sidebar & Multi-Group Navigation
     ========================================================================== */
  function renderSidebar() {
    const totalGroups = state.groups.length;
    el.sidebarGroupCount.textContent = totalGroups;
    el.groupsNavList.innerHTML = '';

    if (el.btnClearAllGroups) {
      el.btnClearAllGroups.disabled = totalGroups === 0;
    }
    if (el.btnClearAllGroupsHeader) {
      el.btnClearAllGroupsHeader.style.display = totalGroups === 0 ? 'none' : 'inline-flex';
    }

    state.groups.forEach(group => {
      const item = document.createElement('div');
      item.className = `nav-group-item ${group.id === state.activeGroupId ? 'active' : ''}`;
      item.innerHTML = `
        <div class="nav-group-item-content">
          <span class="group-item-name" title="${escapeHtml(group.name)}">${escapeHtml(group.name)}</span>
          <span class="group-item-count">${group.students.length} al.</span>
        </div>
        <button type="button" class="btn-group-item-delete" title="Eliminar grupo &quot;${escapeHtml(group.name)}&quot;" aria-label="Eliminar grupo">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      `;

      item.addEventListener('click', () => {
        selectGroup(group.id);
      });

      const btnDelete = item.querySelector('.btn-group-item-delete');
      if (btnDelete) {
        btnDelete.addEventListener('click', (e) => {
          e.stopPropagation();
          deleteGroupById(group.id);
        });
      }

      el.groupsNavList.appendChild(item);
    });
  }

  function selectGroup(groupId) {
    state.activeGroupId = groupId;
    state.searchQuery = '';
    el.tableSearchInput.value = '';
    persistState();
    renderSidebar();
    updateDashboard();
    renderTable();
  }

  function deleteGroupById(groupId) {
    const group = state.groups.find(g => g.id === groupId);
    if (!group) return;
    if (!confirm(`¿Eliminar el grupo "${group.name}"?`)) return;

    state.groups = state.groups.filter(g => g.id !== groupId);
    if (state.activeGroupId === groupId) {
      state.activeGroupId = state.groups.length > 0 ? state.groups[0].id : null;
    }

    persistState();
    renderSidebar();
    updateDashboard();
    renderTable();
    showToast(`Grupo "${group.name}" eliminado`);
  }

  function deleteCurrentGroup() {
    if (!state.activeGroupId) return;
    deleteGroupById(state.activeGroupId);
  }

  function clearAllGroups() {
    if (!state.groups || state.groups.length === 0) {
      showToast('No hay grupos activos para limpiar');
      return;
    }

    const count = state.groups.length;
    const msg = count === 1
      ? '¿Estás seguro de que deseas limpiar el grupo activo? Se eliminará de la sesión.'
      : `¿Estás seguro de que deseas limpiar todos los ${count} grupos activos? Se eliminarán de la sesión actual.`;

    if (!confirm(msg)) return;

    state.groups = [];
    state.activeGroupId = null;
    state.searchQuery = '';
    if (el.tableSearchInput) el.tableSearchInput.value = '';

    persistState();
    renderSidebar();
    updateDashboard();
    renderTable();
    showToast(count === 1 ? 'Grupo activo eliminado' : 'Grupos activos limpiados correctamente');
  }

  /* ==========================================================================
     Sort & Filter Event Handlers
     ========================================================================== */
  function setSort(sortType) {
    state.currentSort = sortType;

    el.btnSortNameAsc.classList.toggle('active', sortType === 'name_asc');
    el.btnSortNameDesc.classList.toggle('active', sortType === 'name_desc');
    el.btnSortAvgDesc.classList.toggle('active', sortType === 'avg_desc');
    el.btnSortAvgAsc.classList.toggle('active', sortType === 'avg_asc');

    renderTable();
  }

  function initControls() {
    // Missing tasks calculation toggle
    el.toggleMissingAsZero.addEventListener('change', () => {
      state.settings.treatMissingAsZero = el.toggleMissingAsZero.checked;
      persistState();
      updateDashboard();
      renderTable();
      showToast(state.settings.treatMissingAsZero ? 'No entregadas calculadas como 0.0' : 'No entregadas excluidas del promedio');
    });

    // Rounding mode toggle (top-nav)
    if (el.toggleRoundAverages) {
      el.toggleRoundAverages.addEventListener('change', () => {
        setRoundingMode(el.toggleRoundAverages.checked);
      });
    }

    // Rounding mode buttons (toolbar)
    if (el.tabRoundAvg) {
      el.tabRoundAvg.addEventListener('click', () => {
        setRoundingMode(true);
      });
    }
    if (el.tabRawAvg) {
      el.tabRawAvg.addEventListener('click', () => {
        setRoundingMode(false);
      });
    }

    // Min Passing Grade
    el.inputMinPassing.addEventListener('change', () => {
      const val = parseFloat(el.inputMinPassing.value) || 6.0;
      state.settings.minPassingGrade = Math.max(0, Math.min(100, val));
      el.inputMinPassing.value = state.settings.minPassingGrade;
      persistState();
      updateDashboard();
      renderTable();
    });

    // Search bar
    el.tableSearchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      renderTable();
    });

    // Hotkey '/' to focus search
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== el.tableSearchInput && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        el.tableSearchInput.focus();
      }
    });

    // Sort buttons
    el.btnSortNameAsc.addEventListener('click', () => setSort('name_asc'));
    el.btnSortNameDesc.addEventListener('click', () => setSort('name_desc'));
    el.btnSortAvgDesc.addEventListener('click', () => setSort('avg_desc'));
    el.btnSortAvgAsc.addEventListener('click', () => setSort('avg_asc'));

    // Status filter tabs (only tabs with data-filter attribute)
    document.querySelectorAll('.filter-tabs-group button[data-filter]').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tabs-group button[data-filter]').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.currentFilter = tab.getAttribute('data-filter');
        renderTable();
      });
    });

    // Delete Group Button
    el.btnDeleteCurrentGroup.addEventListener('click', deleteCurrentGroup);

    // Clear all groups buttons
    if (el.btnClearAllGroups) el.btnClearAllGroups.addEventListener('click', clearAllGroups);
    if (el.btnClearAllGroupsHeader) el.btnClearAllGroupsHeader.addEventListener('click', clearAllGroups);

    // Export button
    el.btnExportGroup.addEventListener('click', exportActiveGroupToExcel);

    // Add New Task Button
    if (el.btnAddNewTask) {
      el.btnAddNewTask.addEventListener('click', addNewTaskPrompt);
    }

    // Modal controls
    el.btnOpenUploadModal.addEventListener('click', () => {
      el.inputCustomGroupName.value = '';
      el.uploadModal.classList.remove('hidden');
    });
    el.btnCloseUploadModal.addEventListener('click', () => el.uploadModal.classList.add('hidden'));
    el.btnCancelUpload.addEventListener('click', () => el.uploadModal.classList.add('hidden'));

    // Upload Browse
    el.btnModalBrowse.addEventListener('click', () => el.modalFileInput.click());
    el.btnEmptyBrowse.addEventListener('click', () => el.emptyFileInput.click());

    // File Input Changes
    el.modalFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFileImport(e.target.files[0], el.inputCustomGroupName.value);
        el.uploadModal.classList.add('hidden');
      }
    });

    el.emptyFileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        Array.from(e.target.files).forEach(file => handleFileImport(file));
      }
    });

    // Drag and Drop
    setupDropZone(el.emptyDropCard, (file) => handleFileImport(file));
    setupDropZone(el.modalDropZone, (file) => {
      handleFileImport(file, el.inputCustomGroupName.value);
      el.uploadModal.classList.add('hidden');
    });
  }

  function setupDropZone(dropElement, onFileDropped) {
    if (!dropElement) return;

    ['dragenter', 'dragover'].forEach(name => {
      dropElement.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropElement.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropElement.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropElement.classList.remove('dragover');
      });
    });

    dropElement.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt.files && dt.files.length > 0) {
        onFileDropped(dt.files[0]);
      }
    });
  }

  function handleFileImport(file, customName = '') {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      showToast('Por favor selecciona un archivo .xlsx o .csv válido');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const parsedGroup = parseSpreadsheet(data, file.name, customName);
        
        state.groups.push(parsedGroup);
        state.activeGroupId = parsedGroup.id;
        
        persistState();
        renderSidebar();
        updateDashboard();
        renderTable();

        showToast(`Grupo "${parsedGroup.name}" importado con éxito`);
      } catch (err) {
        console.error(err);
        showToast('Error al procesar archivo: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /* ==========================================================================
     Excel Export (.xlsx)
     ========================================================================== */
  function exportActiveGroupToExcel() {
    const group = getActiveGroup();
    if (!group) return;

    const treatAsZero = state.settings.treatMissingAsZero;

    // Build rows adhering to clean spreadsheet standards
    const rows = [];
    
    // Row 1: Dates
    const rowDates = ['FECHAS DE ENTREGA', ''];
    group.tasks.forEach(t => rowDates.push(t.date || ''));
    rowDates.push('PROMEDIO');
    rows.push(rowDates);

    // Row 2: Task Names
    const rowTasks = ['APELLIDOS', 'NOMBRES'];
    group.tasks.forEach(t => rowTasks.push(t.name));
    rowTasks.push('PROMEDIO');
    rows.push(rowTasks);

    // Row 3: Class Task Averages
    const rowAvgSummary = ['PROMEDIO DE LA CLASE', ''];
    group.tasks.forEach(t => {
      let sum = 0, count = 0;
      group.students.forEach(s => {
        const val = s.grades[t.id];
        if (val !== null) {
          sum += val;
          count++;
        } else if (treatAsZero) {
          count++;
        }
      });
      rowAvgSummary.push(count > 0 ? Math.round((sum / count) * 10) / 10 : 0);
    });
    const allRawAvgs = group.students.map(s => computeStudentRawAverage(s, group.tasks, treatAsZero));
    const classRawAvg = allRawAvgs.length > 0 ? (allRawAvgs.reduce((a, b) => a + b, 0) / allRawAvgs.length) : 0;

    rowAvgSummary.push(Math.round(classRawAvg * 100) / 100);
    rows.push(rowAvgSummary);

    // Rows 4+: Students sorted alphabetically A - Z (by apellidos, then nombres)
    const sortedStudents = [...group.students].sort((a, b) => {
      const cmp = (a.apellidos || a.fullName || '').localeCompare(b.apellidos || b.fullName || '', 'es', { sensitivity: 'base' });
      if (cmp !== 0) return cmp;
      return (a.nombres || '').localeCompare(b.nombres || '', 'es', { sensitivity: 'base' });
    });

    sortedStudents.forEach(s => {
      const rawAvg = computeStudentRawAverage(s, group.tasks, treatAsZero);
      const exactAvg = Math.round(rawAvg * 100) / 100;

      const studentRow = [s.apellidos, s.nombres];
      group.tasks.forEach(t => {
        const val = s.grades[t.id];
        studentRow.push(val !== null ? val : (treatAsZero ? 0 : ''));
      });
      studentRow.push(exactAvg);
      rows.push(studentRow);
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Calificaciones');

    const cleanFile = `${group.name.replace(/[^a-zA-Z0-9_-]/g, '_')}_Calculado.xlsx`;
    XLSX.writeFile(wb, cleanFile);
    showToast(`Archivo "${cleanFile}" descargado`);
  }

  /* ==========================================================================
     Application Initialization
     ========================================================================== */
  function init() {
    initTheme();
    loadPersistedState();
    initControls();

    renderSidebar();
    updateDashboard();
    renderTable();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
