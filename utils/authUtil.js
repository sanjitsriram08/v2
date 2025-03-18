// Constants for defining permission levels using bitwise values
const PERMISSIONS = {
    2: 4, // 100 (superAdmin)
    1: 2, // 010 (admin)
    0: 1  // 001 (user)
};

/**
 * Encode permissions into a single numeric value using bitwise OR
 * @param {boolean} superAdmin - Whether superAdmin is allowed
 * @param {boolean} admin - Whether admin is allowed
 * @param {boolean} user - Whether user is allowed
 * @returns {number} Encoded permissions (bitwise representation)
 */
function encodePermissions(superAdmin, admin, user) {
    let encoded = 0;
    if (superAdmin) encoded |= PERMISSIONS["2"]; // Set superAdmin bit if true
    if (admin) encoded |= PERMISSIONS["1"]; // Set admin bit if true
    if (user) encoded |= PERMISSIONS["0"]; // Set user bit if true
    return encoded; // Returns combined permission value
}

/**
 * Decode a numeric permission value back into an object
 * @param {number} encoded - Encoded permissions
 * @returns {object} Object with boolean values for each role
 */
function decodePermissions(encoded) {
    return {
        superAdmin: !!(encoded & PERMISSIONS["2"]), // Check if superAdmin bit is set
        admin: !!(encoded & PERMISSIONS["1"]), // Check if admin bit is set
        user: !!(encoded & PERMISSIONS["0"]) // Check if user bit is set
    };
}

/**
 * Check if a specific role has access based on encoded permissions
 * @param {number} encoded - Encoded permission value
 * @param {string} role - Role to check (superAdmin, admin, user)
 * @returns {boolean} True if the role has access, otherwise false
 */
function hasAccess(encoded, role) {
    if (!PERMISSIONS[role]) {
        throw new Error(`Invalid role: ${role}`); // Throw error if role is not valid
    }
    return !!(encoded & PERMISSIONS[role.toUpperCase()]); // Check if role's bit is set
}

// Export functions for external use
module.exports = {
    encodePermissions,
    hasAccess
};

