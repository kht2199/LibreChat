const manifest = require('./manifest');

// Structured Tools
const DALLE3 = require('./structured/DALLE3');
const OpenWeather = require('./structured/OpenWeather');
const StructuredWolfram = require('./structured/Wolfram');
const StructuredACS = require('./structured/AzureAISearch');
const StructuredSD = require('./structured/StableDiffusion');
const GoogleSearchAPI = require('./structured/GoogleSearch');
const createOpenAIImageTools = require('./structured/OpenAIImageTools');
const createGeminiImageTool = require('./structured/GeminiImageGen');

module.exports = {
  ...manifest,
  // Structured Tools
  DALLE3,
  OpenWeather,
  StructuredSD,
  StructuredACS,
  GoogleSearchAPI,
  StructuredWolfram,
  createOpenAIImageTools,
  createGeminiImageTool,
};
