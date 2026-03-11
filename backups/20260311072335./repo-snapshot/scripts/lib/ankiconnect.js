const http = require('http');

const ANKICONNECT_HOST = '127.0.0.1';
const ANKICONNECT_PORT = 8765;

/**
 * Make a request to the AnkiConnect API
 * @param {string} action - The AnkiConnect action name
 * @param {object} params - The parameters for the action
 * @returns {Promise<any>} The result from AnkiConnect
 * @throws {Error} If the request fails or AnkiConnect returns an error
 */
function request(action, params = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      action,
      version: 6,
      params,
    });

    const options = {
      hostname: ANKICONNECT_HOST,
      port: ANKICONNECT_PORT,
      path: '/',
      method: 'POST',
      agent: false, // disable keep-alive pooling; AnkiConnect closes connections between requests
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Origin': 'http://127.0.0.1',
        'Connection': 'close',
      },
    };

    const req = http.request(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`AnkiConnect request failed with status ${res.statusCode}`));
        return;
      }

      const chunks = [];

      res.on('data', (chunk) => {
        chunks.push(chunk);
      });

      res.on('end', () => {
        try {
          const data = Buffer.concat(chunks).toString();
          const response = JSON.parse(data);
          if (response.error) {
            reject(new Error(`AnkiConnect error: ${response.error}`));
          } else {
            resolve(response.result);
          }
        } catch (err) {
          reject(new Error(`Failed to parse AnkiConnect response: ${err.message}`));
        }
      });
    });

    req.setTimeout(5000, () => {
      req.destroy(new Error('AnkiConnect request timed out'));
    });

    req.on('error', (err) => {
      reject(new Error(`Failed to connect to AnkiConnect at ${ANKICONNECT_HOST}:${ANKICONNECT_PORT}: ${err.message}`));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Verify that AnkiConnect is reachable
 * @returns {Promise<void>}
 * @throws {Error} If AnkiConnect is not reachable
 */
async function checkConnection() {
  try {
    await request('version');
  } catch (err) {
    throw new Error(`AnkiConnect is not reachable. Make sure Anki is running with AnkiConnect add-on enabled. Details: ${err.message}`);
  }
}

/**
 * Get all available note type (model) names
 * @returns {Promise<string[]>} Array of note type names
 */
async function modelNames() {
  return request('modelNames');
}

/**
 * Get the templates for a note type
 * @param {string} modelName - The name of the note type
 * @returns {Promise<object>} The templates object containing card template HTML
 */
async function modelTemplates(modelName) {
  return request('modelTemplates', { modelName });
}

/**
 * Get the styling (CSS) for a note type
 * @param {string} modelName - The name of the note type
 * @returns {Promise<string>} The CSS string for the note type
 */
async function modelStyling(modelName) {
  return request('modelStyling', { modelName });
}

/**
 * Update the templates for a note type
 * @param {string} modelName - The name of the note type
 * @param {object} templates - The templates object with updated HTML
 * @returns {Promise<void>}
 */
async function updateModelTemplates(modelName, templates) {
  await request('updateModelTemplates', {
    model: {
      name: modelName,
      templates,
    },
  });
}

/**
 * Update the styling (CSS) for a note type
 * @param {string} modelName - The name of the note type
 * @param {string} css - The CSS string to apply to the note type
 * @returns {Promise<void>}
 */
async function updateModelStyling(modelName, css) {
  await request('updateModelStyling', {
    model: {
      name: modelName,
      css,
    },
  });
}

module.exports = {
  checkConnection,
  modelNames,
  modelTemplates,
  modelStyling,
  updateModelTemplates,
  updateModelStyling,
};
