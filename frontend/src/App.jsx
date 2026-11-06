import { useCallback, useEffect, useMemo, useState } from 'react';
import { request, checkHealth, API_URL } from './api.js';
import {
  StudentIcon, DepartmentIcon, SectionIcon, SemesterIcon,
  SearchIcon, PlusIcon, EditIcon, TrashIcon, CloseIcon,
  CheckIcon, AlertIcon, SunIcon, MoonIcon, DatabaseIcon,
  RefreshIcon, SpinnerIcon
} from './Icons.jsx';

const emptyStudent = {
  studentId: '',
  name: '',
  email: '',
  department: '',
  section: '',
  semester: '1',
  contact: ''
};

// Generates consistent soft gradient colors based on a string (for student avatars)
function getAvatarGradient(name = '') {
  const gradients = [
    'linear-gradient(135deg, #6366f1, #8b5cf6)',
    'linear-gradient(135deg, #3b82f6, #06b6d4)',
    'linear-gradient(135deg, #10b981, #14b8a6)',
    'linear-gradient(135deg, #f59e0b, #ef4444)',
    'linear-gradient(135deg, #ec4899, #8b5cf6)',
    'linear-gradient(135deg, #0ea5e9, #6366f1)'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const index = Math.abs(hash) % gradients.length;
  return gradients[index];
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (!parts[0]) return 'S';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function App() {
  const [page, setPage] = useState('overview');
  const [students, setStudents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null); // { type: 'success'|'error', text: '' }
  const [query, setQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [isDbOnline, setIsDbOnline] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('campusdesk_theme') || 'dark');

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('campusdesk_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
  };

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, dRes, dbHealthy] = await Promise.all([
        request('/api/students'),
        request('/api/departments'),
        checkHealth()
      ]);
      setStudents(sRes.data || []);
      setDepartments(dRes.data || []);
      setIsDbOnline(dbHealthy);
      setError('');
    } catch (e) {
      setError(e.message);
      setIsDbOnline(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keyboard shortcut: Escape to close modals
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (!saving) setForm(null);
        setConfirmDelete(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving]);

  const counts = useMemo(() => {
    const m = {};
    students.forEach((s) => {
      const id = s.department?._id;
      if (id) m[id] = (m[id] || 0) + 1;
    });
    return m;
  }, [students]);

  const availableSections = useMemo(() => {
    if (!deptFilter) return [];
    const dept = departments.find((d) => d._id === deptFilter);
    return dept?.sections || [];
  }, [deptFilter, departments]);

  const visibleStudents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (deptFilter && s.department?._id !== deptFilter) return false;
      if (sectionFilter && s.section !== sectionFilter) return false;
      if (!q) return true;
      const haystack = [
        s.studentId,
        s.name,
        s.email,
        s.department?.name,
        s.section,
        s.contact
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [students, query, deptFilter, sectionFilter]);

  const openStudent = (student = null) => {
    const defaultDept = deptFilter || departments[0]?._id || '';
    const deptObj = departments.find((d) => d._id === defaultDept);
    const defaultSection = deptObj?.sections?.[0] || '';

    setForm({
      type: 'student',
      student,
      formError: '',
      values: student
        ? {
            studentId: student.studentId,
            name: student.name,
            email: student.email,
            department: student.department?._id || '',
            section: student.section || '',
            semester: String(student.semester || 1),
            contact: student.contact || ''
          }
        : {
            ...emptyStudent,
            department: defaultDept,
            section: defaultSection
          }
    });
  };

  const openDepartment = (department = null) => {
    setForm({
      type: 'department',
      department,
      formError: '',
      values: {
        name: department?.name || '',
        sections: department ? department.sections.join(', ') : 'A, B'
      }
    });
  };

  const setField = (k, v, extra = {}) =>
    setForm((f) => ({ ...f, values: { ...f.values, [k]: v, ...extra } }));

  const submitForm = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { type, student, department, values } = form;
      if (type === 'student') {
        const path = student
          ? `/api/students/${encodeURIComponent(student.studentId)}`
          : '/api/students';
        await request(path, {
          method: student ? 'PUT' : 'POST',
          body: JSON.stringify({
            ...values,
            semester: Number(values.semester)
          })
        });
        showToast(student ? `Updated ${values.name} successfully.` : `Added ${values.name} successfully!`);
      } else {
        const sections = [
          ...new Set(
            values.sections
              .split(',')
              .map((s) => s.trim().toUpperCase())
              .filter(Boolean)
          )
        ];
        await request(
          department ? `/api/departments/${department._id}` : '/api/departments',
          {
            method: department ? 'PUT' : 'POST',
            body: JSON.stringify({ name: values.name.trim(), sections })
          }
        );
        showToast(
          department
            ? `Updated department "${values.name}".`
            : `Created department "${values.name}".`
        );
      }
      setForm(null);
      await loadData();
    } catch (err) {
      setForm((f) => ({ ...f, formError: err.message }));
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    const { kind, item } = confirmDelete;
    try {
      const path =
        kind === 'student'
          ? `/api/students/${encodeURIComponent(item.studentId)}`
          : `/api/departments/${item._id}`;
      await request(path, { method: 'DELETE' });
      showToast(`${item.name} has been deleted.`, 'success');
      setConfirmDelete(null);
      await loadData();
    } catch (err) {
      setError(err.message);
      setConfirmDelete(null);
    }
  };

  const sectionsTotal = departments.reduce((n, d) => n + (d.sections?.length || 0), 0);
  const semestersTotal = new Set(students.map((s) => s.semester)).size;

  const currentFormSections = useMemo(() => {
    if (form?.type !== 'student') return [];
    const dept = departments.find((d) => d._id === form?.values?.department);
    return dept?.sections || [];
  }, [form, departments]);

  return (
    <div className="app-shell">
      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type} animate-slide-in`}>
          <div className="toast-icon">
            {toast.type === 'success' ? <CheckIcon size={18} /> : <AlertIcon size={18} />}
          </div>
          <span className="toast-text">{toast.text}</span>
          <button
            className="toast-close"
            onClick={() => setToast(null)}
            aria-label="Close notification"
          >
            <CloseIcon size={16} />
          </button>
          <div className="toast-progress" />
        </div>
      )}

      {/* Navigation Header */}
      <header className="navbar">
        <div className="nav-container">
          <div className="brand-group">
            <div className="brand-logo">
              <StudentIcon size={22} className="brand-icon" />
            </div>
            <div>
              <div className="brand-title">CampusDesk</div>
              <div className="brand-subtitle">Student Information System</div>
            </div>
          </div>

          <div className="nav-center">
            <nav className="tab-pill-nav" aria-label="Main Navigation">
              {[
                { key: 'overview', label: 'Overview', icon: null },
                { key: 'students', label: 'Students', count: students.length },
                { key: 'departments', label: 'Departments', count: departments.length }
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  className={`tab-btn ${page === key ? 'active' : ''}`}
                  onClick={() => {
                    if (key === 'students') {
                      setDeptFilter('');
                      setSectionFilter('');
                      setQuery('');
                    }
                    setPage(key);
                  }}
                >
                  <span>{label}</span>
                  {typeof count === 'number' && <span className="tab-badge">{count}</span>}
                </button>
              ))}
            </nav>
          </div>

          <div className="nav-actions">
            {/* Database Atlas Live Status */}
            <div
              className={`status-pill ${isDbOnline ? 'online' : isDbOnline === false ? 'offline' : 'checking'}`}
              title={`MongoDB Atlas: ${isDbOnline ? 'Connected' : 'Offline'}`}
            >
              <span className="status-dot" />
              <DatabaseIcon size={14} />
              <span className="status-label">
                {isDbOnline ? 'Atlas Connected' : isDbOnline === false ? 'Disconnected' : 'Connecting'}
              </span>
            </div>

            {/* Refresh button */}
            <button
              className="icon-btn"
              onClick={loadData}
              title="Refresh data"
              aria-label="Refresh data"
            >
              <RefreshIcon size={16} className={loading ? 'spin' : ''} />
            </button>

            {/* Dark / Light Toggle */}
            <button
              className="icon-btn theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {error && (
          <div className="banner-alert animate-fade-in" role="alert">
            <AlertIcon size={20} className="alert-icon" />
            <div className="alert-body">
              <strong>Connection Notice:</strong> {error}
            </div>
            <button className="banner-dismiss" onClick={() => setError('')}>
              <CloseIcon size={16} />
            </button>
          </div>
        )}

        {/* ===================== OVERVIEW PAGE ===================== */}
        {page === 'overview' && (
          <div className="page-view animate-fade-in">
            <div className="section-header">
              <div>
                <h1 className="page-title">Dashboard Overview</h1>
                <p className="page-desc">Real-time statistics and quick student management</p>
              </div>
              <button
                className="btn btn-primary shadow-glow"
                onClick={() => openStudent()}
                disabled={!departments.length}
              >
                <PlusIcon size={18} />
                <span>Add Student</span>
              </button>
            </div>

            {/* Stat Cards Grid */}
            <div className="stats-grid">
              <div className="stat-card" onClick={() => setPage('students')}>
                <div className="stat-card-glow" />
                <div className="stat-header">
                  <span className="stat-label">Total Students</span>
                  <div className="stat-icon-wrap indigo">
                    <StudentIcon size={22} />
                  </div>
                </div>
                <div className="stat-value">{loading ? '...' : students.length}</div>
                <div className="stat-footer">
                  <span className="stat-hint">Active enrolled records</span>
                </div>
              </div>

              <div className="stat-card" onClick={() => setPage('departments')}>
                <div className="stat-card-glow" />
                <div className="stat-header">
                  <span className="stat-label">Departments</span>
                  <div className="stat-icon-wrap emerald">
                    <DepartmentIcon size={22} />
                  </div>
                </div>
                <div className="stat-value">{loading ? '...' : departments.length}</div>
                <div className="stat-footer">
                  <span className="stat-hint">Academic faculties</span>
                </div>
              </div>

              <div className="stat-card" onClick={() => setPage('departments')}>
                <div className="stat-card-glow" />
                <div className="stat-header">
                  <span className="stat-label">Active Sections</span>
                  <div className="stat-icon-wrap amber">
                    <SectionIcon size={22} />
                  </div>
                </div>
                <div className="stat-value">{loading ? '...' : sectionsTotal}</div>
                <div className="stat-footer">
                  <span className="stat-hint">Class subdivisions</span>
                </div>
              </div>

              <div className="stat-card" onClick={() => setPage('students')}>
                <div className="stat-card-glow" />
                <div className="stat-header">
                  <span className="stat-label">Active Semesters</span>
                  <div className="stat-icon-wrap cyan">
                    <SemesterIcon size={22} />
                  </div>
                </div>
                <div className="stat-value">{loading ? '...' : semestersTotal}</div>
                <div className="stat-footer">
                  <span className="stat-hint">Cohorts represented</span>
                </div>
              </div>
            </div>

            {/* Recent Students Section */}
            <div className="card-box mt-8">
              <div className="card-box-header">
                <div>
                  <h2 className="card-box-title">Recent Students</h2>
                  <p className="card-box-desc">Latest student records registered in the database</p>
                </div>
                {students.length > 5 && (
                  <button className="btn btn-secondary btn-sm" onClick={() => setPage('students')}>
                    View all {students.length} students →
                  </button>
                )}
              </div>

              {students.length > 0 ? (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Student ID</th>
                        <th>Department</th>
                        <th>Section</th>
                        <th>Semester</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.slice(0, 5).map((s) => (
                        <tr key={s._id} className="table-row-hover">
                          <td>
                            <div className="student-profile">
                              <div
                                className="student-avatar"
                                style={{ background: getAvatarGradient(s.name) }}
                              >
                                {getInitials(s.name)}
                              </div>
                              <div>
                                <div className="student-name">{s.name}</div>
                                <div className="student-email">{s.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge-id">{s.studentId}</span>
                          </td>
                          <td>
                            <span className="badge-dept">{s.department?.name || '—'}</span>
                          </td>
                          <td>
                            <span className="badge-section">{s.section || '—'}</span>
                          </td>
                          <td>
                            <span className="badge-sem">Sem {s.semester}</span>
                          </td>
                          <td className="text-right">
                            <div className="action-buttons">
                              <button
                                className="action-btn edit"
                                title="Edit student"
                                onClick={() => openStudent(s)}
                              >
                                <EditIcon size={15} />
                                <span>Edit</span>
                              </button>
                              <button
                                className="action-btn delete"
                                title="Delete student"
                                onClick={() => setConfirmDelete({ kind: 'student', item: s })}
                              >
                                <TrashIcon size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  loading={loading}
                  title="No students enrolled yet"
                  desc="Get started by adding your first student to the system."
                  action={
                    departments.length > 0 ? (
                      <button className="btn btn-primary" onClick={() => openStudent()}>
                        <PlusIcon size={18} /> Add Student
                      </button>
                    ) : (
                      <button className="btn btn-primary" onClick={() => openDepartment()}>
                        <PlusIcon size={18} /> Create Department First
                      </button>
                    )
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* ===================== STUDENTS PAGE ===================== */}
        {page === 'students' && (
          <div className="page-view animate-fade-in">
            <div className="section-header">
              <div>
                <h1 className="page-title">Students Directory</h1>
                <p className="page-desc">Search, filter, edit and manage all enrolled students</p>
              </div>
              <button
                className="btn btn-primary shadow-glow"
                onClick={() => openStudent()}
                disabled={!departments.length}
              >
                <PlusIcon size={18} />
                <span>Add Student</span>
              </button>
            </div>

            {/* Search & Filter Toolbar */}
            <div className="toolbar-box">
              <div className="search-input-wrap">
                <SearchIcon size={18} className="search-icon" />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search by student name, ID, email or phone..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button className="search-clear-btn" onClick={() => setQuery('')}>
                    <CloseIcon size={16} />
                  </button>
                )}
              </div>

              <div className="filter-group">
                <select
                  className="select-input"
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

                {availableSections.length > 0 && (
                  <select
                    className="select-input"
                    value={sectionFilter}
                    onChange={(e) => setSectionFilter(e.target.value)}
                  >
                    <option value="">All Sections</option>
                    {availableSections.map((sec) => (
                      <option key={sec} value={sec}>
                        Section {sec}
                      </option>
                    ))}
                  </select>
                )}

                {(query || deptFilter || sectionFilter) && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setQuery('');
                      setDeptFilter('');
                      setSectionFilter('');
                    }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* Students Table */}
            <div className="card-box mt-4">
              <div className="card-box-header py-3">
                <span className="results-counter">
                  Showing <strong>{visibleStudents.length}</strong> of{' '}
                  <strong>{students.length}</strong> students
                </span>
              </div>

              {visibleStudents.length > 0 ? (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Student ID</th>
                        <th>Department</th>
                        <th>Section</th>
                        <th>Semester</th>
                        <th>Phone / Contact</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleStudents.map((s) => (
                        <tr key={s._id} className="table-row-hover">
                          <td>
                            <div className="student-profile">
                              <div
                                className="student-avatar"
                                style={{ background: getAvatarGradient(s.name) }}
                              >
                                {getInitials(s.name)}
                              </div>
                              <div>
                                <div className="student-name">{s.name}</div>
                                <div className="student-email">{s.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge-id">{s.studentId}</span>
                          </td>
                          <td>
                            <span className="badge-dept">{s.department?.name || '—'}</span>
                          </td>
                          <td>
                            <span className="badge-section">{s.section || '—'}</span>
                          </td>
                          <td>
                            <span className="badge-sem">Sem {s.semester}</span>
                          </td>
                          <td>
                            <span className="text-contact">{s.contact || '—'}</span>
                          </td>
                          <td className="text-right">
                            <div className="action-buttons">
                              <button
                                className="action-btn edit"
                                title="Edit student"
                                onClick={() => openStudent(s)}
                              >
                                <EditIcon size={15} />
                                <span>Edit</span>
                              </button>
                              <button
                                className="action-btn delete"
                                title="Delete student"
                                onClick={() => setConfirmDelete({ kind: 'student', item: s })}
                              >
                                <TrashIcon size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  loading={loading}
                  title={query || deptFilter ? 'No matching students found' : 'No students found'}
                  desc={
                    query || deptFilter
                      ? 'Try adjusting your search criteria or clearing active filters.'
                      : 'Add your first student to populate this directory.'
                  }
                  action={
                    !query && !deptFilter && departments.length ? (
                      <button className="btn btn-primary" onClick={() => openStudent()}>
                        <PlusIcon size={18} /> Add Student
                      </button>
                    ) : null
                  }
                />
              )}
            </div>
          </div>
        )}

        {/* ===================== DEPARTMENTS PAGE ===================== */}
        {page === 'departments' && (
          <div className="page-view animate-fade-in">
            <div className="section-header">
              <div>
                <h1 className="page-title">Departments & Sections</h1>
                <p className="page-desc">
                  Manage academic faculties, class sections, and student allocations
                </p>
              </div>
              <button
                className="btn btn-primary shadow-glow"
                onClick={() => openDepartment()}
              >
                <PlusIcon size={18} />
                <span>Add Department</span>
              </button>
            </div>

            <div className="card-box mt-4">
              {departments.length > 0 ? (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Department Name</th>
                        <th>Sections</th>
                        <th>Enrolled Students</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departments.map((d) => (
                        <tr key={d._id} className="table-row-hover">
                          <td>
                            <div className="dept-item">
                              <div className="dept-icon-circle">
                                <DepartmentIcon size={18} />
                              </div>
                              <span className="dept-title">{d.name}</span>
                            </div>
                          </td>
                          <td>
                            <div className="section-pill-wrap">
                              {d.sections && d.sections.length > 0 ? (
                                d.sections.map((sec) => (
                                  <span key={sec} className="badge-section">
                                    Section {sec}
                                  </span>
                                ))
                              ) : (
                                <span className="text-muted">None</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="badge-counter">
                              {counts[d._id] || 0} enrolled
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="action-buttons">
                              <button
                                className="action-btn edit"
                                title="Edit department"
                                onClick={() => openDepartment(d)}
                              >
                                <EditIcon size={15} />
                                <span>Edit</span>
                              </button>
                              <button
                                className="action-btn delete"
                                title={
                                  counts[d._id] > 0
                                    ? 'Cannot delete department with enrolled students'
                                    : 'Delete department'
                                }
                                disabled={counts[d._id] > 0}
                                onClick={() => setConfirmDelete({ kind: 'department', item: d })}
                              >
                                <TrashIcon size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  loading={loading}
                  title="No departments found"
                  desc="Create academic departments with assigned class sections."
                  action={
                    <button className="btn btn-primary" onClick={() => openDepartment()}>
                      <PlusIcon size={18} /> Add Department
                    </button>
                  }
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* ===================== FORM MODAL (STUDENT / DEPARTMENT) ===================== */}
      {form && (
        <div
          className="modal-backdrop animate-fade-in"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setForm(null);
          }}
        >
          <div className="modal-dialog animate-scale-in" role="dialog" aria-modal="true">
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge">
                  {form.type === 'student' ? <StudentIcon size={20} /> : <DepartmentIcon size={20} />}
                </div>
                <div>
                  <h3 className="modal-title">
                    {form.type === 'student'
                      ? form.student
                        ? 'Edit Student Record'
                        : 'Add New Student'
                      : form.department
                      ? 'Edit Department'
                      : 'Create New Department'}
                  </h3>
                  <p className="modal-subtitle">
                    {form.type === 'student'
                      ? 'Fill in the information below to save student record.'
                      : 'Specify department faculty name and associated sections.'}
                  </p>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => !saving && setForm(null)}
                aria-label="Close dialog"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            {form.formError && (
              <div className="form-error-alert animate-shake">
                <AlertIcon size={18} />
                <span>{form.formError}</span>
              </div>
            )}

            <form onSubmit={submitForm} className="modal-form">
              {form.type === 'student' ? (
                <>
                  <div className="form-grid-2">
                    <div className="form-field">
                      <label className="field-label">
                        Student ID <span className="req">*</span>
                      </label>
                      <input
                        required
                        maxLength={30}
                        placeholder="e.g. STU2024-001"
                        className="form-input"
                        disabled={Boolean(form.student)}
                        value={form.values.studentId}
                        onChange={(e) => setField('studentId', e.target.value)}
                      />
                      {form.student && (
                        <span className="field-hint">Student ID cannot be changed once created</span>
                      )}
                    </div>

                    <div className="form-field">
                      <label className="field-label">
                        Full Name <span className="req">*</span>
                      </label>
                      <input
                        required
                        maxLength={100}
                        placeholder="e.g. Sarah Connor"
                        className="form-input"
                        value={form.values.name}
                        onChange={(e) => setField('name', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className="form-field">
                      <label className="field-label">
                        Email Address <span className="req">*</span>
                      </label>
                      <input
                        required
                        type="email"
                        maxLength={254}
                        placeholder="e.g. sarah@college.edu"
                        className="form-input"
                        value={form.values.email}
                        onChange={(e) => setField('email', e.target.value)}
                      />
                    </div>

                    <div className="form-field">
                      <label className="field-label">
                        Department <span className="req">*</span>
                      </label>
                      <select
                        required
                        className="form-input"
                        value={form.values.department}
                        onChange={(e) => {
                          const dept = departments.find((d) => d._id === e.target.value);
                          setField('department', e.target.value, {
                            section: dept?.sections?.[0] || ''
                          });
                        }}
                      >
                        <option value="" disabled>Select Department</option>
                        {departments.map((d) => (
                          <option key={d._id} value={d._id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-grid-3">
                    <div className="form-field">
                      <label className="field-label">
                        Section {currentFormSections.length > 0 && <span className="req">*</span>}
                      </label>
                      <select
                        required={currentFormSections.length > 0}
                        disabled={!currentFormSections.length}
                        className="form-input"
                        value={form.values.section}
                        onChange={(e) => setField('section', e.target.value)}
                      >
                        <option value="" disabled={currentFormSections.length > 0}>
                          {currentFormSections.length ? 'Select Section' : 'None Available'}
                        </option>
                        {currentFormSections.map((s) => (
                          <option key={s} value={s}>
                            Section {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label className="field-label">
                        Semester <span className="req">*</span>
                      </label>
                      <select
                        required
                        className="form-input"
                        value={form.values.semester}
                        onChange={(e) => setField('semester', e.target.value)}
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((sem) => (
                          <option key={sem} value={sem}>
                            Semester {sem}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label className="field-label">Phone Contact</label>
                      <input
                        type="tel"
                        maxLength={20}
                        placeholder="+1 555-0199"
                        className="form-input"
                        value={form.values.contact}
                        onChange={(e) => setField('contact', e.target.value)}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-field">
                    <label className="field-label">
                      Department Name <span className="req">*</span>
                    </label>
                    <input
                      required
                      maxLength={80}
                      placeholder="e.g. Mechanical Engineering"
                      className="form-input"
                      value={form.values.name}
                      onChange={(e) => setField('name', e.target.value)}
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label">
                      Sections (comma-separated) <span className="req">*</span>
                    </label>
                    <input
                      required
                      maxLength={500}
                      placeholder="e.g. A, B, C"
                      className="form-input"
                      value={form.values.sections}
                      onChange={(e) => setField('sections', e.target.value)}
                    />
                    <div className="field-hint">
                      Preview sections:{' '}
                      {form.values.sections
                        .split(',')
                        .map((s) => s.trim().toUpperCase())
                        .filter(Boolean)
                        .map((sec) => (
                          <span key={sec} className="badge-section mr-1">
                            {sec}
                          </span>
                        ))}
                    </div>
                  </div>

                  <p className="note-alert">
                    <strong>Note:</strong> Sections that currently have enrolled students cannot be removed.
                  </p>
                </>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={saving}
                  onClick={() => setForm(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <>
                      <SpinnerIcon size={16} />
                      <span>Saving Record...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== DELETE CONFIRMATION MODAL ===================== */}
      {confirmDelete && (
        <div
          className="modal-backdrop animate-fade-in"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setConfirmDelete(null);
          }}
        >
          <div className="modal-dialog modal-sm animate-scale-in" role="alertdialog">
            <div className="confirm-icon-wrap">
              <TrashIcon size={24} />
            </div>
            <h3 className="confirm-title">
              Delete {confirmDelete.kind === 'student' ? 'Student' : 'Department'}?
            </h3>
            <p className="confirm-desc">
              Are you sure you want to delete{' '}
              <strong>"{confirmDelete.item.name}"</strong>
              {confirmDelete.item.studentId ? ` (${confirmDelete.item.studentId})` : ''}? This action
              cannot be undone.
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={executeDelete}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable Empty State component with SVG illustration
function EmptyState({ loading, title, desc, action }) {
  if (loading) {
    return (
      <div className="empty-state animate-pulse">
        <SpinnerIcon size={32} className="spin text-primary mb-3" />
        <h4 className="empty-title">Loading system data...</h4>
        <p className="empty-desc">Fetching latest records from MongoDB Atlas database.</p>
      </div>
    );
  }

  return (
    <div className="empty-state animate-fade-in">
      <div className="empty-icon-wrap">
        <StudentIcon size={36} />
      </div>
      <h4 className="empty-title">{title}</h4>
      <p className="empty-desc">{desc}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export default App;
