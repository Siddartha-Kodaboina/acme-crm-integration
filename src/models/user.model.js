/**
 * User Model
 * Simulates a user database for authentication
 * 
 * In a real application, this would be replaced with a database model
 */

// Mock user database
const users = [
  {
    id: '1',
    username: 'admin@acmecrm.com',
    password: 'admin123', // In a real app, this would be hashed
    role: 'admin'
  },
  {
    id: '2',
    username: 'user@acmecrm.com',
    password: 'user123', // In a real app, this would be hashed
    role: 'user'
  }
];

/**
 * Find a user by username
 * @param {string} username - Username to search for
 * @returns {Object|null} User object or null if not found
 * 
 * Example:
 * Input: "admin@acmecrm.com"
 * Output: { id: "1", username: "admin@acmecrm.com", role: "admin" }
 */
function findByUsername(username) {
  const user = users.find(u => u.username === username);
  if (!user) return null;
  
  // Don't return the password in the response
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

/**
 * Validate user credentials
 * @param {string} username - Username to validate
 * @param {string} password - Password to validate
 * @returns {Object|null} User object without password or null if invalid
 * 
 * Example:
 * Input: "admin@acmecrm.com", "admin123"
 * Output: { id: "1", username: "admin@acmecrm.com", role: "admin" }
 */
function validateCredentials(username, password) {
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return null;
  
  // Don't return the password in the response
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

/**
 * Find a user by ID
 * @param {string} id - User ID to search for
 * @returns {Object|null} User object or null if not found
 * 
 * Example:
 * Input: "1"
 * Output: { id: "1", username: "admin@acmecrm.com", role: "admin" }
 */
function findById(id) {
  const user = users.find(u => u.id === id);
  if (!user) return null;
  
  // Don't return the password in the response
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

module.exports = {
  findByUsername,
  validateCredentials,
  findById
};
