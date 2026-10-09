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
      minPassingGrade: 6.0
    }
  };

  // DOM Elements Cache
  const el = {
    // Sidebar
    sidebarGroupCount: document.getElementById('sidebarGroupCount'),
    groupsNavList: document.getElementById('groupsNavList'),
    btnOpenUploadModal: document.getElementById('btnOpenUploadModal'),
    btnToggleTheme: document.getElementById('btnToggleTheme'),

    // Top Nav
    activeGroupName: document.getElementById('activeGroupName'),
    activeGroupMeta: document.getElementById('activeGroupMeta'),
    toggleMissingAsZero: document.getElementById('toggleMissingAsZero'),
    inputMinPassing: document.getElementById('inputMinPassing'),
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
    kpiPassRate: document.getElementById('kpiPassRate'),
    kpiPassCount: document.getElementById('kpiPassCount'),
    kpiFailCount: document.getElementById('kpiFailCount'),
    kpiPassProgress: document.getElementById('kpiPassProgress'),

    // Toolbar
    tableSearchInput: document.getElementById('tableSearchInput'),
    btnSortNameAsc: document.getElementById('btnSortNameAsc'),
    btnSortNameDesc: document.getElementById('btnSortNameDesc'),
    btnSortAvgDesc: document.getElementById('btnSortAvgDesc'),
    btnSortAvgAsc: document.getElementById('btnSortAvgAsc'),
    countAll: document.getElementById('countAll'),
    countPassed: document.getElementById('countPassed'),
    countFailed: document.getElementById('countFailed'),

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
     Theme Management (Geist Light/Dark)
     ========================================================================== */
  function initTheme() {
    const savedTheme = localStorage.getItem('gradeflow_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    el.btnToggleTheme.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('gradeflow_theme', next);
      showToast(`Tema cambiado a ${next === 'dark' ? 'Oscuro' : 'Claro'}`);
    });
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
  function computeStudentAverage(student, tasks, treatAsZero) {
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
    return Math.round((sum / count) * 10) / 10;
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
      return;
    }

    el.emptyStateView.classList.add('hidden');
    el.groupWorkspace.classList.remove('hidden');

    el.activeGroupName.textContent = group.name;
    el.activeGroupMeta.textContent = `${group.students.length} alumnos • ${group.tasks.length} tareas evaluadas`;

    const treatAsZero = state.settings.treatMissingAsZero;
    const minPass = state.settings.minPassingGrade;

    // Student Averages
    const studentAvgs = group.students.map(s => computeStudentAverage(s, group.tasks, treatAsZero));
    const totalStudents = studentAvgs.length;

    // Group Average
    const groupAvg = totalStudents > 0 ? (studentAvgs.reduce((a, b) => a + b, 0) / totalStudents) : 0;
    const roundedGroupAvg = Math.round(groupAvg * 10) / 10;

    el.kpiGroupAvg.textContent = roundedGroupAvg.toFixed(1);
    if (roundedGroupAvg >= minPass) {
      el.kpiAvgStatus.textContent = 'Acreditado';
      el.kpiAvgStatus.className = 'metric-badge badge-success';
    } else {
      el.kpiAvgStatus.textContent = 'En Riesgo';
      el.kpiAvgStatus.className = 'metric-badge badge-danger';
    }

    el.kpiTotalStudents.textContent = totalStudents;
    el.kpiTaskCount.textContent = `${group.tasks.length} actividades`;

    // Passing vs Failing
    const passedCount = studentAvgs.filter(avg => avg >= minPass).length;
    const failedCount = totalStudents - passedCount;
    const passRate = totalStudents > 0 ? Math.round((passedCount / totalStudents) * 100) : 0;

    el.kpiPassRate.textContent = `${passRate}%`;
    el.kpiPassCount.textContent = passedCount;
    el.kpiFailCount.textContent = failedCount;
    el.kpiPassProgress.style.width = `${passRate}%`;
  }

  /* ==========================================================================
     Table Rendering & Dynamic Columns
     ========================================================================== */
  function renderTable() {
    const group = getActiveGroup();
    if (!group) return;

    const treatAsZero = state.settings.treatMissingAsZero;
    const minPass = state.settings.minPassingGrade;

    // 1. Rebuild Headers (Dates Row & Tasks Row)
    // Clear dynamic columns between student col and metrics col
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

    // Append dynamic task columns
    group.tasks.forEach((t) => {
      // Date row
      const thDate = document.createElement('th');
      thDate.className = 'font-mono';
      thDate.textContent = t.date || '-';
      el.theadDatesRow.appendChild(thDate);

      // Task name row
      const thTask = document.createElement('th');
      thTask.title = t.name;
      thTask.textContent = t.name;
      el.theadTasksRow.appendChild(thTask);
    });

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
      <th class="col-pinned-right col-avg sortable" id="thStudentAvg">
        <span>Promedio</span>
        <span class="sort-indicator" id="avgSortIndicator">${state.currentSort.startsWith('avg') ? (state.currentSort === 'avg_desc' ? '▼' : '▲') : '⇅'}</span>
      </th>
      <th class="col-pinned-right col-status">
        <span>Condición</span>
      </th>
    `);

    // Attach click sorting to dynamically rebuilt headers
    document.getElementById('thStudentName').addEventListener('click', () => {
      setSort(state.currentSort === 'name_asc' ? 'name_desc' : 'name_asc');
    });
    document.getElementById('thStudentAvg').addEventListener('click', () => {
      setSort(state.currentSort === 'avg_desc' ? 'avg_asc' : 'avg_desc');
    });

    // 2. Filter & Sort Student List
    let list = [...group.students];

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
      list = list.filter(s => computeStudentAverage(s, group.tasks, treatAsZero) >= minPass);
    } else if (state.currentFilter === 'failed') {
      list = list.filter(s => computeStudentAverage(s, group.tasks, treatAsZero) < minPass);
    }

    // Sorting
    list.sort((a, b) => {
      const avgA = computeStudentAverage(a, group.tasks, treatAsZero);
      const avgB = computeStudentAverage(b, group.tasks, treatAsZero);

      if (state.currentSort === 'name_asc') {
        return (a.apellidos || a.fullName).localeCompare(b.apellidos || b.fullName, 'es', { sensitivity: 'base' });
      }
      if (state.currentSort === 'name_desc') {
        return (b.apellidos || b.fullName).localeCompare(a.apellidos || a.fullName, 'es', { sensitivity: 'base' });
      }
      if (state.currentSort === 'avg_desc') {
        return avgB - avgA;
      }
      if (state.currentSort === 'avg_asc') {
        return avgA - avgB;
      }
      return 0;
    });

    // Update counts
    const allStudents = group.students;
    el.countAll.textContent = allStudents.length;
    el.countPassed.textContent = allStudents.filter(s => computeStudentAverage(s, group.tasks, treatAsZero) >= minPass).length;
    el.countFailed.textContent = allStudents.filter(s => computeStudentAverage(s, group.tasks, treatAsZero) < minPass).length;

    // 3. Render Body Rows
    el.gradesTableBody.innerHTML = '';
    if (list.length === 0) {
      el.tableSearchEmpty.classList.remove('hidden');
      return;
    }
    el.tableSearchEmpty.classList.add('hidden');

    list.forEach((student, index) => {
      const avg = computeStudentAverage(student, group.tasks, treatAsZero);
      const isPassed = avg >= minPass;

      const tr = document.createElement('tr');

      let rowHtml = `
        <td class="col-pinned col-idx">${index + 1}</td>
        <td class="col-pinned col-student">
          <span class="student-row-name">${escapeHtml(student.fullName)}</span>
        </td>
      `;

      // Task grades
      group.tasks.forEach(t => {
        const val = student.grades[t.id];
        if (val !== null && val !== undefined) {
          const isZero = val === 0;
          rowHtml += `<td class="grade-cell ${isZero ? 'grade-zero' : ''}">${val.toFixed(1)}</td>`;
        } else {
          rowHtml += `<td class="grade-cell grade-unsubmitted">${treatAsZero ? '0.0' : '-'}</td>`;
        }
      });

      // Individual average & status
      rowHtml += `
        <td class="col-pinned-right col-avg student-avg-cell ${isPassed ? 'text-success' : 'text-danger'}">
          ${avg.toFixed(1)}
        </td>
        <td class="col-pinned-right col-status">
          <span class="badge-status ${isPassed ? 'badge-status-pass' : 'badge-status-fail'}">
            ${isPassed ? 'Acreditado' : 'Reprobado'}
          </span>
        </td>
      `;

      tr.innerHTML = rowHtml;
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
    el.sidebarGroupCount.textContent = state.groups.length;
    el.groupsNavList.innerHTML = '';

    state.groups.forEach(group => {
      const item = document.createElement('div');
      item.className = `nav-group-item ${group.id === state.activeGroupId ? 'active' : ''}`;
      item.innerHTML = `
        <span class="group-item-name" title="${escapeHtml(group.name)}">${escapeHtml(group.name)}</span>
        <span class="group-item-count">${group.students.length} al.</span>
      `;

      item.addEventListener('click', () => {
        selectGroup(group.id);
      });

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

  function deleteCurrentGroup() {
    if (!state.activeGroupId) return;
    const group = getActiveGroup();
    if (!confirm(`¿Eliminar el grupo "${group.name}"?`)) return;

    state.groups = state.groups.filter(g => g.id !== state.activeGroupId);
    state.activeGroupId = state.groups.length > 0 ? state.groups[0].id : null;

    persistState();
    renderSidebar();
    updateDashboard();
    renderTable();
    showToast('Grupo eliminado');
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

    // Filter tabs
    document.querySelectorAll('.filter-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.currentFilter = tab.getAttribute('data-filter');
        renderTable();
      });
    });

    // Delete Group Button
    el.btnDeleteCurrentGroup.addEventListener('click', deleteCurrentGroup);

    // Export button
    el.btnExportGroup.addEventListener('click', exportActiveGroupToExcel);

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
    const minPass = state.settings.minPassingGrade;

    // Build rows adhering to clean spreadsheet standards
    const rows = [];
    
    // Row 1: Dates
    const rowDates = ['FECHAS DE ENTREGA', ''];
    group.tasks.forEach(t => rowDates.push(t.date || ''));
    rowDates.push('PROMEDIO');
    rowDates.push('CONDICIÓN');
    rows.push(rowDates);

    // Row 2: Task Names
    const rowTasks = ['APELLIDOS', 'NOMBRES'];
    group.tasks.forEach(t => rowTasks.push(t.name));
    rowTasks.push('PROMEDIO INDIVIDUAL');
    rowTasks.push('ESTADO');
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
    const allAvgs = group.students.map(s => computeStudentAverage(s, group.tasks, treatAsZero));
    const groupAvg = allAvgs.length > 0 ? (allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length) : 0;
    rowAvgSummary.push(Math.round(groupAvg * 10) / 10);
    rowAvgSummary.push('-');
    rows.push(rowAvgSummary);

    // Rows 4+: Students
    group.students.forEach(s => {
      const avg = computeStudentAverage(s, group.tasks, treatAsZero);
      const studentRow = [s.apellidos, s.nombres];
      group.tasks.forEach(t => {
        const val = s.grades[t.id];
        studentRow.push(val !== null ? val : (treatAsZero ? 0 : ''));
      });
      studentRow.push(avg);
      studentRow.push(avg >= minPass ? 'Acreditado' : 'Reprobado');
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
