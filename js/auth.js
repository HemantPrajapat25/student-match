/**
 * auth.js — Login, register, session management
 */
import { getUser, saveUser, setSession, clearSession, getSession, emailExists } from './store.js';
import { uuid, stringToColor } from './utils.js';

const ADMIN_EMAIL = 'admin@mentor.ai';
const ADMIN_PASS  = 'admin123';

/**
 * Attempt admin login. Returns true on success.
 * @param {string} email
 * @param {string} password
 * @returns {boolean}
 */
export function adminLogin(email, password) {
  if (email.toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASS) {
    setSession(ADMIN_EMAIL);
    sessionStorage.setItem('mm_admin', '1');
    return true;
  }
  return false;
}

/**
 * Check if current session is admin.
 * @returns {boolean}
 */
export function isAdmin() {
  return sessionStorage.getItem('mm_admin') === '1' && getSession() === ADMIN_EMAIL;
}

/**
 * Register a new student user.
 * @param {Object} formData - All profile fields
 * @returns {{ success:boolean, error?:string, user?:Object }}
 */
export function registerStudent(formData) {
  const email = formData.email.trim().toLowerCase();
  if (emailExists(email)) {
    return { success: false, error: 'An account with this email already exists.' };
  }
  const user = {
    id:        uuid(),
    email,
    role:      'student',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status:    'active',
    password:  '0000',
    profile: {
      name:            formData.name.trim(),
      field:           formData.field,
      year:            formData.year ?? '',
      goals:           formData.goals ?? [],
      skillsWanted:    formData.skillsWanted ?? [],
      timezone:        formData.timezone,
      availabilityHrs: Number(formData.availabilityHrs),
      preferredStyle:  formData.preferredStyle,
      bio:             formData.bio.trim(),
      savedMentors:    [],
      avatarColor:     stringToColor(email),
    },
  };
  saveUser(user);
  setSession(email);
  return { success: true, user };
}

/**
 * Register a new mentor user.
 * @param {Object} formData
 * @returns {{ success:boolean, error?:string, user?:Object }}
 */
export function registerMentor(formData) {
  const email = formData.email.trim().toLowerCase();
  if (emailExists(email)) {
    return { success: false, error: 'An account with this email already exists.' };
  }
  const user = {
    id:        uuid(),
    email,
    role:      'mentor',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status:    'active',
    profile: {
      name:            formData.name.trim(),
      role:            formData.jobTitle ?? '',
      company:         formData.company ?? '',
      expertise:       formData.expertise ?? [],
      yearsExp:        Number(formData.yearsExp),
      mentoringStyle:  formData.mentoringStyle ?? [],
      capacity:        Number(formData.capacity ?? 3),
      timezone:        formData.timezone,
      availabilityHrs: Number(formData.availabilityHrs),
      bio:             formData.bio.trim(),
      avatarColor:     stringToColor(email),
      onlineStatus:    'online',
    },
  };
  saveUser(user);
  setSession(email);
  return { success: true, user };
}

/**
 * Simple login: just checks if user exists (no passwords for demo).
 * In production replace with hashed password check.
 * @param {string} email
 * @returns {{ success:boolean, user?:Object, error?:string }}
 */
export function login(email, password) {
  const user = getUser(email.trim().toLowerCase());
  if (!user) return { success: false, error: 'No account found with that email.' };
  if (user.status === 'inactive') return { success: false, error: 'This account has been deactivated.' };
  
  if (user.password && user.password !== password) {
    return { success: false, error: 'Incorrect password.' };
  }
  
  setSession(user.email);
  if (user.role === 'admin') sessionStorage.setItem('mm_admin', '1');
  return { success: true, user };
}

/**
 * Log out the current user.
 */
export function logout() {
  clearSession();
  window.location.href = 'index.html';
}

/**
 * Guard: redirect to index if not logged in.
 * @param {string} redirectTo - Page to redirect to if not authed
 */
export function requireAuth(redirectTo = 'index.html') {
  const session = getSession();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  const user = getUser(session);
  if (!user) {
    clearSession();
    window.location.href = redirectTo;
    return null;
  }
  return user;
}

/**
 * Guard: redirect to index if not admin.
 */
export function requireAdmin() {
  if (!isAdmin()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}
