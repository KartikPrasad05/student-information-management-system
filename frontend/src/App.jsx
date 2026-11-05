import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { request, checkHealth, API_URL } from './api.js';
import {
  IconGraduationCap,
  IconUsers,
  IconBuilding,
  IconLayers,
  IconCalendar,
  IconPlus,
  IconSearch,
  IconX,
  IconEdit,
  IconTrash,
  IconEye,
  IconDownload,
  IconCopy,
  IconCheck,
  IconSun,
  IconMoon,
  IconRefresh,
  IconMail,
  IconPhone,
  IconTable,
  IconGrid,
  IconAlertCircle,
  IconCheckCircle
} from './icons.jsx';

const AVATAR_COLORS = [
  '#4f46e5', '#0284c7', '#059669', '#d97706',
  '#7c3aed', '#db2777', '#2563eb', '#0d9488'
];

function getAvatarColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (!parts.length || !parts[0]) return 'ST';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const emptyStudent = {
  studentId: '',
  name: '',
  email: '',
  department: '',
  section: '',
  semester: '1',
  contact: ''
};

export default function App() {
  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('campusdesk-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  // Navigation & Data state
  const [page, setPage] = useState('overview');
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiStatus, setApiStatus] = useState('connecting'); // 'online' | 'connecting' | 'offline'
  const [errorBanner, setErrorBanner] = useState('');
  const [toast, setToast] = useState(null); // { message, type }

  // Search & Filter state
  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [copiedId, setCopiedId] = useState('');

  // Modals state
  const [studentModal, setStudentModal] = useState(null); // { isOpen, isEdit, values, error, saving }
  const [deptModal, setDeptModal] = useState(null);       // { isOpen, isEdit, deptId, name, sections, newSectionInput, error, saving }
  const [profileModal, setProfileModal] = useState(null); // student object

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('campusdesk-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load backend data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const health = await checkHealth();
      setApiStatus(health.online ? 'online' : 'offline');

      // 1. Fetch Students
      const sRes = await request('/api/students');
      const studentList = Array.isArray(sRes) ? sRes : (sRes.data || []);
      setStudents(studentList);

      // 2. Fetch or dynamically derive Departments
      let deptList = [];
      try {
        const dRes = await request('/api/departments');
        deptList = Array.isArray(dRes) ? dRes : (dRes.data || []);
      } catch {
        // Derive departments directly from enrolled students list
        const uniqueDeptNames = [
          ...new Set(
            studentList
              .map((s) => (typeof s.department === 'string' ? s.department : s.department?.name))
              .filter(Boolean)
          )
        ];
        const defaults = uniqueDeptNames.length
          ? uniqueDeptNames
          : ['Computer Science', 'Information Technology', 'CSE'];
        deptList = defaults.map((name, i) => ({
          _id: name,
          name,
          sections: ['A', 'B']
        }));
      }
      setDepartments(deptList);
      setErrorBanner('');
    } catch (err) {
      setApiStatus('offline');
      setErrorBanner(err.message || 'Failed to connect to the backend server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keyboard navigation & modal dismiss
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (studentModal && !studentModal.saving) setStudentModal(null);
        if (deptModal && !deptModal.saving) setDeptModal(null);
        if (profileModal) setProfileModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [studentModal, deptModal, profileModal]);

  // Calculated department student counts
  const counts = useMemo(() => {
    const map = {};
    students.forEach((s) => {
      const key = typeof s.department === 'string' ? s.department : (s.department?._id || s.department?.name);
      if (key) map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [students]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      const sDept = typeof s.department === 'string' ? s.department : (s.department?._id || s.department?.name);
      if (deptFilter && sDept !== deptFilter) return false;
      if (sectionFilter && s.section !== sectionFilter) return false;
      if (semesterFilter && String(s.semester) !== semesterFilter) return false;
      if (!q) return true;
      const haystack = [
        s.studentId,
        s.name,
        s.email,
        typeof s.department === 'string' ? s.department : s.department?.name,
        s.section,
        s.contact
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [students, query, deptFilter, sectionFilter, semesterFilter]);

  // Available sections for current department filter
  const filterDeptSections = useMemo(() => {
    if (!deptFilter) return [];
    const dept = departments.find((d) => d._id === deptFilter);
    return dept ? dept.sections : [];
  }, [departments, deptFilter]);

  // Copy to clipboard helper
  const copyStudentId = (id) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    showToast(`Copied ${id} to clipboard!`);
    setTimeout(() => setCopiedId(''), 2000);
  };

  // CSV Export
  const exportCSV = () => {
    if (!students.length) {
      showToast('No student data to export.', 'error');
      return;
    }
    const targetList = filteredStudents.length ? filteredStudents : students;
    const headers = ['Student ID', 'Full Name', 'Email', 'Department', 'Section', 'Semester', 'Phone'];
    const rows = targetList.map((s) => [
      `"${s.studentId || ''}"`,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${s.email || ''}"`,
      `"${(s.department?.name || '').replace(/"/g, '""')}"`,
      `"${s.section || ''}"`,
      `"${s.semester || ''}"`,
      `"${s.contact || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `students-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${targetList.length} student records.`);
  };

  // Student Form Handlers
  const openStudentModal = (student = null) => {
    const defaultDept = deptFilter || (departments[0]?.name || departments[0]?._id || 'CSE');
    setStudentModal({
      isOpen: true,
      isEdit: Boolean(student),
      studentObj: student,
      values: student ? {
        studentId: student.studentId,
        name: student.name,
        email: student.email,
        department: typeof student.department === 'string' ? student.department : (student.department?.name || student.department?._id || ''),
        section: student.section || '',
        semester: String(student.semester || '1'),
        contact: student.contact || ''
      } : {
        ...emptyStudent,
        department: defaultDept
      },
      error: '',
      saving: false
    });
  };

  const handleStudentFieldChange = (field, value) => {
    setStudentModal((prev) => {
      const newValues = { ...prev.values, [field]: value };
      if (field === 'department') {
        newValues.section = '';
      }
      return { ...prev, values: newValues };
    });
  };

  const submitStudentForm = async (e) => {
    e.preventDefault();
    if (!studentModal) return;
    setStudentModal((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      const { isEdit, studentObj, values } = studentModal;
      const deptValue = typeof values.department === 'object' ? values.department?.name : values.department;
      const payload = {
        ...values,
        department: deptValue,
        studentId: values.studentId.trim().toUpperCase(),
        semester: Number(values.semester)
      };

      if (isEdit) {
        const targetId = studentObj._id || studentObj.studentId;
        await request(`/api/students/${encodeURIComponent(targetId)}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast(`Student ${values.name} updated.`);
      } else {
        await request('/api/students', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast(`Student ${values.name} added.`);
      }
      setStudentModal(null);
      await loadData();
    } catch (err) {
      setStudentModal((prev) => ({ ...prev, error: err.message, saving: false }));
    }
  };

  const deleteStudent = async (student) => {
    if (!window.confirm(`Are you sure you want to delete student "${student.name}" (${student.studentId})? This cannot be undone.`)) {
      return;
    }
    try {
      const targetId = student._id || student.studentId;
      await request(`/api/students/${encodeURIComponent(targetId)}`, {
        method: 'DELETE'
      });
      showToast(`Student "${student.name}" deleted.`);
      if (profileModal?.studentId === student.studentId) {
        setProfileModal(null);
      }
      await loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Department Form Handlers
  const openDeptModal = (department = null) => {
    setDeptModal({
      isOpen: true,
      isEdit: Boolean(department),
      deptId: department?._id || null,
      name: department?.name || '',
      sections: department?.sections ? [...department.sections] : ['A', 'B'],
      newSectionInput: '',
      error: '',
      saving: false
    });
  };

  const addSectionTag = () => {
    if (!deptModal || !deptModal.newSectionInput.trim()) return;
    const sec = deptModal.newSectionInput.trim().toUpperCase();
    if (!deptModal.sections.includes(sec)) {
      setDeptModal((prev) => ({
        ...prev,
        sections: [...prev.sections, sec],
        newSectionInput: ''
      }));
    } else {
      setDeptModal((prev) => ({ ...prev, newSectionInput: '' }));
    }
  };

  const removeSectionTag = (secToRemove) => {
    setDeptModal((prev) => ({
      ...prev,
      sections: prev.sections.filter((s) => s !== secToRemove)
    }));
  };

  const submitDeptForm = async (e) => {
    e.preventDefault();
    if (!deptModal) return;
    setDeptModal((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      const { isEdit, deptId, name, sections } = deptModal;
      const payload = {
        name: name.trim(),
        sections: [...new Set(sections.map((s) => s.trim()).filter(Boolean))]
      };

      if (isEdit) {
        await request(`/api/departments/${deptId}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showToast(`Department "${name}" updated.`);
      } else {
        await request('/api/departments', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        showToast(`Department "${name}" created.`);
      }
      setDeptModal(null);
      await loadData();
    } catch (err) {
      setDeptModal((prev) => ({ ...prev, error: err.message, saving: false }));
    }
  };

  const deleteDepartment = async (dept) => {
    const studentCount = counts[dept._id] || 0;
    if (studentCount > 0) {
      alert(`Cannot delete "${dept.name}" because ${studentCount} student(s) are currently enrolled in it. Reassign or remove them first.`);
      return;
    }
    if (!window.confirm(`Are you sure you want to delete department "${dept.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      await request(`/api/departments/${dept._id}`, { method: 'DELETE' });
      showToast(`Department "${dept.name}" deleted.`);
      await loadData();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Overview metrics
  const totalSections = departments.reduce((acc, d) => acc + (d.sections?.length || 0), 0);
  const totalSemesters = new Set(students.map((s) => s.semester)).size;
  const modalSelectedDept = departments.find((d) => d._id === studentModal?.values?.department);
  const modalDeptSections = modalSelectedDept?.sections || [];

  return (
    <div className="app-container">
      {/* Sticky Navigation Bar */}
      <header className="navbar">
        <div className="navbar-inner">
          <div className="brand-section" onClick={() => setPage('overview')}>
            <div className="brand-logo">
              <IconGraduationCap size={22} />
            </div>
            <span className="brand-name">
              Student Management System
              <span className="brand-tag">SMS</span>
            </span>
          </div>

          <nav className="nav-tabs" aria-label="Main Navigation">
            <button
              className={`nav-tab-btn ${page === 'overview' ? 'active' : ''}`}
              onClick={() => setPage('overview')}
            >
              <IconLayers size={16} />
              Overview
            </button>
            <button
              className={`nav-tab-btn ${page === 'students' ? 'active' : ''}`}
              onClick={() => setPage('students')}
            >
              <IconUsers size={16} />
              Students
              <span className="tab-badge">{students.length}</span>
            </button>
            <button
              className={`nav-tab-btn ${page === 'departments' ? 'active' : ''}`}
              onClick={() => setPage('departments')}
            >
              <IconBuilding size={16} />
              Departments
              <span className="tab-badge">{departments.length}</span>
            </button>
          </nav>

          <div className="nav-actions">
            <div className="status-pill" title={`API Endpoint: ${API_URL}`}>
              <span className={`status-dot ${apiStatus}`} />
              {apiStatus === 'online' ? 'API Online' : apiStatus === 'connecting' ? 'Connecting...' : 'API Offline'}
            </div>

            <button
              className="icon-btn"
              onClick={loadData}
              title="Refresh data"
              disabled={loading}
            >
              <IconRefresh size={16} className={loading ? 'animate-spin' : ''} />
            </button>

            <button
              className="icon-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? <IconMoon size={17} /> : <IconSun size={17} />}
            </button>

            <button
              className="btn-primary"
              onClick={() => openStudentModal()}
              disabled={!departments.length}
            >
              <IconPlus size={16} />
              Add Student
            </button>
          </div>
        </div>
      </header>

      {/* Main Page Body */}
      <main className="main-content">
        {/* Offline / Reconnect Banner */}
        {errorBanner && (
          <div className="alert-banner error" role="alert">
            <div className="alert-content">
              <IconAlertCircle size={18} />
              <div>
                <strong>Connection Error:</strong> {errorBanner}
              </div>
            </div>
            <button className="btn-secondary" onClick={loadData}>
              Retry Connection
            </button>
          </div>
        )}

        {/* -------------------- OVERVIEW VIEW -------------------- */}
        {page === 'overview' && (
          <div>
            <div className="page-header">
              <div className="page-title-group">
                <h1>Student Management System</h1>
                <p>Welcome to Student Management System. Monitor student statistics, enrollment, and departments.</p>
              </div>
              <div className="page-header-actions">
                <button className="btn-secondary" onClick={exportCSV} disabled={!students.length}>
                  <IconDownload size={15} />
                  Export CSV
                </button>
                <button
                  className="btn-primary"
                  onClick={() => openStudentModal()}
                  disabled={!departments.length}
                >
                  <IconPlus size={16} />
                  New Student
                </button>
              </div>
            </div>

            {/* KPI Stat Cards */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-info">
                  <span className="stat-label">Total Students</span>
                  <span className="stat-value">{students.length}</span>
                  <span className="stat-desc">Enrolled across departments</span>
                </div>
                <div className="stat-icon-wrapper indigo">
                  <IconUsers size={22} />
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-info">
                  <span className="stat-label">Academic Departments</span>
                  <span className="stat-value">{departments.length}</span>
                  <span className="stat-desc">Active faculties</span>
                </div>
                <div className="stat-icon-wrapper emerald">
                  <IconBuilding size={22} />
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-info">
                  <span className="stat-label">Class Sections</span>
                  <span className="stat-value">{totalSections}</span>
                  <span className="stat-desc">Active course sections</span>
                </div>
                <div className="stat-icon-wrapper sky">
                  <IconLayers size={22} />
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-info">
                  <span className="stat-label">Semesters Represented</span>
                  <span className="stat-value">{totalSemesters}</span>
                  <span className="stat-desc">Active semester cohorts</span>
                </div>
                <div className="stat-icon-wrapper amber">
                  <IconCalendar size={22} />
                </div>
              </div>
            </div>

            {/* Department Enrollment Proportional Bar */}
            {departments.length > 0 && students.length > 0 && (
              <div className="distribution-card">
                <div className="distribution-header">
                  <h3>Enrollment Distribution by Department</h3>
                  <span>{students.length} total students</span>
                </div>
                <div className="progress-bar-container">
                  {departments.map((dept, index) => {
                    const count = counts[dept._id] || 0;
                    if (!count) return null;
                    const pct = ((count / students.length) * 100).toFixed(1);
                    const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
                    return (
                      <div
                        key={dept._id}
                        className="progress-bar-segment"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                        title={`${dept.name}: ${count} students (${pct}%)`}
                      />
                    );
                  })}
                </div>
                <div className="distribution-legend">
                  {departments.map((dept, index) => {
                    const count = counts[dept._id] || 0;
                    const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
                    return (
                      <div key={dept._id} className="legend-item">
                        <span className="legend-dot" style={{ backgroundColor: color }} />
                        <span><strong>{dept.name}</strong> ({count})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Actions Bar */}
            <div className="overview-action-bar">
              <h3>Administrative Shortcuts</h3>
              <div className="action-buttons-group">
                <button
                  className="btn-secondary"
                  onClick={() => openDeptModal()}
                >
                  <IconBuilding size={15} />
                  Add Department
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setPage('students')}
                >
                  <IconUsers size={15} />
                  Browse Student Directory
                </button>
                <button
                  className="btn-secondary"
                  onClick={exportCSV}
                  disabled={!students.length}
                >
                  <IconDownload size={15} />
                  Download Records (.csv)
                </button>
              </div>
            </div>

            {/* Recent Students Section */}
            <div className="page-header" style={{ marginBottom: '14px' }}>
              <div className="page-title-group">
                <h2 style={{ fontSize: '18px', fontWeight: '700' }}>Recently Enrolled Students</h2>
              </div>
              {students.length > 5 && (
                <button className="btn-secondary" onClick={() => setPage('students')}>
                  View All {students.length} Students &rarr;
                </button>
              )}
            </div>

            {students.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Student ID</th>
                      <th>Department</th>
                      <th>Section</th>
                      <th>Semester</th>
                      <th>Contact</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.slice(0, 5).map((s) => (
                      <StudentTableRow
                        key={s._id}
                        student={s}
                        copiedId={copiedId}
                        onCopyId={copyStudentId}
                        onView={setProfileModal}
                        onEdit={openStudentModal}
                        onDelete={deleteStudent}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                loading={loading}
                title="No Students Enrolled Yet"
                subtitle="Get started by adding your first student record to the system."
                actionText="Add Student"
                onAction={() => openStudentModal()}
              />
            )}
          </div>
        )}

        {/* -------------------- STUDENTS VIEW -------------------- */}
        {page === 'students' && (
          <div>
            <div className="page-header">
              <div className="page-title-group">
                <h1>Student Directory</h1>
                <p>
                  Showing {filteredStudents.length} of {students.length} students enrolled
                </p>
              </div>
              <div className="page-header-actions">
                <button className="btn-secondary" onClick={exportCSV} disabled={!students.length}>
                  <IconDownload size={15} />
                  Export CSV
                </button>
                <button
                  className="btn-primary"
                  onClick={() => openStudentModal()}
                  disabled={!departments.length}
                >
                  <IconPlus size={16} />
                  Add Student
                </button>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="toolbar-card">
              <div className="toolbar-left">
                <div className="search-box">
                  <IconSearch size={16} className="search-icon" />
                  <input
                    type="text"
                    className="search-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name, ID, email, section..."
                  />
                  {query && (
                    <button className="search-clear" onClick={() => setQuery('')}>
                      <IconX size={14} />
                    </button>
                  )}
                </div>

                <select
                  className="filter-select"
                  value={deptFilter}
                  onChange={(e) => {
                    setDeptFilter(e.target.value);
                    setSectionFilter('');
                  }}
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name}
                    </option>
                  ))}
                </select>

                {deptFilter && filterDeptSections.length > 0 && (
                  <select
                    className="filter-select"
                    value={sectionFilter}
                    onChange={(e) => setSectionFilter(e.target.value)}
                  >
                    <option value="">All Sections</option>
                    {filterDeptSections.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                )}

                <select
                  className="filter-select"
                  value={semesterFilter}
                  onChange={(e) => setSemesterFilter(e.target.value)}
                >
                  <option value="">All Semesters</option>
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={String(i + 1)}>
                      Semester {i + 1}
                    </option>
                  ))}
                </select>

                {(query || deptFilter || sectionFilter || semesterFilter) && (
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setQuery('');
                      setDeptFilter('');
                      setSectionFilter('');
                      setSemesterFilter('');
                    }}
                    style={{ height: '38px' }}
                  >
                    <IconX size={14} />
                    Reset
                  </button>
                )}
              </div>

              <div className="toolbar-right">
                <div className="view-switch">
                  <button
                    className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setViewMode('table')}
                    title="Table View"
                  >
                    <IconTable size={16} />
                  </button>
                  <button
                    className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid Cards View"
                  >
                    <IconGrid size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Department notice if empty */}
            {!departments.length && (
              <div className="alert-banner warning" style={{ marginBottom: '16px' }}>
                <div className="alert-content">
                  <IconAlertCircle size={18} />
                  <span>
                    No departments created yet. You must create at least one department before adding students.
                  </span>
                </div>
                <button className="btn-secondary" onClick={() => setPage('departments')}>
                  Go to Departments
                </button>
              </div>
            )}

            {/* Data Render: Table or Grid */}
            {filteredStudents.length > 0 ? (
              viewMode === 'table' ? (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Student ID</th>
                        <th>Department</th>
                        <th>Section</th>
                        <th>Semester</th>
                        <th>Contact</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s) => (
                        <StudentTableRow
                          key={s._id}
                          student={s}
                          copiedId={copiedId}
                          onCopyId={copyStudentId}
                          onView={setProfileModal}
                          onEdit={openStudentModal}
                          onDelete={deleteStudent}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="student-grid">
                  {filteredStudents.map((s) => (
                    <StudentCard
                      key={s._id}
                      student={s}
                      copiedId={copiedId}
                      onCopyId={copyStudentId}
                      onView={setProfileModal}
                      onEdit={openStudentModal}
                      onDelete={deleteStudent}
                    />
                  ))}
                </div>
              )
            ) : (
              <EmptyState
                loading={loading}
                title={students.length ? 'No Matching Students' : 'No Students Found'}
                subtitle={
                  students.length
                    ? 'No students matched your search criteria. Try modifying your filter keywords.'
                    : 'Get started by creating your first student record.'
                }
                actionText={students.length ? 'Clear Filters' : 'Add Student'}
                onAction={
                  students.length
                    ? () => {
                        setQuery('');
                        setDeptFilter('');
                        setSectionFilter('');
                        setSemesterFilter('');
                      }
                    : () => openStudentModal()
                }
              />
            )}
          </div>
        )}

        {/* -------------------- DEPARTMENTS VIEW -------------------- */}
        {page === 'departments' && (
          <div>
            <div className="page-header">
              <div className="page-title-group">
                <h1>Academic Departments</h1>
                <p>
                  Manage college departments, manage sections, and monitor student enrollment counts.
                </p>
              </div>
              <div className="page-header-actions">
                <button className="btn-primary" onClick={() => openDeptModal()}>
                  <IconPlus size={16} />
                  Add Department
                </button>
              </div>
            </div>

            {departments.length > 0 ? (
              <div className="departments-grid">
                {departments.map((dept) => {
                  const enrolledCount = counts[dept._id] || 0;
                  return (
                    <div key={dept._id} className="dept-card">
                      <div className="dept-card-header">
                        <div className="dept-title-group">
                          <div className="dept-icon">
                            <IconBuilding size={20} />
                          </div>
                          <div>
                            <h3 className="dept-card-title">{dept.name}</h3>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              Department ID: {dept._id.substring(dept._id.length - 6).toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="dept-card-sections">
                        <span className="dept-sections-label">
                          Configured Sections ({dept.sections?.length || 0})
                        </span>
                        <div className="dept-sections-chips">
                          {dept.sections?.length ? (
                            dept.sections.map((sec) => (
                              <span key={sec} className="dept-chip">
                                Section {sec}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                              No sections configured
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="dept-card-footer">
                        <div className="dept-student-count">
                          <IconUsers size={16} />
                          <span>
                            <strong>{enrolledCount}</strong> enrolled student{enrolledCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="table-actions">
                          <button
                            className="row-action-btn"
                            onClick={() => openDeptModal(dept)}
                            title="Edit department"
                          >
                            <IconEdit size={16} />
                          </button>
                          <button
                            className="row-action-btn danger"
                            onClick={() => deleteDepartment(dept)}
                            title={
                              enrolledCount > 0
                                ? 'Cannot delete department while students are enrolled'
                                : 'Delete department'
                            }
                          >
                            <IconTrash size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                loading={loading}
                title="No Departments Found"
                subtitle="Create academic departments so you can assign sections and enroll students."
                actionText="Add Department"
                onAction={() => openDeptModal()}
              />
            )}
          </div>
        )}
      </main>

      {/* -------------------- STUDENT ADD/EDIT MODAL -------------------- */}
      {studentModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !studentModal.saving) setStudentModal(null);
          }}
        >
          <div className="modal-dialog" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div className="modal-title-group">
                <IconGraduationCap size={20} style={{ color: 'var(--primary)' }} />
                <h2 className="modal-title">
                  {studentModal.isEdit ? 'Edit Student Record' : 'Enroll New Student'}
                </h2>
              </div>
              <button
                className="icon-btn"
                onClick={() => setStudentModal(null)}
                disabled={studentModal.saving}
              >
                <IconX size={16} />
              </button>
            </div>

            <form onSubmit={submitStudentForm}>
              <div className="modal-body">
                {studentModal.error && (
                  <div className="alert-banner error" style={{ margin: 0 }}>
                    <IconAlertCircle size={16} />
                    <span>{studentModal.error}</span>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Student ID <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      maxLength="30"
                      disabled={studentModal.isEdit || studentModal.saving}
                      placeholder="e.g. CS2024-001"
                      value={studentModal.values.studentId}
                      onChange={(e) => handleStudentFieldChange('studentId', e.target.value.toUpperCase())}
                    />
                    <span className="form-hint">Unique academic identifier.</span>
                  </div>

                  <div className="form-group">
                    <label>
                      Full Name <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      maxLength="100"
                      disabled={studentModal.saving}
                      placeholder="e.g. Eleanor Vance"
                      value={studentModal.values.name}
                      onChange={(e) => handleStudentFieldChange('name', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>
                    Email Address <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="email"
                    className="form-input"
                    required
                    maxLength="254"
                    disabled={studentModal.saving}
                    placeholder="student@campus.edu"
                    value={studentModal.values.email}
                    onChange={(e) => handleStudentFieldChange('email', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>
                    Department <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select
                    className="form-select"
                    required
                    disabled={studentModal.saving}
                    value={studentModal.values.department}
                    onChange={(e) => handleStudentFieldChange('department', e.target.value)}
                  >
                    <option value="" disabled>Select department</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Section {modalDeptSections.length > 0 && <span style={{ color: 'var(--danger)' }}>*</span>}
                    </label>
                    <select
                      className="form-select"
                      required={modalDeptSections.length > 0}
                      disabled={!modalDeptSections.length || studentModal.saving}
                      value={studentModal.values.section}
                      onChange={(e) => handleStudentFieldChange('section', e.target.value)}
                    >
                      <option value="" disabled={modalDeptSections.length > 0}>
                        {modalDeptSections.length ? 'Select section' : 'None available'}
                      </option>
                      {modalDeptSections.map((sec) => (
                        <option key={sec} value={sec}>
                          Section {sec}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>
                      Semester <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <select
                      className="form-select"
                      required
                      disabled={studentModal.saving}
                      value={studentModal.values.semester}
                      onChange={(e) => handleStudentFieldChange('semester', e.target.value)}
                    >
                      {[...Array(12)].map((_, i) => (
                        <option key={i + 1} value={String(i + 1)}>
                          Semester {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Contact Phone (Optional)</label>
                  <input
                    type="tel"
                    className="form-input"
                    maxLength="20"
                    disabled={studentModal.saving}
                    placeholder="+1 (555) 000-0000"
                    value={studentModal.values.contact}
                    onChange={(e) => handleStudentFieldChange('contact', e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={studentModal.saving}
                  onClick={() => setStudentModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={studentModal.saving}
                >
                  {studentModal.saving ? 'Saving...' : studentModal.isEdit ? 'Save Changes' : 'Enroll Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- DEPARTMENT ADD/EDIT MODAL -------------------- */}
      {deptModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !deptModal.saving) setDeptModal(null);
          }}
        >
          <div className="modal-dialog" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div className="modal-title-group">
                <IconBuilding size={20} style={{ color: 'var(--primary)' }} />
                <h2 className="modal-title">
                  {deptModal.isEdit ? 'Edit Department' : 'Create Department'}
                </h2>
              </div>
              <button
                className="icon-btn"
                onClick={() => setDeptModal(null)}
                disabled={deptModal.saving}
              >
                <IconX size={16} />
              </button>
            </div>

            <form onSubmit={submitDeptForm}>
              <div className="modal-body">
                {deptModal.error && (
                  <div className="alert-banner error" style={{ margin: 0 }}>
                    <IconAlertCircle size={16} />
                    <span>{deptModal.error}</span>
                  </div>
                )}

                <div className="form-group">
                  <label>
                    Department Name <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    required
                    maxLength="80"
                    disabled={deptModal.saving}
                    placeholder="e.g. Mechanical Engineering"
                    value={deptModal.name}
                    onChange={(e) => setDeptModal((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Class Sections</label>
                  <div className="tags-input-container">
                    {deptModal.sections.map((sec) => (
                      <span key={sec} className="tag-chip">
                        Section {sec}
                        <button
                          type="button"
                          className="tag-remove-btn"
                          onClick={() => removeSectionTag(sec)}
                          title={`Remove section ${sec}`}
                        >
                          <IconX size={13} />
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      className="tag-text-input"
                      placeholder={deptModal.sections.length ? 'Add section...' : 'Type section name & press Enter...'}
                      value={deptModal.newSectionInput}
                      onChange={(e) => setDeptModal((prev) => ({ ...prev, newSectionInput: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',') {
                          e.preventDefault();
                          addSectionTag();
                        }
                      }}
                    />
                    {deptModal.newSectionInput.trim() && (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={addSectionTag}
                        style={{ height: '28px', padding: '0 8px', fontSize: '12px' }}
                      >
                        Add
                      </button>
                    )}
                  </div>
                  <span className="form-hint">
                    Press Enter or comma to add sections (e.g. A, B, C). Sections with enrolled students cannot be removed.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={deptModal.saving}
                  onClick={() => setDeptModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={deptModal.saving}
                >
                  {deptModal.saving ? 'Saving...' : deptModal.isEdit ? 'Update Department' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- STUDENT PROFILE VIEW MODAL -------------------- */}
      {profileModal && (
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setProfileModal(null);
          }}
        >
          <div className="modal-dialog" role="dialog" aria-modal="true">
            <div className="modal-header">
              <span style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-secondary)' }}>
                Student Profile Record
              </span>
              <button className="icon-btn" onClick={() => setProfileModal(null)}>
                <IconX size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="profile-hero">
                <div
                  className="profile-avatar"
                  style={{ backgroundColor: getAvatarColor(profileModal.name) }}
                >
                  {getInitials(profileModal.name)}
                </div>
                <div className="profile-info">
                  <h3>{profileModal.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span
                      className="id-badge"
                      onClick={() => copyStudentId(profileModal.studentId)}
                    >
                      {copiedId === profileModal.studentId ? <IconCheck size={13} /> : <IconCopy size={13} />}
                      {profileModal.studentId}
                    </span>
                    <span className="dept-pill">{typeof profileModal.department === 'string' ? profileModal.department : (profileModal.department?.name || 'Unassigned')}</span>
                  </div>
                </div>
              </div>

              <dl className="profile-grid">
                <div className="profile-item">
                  <dt>Email Address</dt>
                  <dd>
                    <a href={`mailto:${profileModal.email}`} className="contact-link">
                      <IconMail size={14} />
                      {profileModal.email}
                    </a>
                  </dd>
                </div>

                <div className="profile-item">
                  <dt>Phone / Contact</dt>
                  <dd>
                    {profileModal.contact ? (
                      <a href={`tel:${profileModal.contact}`} className="contact-link">
                        <IconPhone size={14} />
                        {profileModal.contact}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Not provided</span>
                    )}
                  </dd>
                </div>

                <div className="profile-item">
                  <dt>Assigned Section</dt>
                  <dd>
                    <span className="section-pill">
                      {profileModal.section ? `Section ${profileModal.section}` : 'None'}
                    </span>
                  </dd>
                </div>

                <div className="profile-item">
                  <dt>Current Semester</dt>
                  <dd>
                    <span className="semester-pill">
                      Semester {profileModal.semester}
                    </span>
                  </dd>
                </div>

                <div className="profile-item">
                  <dt>Record Created</dt>
                  <dd>
                    {profileModal.createdAt
                      ? new Date(profileModal.createdAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })
                      : '—'}
                  </dd>
                </div>

                <div className="profile-item">
                  <dt>Last Updated</dt>
                  <dd>
                    {profileModal.updatedAt
                      ? new Date(profileModal.updatedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })
                      : '—'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-danger"
                onClick={() => deleteStudent(profileModal)}
              >
                <IconTrash size={15} />
                Delete
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const target = profileModal;
                  setProfileModal(null);
                  openStudentModal(target);
                }}
              >
                <IconEdit size={15} />
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? (
              <IconCheckCircle size={18} style={{ color: 'var(--success)' }} />
            ) : (
              <IconAlertCircle size={18} style={{ color: 'var(--danger)' }} />
            )}
            <span className="toast-message">{toast.message}</span>
            <button className="alert-close" onClick={() => setToast(null)}>
              <IconX size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent: Student Table Row
function StudentTableRow({ student, copiedId, onCopyId, onView, onEdit, onDelete }) {
  return (
    <tr>
      <td>
        <div className="student-cell">
          <div
            className="avatar-circle"
            style={{ backgroundColor: getAvatarColor(student.name) }}
          >
            {getInitials(student.name)}
          </div>
          <div className="student-meta">
            <span className="student-name">{student.name}</span>
            <a href={`mailto:${student.email}`} className="student-email">
              {student.email}
            </a>
          </div>
        </div>
      </td>
      <td>
        <span
          className="id-badge"
          onClick={() => onCopyId(student.studentId)}
          title="Click to copy student ID"
        >
          {copiedId === student.studentId ? <IconCheck size={13} /> : <IconCopy size={13} />}
          {student.studentId}
        </span>
      </td>
      <td>
        <span className="dept-pill">{typeof student.department === 'string' ? student.department : (student.department?.name || '—')}</span>
      </td>
      <td>
        <span className="section-pill">{student.section ? `Sec ${student.section}` : '—'}</span>
      </td>
      <td>
        <span className="semester-pill">Sem {student.semester}</span>
      </td>
      <td>
        {student.contact ? (
          <a href={`tel:${student.contact}`} className="contact-link">
            <IconPhone size={13} />
            {student.contact}
          </a>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
      <td>
        <div className="table-actions">
          <button
            className="row-action-btn"
            onClick={() => onView(student)}
            title="View Details"
          >
            <IconEye size={16} />
          </button>
          <button
            className="row-action-btn"
            onClick={() => onEdit(student)}
            title="Edit Student"
          >
            <IconEdit size={16} />
          </button>
          <button
            className="row-action-btn danger"
            onClick={() => onDelete(student)}
            title="Delete Student"
          >
            <IconTrash size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Subcomponent: Student Card (Grid View)
function StudentCard({ student, copiedId, onCopyId, onView, onEdit, onDelete }) {
  return (
    <div className="student-card">
      <div className="card-top">
        <div className="card-identity">
          <div
            className="avatar-circle"
            style={{ backgroundColor: getAvatarColor(student.name) }}
          >
            {getInitials(student.name)}
          </div>
          <div>
            <h4 className="student-name">{student.name}</h4>
            <a href={`mailto:${student.email}`} className="student-email">
              {student.email}
            </a>
          </div>
        </div>
        <span
          className="id-badge"
          onClick={() => onCopyId(student.studentId)}
          title="Click to copy student ID"
        >
          {copiedId === student.studentId ? <IconCheck size={13} /> : <IconCopy size={13} />}
          {student.studentId}
        </span>
      </div>

      <div className="card-badge-row">
        <span className="dept-pill">{typeof student.department === 'string' ? student.department : (student.department?.name || '—')}</span>
        <span className="section-pill">{student.section ? `Sec ${student.section}` : 'No Sec'}</span>
        <span className="semester-pill">Sem {student.semester}</span>
      </div>

      <div className="card-details-list">
        <div className="card-details-row">
          <IconPhone size={13} style={{ color: 'var(--text-muted)' }} />
          <span>{student.contact || 'No phone recorded'}</span>
        </div>
      </div>

      <div className="card-actions">
        <button className="btn-secondary" onClick={() => onView(student)} style={{ padding: '4px 10px', fontSize: '12px' }}>
          <IconEye size={14} />
          View
        </button>
        <button className="btn-secondary" onClick={() => onEdit(student)} style={{ padding: '4px 10px', fontSize: '12px' }}>
          <IconEdit size={14} />
          Edit
        </button>
        <button className="row-action-btn danger" onClick={() => onDelete(student)} title="Delete Student">
          <IconTrash size={15} />
        </button>
      </div>
    </div>
  );
}

// Subcomponent: Empty State
function EmptyState({ loading, title, subtitle, actionText, onAction }) {
  if (loading) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <IconRefresh size={24} className="animate-spin" />
        </div>
        <h3 className="empty-title">Loading Information...</h3>
        <p className="empty-subtitle">Connecting to campus database and fetching records.</p>
      </div>
    );
  }

  return (
    <div className="empty-state">
      <div className="empty-icon">
        <IconUsers size={24} />
      </div>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-subtitle">{subtitle}</p>
      {actionText && onAction && (
        <button className="btn-primary" onClick={onAction} style={{ marginTop: '6px' }}>
          <IconPlus size={15} />
          {actionText}
        </button>
      )}
    </div>
  );
}
