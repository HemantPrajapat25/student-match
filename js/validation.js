/**
 * validation.js — Real-time form validators
 */

/** Email regex RFC-5322 simplified */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate an email string.
 * @param {string} email
 * @returns {{ valid: boolean, message: string }}
 */
export function validateEmail(email = '') {
  if (!email.trim()) return { valid: false, message: 'Email is required.' };
  if (!EMAIL_RE.test(email.trim())) return { valid: false, message: 'Enter a valid email address.' };
  return { valid: true, message: '' };
}

/**
 * Validate a required text field.
 * @param {string} value
 * @param {string} label - Field name for messages
 * @param {number} min   - Min char length
 * @param {number} max   - Max char length
 */
export function validateText(value = '', label = 'This field', min = 1, max = 300) {
  const v = value.trim();
  if (!v) return { valid: false, message: `${label} is required.` };
  if (v.length < min) return { valid: false, message: `${label} must be at least ${min} characters.` };
  if (v.length > max) return { valid: false, message: `${label} must be under ${max} characters.` };
  return { valid: true, message: '' };
}

/**
 * Validate that an array has at least `min` items.
 * @param {Array}  arr
 * @param {string} label
 * @param {number} min
 */
export function validateMultiSelect(arr = [], label = 'Selection', min = 1) {
  if (arr.length < min) return { valid: false, message: `Select at least ${min} ${label}.` };
  return { valid: true, message: '' };
}

/**
 * Show inline validation error on a field.
 * @param {HTMLElement} input
 * @param {string}      message - '' to clear error
 */
export function showFieldError(input, message = '') {
  if (!input) return;
  const group = input.closest('.form-group');
  const errorEl = group?.querySelector('.form-error');
  if (message) {
    input.setAttribute('aria-invalid', 'true');
    if (errorEl) { errorEl.textContent = message; errorEl.classList.add('visible'); }
  } else {
    input.removeAttribute('aria-invalid');
    if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('visible'); }
  }
}

/**
 * Attach a live character counter to a textarea.
 * @param {HTMLTextAreaElement} textarea
 * @param {number} min
 * @param {number} max
 * @param {HTMLElement} counterEl - Element to update
 */
export function attachCharCounter(textarea, min, max, counterEl) {
  const update = () => {
    const len = textarea.value.length;
    counterEl.textContent = `${len} / ${max}`;
    counterEl.className = 'char-counter';
    if (len < min)      counterEl.classList.add('error');
    else if (len > max) counterEl.classList.add('error');
    else if (len > max * 0.9) counterEl.classList.add('warn');
    else                counterEl.classList.add('ok');
  };
  textarea.addEventListener('input', update);
  update();
}

/**
 * Run all validators for step 1 of registration (name, email).
 * @param {{ name:string, email:string }} data
 * @param {Function} emailExistsFn - Check if email already in store
 * @returns {string[]} Array of error messages (empty = valid)
 */
export function validateStep1(data, emailExistsFn) {
  const errors = [];
  const name = validateText(data.name, 'Name', 2, 80);
  if (!name.valid) errors.push(name.message);
  const email = validateEmail(data.email);
  if (!email.valid) errors.push(email.message);
  else if (emailExistsFn(data.email)) errors.push('This email is already registered.');
  return errors;
}

/**
 * Validate step 2 (field + goals).
 * @param {{ field:string, goals:string[] }} data
 * @returns {string[]}
 */
export function validateStep2(data) {
  const errors = [];
  if (!data.field) errors.push('Please select a field of study.');
  const goals = validateMultiSelect(data.goals, 'career goals', 2);
  if (!goals.valid) errors.push(goals.message);
  return errors;
}

/**
 * Validate step 3 (timezone, availability, bio, preferredStyle).
 * @param {{ timezone:string, availabilityHrs:number, bio:string, preferredStyle:string }} data
 * @returns {string[]}
 */
export function validateStep3(data) {
  const errors = [];
  if (!data.timezone) errors.push('Please select a timezone.');
  if (!data.availabilityHrs) errors.push('Please select your weekly availability.');
  const bio = validateText(data.bio, 'Bio', 50, 300);
  if (!bio.valid) errors.push(bio.message);
  if (!data.preferredStyle) errors.push('Please select a mentoring style preference.');
  return errors;
}

/**
 * Validate mentor step 2 (expertise, yearsExp, mentoringStyle, bio).
 * @param {{ expertise:string[], yearsExp:number, mentoringStyle:string[], bio:string }} data
 * @returns {string[]}
 */
export function validateMentorStep2(data) {
  const errors = [];
  const exp = validateMultiSelect(data.expertise, 'expertise areas', 2);
  if (!exp.valid) errors.push(exp.message);
  if (!data.yearsExp || isNaN(data.yearsExp)) errors.push('Years of experience is required.');
  const style = validateMultiSelect(data.mentoringStyle, 'mentoring styles', 1);
  if (!style.valid) errors.push(style.message);
  const bio = validateText(data.bio ?? '', 'Bio', 30, 300);
  if (!bio.valid) errors.push(bio.message);
  return errors;
}
