const express = require('express');
const bodyParser = require('body-parser');
const apiRoutes = require('./api'); // Reference to your api.js file

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public')); // Serve static files from the public directory

// Use the API routes
app.use('/api', apiRoutes); // This mounts the routes defined in api.js under the /api path

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});