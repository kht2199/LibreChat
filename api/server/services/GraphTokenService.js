const { logger } = require('@librechat/data-schemas');

/**
 * @returns {Promise<never>}
 */
async function getGraphApiToken() {
  logger.warn('[GraphTokenService] OpenID strategy is not available in this build');
  throw new Error('OpenID strategy is not available in this build');
}

module.exports = {
  getGraphApiToken,
};
