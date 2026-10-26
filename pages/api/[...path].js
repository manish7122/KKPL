import { app, initDatabase } from '../../server.js';

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true
  }
};

let databaseReady;

export default async function handler(req, res) {
  try {
    if (!databaseReady) {
      const initialization = initDatabase();
      databaseReady = initialization;
      initialization.catch(() => {
        if (databaseReady === initialization) databaseReady = undefined;
      });
    }
    await databaseReady;
    await new Promise((resolve) => {
      res.once('finish', resolve);
      app(req, res);
    });
  } catch (error) {
    console.error('Could not initialize the database:', error);
    res.status(500).json({ error: 'The application could not connect to its database.' });
  }
}
