'use strict';

const express = require('express');
import { initiateInformer } from './deployHandler'

// Constants
const PORT = 8080;
const HOST = '0.0.0.0';

// App
const app = express();
app.get('/', (req, res) => {
	res.send('Custom controller is running');
});

// initiate controller
initiateInformer()

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);