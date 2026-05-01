const passportLogin = require('./localStrategy');
const ldapLogin = require('./ldapStrategy');
const jwtLogin = require('./jwtStrategy');

module.exports = {
  passportLogin,
  ldapLogin,
  jwtLogin,
};
