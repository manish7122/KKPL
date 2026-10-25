const { app, initDatabase } = require('../server');

let databaseReady;

module.exports = async (req, res) => {
  try {
    databaseReady = databaseReady || initDatabase();
    await databaseReady;
    app(req, res);
  } catch (error) {
    console.error('Could not initialize the database:', error);
    res.status(500).json({ error: 'The application could not connect to its database.' });
  }
};
