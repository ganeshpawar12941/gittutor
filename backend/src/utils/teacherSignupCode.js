import crypto from 'crypto';

// In a production environment, you might want to store these in your database
const TEACHER_SIGNUP_CODES = new Set([
    // Generate some random codes for teacher signup
    'TEACHER123',
    'GITTEACHER2023',
    'EDUCATOR456',
    // Add more codes as needed
]);

/**
 * Generate a new teacher signup code
 * @returns {string} A new signup code
 */
export const generateTeacherSignupCode = () => {
    return `TCHR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
};

/**
 * Check if a teacher signup code is valid
 * @param {string} code - The code to validate
 * @returns {boolean} True if the code is valid
 */
export const isValidTeacherSignupCode = (code) => {
    return TEACHER_SIGNUP_CODES.has(code);
};

/**
 * Add a new teacher signup code
 * @param {string} code - The code to add
 */
export const addTeacherSignupCode = (code) => {
    TEACHER_SIGNUP_CODES.add(code);
};

/**
 * Remove a used teacher signup code
 * @param {string} code - The code to remove
 */
export const removeTeacherSignupCode = (code) => {
    TEACHER_SIGNUP_CODES.delete(code);
};
