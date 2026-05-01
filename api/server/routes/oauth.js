const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { ErrorTypes } = require('librechat-data-provider');

const router = express.Router();

const domains = {
  client: process.env.DOMAIN_CLIENT,
};

router.get('/error', (req, res) => {
  const errorMessage = req.session?.messages?.pop() || 'Unknown OAuth error';
  logger.error('Error in OAuth authentication:', { message: errorMessage });
  res.redirect(`${domains.client}/login?redirect=false&error=${ErrorTypes.AUTH_FAILED}`);
});

module.exports = router;
